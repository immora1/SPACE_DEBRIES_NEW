# AI 故事五节点低频生成验收与性能报告

日期：2026-08-09  
模型：`gpt-5.6-luna`  
故事流版本：`FIVE_STAGE_V1`

## 1. 新旧调用频率

旧流程的名义完整调用序列为：Outline、Opening、M2、Mission、Q1、Q2、Q3、Q4、Q5、Q6、Ending、Knowledge，共 12 次模型调用，其中 Continue 8 次。

新流程固定为：Outline、Opening、Story Stage 1、Story Stage 2、Story Stage 3、Ending、Knowledge，共 7 次名义模型调用，其中 Continue 3 次。名义模型调用减少 41.7%，Continue 调用减少 62.5%；轨道游戏从 6 次 Continue 降为 Q1 后的 1 次 Continue。

| 故事节点 | 生成来源 | 生成时机 |
|---|---|---|
| `node_01` Opening | 用户输入与 Outline | 创建故事时同步生成 |
| `node_02` Stage 1 | M2 四组材料 | M2 原子提交后异步生成 |
| `node_03` Stage 2 | M3 单个任务 | M3 原子提交后异步生成 |
| `node_04` Stage 3 | 轨道游戏 Q1 | Q1 原子提交后异步生成 |
| `node_05` Ending | Q1–Q6 最终累计状态 | Q6 后由后端选结局，等待 Stage 3 handoff 后生成 |
| Knowledge | 故事异常与 M2/M3/M4/M6 真实快照 | M6 完成后独立生成，不计入故事节点 |

Q2–Q5 只保存答案、数值变化、consequence 与 key outcome；Q6 同样不生成 Continue，只冻结最终状态并创建 Ending。游戏提交不等待 OpenAI，Stage 3 失败也不会回滚 Q1 或锁住 Q2–Q6。

## 2. Prompt、Schema 与职责边界

- Outline 的运行时源位于 `docs/space_debris_outline_opening_v0.4/prompts/story_outline_prompt.md`，由 `scripts/generate-story-spec-assets.mjs` 同步到 `functions/_story/spec-assets.generated.js`。
- Outline Schema 的基础源位于 `docs/space_debris_outline_opening_v0.4/schemas/story_outline.schema.json`，运行时补丁固定 `story_nodes.length = 5`、`node_01` 至 `node_05` 与结构化 `state_rule`。
- Continue Prompt/Schema 只允许 `node_02`、`node_03`、`node_04`；Stage 3 Context 在 Q1 提交时冻结，不含 Q2–Q6 的未来答案。
- Ending Prompt/Schema 固定 `node_05`。后端先执行 `selectEnding()`，模型返回的 `selected_ending_id` 不一致时拒绝保存。
- Knowledge 在公开时间线中的 `node_id` 为 `null`，与五个故事节点分离；内部兼容契约仍保留历史 `node_10` 标记，不会进入新 Outline 或前端节点导航。
- 三项状态 `event_integrity`、`relationship_connection`、`uncertainty` 始终由后端逐字段累加并 clamp 到 0–100；模型不修改状态、节点、后果或结局。

## 3. 真实端到端结果

真实 HTTP/OpenAI 流程完成，未使用 mock：

```text
Outline → Opening → M2 → Stage 1 → Mission → Stage 2
→ Q1 / Stage 3 enqueue → Q2–Q5 state only → Q6 / Ending enqueue
→ M6 三次配对 → Knowledge → completed
```

最终公开时间线：

```text
node_01 Opening
node_02 Story Stage 1
node_03 Story Stage 2
node_04 Story Stage 3
node_05 Ending
Knowledge Reveal (node_id = null)
```

本次样本耗时：

| 项目 | 实测 |
|---|---:|
| 故事创建（含 Outline 一次定向重试 + Opening） | 49,671 ms |
| M2 确认 API | 9 ms |
| Mission 确认 API | 4 ms |
| Q1–Q6 确认 API | 3–11 ms / 次 |
| M6 三次配对 API | 2–3 ms / 次 |
| M6 完成 API | 3 ms |
| Stage 1 成功生成 | 11,961 ms |
| Stage 2 成功生成 | 12,069 ms |
| Stage 3 首轮失败耗时 | 13,358 ms |
| Stage 3 定向重试成功 | 11,313 ms |
| Ending | 12,664 ms |
| Knowledge | 18,167 ms |
| Provider 总耗时 | 115,750.9 ms |
| 合成无停顿脚本记录的 user-visible wait | 146,186 ms |

本次实际调用 9 次：名义 7 次，加上 Outline 和 Stage 3 各一次业务校验重试；Continue 实际 4 次，名义稳定路径为 3 次。重试上限仍为一次，第二次失败会保留网站已提交状态并将生成标记为可恢复失败。

本次脚本连续、无阅读停顿地提交所有操作，因此 `prefetch_hit_count = 0`、`prefetch_miss_count = 4`。这个结果证明游戏 API 未等待模型，但不能代表真实用户阅读节奏下的命中率；上线后必须用真实停留时间继续观测。

## 4. Outline 可达性修复

真实模型首次生成的四个非 fallback 结局均无法被真实选项路径命中。后端没有放宽校验，也没有保存部分 Outline，而是从实际 M2、M3、Q1–Q6 配置枚举出的可达状态空间中生成精确规则提示，只允许一次定向重试。

首次 Outline 继续使用 `reasoning_effort=low`；只有 `OUTLINE_ENDING_UNREACHABLE` 的唯一重试使用 `medium`，并接收完整、未被 320 字截断的后端规则。真实复测已通过。该机制仍保持“AI 返回完整结构 → JSON Schema 校验 → 业务校验 → 原子保存”的边界。

## 5. 自动化与工程验证

| 验证 | 结果 |
|---|---|
| `npm run test:story` | 91/91 通过 |
| `node --test src/services/*.test.mjs` | 11/11 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 通过，2,783 modules，22.44 s |
| 本地 D1 migration check | 通过，No migrations to apply |
| `git diff --check` | 通过，仅有既有 LF/CRLF 提示 |
| 后端 `/api/health` | HTTP 200，memory-dev-only |
| 真实模型完整流程 | 通过，Ending 与 Knowledge 均存在，故事 completed |

生产构建仍有既有 `Gltf` chunk 大于 500 kB 的非阻塞警告，与本次故事流修改无关。

## 6. 兼容、部署与风险

- 新故事写入 `story_flow_version = FIVE_STAGE_V1`，不迁移运行中的旧 Outline。
- 新流程不会进入 `node_06` 至 `node_10` 的历史叙事路径；旧 Prompt/测试文档与兼容代码仍保留以读取或处理历史数据。
- 本地迁移 `0008_story_artifact_lookahead.sql` 已验证；没有执行远程 D1 迁移，也没有修改或输出 API Key、远程 D1 ID。
- 部署前需要在目标环境应用尚未部署的迁移、确认现有 `OPENAI_API_KEY` 与可选阶段模型配置，并在远程健康检查后运行一次 smoke/E2E。
- 本次只完成一个真实完整样本，9 次实际调用不能视为生产 SLA。需要重点监控 Outline/Stage 3 retry rate、`model_calls_per_story`、`continue_calls_per_story`、provider 总耗时、前瞻命中率和用户可见等待。
- 未根据按钮文案猜测或改写 delta/consequence；现有真实配置已通过一致性、累计、边界与 Ending 回归测试。其叙事含义仍可由策划做内容复核，但当前没有阻止上线的代码、测试或构建错误。
