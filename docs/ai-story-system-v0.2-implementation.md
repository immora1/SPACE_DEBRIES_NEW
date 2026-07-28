# AI 互动故事系统 v0.2 实现报告

## 1. 仓库分析结论

- 产品说明中的 M2 信息输入、材料选择、任务选择，实际代码位于 `src/modules/M3/`。
- 产品说明中的 M4 六个太空事件，实际代码位于 `src/modules/M4/M4New.jsx` 和 `src/modules/M4/gameData.js`。
- 产品说明中的 M5 清理方式配对，实际代码位于 `src/modules/M6/`；仓库现有 M5 是法律边界模块。
- Cloudflare Pages Functions 是生产 API，D1 是生产故事事实来源。
- `server/index.js` 只作为本地 Vite 开发适配器，使用内存仓库，不是生产事实来源。

## 2. 主要修改文件

后端与数据：

- `functions/_story/constants.js`
- `functions/_story/schemas.js`
- `functions/_story/state-reducer.js`
- `functions/_story/stage-contract.js`
- `functions/_story/story-service.js`
- `functions/_story/repository.js`
- `functions/_story/public-dto.js`
- `functions/_story/model.js`
- `functions/_story/http.js`
- `functions/_story/config/*.js`
- `functions/_story/prompts/*.js`
- `functions/api/stories/index.js`
- `functions/api/stories/[storyId].js`
- `functions/api/stories/[storyId]/actions.js`
- `migrations/0001_story_system.sql`
- `wrangler.toml`
- `server/index.js`

前端：

- `src/services/ai.js`
- `src/services/aiTimeline.js`
- `src/store/useAppStore.js`
- `src/components/AIStoryRail.jsx`
- `src/App.jsx`
- `src/modules/M3/*`
- `src/modules/M4/M4New.jsx`
- `src/modules/M6/index.jsx`
- `src/modules/M6/index.css`

验证：

- `functions/_story/fixtures.js`
- `functions/_story/story-service.test.mjs`
- `package.json`

## 3. D1 migration 与 binding

Migration 建立三张表：

- `story_sessions`
- `story_stages`
- `story_interactions`

并建立 expiry、stage 和 interaction 索引、外键及级联删除。`wrangler.toml` 已增加 `STORY_DB` binding 和 migrations 目录。

当前 `database_id` 与 `preview_database_id` 是明确的全零占位符，只用于完成本地 D1 验证；部署前必须替换为真实 Cloudflare D1 ID。

本地已执行并验证：

```powershell
npx.cmd wrangler d1 migrations apply STORY_DB --local
npx.cmd wrangler d1 execute STORY_DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'story_%' ORDER BY name;"
```

查询确认三张表均存在。

## 4. 已跑通调用链

```text
身份提交
→ STORY_OUTLINE
→ 材料提交
→ STORY_CONTINUE
→ 任务选择
→ STORY_OPENING
→ 6 × M4 ORBITAL_EVENT_RESOLVE / STORY_CONTINUE
→ 3 × CLEANUP_PAIR_SUBMIT / STORY_CONTINUE
→ STORY_ENDING
→ KNOWLEDGE_REVEAL
→ completed
```

所有有效操作均执行 session、version、checkpoint 和 action 校验；固定配置先确定性更新 `game_state` 与 `story_state`，AI 成功且 Zod 校验通过后，interaction、stage 和 session 才通过同一个 D1 batch 提交。

## 5. 尚未接入的数据或页面

用户要求的五处产品交互已全部接入。

尚未完成的是部署环境配置，不是产品页面：

- 尚未创建或绑定远程 D1 实例。
- 尚未向 Cloudflare Pages 写入生产 `OPENAI_API_KEY`。
- 用户后续提供的每阶段正式 Prompt 尚未到位；目前每个阶段已有独立、可替换的可运行基线 Prompt。

## 6. 测试命令与结果

```powershell
npm.cmd run test:story
npm.cmd run lint
npm.cmd run build
git diff --check
```

结果：

- Story 测试：11/11 通过。
- 全量 ESLint：通过。
- Vite 生产构建：通过，2780 modules transformed。
- diff whitespace 检查：通过。
- 构建仅保留现有 Gltf chunk 大于 500 kB 的性能警告。

11 个测试用例覆盖需求中的 20 项验收条件，包括非法 action、409 version 冲突、指标 clamp、AI 失败原子性、expiry、public DTO、六个 M4 事件、三组清理配对、ENDING、KNOWLEDGE_REVEAL、completed 原子性、三组完整故事和 System Prompt 哈希。

## 7. 本地验证步骤

现有 `server/.env` 可继续供本地 Express 适配器读取，密钥不会进入前端 bundle。

```powershell
npm.cmd install
npm.cmd run test:story
npm.cmd run dev
```

打开 `http://localhost:5173`。此方式的故事仓库是内存实现，服务重启后清空，只用于 UI 联调。

如需验证本地 D1：

```powershell
npx.cmd wrangler d1 migrations apply STORY_DB --local
npm.cmd run dev:client
npm.cmd run dev:pages
```

然后从 Wrangler Pages 地址访问应用，并通过 `.dev.vars` 提供本地 Functions secret。

## 8. Cloudflare 部署前步骤

```powershell
npx.cmd wrangler d1 create space-debris-stories
```

把返回的真实 ID 写入 `wrangler.toml` 的 `database_id` 和 `preview_database_id`，然后：

```powershell
npx.cmd wrangler d1 migrations apply STORY_DB --remote
npx.cmd wrangler pages secret put OPENAI_API_KEY --project-name space-debries
npm.cmd run build
npx.cmd wrangler pages deploy dist --project-name space-debries
```

`OPENAI_API_KEY` 只能通过 Pages secret 注入，不能写入源码、`wrangler.toml`、前端环境变量或提交记录。

## 9. `server/index.js` 与 Pages Functions

没有复制两套业务逻辑。两者共用：

- `StoryService`
- 阶段 Prompt
- Zod Schema
- 固定配置
- 状态 reducer
- public DTO

差别只在 repository：

- 本地 Express：`MemoryStoryRepository`
- Pages Functions：`D1StoryRepository`

## 10. 产品 M5 的实际代码位置

产品文档所称的“清理方式配对 M5”，在当前仓库实际是：

```text
src/modules/M6/index.jsx
src/modules/M6/index.css
```

当前仓库的 `src/modules/M5/` 是法律边界内容，不应改作清理模块。

## 11. System Prompt

原始来源：

```text
C:\Users\22763\Downloads\system prompt.md
```

后端接入位置：

```text
functions/_story/prompts/system.js
```

内容逐字复用，测试哈希为：

```text
d6a9822bf954315e289c3a60a591635bb3656b8ad2f11404316a8f1f1ead689e
```

System Prompt 仅由后端模型适配器导入，不进入前端 bundle 或 public DTO。

## 12. 阶段接通状态

| 阶段 | 状态 | 触发点 |
|---|---|---|
| STORY_OUTLINE | 已接通 | 身份与重要事件提交 |
| STORY_OPENING | 已接通 | 任务选择 |
| STORY_CONTINUE | 已接通 | 材料、M4 六事件、清理三配对 |
| STORY_ENDING | 已接通 | 第三个正确清理配对 |
| KNOWLEDGE_REVEAL | 已接通 | ENDING 成功后 |

每个阶段均使用独立 Prompt；非 OUTLINE 阶段的 Structured Output Schema 会把 `checkpoint` 收紧为 stage contract 唯一允许的字面值。

## 13. 六个 M4 事件

全部接入：

1. `debris_close`
2. `solar_flare`
3. `orbital_decay`
4. `cascade_fragment`
5. `fuel_leak`
6. `end_of_life`

每个事件的三个 action ID、技术指标变化与现有 `gameData.js` 一致。AI 失败时页面保留当前事件并允许重试，不更新本地游戏状态；六个事件未全部提交时不能进入清理阶段。

## 14. 清理配对、结局与知识揭示

固定配对：

- 微小碎片 → 激光烧蚀
- 完整大型目标 → 机械臂抓取
- 寿命末期可控平台 → 阻力帆

错误配对只产生本地教学反馈，不推进故事。正确配对必须等 AI 成功后才锁卡。第三个配对、ENDING、KNOWLEDGE_REVEAL 和 completed 使用同一个提交边界；知识揭示失败时，第三个配对和结局也不会部分保存。

## 15. 三组完整故事测试

以下三组虚构输入均从 OUTLINE 跑到 completed：

- 成都：参加妹妹的婚礼
- 上海：在雨停前送达一封信
- 北京：和老朋友完成一次约定

每组均完成材料、任务、六事件、三配对、ENDING 和 KNOWLEDGE_REVEAL。

## 16. 尚未解决的问题与建议

- 部署前必须替换 D1 全零占位 ID，并执行 remote migration。
- 后续收到正式阶段 Prompt 时，只需替换 `functions/_story/prompts/` 对应文件，保持 Schema 和 service contract 不变。
- `gpt-4o-mini` 已真实验证 OUTLINE、材料 CONTINUE、OPENING 和前三个 M4 CONTINUE；完整十五阶段链路由确定性 fixture 测试覆盖。
- 本地 Express 内存仓库重启会清空；生产 Pages Functions 使用 D1，不存在此限制。
- 浏览器沙箱会拦截 Google Fonts 外链，页面使用回退字体且功能正常；如需离线完全一致，可把字体资产本地化。
- Vite 报告现有 Gltf chunk 约 951 kB；后续可单独做 3D 资源压缩或更细粒度懒加载。
- `npm install` 报告 6 个 high severity 依赖审计项，本次未执行可能带来破坏性升级的 `npm audit fix`，建议另开依赖治理任务。
