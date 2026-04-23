# SPACE_DEBRIES · 开发过程记录

> 记录从项目创建到当前状态的所有关键步骤、决策和完成情况

---
2026.4.21
开始尝试构建网站，但是发现api链接出错，文件名称是SPACE_DEBRIES。
2026.4.22
继续尝试构建但是还是无法实现，因此想先创建SPACE_DEBRIES_NEW 做最小可行性测试，可行性成功了
2026.4.23
想复用到SPACE_DEBRIES结果失败，同时初次尝试链接celestrak也失败，发现是Claude.md文档里面写成
接入Claude api，估计是因为这个导致连接失败，因此我把Claude.md里面内容修改并让mvp测试成功的路径
让cc在构建完整网站的时候复用，同时每次编辑都需要跑一次api链接，如果失败就需要将文件恢复至修改前。
## 一、项目初始化（commit: 04f487e）

### 完成内容

**技术栈搭建**
- React 19 + Vite 8 + Tailwind CSS v4（原子化样式）
- React Router v7、Zustand v5、Framer Motion
- Express 后端（server/index.js），前后端同时启动：`npm run dev`

**代理方案确立（核心架构决策）**
- 问题：Node.js 原生 fetch 完全忽略系统代理，直连 OpenAI / CelesTrak 被墙
- 解决：`node-fetch` + `https-proxy-agent`，所有外部请求强制走 `127.0.0.1:22307`
- 核心三行（server/index.js，禁止改动）：
  ```js
  import fetch from 'node-fetch'
  import { HttpsProxyAgent } from 'https-proxy-agent'
  const proxiedFetch = (url, init = {}) => fetch(url, { ...init, agent })
  ```

**后端 API 端点搭建**
| 端点 | 状态 | 用途 |
|------|------|------|
| `GET /api/health` | ✅ | 服务在线检查 |
| `GET /api/test-celestrak` | ✅ | 拉取 ISS（NORAD 25544）验证连通性 |
| `POST /api/test-gpt` | ✅ | 发固定 prompt 验证 GPT 连通性 |
| `POST /api/gpt` | ✅ | 通用 AI 入口，所有模块统一调用 |
| `GET /api/satellite?city=xxx` | ✅ | 按城市匹配真实 LEO 卫星 |

**CelesTrak 卫星匹配策略（两级降级）**
- 优先：在线查询 CelesTrak satcat 活跃卫星列表
- 降级：离线备用 6 颗真实卫星硬编码数据（FENGYUN 3D / TERRA / AQUA / SENTINEL-2A / LANDSAT 8 / SUOMI NPP）
- 城市哈希选星：`ASCII码之和 % 列表长度`，保证同城市永远匹配同一颗卫星

**已知失效 URL 记录（不再使用）**
```
https://celestrak.org/SPACETRACK/query/class/gp/EPOCH/...   ← 返回 404
https://celestrak.org/SPACETRACK/query/class/satcat/...     ← 返回 404
```
**可用 URL**：`https://celestrak.org/satcat/records.php?CATNR=25544&FORMAT=json`

**MVP 验证页**
- `src/pages/ApiTest.jsx`：手动测试三条 API 的调试页，三条全返回 `ok: true` 才算通过

**环境变量（server/.env，不入 git）**
```
OPENAI_API_KEY=sk-proj-...
PROXY_URL=http://127.0.0.1:22307
PORT=3001
```

**Vite 代理（禁止修改）**
```js
// vite.config.js
proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
```
前端永远只写 `/api/xxx`，不带端口，不带域名。

---

## 二、入口模块 + 核心功能跑通（commit: fd3e409）

### 完成内容

**CLAUDE.md 创建**
- 完整记录项目定位、模块结构、API 规则、技术栈、数据流、AI 调用规范
- 关键约束：每次修改文件后必须跑三条 curl 验证 API；禁止改动代理核心代码

**全局状态 store（src/store/useAppStore.js）**
- Zustand + persist（localStorage 持久化）
- 初始字段：
  - `user`：姓名、城市、最重要的事
  - `satellite`：匹配到的卫星数据
  - `material`：M1 材料选择（null → M4/M5/M6 联动）
  - `storyChapters`：各模块 AI 生成的故事段落
  - `unlockedModules` / `completedModules`：进度追踪

**Entrance 模块（src/modules/Entrance/index.jsx）**
三阶段流程：
1. **FormPhase**：输入姓名/城市/最重要的事
2. **MatchingPhase**：加载动画，显示 `SCANNING ORBIT` → `WRITING STORY`
3. **ResultPhase**：展示匹配卫星参数卡 + AI 生成开场故事

**AI 服务层初版（src/services/ai.js）**
- `chat()` 基础函数：调用 `/api/gpt`，统一处理请求/响应
- `generateOpeningStory()`：Entrance 专用，生成约 150 字开场故事，输出 `{"story": "..."}`
- GPT 返回 JSON 的解析陷阱处理：用正则 `/\{[\s\S]*\}/` 提取，兼容 markdown 代码块包裹

**样式体系（src/index.css）**
- CSS 变量定义（--color-bg / --color-text / --color-accent 等）
- 通用组件类：`.mono-label`、`.input-line`、`.textarea-box`、`.btn-primary`、`.story-text`
- 动画：`fadeUp`、`ping`

---

## 三、问题记录文档（commit: b951a15）

### 完成内容
- `problem.md` 创建：记录开发过程中遇到的问题、排查思路和解决方案

---

## 四、AI 服务层重构（本次会话，未提交）

### 完成内容

**各模块独立 AI 函数（src/services/ai.js 重写）**

每个模块有专属函数，prompt 集中在函数内，`// TODO` 标注替换位置，后期只改 `system` 和 `user_` 两个变量。

| 函数 | 模块 | 触发时机 | 输出字段 |
|------|------|----------|----------|
| `generateStoryOutline` | Entrance | 表单提交后立即 | `premise` + `checkpoints[7]` + `successEnding` + `failureEnding` |
| `generateOpeningStory` | Entrance | 大纲生成后 | `story` |
| `generateMaterialFeedback` | M1 | 材料选择 | `feedback` |
| `generateMissionStory` | M2 | 任务选择 | `story` |
| `generateEventNarrative` | M3 | 点击历史事件 | `narrative` |
| `generateHistoryStory` | M3 | 全部事件浏览完 | `story` |
| `generateGameDecisionFeedback` | M4 | 每次决策（最频繁） | `feedback` + `storyUpdate` |
| `generateGameReflection` | M4 | 游戏结束 | `knowledgePoints[]` + `satFate` + `debrisDescription` |
| `generateReentryEnding` | M5 | 进入 M5 | `ending` |
| `generateCleanupFeedback` | M6 | 每次拖拽 | `feedback` |
| `generateCleanupEpilogue` | M6 | 全部匹配完 | `epilogue` |
| `generateVideoQuestion` | M7 | 视频结束 | `question` |
| `generateAnswerExplanation` | M7 | 用户作答 | `explanation` |

**故事大纲系统（核心架构新增）**

设计原则：
- 用户提交表单后立即调用 `generateStoryOutline()`，生成一次，全程不变
- 大纲包含 7 个固定节点（checkpoints），对应 Entrance → M6
- 用户选择只影响"如何到达节点"，不改变"必须经过哪些节点"
- 所有模块 AI 调用时传入 `storyOutline` 作为叙事约束（通过 `outlineContext()` 注入 prompt）
- M4 是故事高潮，`decisionIndex/totalDecisions` 参数驱动紧张感递进

大纲数据结构：
```js
{
  premise: "故事核心前提",
  checkpoints: [
    { id: "entrance", label: "启程",        beat: "..." },
    { id: "m1",       label: "第一个选择",  beat: "..." },
    { id: "m2",       label: "任务展开",    beat: "..." },
    { id: "m3",       label: "裂缝出现",    beat: "..." },
    { id: "m4",       label: "高潮·命运决战", beat: "..." },
    { id: "m5",       label: "余波",        beat: "..." },
    { id: "m6",       label: "行动与尾声",  beat: "..." },
  ],
  successEnding: "守住结局的情感内核",
  failureEnding: "失败结局的情感内核",
}
```

**全局 store 新增字段（src/store/useAppStore.js）**
- `storyOutline: null` + `setStoryOutline()`
- `reset()` 同步清空 `storyOutline`

**Entrance 流程更新（src/modules/Entrance/index.jsx）**
- 表单提交后顺序执行：
  1. `fetchSatellite()` → `SCANNING ORBIT`
  2. `generateStoryOutline()` → `BUILDING NARRATIVE`（新增）
  3. `generateOpeningStory({ storyOutline })` → `WRITING STORY`
- `generateOpeningStory` 现在接收 `storyOutline` 参数，开场故事受框架约束

---

## 五、当前文件结构

```
SPACE_DEBRIES_NEW/
├── server/
│   ├── index.js          ✅ Express 后端，含全部 API 端点
│   └── .env              ✅ OpenAI Key + 代理配置（不入 git）
├── src/
│   ├── modules/
│   │   └── Entrance/
│   │       └── index.jsx ✅ 入口模块（三阶段：表单→加载→结果）
│   ├── pages/
│   │   └── ApiTest.jsx   ✅ MVP 验证调试页
│   ├── services/
│   │   └── ai.js         ✅ 全站 AI 调用层（12个函数，含故事大纲）
│   ├── store/
│   │   └── useAppStore.js ✅ Zustand 全局状态
│   ├── App.jsx           ⚠️ 仅挂载 Entrance，路由未接入
│   └── index.css         ✅ 全局样式变量和组件类
├── vite.config.js        ✅ Vite + 代理配置
├── package.json          ✅ 依赖完整
├── CLAUDE.md             ✅ 项目规范文档
├── problem.md            ✅ 问题记录
└── process.md            ✅ 本文件
```

---

## 六、未完成内容

### 模块页面（均未创建）
- [ ] M1 · 太空垃圾是什么（材料选择交互）
- [ ] M2 · 轨道是什么（Three.js 三维地球 + 任务选择）
- [ ] M3 · 重大历史事件（时间线 + 沉浸叙事视图）
- [ ] M4 · 卫星生存任务游戏（核心玩法，决策节点）
- [ ] M5 · 太空垃圾落地球（再入动画 + 文件夹交互 + 世界地图）
- [ ] M6 · 怎么清理太空垃圾（拖拽匹配）
- [ ] M7 · 科普视频（视频 + 开放问答）
- [ ] 前测页（20题知识选择题）
- [ ] 后测页（知识题 + 量表 + 个人知识卡生成）
- [ ] 社区模块（目击报告 + 讨论区）

### 路由系统
- [ ] App.jsx 接入 React Router，模块间导航
- [ ] 模块解锁逻辑（完成上一模块才解锁下一个）

### AI Prompt
- [ ] 全部 12 个函数的 prompt 均为临时占位版本，标有 `// TODO`，待替换为完整 prompt

### 全局状态补全
- [ ] `mission`（M2 选择）
- [ ] `damageLevel`（M3 累积受损值）
- [ ] `gameResult`（M4 输出）
- [ ] `debrisGenerated`（M4 输出碎片类型）
- [ ] `preTest` / `postTest`（前后测得分）

### 其他
- [ ] Three.js 三维轨道可视化（M2）
- [ ] PostHog 埋点接入
- [ ] satellite.js TLE 解析（当前仅用 satcat 参数，未解析 TLE 做实时位置计算）

---

## 七、关键规则备忘

1. **修改任何文件后必须验证三条 API**（health / test-celestrak / test-gpt），任意失败立即 `git restore`
2. **代理核心三行禁止改动**（server/index.js 的 node-fetch + HttpsProxyAgent + proxiedFetch）
3. **前端只写 `/api/xxx`**，不带端口，不带域名
4. **AI 用 OpenAI（sk-proj-前缀），不是 Claude/Anthropic**
5. **所有 AI 输出 JSON**，前端用 `extractJSON()` 解析，兼容 markdown 代码块包裹
6. **修改 server/index.js 后必须重启服务端**（--watch 只在 npm run dev 下生效）
