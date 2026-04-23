# SPACE_DEBRIES · 项目文档

> 太空垃圾科普交互平台 · 个性化叙事 + AI生成 + 数据可视化

---

## ⚠️ 修改文件后必须验证 API（强制规则）

**每次修改任何文件后，必须立即测试 API 是否仍然可用。如果 API 无法接通，立即用 `git restore` 恢复修改前的状态，不得继续后续工作。**

```bash
curl http://localhost:3001/api/health          # 后端在线
curl http://localhost:3001/api/test-celestrak  # CelesTrak 连通
curl -X POST http://localhost:3001/api/test-gpt  # GPT 连通
```

三条全部返回 `"ok": true` 才算通过。任意失败 → `git restore <文件>` 立即回滚。

---

## ⚠️ API 调用规则（任何模块构建都不得修改）

### 一、为什么当前 API 能正常工作

**根本问题：** Node.js 完全忽略系统代理，原生 `fetch` / `https` 直连会被墙。

**解决方案：** 用 `node-fetch` + `https-proxy-agent` 在后端手动注入代理 agent，所有出站请求强制经过 `127.0.0.1:22307`。

**完整链路：**
```
浏览器 fetch('/api/xxx')          ← 只写相对路径，不带端口
  → Vite dev server :5173          ← vite.config.js 的 proxy 规则
    → Express 后端 :3001           ← npm run dev:server 启动
      → proxiedFetch(外部URL)      ← node-fetch + HttpsProxyAgent
        → 代理 127.0.0.1:22307
          → OpenAI / CelesTrak
```

**核心代码（server/index.js，禁止改动这三行）：**
```js
import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'

const agent = new HttpsProxyAgent(process.env.PROXY_URL)  // http://127.0.0.1:22307
const proxiedFetch = (url, init = {}) => fetch(url, { ...init, agent })
// 所有外部 HTTP 请求必须用 proxiedFetch，绝对不能用原生 fetch/axios
```

**关键陷阱（踩过的坑）：**
- 修改 `server/index.js` 后必须重启服务端。`--watch` 只在 `npm run dev:server` 下生效，手动后台启动的进程不会自动重载。
- 重启方法：`Ctrl+C` 停掉 `npm run dev`，重新运行即可。或用 `netstat -ano | grep 3001` 找 PID 后 `Stop-Process` 杀掉。

---

### 二、AI 服务：OpenAI GPT API

**重要：本项目用 OpenAI，不是 Claude/Anthropic。Key 前缀 `sk-proj-`，存 `server/.env` 的 `OPENAI_API_KEY`，绝对不放前端。**

| 端点 | 方法 | 用途 |
|------|------|------|
| `POST /api/test-gpt` | POST | MVP验证端点，发固定 prompt |
| `POST /api/gpt` | POST | **正式通用入口，所有模块 AI 调用统一走这里** |

**前端调用 `/api/gpt`（所有模块唯一 AI 调用方式）：**
```js
const res = await fetch('/api/gpt', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ systemPrompt, userPrompt, temperature, maxTokens }),
})
const data = await res.json()
// data: { ok, content, inputTokens, outputTokens }
```

**GPT 返回 JSON 的解析陷阱：** GPT 有时会把 JSON 包在 markdown 代码块里（` ```json {...} ``` `）。前端 `ai.js` 里必须用正则提取：
```js
const match = raw.match(/\{[\s\S]*\}/)
if (!match) throw new Error('AI 返回格式异常')
return JSON.parse(match[0])
```

**后端实现（禁止改动结构）：**
```js
app.post('/api/gpt', async (req, res) => {
  const { systemPrompt, userPrompt, temperature = 0.7, maxTokens = 512 } = req.body
  const response = await proxiedFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  const data = JSON.parse(await response.text())
  res.json({ ok: true, content: data.choices?.[0]?.message?.content ?? '' })
})
```

---

### 三、卫星数据：CelesTrak

| 端点 | 方法 | 用途 |
|------|------|------|
| `GET /api/test-celestrak` | GET | MVP验证，拉取 ISS（NORAD 25544）数据 |
| `GET /api/satellite?city=xxx` | GET | 按城市匹配一颗真实 LEO 卫星 |

**已知可用的 CelesTrak URL（satcat 单星查询）：**
```
https://celestrak.org/satcat/records.php?CATNR=25544&FORMAT=json
```

**已知失效的 URL（返回 404，不要再用）：**
```
https://celestrak.org/SPACETRACK/query/class/gp/EPOCH/%3Enow-30/...  ← 404
https://celestrak.org/SPACETRACK/query/class/satcat/CURRENT/Y/...    ← 404
```

**`/api/satellite` 的实现策略（两级降级）：**
1. 先尝试 CelesTrak 在线查询
2. 失败时使用离线备用卫星列表（6颗真实卫星的硬编码数据）
3. 用城市名字符 ASCII 码之和取模，保证同城市始终匹配同一颗卫星

```js
// 备用卫星列表（真实数据，来源 CelesTrak satcat）
const FALLBACK_SATS = [
  { OBJECT_NAME: 'FENGYUN 3D',  NORAD_CAT_ID: 43010, APOGEE: 851, PERIGEE: 820, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH_DATE: '2017-11-15' },
  { OBJECT_NAME: 'TERRA',       NORAD_CAT_ID: 25994, APOGEE: 705, PERIGEE: 694, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH_DATE: '1999-12-18' },
  { OBJECT_NAME: 'AQUA',        NORAD_CAT_ID: 27424, APOGEE: 710, PERIGEE: 697, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH_DATE: '2002-05-04' },
  { OBJECT_NAME: 'SENTINEL-2A', NORAD_CAT_ID: 40697, APOGEE: 790, PERIGEE: 783, INCLINATION: 98.6, PERIOD: 100.6, LAUNCH_DATE: '2015-06-23' },
  { OBJECT_NAME: 'LANDSAT 8',   NORAD_CAT_ID: 39084, APOGEE: 708, PERIGEE: 703, INCLINATION: 98.2, PERIOD:  99.0, LAUNCH_DATE: '2013-02-11' },
  { OBJECT_NAME: 'SUOMI NPP',   NORAD_CAT_ID: 37849, APOGEE: 833, PERIGEE: 826, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH_DATE: '2011-10-28' },
]
// 城市哈希选星：const hash = city.split('').reduce((a,c) => a + c.charCodeAt(0), 0)
// sat = FALLBACK_SATS[hash % FALLBACK_SATS.length]
```

**前端调用：**
```js
fetch(`/api/satellite?city=${encodeURIComponent(city)}`)
// 响应: { ok, satellite: { OBJECT_NAME, NORAD_CAT_ID, APOGEE, PERIGEE, INCLINATION, PERIOD, LAUNCH_DATE }, source }
// source 字段: 'celestrak' 或 'fallback'，用于调试
```

---

### 四、Vite 代理（禁止修改）

```js
// vite.config.js
server: { proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } } }
```

**前端永远只写 `/api/xxx`，不带端口，不带域名。**

---

### 五、环境变量 server/.env

```
OPENAI_API_KEY=sk-proj-...   # OpenAI Key，不是 Anthropic
PROXY_URL=http://127.0.0.1:22307
PORT=3001
```

---

### 六、启动

```bash
npm run dev   # 同时启动前端(Vite:5173) + 后端(Express:3001，带 --watch 自动重载)
```

---

## 一、项目定位

**核心问题：** 公众对航天感兴趣，但对太空垃圾无感。不是没有受众，是现有表达方式没有建立个体相关性。

**解决方式：** 不做传统科普，做个性化体验系统。用户输入真实的个人信息，系统将太空垃圾问题转化为与这个人直接相关的叙事和行动路径。

**一句话定位：**
> 以太空垃圾为主题，以个体相关性为驱动，以可执行行动为输出的个性化科普平台。

---

## 二、用户目标路径

```
不知道 → 知道 → 觉得和自己有关 → 愿意采取某种行动
```

输出分三类：
- **认知型** — 让用户理解太空垃圾与自己的关系
- **情感型** — 通过个性化叙事建立深层连接
- **行动型** — 告诉用户现在能做什么

---

## 三、完整流程结构

### 前测
- 20题知识选择题
- 建立知识/态度/积极性三维基线，存入本地，供后测对比
- AI参与：无（保证测量纯净性）

---

### 入口 ENTRANCE
**用户输入：** 姓名或代号 / 所在城市 / 对自己最重要的一件事

**系统工作：**
1. 从 CelesTrak 按城市纬度匹配一颗真实卫星（TLE数据）
2. GPT 生成故事开头约150字：卫星初始化就绪，平行时空里那件事处于前夜，结尾留悬念

**输出给后续模块：** 姓名+城市+最重要的事（驱动全站AI个性化）/ 卫星TLE+轨道参数

---

### M1 · 太空垃圾是什么
**科普：** 定义与来源 / 三个尺寸层级与数量 / 28,000km/h速度与碰撞当量 / 各国贡献排名

**交互：** 用户为卫星选择主要材料（铝合金 / 钛合金 / 碳纤维 / 太阳能电池板）

**AI工作：** 生成一句话反馈，说明该材料在真实卫星上的使用案例+再入特性

**关键设计：** 这是全站第一个有后果的选择，用户不知道它会影响M4和M5

**输出：** 材料类型 → M4碎片描述 / M5再入叙事 / M6清理技术匹配

*衔接句：「因为那件事，平行宇宙的你，也开始对太空垃圾感兴趣。」*

---

### M2 · 轨道是什么
**科普：** LEO/MEO/GEO三层轨道 / 用户城市上方实时轨道数据 / 该轨道碎片密度现状

**交互：** Three.js 三维地球，用户卫星轨道高亮；用户为卫星选择执行任务（气象/通信/成像/科学）

**AI工作：** 生成故事第二段约150字：卫星执行任务中遭遇轨道早期威胁，某项功能轻微受损，那件事的一个细节悄悄变了

**输出：** 任务类型 → M4游戏背景 / 轨道高度 → M3历史事件碎片云距离计算

*衔接句：「旅行总有终点，那些留下来的，我们总是忘了还有机会。」*

---

### M3 · 重大历史事件
**科普：** 从1957年Sputnik至今的完整太空垃圾历史时间线，含：
- 首次在轨解体 1961
- Kosmos 954核泄漏 1978
- Cerise碰撞 1996
- 风云一号反卫测试 2007
- 铱星-33/Cosmos-2251碰撞 + 凯斯勒效应 2009
- ISS电池托盘坠落 2024

**交互：**
- 用户卫星发射年份前的事件：灰色可浏览
- 发射年份后的事件：激活状态，点击进入沉浸叙事视图

**AI工作：**
- 点击激活事件 → 生成卫星第一视角100字叙事（距碎片云多远/是否机动/传感器记录）
- 全部浏览完 → 生成故事第三段约150字：历史事件在平行时空制造偏移，那件事走向开始不确定

**输出：** 累积受损值 → M4初始护甲 / 点击事件记录 → M4随机事件权重

*衔接句：「不是没有人做过这个决定，是做了这个决定的人，已经不在了。」*

---

### M4 · 卫星生存任务游戏
**科普（通过游戏传递）：** 轨道高度与碎片风险 / 规避机动的燃料代价 / 卫星失效后的碎片生命周期 / 25年离轨规定首次出现

**交互：**
- 每局5-8个决策节点，真实威胁类型随机触发（碎片接近/太阳风暴/轨道衰减/卫星解体）
- 用户选择应对方案 → AI生成即时后果
- 实时显示：护甲值 / 燃料值 / 任务完成度
- 初始护甲值来自M3累积受损

**AI工作（最密集）：**
- 每次决策 → 即时反馈（正确：任务日志+历史数据支撑；错误：故障报告+历史先例）
- 每次决策 → 同步更新平行时空故事
- 游戏结束 → 生成反思页（知识点清单+卫星命运+碎片描述）

**结局分叉：**
- 成功：那件最重要的事被守住
- 失败：那件最重要的事被改写

**输出：** 游戏结局（成功/失败）+ 碎片类型和数量 → M5/M6

---

### M5 · 太空垃圾落地球
**科普：** 再入大气层物理过程（什么材料烧毁/存活）/ 25年离轨规定正式交代 / 历史坠落事件世界地图 / 法律真空：无国家有权强制清除他国碎片

**交互：**
- 动画：卫星25年后开始离轨，燃烧过程与M1材料挂钩
- 文件夹交互：悬浮文件夹内含事件卡片，用户拖出展开（模拟档案室体验）
  - 卡片：1997年Lottie Williams / 2024年佛罗里达 / Kosmos 954 / 其他典型案例
- 世界地图：全球落点可点击

**AI工作：** 根据M4结局生成两版故事结局（约120字），正式收尾平行时空

**输出：** 碎片类型 → M6清理题素材 / 故事结局 → 后测知识卡

*衔接句：「旅行结束了，那些留下来的，我们总是忘了还有机会处理。」*

---

### M6 · 怎么清理太空垃圾
**科普：** 清理四重障碍（速度/数量/法律/成本）/ 三种现实技术（激光消融/帆式减速/机械臂捕获）/ 现实进展：目前无商业规模清理案例

**交互：** 拖拽匹配——针对M4产生的具体碎片，为每种碎片选择最合适的清理技术

**AI工作：**
- 每次拖拽 → 即时反馈（匹配或不匹配的原因）
- 全部完成 → 生成故事尾声约80字：平行时空的用户开始行动，最后一句是开口不是结论

**输出：** 准确率 + 尾声故事 → 后测知识卡

---

### M7 · 科普视频
- 视觉化补充前六个模块核心内容
- 视频结束后AI根据用户卫星生成一个具体问题
- 用户自由作答，AI给出解释（开放对话，最轻量的AI参与形式）

---

### 后测 + 个人知识卡
- 同前测：9题知识题 + 6题积极性量表 + 15题NEP量表（题序打乱）
- 前后得分对比报告（三维度分别显示）
- AI生成个性化知识卡：串联卫星命运 + 那件最重要的事的结局 + 知识提升幅度
- 含关键节点摘要，可截图分享

---

### 第三部分 · 观测教学与社区模块

**定位：** 将用户从被动接受者转变为主动参与者，建立持续参与入口

**核心功能：**

**1. 观测教学**
教用户区分再入火球、流星和航空器的方法：
- 速度特征对比（再入火球更慢、持续时间更长）
- 颜色与碎裂特征
- 轨迹与方向规律
- 配合图示和真实案例视频

**2. 目击报告写作**
提供结构化报告模板（时间/地点/方向/持续时长/颜色/碎裂情况），引导用户规范记录并提交

**3. 社区讨论**
- 用户提交自己的目击报告
- 其他用户可评论与讨论
- 真实事件讨论区（佛罗里达2024、ISS轨道等）
- 连接AMS（美国流星协会）等真实公民科学项目作为参与出口

**设计原则：** 这部分不强制完成，作为对完成主流程用户的延伸入口

---

## 四、数据流与状态

所有模块共享同一个全局状态（Zustand + localStorage持久化），关键字段：

```
user          → 姓名、城市、最重要的事（驱动全站AI）
satellite     → 真实卫星TLE+轨道参数（驱动Three.js可视化）
material      → M1选择 → 影响M4碎片描述、M5再入叙事、M6匹配题
mission       → M2选择 → 影响M4游戏背景
damageLevel   → M3累积 → 影响M4初始护甲值
gameResult    → M4输出 → 影响M5故事结局、M6语气
debrisGenerated → M4输出 → 影响M6匹配题内容
storyChapters → 各模块AI生成后写入，后测知识卡汇总
preTest/postTest → 前后测得分，计算提升幅度
```

---

## 五、技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 框架 | React 18 + Vite | 组件化开发，快速热更新 |
| 路由 | React Router v6 | 模块间导航 |
| 状态 | Zustand + persist | 跨模块全局状态，localStorage持久化 |
| 3D | React Three Fiber + Drei | Three.js封装，M2轨道可视化 |
| 轨道计算 | satellite.js | TLE解析，卫星位置/轨道参数计算 |
| 动画 | Framer Motion | 模块间过渡，UI微交互 |
| 样式 | Tailwind CSS v4 | 原子化CSS，设计Token统一管理 |
| AI | GPT API (GPT-4o-mini) | 全站故事生成与即时反馈 |
| 卫星数据 | CelesTrak | 真实TLE数据，按城市纬度匹配 |
| 埋点 | PostHog + 本地兜底 | 页面浏览、事件追踪、漏斗分析 |

---

## 六、项目文件结构



---

## 八、AI调用原则

- **所有AI调用输出JSON**，字段固定，前端直接解析，不处理自由文本
- **语气规范：** 克制、真实、不煽情，禁用「美丽」「壮阔」等形容词
- **叙事视角：** 第三人称，卫星为主角
- **故事结构：** 进入用户的时刻 → 平行叙事不揭示空间连接 → 最后反转
- **数据驱动：** 所有碎片威胁、轨道数据必须与真实历史数据挂钩，不虚构参数

---

## 九、真实数据锚点

以下事件作为全站科普内容的事实基础，不可虚构细节：

- **2009年 铱星-33/Cosmos-2251碰撞**：首次大型卫星碰撞，产生大量碎片，凯斯勒效应的典型案例
- **1996年 Cerise卫星碎裂**：第一次有记录的在轨碎片碰撞，被阿里亚娜火箭残骸击中
- **1978年 Kosmos 954坠落**：核动力卫星失控坠入加拿大，钛合金结构件散落600公里范围
- **2024年 佛罗里达屋顶穿透事件**：ISS电池托盘碎片穿透民宅屋顶，法律归责悬而未决
- **1997年 Lottie Williams**：唯一有记录被坠落航天器碎片击中的人

---

