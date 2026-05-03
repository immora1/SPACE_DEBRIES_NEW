# SPACE_DEBRIES · 问题记录

> 开发过程中遇到的所有问题及解决方案，持续更新。

---

## P001 · Node.js 不读取系统代理导致外部 API 全部被墙

**类型：** 网络 / 环境配置  
**发现时间：** MVP 阶段  
**严重程度：** 致命（不解决无法使用任何外部 API）

### 问题描述
在中国大陆网络环境下，OpenAI 和 CelesTrak 等境外 API 必须走代理。Windows 系统代理设置对浏览器有效，但 **Node.js 完全忽略系统代理**，所有通过 Node.js 发出的 HTTP 请求都直连被墙，无论 Clash/代理软件是否开启。

### 尝试过的错误方案
- 直接用原生 `fetch`（Node 18+ 内置）：不走代理，超时失败
- 用 `axios`：默认也不走系统代理
- 设置环境变量 `HTTP_PROXY` / `HTTPS_PROXY`：部分库支持但不稳定

### 解决方案
用 `node-fetch` + `https-proxy-agent`，在每个出站请求里**手动注入** proxy agent：

```js
import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'

const agent = new HttpsProxyAgent('http://127.0.0.1:22307')
const proxiedFetch = (url, init = {}) => fetch(url, { ...init, agent })

// 之后所有外部请求都用 proxiedFetch，不用原生 fetch
```

### 关键约束
- 所有外部请求必须用 `proxiedFetch`，永远不能用原生 `fetch` 或 `axios`
- 前端代码只调用 `/api/xxx`（相对路径），从不直接请求境外 URL
- Vite 的 `/api` 代理把前端请求转发到 Express，再由 Express 用 `proxiedFetch` 出去

---

## P002 · API Key 类型混淆（Anthropic vs OpenAI）

**类型：** 配置错误  
**发现时间：** MVP 阶段  
**严重程度：** 致命

### 问题描述
项目初始计划用 Claude API，但实际拿到的 Key 前缀是 `sk-proj-`，这是 **OpenAI** 的格式。Anthropic Key 前缀是 `sk-ant-`。在用 `@anthropic-ai/sdk` 时一直报"无法认证"，原因是 Key 根本对不上。

### 解决方案
- 将 `server/.env` 的环境变量从 `ANTHROPIC_API_KEY` 改为 `OPENAI_API_KEY`
- 删除 `@anthropic-ai/sdk`，改用原生 HTTP 直接请求 OpenAI 的 `/v1/chat/completions` 接口
- 模型：`gpt-4o-mini`

### 后续规则
- 本项目只用 OpenAI GPT API，不用 Claude/Anthropic
- Key 只存在 `server/.env`，绝不放前端

---

## P003 · dotenv 加载路径错误

**类型：** Node.js 配置  
**发现时间：** MVP 阶段  
**严重程度：** 高（导致 Key 读不到，所有 API 调用失败）

### 问题描述
`import 'dotenv/config'` 默认从**当前工作目录（CWD）**加载 `.env`，但项目从根目录用 `node server/index.js` 启动，CWD 是项目根，而 `.env` 文件在 `server/` 子目录里，导致 `process.env.OPENAI_API_KEY` 始终是 `undefined`。

### 解决方案
用 `fileURLToPath` 算出 `server/index.js` 的绝对路径，再拼接出 `.env` 的正确路径：

```js
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env') })
```

---

## P004 · 服务端进程不自动重载导致接口 404

**类型：** 开发流程  
**发现时间：** 多次（入口模块开发阶段）  
**严重程度：** 高（改了代码但调用的还是旧版本）

### 问题描述
每次在 `server/index.js` 新增端点后，前端调用时返回 `Cannot GET /api/xxx`（404）。原因是后台有旧的 Node.js 进程还在占用 3001 端口，新代码没有生效。

`node --watch`（npm run dev:server 使用的）只在**通过 npm run dev 正常启动的进程**上有效。如果之前有手动在后台用 `node server/index.js &` 启动的进程，`--watch` 对它不起作用，旧进程一直持续运行。

### 解决方案

**方法一（推荐）：** 永远只用 `npm run dev` 启动，不手动后台启动进程。`Ctrl+C` 停止后重新运行即可。

**方法二（强制清除）：** 找到占用端口的进程 PID 并杀掉：

```bash
# 找 PID
netstat -ano | grep ":3001"

# 杀掉（PowerShell）
Stop-Process -Id <PID> -Force
```

### 预防规则
每次修改 `server/index.js` 后，用 `curl http://localhost:3001/api/health` 验证服务端是否已更新，再继续开发。

---

## P005 · CelesTrak GP 查询 URL 返回 404

**类型：** 第三方 API 变更  
**发现时间：** 入口模块开发阶段  
**严重程度：** 高（卫星匹配功能无法使用）

### 问题描述
尝试通过 CelesTrak 的 GP 数据查询接口获取 LEO 卫星列表，使用的 URL 全部返回 404：

```
# 以下 URL 已失效，不要再用
https://celestrak.org/SPACETRACK/query/class/gp/EPOCH/%3Enow-30/MEAN_MOTION/%3E11.25/ECCENTRICITY/%3C0.25/format/json
https://celestrak.org/SPACETRACK/query/class/satcat/CURRENT/Y/OBJECT_TYPE/PAY/...
```

### 已知可用的 CelesTrak URL
```
# 单星查询（satcat，按 NORAD ID）——已验证可用
https://celestrak.org/satcat/records.php?CATNR=25544&FORMAT=json
```

### 解决方案
放弃在线批量查询，改为**两级降级策略**：

1. **先尝试**在线查询（尝试新的 satcat 格式）
2. **失败后**使用本地硬编码的 6 颗真实 LEO 卫星作为备用列表
3. 用**城市名 ASCII 码之和取模**选星，保证同一城市每次返回同一颗卫星

```js
const FALLBACK_SATS = [
  { OBJECT_NAME: 'FENGYUN 3D',  NORAD_CAT_ID: 43010, APOGEE: 851, PERIGEE: 820, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH_DATE: '2017-11-15' },
  { OBJECT_NAME: 'TERRA',       NORAD_CAT_ID: 25994, APOGEE: 705, PERIGEE: 694, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH_DATE: '1999-12-18' },
  { OBJECT_NAME: 'AQUA',        NORAD_CAT_ID: 27424, APOGEE: 710, PERIGEE: 697, INCLINATION: 98.2, PERIOD:  98.9, LAUNCH_DATE: '2002-05-04' },
  { OBJECT_NAME: 'SENTINEL-2A', NORAD_CAT_ID: 40697, APOGEE: 790, PERIGEE: 783, INCLINATION: 98.6, PERIOD: 100.6, LAUNCH_DATE: '2015-06-23' },
  { OBJECT_NAME: 'LANDSAT 8',   NORAD_CAT_ID: 39084, APOGEE: 708, PERIGEE: 703, INCLINATION: 98.2, PERIOD:  99.0, LAUNCH_DATE: '2013-02-11' },
  { OBJECT_NAME: 'SUOMI NPP',   NORAD_CAT_ID: 37849, APOGEE: 833, PERIGEE: 826, INCLINATION: 98.7, PERIOD: 101.4, LAUNCH_DATE: '2011-10-28' },
]

const hash = city.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
const sat = FALLBACK_SATS[hash % FALLBACK_SATS.length]
```

备用卫星均为真实在轨/历史卫星，数据来源 CelesTrak satcat，具备科学可信度。

---

## P006 · GPT 返回 JSON 被 Markdown 代码块包裹

**类型：** AI 输出格式  
**发现时间：** 入口模块开发阶段  
**严重程度：** 中（偶发，导致 JSON.parse 报错）

### 问题描述
要求 GPT 输出纯 JSON 格式（如 `{"story": "..."}`），但模型有时会自动把内容包在 Markdown 代码块里：

```
```json
{"story": "..."}
```
```

直接 `JSON.parse(raw)` 会因为开头的 ` ```json ` 而抛出异常。

### 解决方案
用正则提取第一个完整的 JSON 对象，忽略 Markdown 包装：

```js
const match = raw.match(/\{[\s\S]*\}/)
if (!match) throw new Error('AI 返回格式异常')
return JSON.parse(match[0])
```

这个处理在 `src/services/ai.js` 的每个 AI 调用函数里都必须加上。

---

## P007 · Vite 多实例占用不同端口

**类型：** 开发流程  
**发现时间：** MVP 阶段  
**严重程度：** 低（混乱但不致命）

### 问题描述
多次在后台启动开发服务器，导致同时存在多个 Vite 实例（端口 5173、5174、5175…）。前端测试时不确定当前访问的是哪个版本的代码。

### 解决方案
用 PowerShell 找出所有占用 Node.js 的进程并清除，然后重新 `npm run dev`：

```powershell
# 查看所有 Node 进程
Get-Process node

# 全部杀掉
Get-Process node | Stop-Process -Force
```

### 预防规则
- 永远只在一个终端里运行 `npm run dev`
- 不用 `&` 或 `run_in_background` 启动开发服务器

---

## P008 · git clean 无法删除 IDE 已打开的文件

**类型：** 工具行为  
**发现时间：** 回滚操作时  
**严重程度：** 低

### 问题描述
执行 `git clean -fd` 清除所有未跟踪文件后，输出显示 `Removing CLAUDE.md`，但文件实际上仍然存在于磁盘。原因是 VSCode 当时正在打开该文件，Windows 文件锁定机制阻止了删除，或 IDE 在进程结束后将缓冲区内容回写到磁盘。

### 解决方案
- 关闭 IDE 中已打开的文件后再执行清理操作
- 或在清理后手动确认文件是否真正消失

---

## P009 · 首屏 JS 包体积超过 500 kB 警告

**类型：** 构建 / 性能  
**发现时间：** Cloudflare Pages 部署准备阶段  
**严重程度：** 中（不影响功能，但首屏加载慢）

### 问题描述
`npm run build` 输出警告：单个 JS chunk 体积 1,464 kB（gzip 后 417 kB），超过 Vite 的 500 kB 警告阈值。根本原因是 `App.jsx` 用静态 `import` 引入了全部 9 个模块，Three.js（来自 M2 的 OrbitGlobe）和 M4 游戏场景被一次性打包进首屏。

### 解决方案
将 `App.jsx` 中所有模块改为 `React.lazy()` + 动态 `import()`，配合 `<Suspense>` 包裹每个 `ModuleWrapper`：

```jsx
// 改前
import M2 from './modules/M2'

// 改后
const M2 = lazy(() => import('./modules/M2'))

// 渲染侧
<Suspense fallback={<ModuleLoader />}>
  <ModuleWrapper isUnlocked={...}>
    <M2 onComplete={...} />
  </ModuleWrapper>
</Suspense>
```

利用 `ModuleWrapper` 在未解锁时 `return null` 的特性——locked 模块的 children 不会被 React 实例化，因此对应 chunk 不会被请求。

### 效果
| | 改前 | 改后 |
|---|---|---|
| 首屏 JS（gzip） | 417 kB | **59 kB** |
| Three.js 加载时机 | 首屏 | 仅 M2 解锁时（237 kB gzip，按需） |

每个模块现为独立 chunk，按解锁顺序逐步加载。

---

## P010 · Express 后端无法部署到 Cloudflare Pages

**类型：** 部署架构  
**发现时间：** Cloudflare Pages 部署准备阶段  
**严重程度：** 致命（不迁移则无法上线）

### 问题描述
Cloudflare Pages 是纯静态托管 + Functions（Workers 运行时），不支持运行 Node.js 进程（Express、node --watch 等）。原有的 `server/index.js`（Express + node-fetch + https-proxy-agent）无法直接部署。

### 解决方案
将 `server/index.js` 的全部端点迁移到 `functions/api/` 目录，改写为 Cloudflare Pages Functions 格式（Cloudflare Workers 运行时）：

```
functions/
  api/
    health.js       → GET  /api/health
    test-gpt.js     → POST /api/test-gpt
    gpt.js          → POST /api/gpt
    satellite.js    → GET  /api/satellite
```

### 关键差异

| | Express（本地） | CF Pages Function |
|---|---|---|
| 环境变量 | `process.env.OPENAI_API_KEY` | `context.env.OPENAI_API_KEY` |
| 外部 HTTP | `proxiedFetch`（需手动注入代理） | 原生 `fetch`（CF 数据中心直连，不需要代理） |
| 卫星数据 | `fs.readFileSync('satellites.json')` | `import satellitesData from '../../satellites.json'`（wrangler 打包） |
| 响应 | `res.json({...})` | `Response.json({...})` |

### 本地开发调整
- 本地密钥改为 `.dev.vars` 文件（格式同 `.env`，被 wrangler 读取，已加入 `.gitignore`）
- 启动命令不变（`npm run dev`），内部改为 `wrangler pages dev --proxy 5173 --port 8788`
- 开发时访问 **http://localhost:8788**，不再是 :5173

### 代理不再需要的原因
`https-proxy-agent` 是为了绕过 GFW。Cloudflare Workers 在 CF 的全球网络上运行，可直连 OpenAI，无需代理。本地 wrangler 也走系统 HTTP 代理，无需在代码层面手动注入。

---

*最后更新：2026-05-04*
