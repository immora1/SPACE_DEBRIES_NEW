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

## 五、全部模块搭建完成

所有 9 个模块（Entrance + M1–M8）均已创建并接入全局状态和 `App.jsx` 解锁逻辑。

---

## 六、Cloudflare Pages 部署迁移

### 完成内容

**后端迁移：Express → Cloudflare Pages Functions**

原 `server/index.js`（Express）迁移为 `functions/api/` 目录下的 Workers 函数，每个端点一个文件：

```
functions/
  api/
    health.js       ✅ GET  /api/health
    test-gpt.js     ✅ POST /api/test-gpt
    gpt.js          ✅ POST /api/gpt
    satellite.js    ✅ GET  /api/satellite（含完整 CITY_LAT 表 + satellites.json 导入）
```

关键变化：
- 环境变量从 `process.env.X` 改为 `context.env.X`
- 外部 HTTP 用原生 `fetch`（不需要 proxiedFetch，CF 数据中心直连 OpenAI）
- 卫星数据通过 ES module `import` 导入（wrangler 用 esbuild 打包进 bundle）
- 响应用 `Response.json()` 代替 `res.json()`

**本地开发改为 wrangler**

- 新增 `wrangler.toml`（指定项目名和构建输出目录 `dist`）
- 本地密钥写在 `.dev.vars`（已加入 `.gitignore`，格式见 `.dev.vars.example`）
- `npm run dev` 同时启动：`vite --port 5173` + `wrangler pages dev --proxy 5173 --port 8788`
- 开发时访问 **http://localhost:8788**

**Cloudflare 部署配置**
- 构建命令：`npm run build`，输出目录：`dist`
- 在 CF Pages 控制台 Settings → Environment Variables 中添加 `OPENAI_API_KEY`

---

## 七、首屏性能优化（React.lazy 懒加载）

### 完成内容

**问题：** `npm run build` 产出单个 1,464 kB chunk，Three.js 随首屏一起加载。

**方案：** 将 `App.jsx` 所有模块改为 `React.lazy()` + 动态 `import()`，每个模块用 `<Suspense>` 包裹。

效果：

| | 改前 | 改后 |
|---|---|---|
| 首屏 JS（gzip） | 417 kB | 59 kB |
| Three.js 加载时机 | 首屏 | 仅 M2 解锁时（237 kB gzip） |

各模块现为独立 chunk，按解锁顺序按需加载。利用 `ModuleWrapper` 在 `isUnlocked=false` 时 `return null` 的特性确保 locked 模块的 JS 不被提前请求。

---

## 八、当前文件结构

```
SPACE_DEBRIES_NEW/
├── functions/
│   └── api/
│       ├── health.js       ✅ GET  /api/health
│       ├── test-gpt.js     ✅ POST /api/test-gpt
│       ├── gpt.js          ✅ POST /api/gpt
│       └── satellite.js    ✅ GET  /api/satellite
├── server/
│   ├── index.js            ✅ 保留（本地备用，不再是主路径）
│   └── .env                ✅ OpenAI Key + 代理配置（不入 git）
├── src/
│   ├── modules/
│   │   ├── Entrance/       ✅
│   │   ├── M1/             ✅
│   │   ├── M2/             ✅ Three.js 三维地球（懒加载）
│   │   ├── M3/             ✅
│   │   ├── M4/             ✅ 游戏模块（懒加载）
│   │   ├── M5/             ✅
│   │   ├── M6/             ✅
│   │   ├── M7/             ✅
│   │   └── M8/             ✅
│   ├── pages/
│   │   └── ApiTest.jsx     ✅ MVP 验证调试页
│   ├── services/
│   │   └── ai.js           ✅ 全站 AI 调用层（12个函数，含故事大纲）
│   ├── store/
│   │   └── useAppStore.js  ✅ Zustand 全局状态
│   ├── App.jsx             ✅ React.lazy 懒加载全部模块
│   └── index.css           ✅ 全局样式变量和组件类
├── satellites.json         ✅ 本地卫星数据库（4976 颗）
├── wrangler.toml           ✅ Cloudflare Pages 配置
├── .dev.vars.example       ✅ 本地密钥模板
├── vite.config.js          ✅
├── package.json            ✅ 含 wrangler devDep
├── CLAUDE.md               ✅ 项目规范文档
├── problem.md              ✅ 问题记录
└── process.md              ✅ 本文件
```

---

## 九、M1 完整范式重设计（场景式沉浸体验）

**完成时间：** 2026-05-17

### 改动背景

原 M1 采用居中列式卡片布局，用户反馈体验单调，缺乏沉浸感。参考 pieterkoopt.nl 和 terminal-industries.com 风格，彻底重建为全视口场景系统。

### 架构变更

**`src/modules/M1/index.jsx` — 完整重写**

- 根容器：`height: 100vh, overflow: hidden`，6 个场景绝对定位叠加
- 场景切换：`AnimatePresence mode="wait"` + 自定义 `x/blur` 过渡变体
- 全局鼠标系统：`useMotionValue` + `useSpring` 分离 raw（光标点）和 smooth（悬停环/视差）
- 自定义光标：6px 白点 + 32px accent 圆环，`position: fixed, pointerEvents: none`
- 底部场景导航：6 个横线指示器，当前场景展开为 28px 发光段

**6 个场景内容**

| 场景 | 内容 | 交互 |
|------|------|------|
| 0 HERO | 全屏文字散布 + 幽灵"28000"视差 | 纯欣赏 |
| 1 SCALE | 三个碎片层级组 + 接近光标时显示描述 | 接近触发 |
| 2 SOURCES | 全视口横向手风琴（来源图片组） | 悬停展开 |
| 3 COUNTRIES | 多国贡献圆环图 + 悬停列表 | 悬停高亮 |
| 4 TREND | SVG 粒子时间轴（1957→2026） | 横向鼠标刮擦 |
| 5 MATERIAL | 3D 卫星GLB + 右侧手风琴选材 | 点击选择 + AI反馈 |

**`src/components/ModuleWrapper.jsx` — ArchDivider 梯形分隔器**

- 两个独立方向的 SVG 梯形路径：
  - Entrance→M1：`M200,0 H1240 L1440,80 H0 Z`（窄上宽下）
  - M1→M2：`M0,0 H1440 L1200,80 H240 Z`（宽上窄下）
- `flip` prop 控制方向，支持 `archDivider: { color, flip }` 对象格式

### M1 滚动拦截系统（历经两版迭代）

详见 problem.md P011。

---

## 十一、关键规则备忘

1. **修改任何文件后必须验证三条 API**（health / test-gpt / satellite），任意失败立即 `git restore`
2. **Functions 中禁止用 node-fetch / proxiedFetch**，CF Workers 直接用原生 `fetch`
3. **前端只写 `/api/xxx`**，不带端口，不带域名
4. **AI 用 OpenAI（sk-proj-前缀），不是 Claude/Anthropic**；Key 只放 `server/.env`（本地旧路径）或 `.dev.vars` / CF Pages 环境变量
5. **所有 AI 输出 JSON**，前端用正则 `/\{[\s\S]*\}/` 提取，兼容 markdown 代码块包裹
6. **本地开发访问 http://localhost:8788**（wrangler），不是 :5173
7. **本地密钥写在 `.dev.vars`**（不入 git），格式参考 `.dev.vars.example`
