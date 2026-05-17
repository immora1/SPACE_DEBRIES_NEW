# SPACE_DEBRIES · CLAUDE.md

> 太空垃圾科普交互平台：个性化叙事 + AI 生成 + 数据可视化

---

## 0. 最重要规则

### 回答语言
所有回复统一使用中文。



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

## 9. UI 风格与交互规范

> 本节描述全站已建立的视觉语言和交互模式。新模块必须与这套体系保持一致，不要引入风格冲突的组件。

### 9.1 色彩系统

全站采用深空蓝紫配色，在 `src/index.css` 的 `@theme` 中定义，直接用变量名引用。

| Token | 值 | 用途 |
|---|---|---|
| `--color-void` | `#04040f` | 页面背景（最深） |
| `--color-surface` | `#08081a` | 卡片/面板背景 |
| `--color-border` | `#1a1a35` | 默认边框 |
| `--color-muted` | `#484878` | 次级文字、标签 |
| `--color-paper` | `#e8e8f8` | 主文字 |
| `--color-accent` | `#6b7fff` | 蓝紫强调色（主） |
| `--color-accent2` | `#8b6cf8` | 紫色强调（副） |
| `--color-success` | `#34d399` | 成功/低风险 |
| `--color-danger` | `#f87171` | 危险/高风险 |
| `--color-teal` | `#22d3ee` | 特殊高亮 |

背景用 `radial-gradient` 叠加制造深空星云感，`background-attachment: fixed` 使背景跟随全站固定。

---

### 9.2 字体排版

全站四套字体，各司其职，**不得混用**：

| 字体 | CSS 变量 | 典型 fontSize | 用途 |
|---|---|---|---|
| `Space Mono` | `--font-mono` | 7–13px | 数据值、NORAD ID、单位、标签徽章 |
| `Noto Serif SC` | `--font-serif` | 14–22px | 故事文字、模块标题、引言 |
| `Noto Sans SC` | `--font-sans` | 11–15px | 正文、描述、提示 |
| `Lexend` | `--font-lexend` | 7–10px | 章节标签（`01 · SCALE`）、UI 按钮、英文说明 |

**字号规律：**
- 微型标签（章节标号/徽章）：`7–9px, letterSpacing: 0.12–0.18em, textTransform: uppercase`
- 正文描述：`11–13px, lineHeight: 1.75–2.0`
- 模块标题：`clamp(22px, 2.8vw, 34px)`（响应式）
- 幽灵装饰数字：`clamp(90px, 16vw, 180px)`，`color: rgba(107,127,255,0.03–0.05)`，`userSelect: none`

---

### 9.3 标准动画参数

**统一 easing（全站）：** `[0.16, 1, 0.3, 1]` — 快速加速、缓慢到达，类 spring 感。

```js
const EASE = [0.16, 1, 0.3, 1]
// 使用方式
transition={{ duration: 0.65, ease: EASE }}
```

**标准 fadeUp 入场：**
```js
initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.65, ease: EASE }}
// 多元素错开用 delay: 0.1 * index
```

**场景切换（M1）：** `AnimatePresence mode="wait"` + blur/x 偏移
```js
enter:  (dir) => ({ x: dir * 80, opacity: 0, filter: 'blur(6px)' }),
show:   { x: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.75 } },
leave:  (dir) => ({ x: -dir * 80, opacity: 0, filter: 'blur(6px)', transition: { duration: 0.5 } }),
```

**性能敏感的 hover 动画** 用 CSS transition 而非 Framer Motion（避免 JS 线程占用）：
```js
// 不好：Framer Motion animate on hover（高频触发）
// 好：
style={{ transition: 'opacity 0.35s ease, transform 0.35s ease' }}
onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
```

---

### 9.4 复用组件类（`src/index.css`）

使用时直接加 className，不重写样式：

| 类名 | 效果 |
|---|---|
| `.glass-card` | 半透明玻璃卡：`rgba(8,8,26,0.72)` + `border: 1px solid #1a1a35` + `backdrop-filter: blur(14px)`，hover 时边框变 accent |
| `.btn-primary` | Space Mono，小号 uppercase，accent 色边框，透明背景，hover 浅 accent 填充 |
| `.input-line` | 透明背景，仅底部边框，focus 变 accent 色 |
| `.textarea-box` | 玻璃背景，完整边框，focus 变 accent 色 |
| `.mono-label` | `Space Mono, 10px, uppercase, #484878` |
| `.section-tag` | 同 mono-label + 底部 `1px solid #1a1a35` 分割线 |
| `.gradient-line` | `1px` 渐变分割线（两端透明，中间 accent） |
| `.story-text` | `Noto Serif SC, 15px, lineHeight 1.9, rgba(232,232,248,0.82)` |
| `.text-accent-glow` | accent 色 + `text-shadow glow` |

---

### 9.5 交互效果清单

#### 自定义光标（M1 专属）
M1 内 `cursor: none`，用两个 `position: fixed` div 替代：
- **白点（6px）**：跟随原始鼠标坐标（`useMotionValue`，无延迟）
- **圆环（32px）**：跟随弹簧平滑坐标（`useSpring { stiffness: 80, damping: 22 }`，有惯性拖尾）

#### 场景导航点
6 个横线状按钮（`height: 2px`），当前场景 `animate.width: 28px + background: #6b7fff`，其余 `width: 6px + background: rgba(107,127,255,0.3)`，`transition: 0.3s`。

#### 鼠标视差（M1 Scene 0 幽灵文字）
```js
// normX/normY: useTransform(rawX, [0, window.innerWidth], [-1, 1])
const ghostX = useTransform(normX, [-1, 1], ['-50px', '50px'])
```
鼠标从左到右，幽灵数字横移 ±50px，纵移 ±28px。

#### 接近触发（M1 Scene 1 碎片层级）
碎片描述文字默认不可见，鼠标进入距离 240px 范围内渐入：
```js
const unsubX = rawX.on('change', () => {
  const dist = Math.sqrt((rawX.get()-cx)**2 + (rawY.get()-cy)**2)
  setNear(dist < 240)
})
```

#### 横向手风琴（M1 Scene 2 来源 / Scene 5 材料）
Flex 容器内子项切换 `flex` 值（`1 → 3`，其余 `0.7`），CSS `transition: flex 0.55s cubic-bezier(0.16,1,0.3,1)` 驱动，无 JS 计算宽度。悬停面板图片 `brightness` 变化，描述文字从 `opacity:0, translateY(12px)` 渐入。

#### Canvas 粒子动画（M1 Scene 4 时间轴）
`requestAnimationFrame` 循环，在 canvas 上手绘卫星轨迹：
- 卫星以随机方向飞行，带渐变尾迹（LinearGradient）
- 边缘 90px 淡出（`fadeEdge` alpha 计算）
- 离屏后尾迹以 0.38/s 速率衰减（约 2.6s 消失）

#### 鼠标刮擦时间轴（M1 Scene 4）
`onMouseMove` 计算光标在 scene 内的相对 X 百分比，映射到年份（1960→2026），更新 canvas 动画的 `yearRef`，状态限流（66ms 间隔）更新显示数字。

#### 视差圆环形图（M1 Scene 3 各国）
纯 SVG 圆弧（`arc` path 手算），悬停行时用 `ref.style.boxShadow` + `ref.style.background` 直接操作 DOM（无 React 重渲）。

#### 加载动画（Entrance）
三个同心圆 `border-radius: 50%`，用 CSS `animation: ping 1.5s ease-out infinite`，各错开 `0.3s` delay，形成向外扩散的雷达波效果。

#### 顶部进度条
`position: fixed, top: 0, height: 2px`，宽度 `(completed/total)*100%`，渐变色 `#4e5df0 → #8b6cf8`，`box-shadow: 0 0 8px rgba(107,127,255,0.6)` 发光。

#### 梯形过渡分隔器（ArchDivider）
两段独立 SVG，覆盖全宽，`preserveAspectRatio="none"` 保证斜线角度不变形：
- Entrance→M1：`M200,0 H1240 L1440,80 H0 Z`（窄上宽下）
- M1→M2：`M0,0 H1440 L1200,80 H240 Z`（宽上窄下）

#### 模块间衔接句
部分模块之间显示一行居中引言（Noto Serif SC，`rgba(232,232,248,0.32)`），上方有渐变分割线 + 小圆点装饰，在 `ModuleWrapper` 的 `connector` prop 中传入。

---

### 9.6 布局规则

- **全视口模块**（M1）：`height: 100vh, overflow: hidden, position: relative`，内部元素全部 `position: absolute`
- **流式模块**（M2、M3 等）：`minHeight: 100vh`，正常文档流，`padding: 40–80px`
- **内容宽度上限**：`maxWidth: 1080px, margin: 0 auto`，两侧 `padding: 0 24px`
- **双栏分割**：左 36% 文字 + 右 64% 可视化，或左 45% 3D + 右 55% 文字
- **间距节奏**：组件内 `gap: 8/12/16px`，节之间 `margin: 24–48px`，模块间 `padding: 72px`

---

### 9.7 禁止事项

- **不要用纯白背景、白色卡片**——破坏深空氛围
- **不要用圆角 > 6px 的卡片**——整体风格为直角或极小圆角（2–4px）
- **不要加 box-shadow 投影（非发光类）**——用 `border` 区分层次，发光用 `0 0 Xpx rgba(accent, opacity)`
- **不要用彩色实心背景大块**——背景只允许深色半透明（`rgba(8,8,26,0.72)`）
- **不要用系统默认字体做正文**——必须用上方四套字体之一
- **不要随意加 `border-radius: 50%` 按钮**——按钮为矩形，带 accent 边框
- **hover 状态变化幅度要克制**——颜色变化而非位移，不要 `scale(1.1)` 这类夸张效果

---

## 10. 开发优先级

1. 先保证 API 可用，再做页面效果。
2. 先保证状态流正确，再做动画和视觉。
3. 先保证知识一致，再增加个性化故事。
4. 新模块必须读写全局状态，不要做孤立页面。
5. 旧网站和新网站知识点必须一致；新网站只增加 AI 个性化表达，不改变事实内容。

---

## 11. Karpathy 编码准则

> 来源：https://github.com/multica-ai/andrej-karpathy-skills

**权衡说明：** 这些准则偏向谨慎而非速度。对于简单任务，自行判断是否需要全部执行。

### 先想清楚，再写代码

**不要假设。不要隐藏困惑。主动暴露权衡。**

- 明确陈述假设，不确定时先问清楚。
- 存在多种解读时，列出来而非默默选一个。
- 有更简单的方案时，说出来，必要时提出反对。
- 有任何不清楚的地方，停下来说清楚哪里困惑，然后问。

### 简洁优先

**最少的代码解决问题，不做投机性扩展。**

- 不实现任务以外的功能。
- 单次使用的代码不做抽象。
- 没有被要求的"灵活性"或"可配置性"不加。
- 不为不可能发生的场景写错误处理。
- 如果 200 行能用 50 行搞定，重写。

### 外科手术式修改

**只改必须改的，只清理自己制造的垃圾。**

- 不顺手优化旁边的代码、注释或格式。
- 不重构没有问题的东西，保持现有风格。
- 发现不相关的死代码，提一句——不要直接删。
- 因自己的修改产生的孤儿（未使用的 import/变量/函数）必须清理。

### 目标驱动执行

**定义可验证的成功标准，循环直到验证通过。**

- "加校验" → "为非法输入写测试，然后让测试通过"
- "修 bug" → "写出能复现 bug 的测试，然后让测试通过"
- 多步骤任务先简述计划，每步附上验证方式。
