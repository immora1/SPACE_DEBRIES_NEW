# SPACE_DEBRIES · CLAUDE.md

> 太空垃圾科普交互平台：个性化叙事 + AI 生成 + 数据可视化

---

## 0. 最重要规则

### 每次改文件后必须验证 API

```bash
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/test-gpt
curl "http://localhost:3001/api/satellite?city=北京&name=test&story=test"
```

三条都返回 `"ok": true` 才算通过。任意失败，立即回滚本次修改：

```bash
git restore <修改过的文件>
```

### 不要破坏现有 API 链路

- 前端只写相对路径：`/api/xxx`，不要写端口或域名。
- 所有 AI 请求统一走：`POST /api/gpt`。
- 卫星数据来自本地 `satellites.json`，不要改回实时调用 Space-Track / CelesTrak。
- 唯一外部依赖是 OpenAI GPT API。
- OpenAI Key 只放 `server/.env`，变量名：`OPENAI_API_KEY`。

---

## 1. API 与代理

Node.js 原生 `fetch` 不会自动走系统代理，所以外部请求必须使用 `proxiedFetch`。

`server/index.js` 中这段结构不要改：

```js
import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'

const agent = new HttpsProxyAgent(process.env.PROXY_URL)
const proxiedFetch = (url, init = {}) => fetch(url, { ...init, agent })
```

禁止直接用原生 `fetch` 或 `axios` 请求外部 API。

请求链路：

```text
浏览器 fetch('/api/xxx')
→ Vite :5173 proxy
→ Express :3001
→ proxiedFetch(外部 URL)
→ PROXY_URL=http://127.0.0.1:22307
→ OpenAI API
```

`server/.env`：

```env
OPENAI_API_KEY=sk-proj-...
PROXY_URL=http://127.0.0.1:22307
PORT=3001
```

启动：

```bash
npm run dev
```

修改 `server/index.js` 后如果未生效，重启 `npm run dev`。

---

## 2. 核心端点

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/health` | GET | 后端健康检查 |
| `/api/test-gpt` | POST | GPT 连通测试 |
| `/api/gpt` | POST | 全站唯一 AI 入口 |
| `/api/satellite?city=xxx` | GET | 按城市匹配本地卫星 |

### `/api/gpt` 前端调用

```js
const res = await fetch('/api/gpt', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ systemPrompt, userPrompt, temperature, maxTokens }),
})
const data = await res.json()
```

返回格式：

```js
{ ok, content, inputTokens, outputTokens }
```

### GPT JSON 解析

GPT 可能把 JSON 包在 markdown 代码块里。前端解析时先提取 `{...}`：

```js
const match = raw.match(/\{[\s\S]*\}/)
if (!match) throw new Error('AI 返回格式异常')
return JSON.parse(match[0])
```

---

## 3. 项目定位

公众对航天感兴趣，但对太空垃圾缺乏个人感知。本项目用个人化叙事和交互任务，把太空垃圾问题转化为和用户生活相关的体验。

一句话定位：

> 以太空垃圾为主题，以个体相关性为驱动，以可执行行动为输出的个性化科普平台。

用户路径：

```text
不知道 → 知道 → 觉得和自己有关 → 愿意采取行动
```

核心输出：认知理解、情感连接、行动引导。

---

## 4. 主流程模块

### 前测

20 题知识选择题，建立知识、态度、积极性三维基线。本模块不调用 AI。

### Entrance · 入口

输入：姓名/代号、城市、对自己最重要的一件事。

输出：

- 根据城市匹配本地真实卫星。
- GPT 生成约 150 字故事开头。
- 写入 `user`、`satellite`、`storyChapters`。

### M1 · 太空垃圾是什么

科普：定义、来源、尺寸层级、速度、碰撞危害、国家贡献。

交互：选择卫星材料：铝合金 / 钛合金 / 碳纤维 / 太阳能电池板。

AI：生成一句材料反馈。

状态：`material`，影响 M4 碎片、M5 再入、M6 清理匹配。

### M2 · 轨道是什么

科普：LEO / MEO / GEO、轨道高度、碎片密度。

交互：Three.js 三维地球；高亮用户卫星轨道；选择任务类型：气象 / 通信 / 成像 / 科学。

AI：生成约 150 字故事第二段。

状态：`mission`，影响 M4 游戏背景。

### M3 · 重大历史事件

时间线包含：Sputnik、首次在轨解体、Kosmos 954、Cerise、风云一号、铱星-33 / Cosmos-2251、ISS 电池托盘坠落。

交互：发射年前事件灰色浏览；发射年后事件可点击进入叙事。

AI：点击事件后生成约 100 字卫星第一视角叙事；全部浏览后生成约 150 字第三段故事。

状态：`damageLevel` 和事件记录，影响 M4 初始护甲与随机事件。

### M4 · 卫星生存任务游戏

科普：轨道风险、规避机动、燃料代价、卫星失效、碎片生命周期、25 年离轨规则。

交互：每局 5–8 个决策节点，触发碎片接近、太阳风暴、轨道衰减、卫星解体等风险；显示护甲、燃料、任务完成度。

AI：每次决策生成即时反馈；结束后生成反思页。

结局：成功则重要事件被守住，失败则重要事件被改写。

状态：`gameResult`、`debrisGenerated`，影响 M5/M6。

### M5 · 太空垃圾落地球

科普：再入大气层、材料烧毁/存活、25 年离轨规则、坠落事件、法律责任。

交互：再入动画；事件档案卡；世界地图落点。

AI：根据 M4 结局生成约 120 字故事结局。

状态：碎片类型、故事结局，进入 M6 和后测知识卡。

### M6 · 怎么清理太空垃圾

科普：速度、数量、法律、成本四类障碍；激光消融、帆式减速、机械臂捕获三类技术。

交互：为 M4 产生的碎片拖拽匹配清理技术。

AI：每次拖拽生成匹配反馈；完成后生成约 80 字开放式尾声。

状态：准确率、尾声故事。

### M7 · 科普视频

补充前六个模块核心知识。视频结束后，AI 基于用户卫星生成问题；用户作答后 AI 解释。

### 后测 + 个人知识卡

后测包含知识题、积极性量表、NEP 量表。展示前后测对比，并生成个人知识卡：卫星命运、个人事件结局、知识提升幅度、关键节点摘要。

### 观测教学与社区

延伸模块，不强制完成。

功能：

- 区分再入火球、流星、航空器。
- 提供目击报告模板：时间、地点、方向、持续时长、颜色、碎裂情况。
- 支持社区提交、评论真实事件，并连接公民科学项目。

---

## 5. 全局状态

使用 Zustand + localStorage 持久化。

```text
user              姓名、城市、最重要的事
satellite         本地真实卫星与轨道参数
material          M1 选择，影响 M4/M5/M6
mission           M2 选择，影响 M4
damageLevel       M3 累积，影响 M4 初始护甲
gameResult        M4 结果，影响 M5/M6
debrisGenerated   M4 碎片，影响 M6
storyChapters     各模块 AI 故事片段
preTest/postTest  前后测得分与提升幅度
```

---

## 6. 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 18 + Vite |
| 路由 | React Router v6 |
| 状态 | Zustand + persist |
| 3D | React Three Fiber + Drei |
| 轨道 | satellite.js |
| 动画 | Framer Motion |
| 样式 | Tailwind CSS v4 |
| AI | OpenAI GPT-4o-mini |
| 数据 | 本地 `satellites.json` |
| 埋点 | PostHog + 本地兜底 |

---

## 7. AI 输出原则

- 所有 AI 调用输出 JSON，字段固定。
- 不输出自由散文，除非字段明确需要故事文本。
- 语气克制、真实、不煽情。
- 避免「美丽」「壮阔」等空泛形容词。
- 叙事视角：第三人称，卫星为主角。
- 故事结构：进入用户时刻 → 平行叙事不直接解释连接 → 最后反转或收束。
- 碎片威胁、轨道参数、历史事件必须基于真实数据，不虚构参数。

---

## 8. 事实锚点

不要虚构以下事件细节：

- 2009 铱星-33 / Cosmos-2251：首次大型卫星碰撞，凯斯勒效应典型案例。
- 1996 Cerise：第一次有记录的在轨碎片碰撞。
- 1978 Kosmos 954：核动力卫星失控坠入加拿大。
- 2024 佛罗里达屋顶穿透事件：ISS 电池托盘碎片穿透民宅屋顶。
- 1997 Lottie Williams：有记录称其被坠落航天器碎片击中。

---

## 9. 开发优先级

1. 先保证 API 可用，再做页面效果。
2. 先保证状态流正确，再做动画和视觉。
3. 先保证知识一致，再增加个性化故事。
4. 新模块必须读写全局状态，不要做孤立页面。
5. 旧网站和新网站知识点必须一致；新网站只增加 AI 个性化表达，不改变事实内容。
