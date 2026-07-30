# Codex 任务：严格接入 STORY_OUTLINE 与 STORY_OPENING（v0.4）

请在当前仓库中完成可运行的 `STORY_OUTLINE` 与 `STORY_OPENING` 后端接入。不要只给方案、伪代码或示例；必须实际修改项目、运行校验、测试和构建，并汇报结果。

## 0. 开始前必须阅读

先完整检查仓库，确认：

- 前后端技术栈和目录结构；
- 当前 OpenAI SDK/调用封装；
- 现有故事创建入口、API、Server Action 或服务层；
- 数据库/持久化方式、事务能力和迁移机制；
- `GameState`、`TechnicalMetrics`、story state/reducer 的现有实现；
- 环境变量、日志、错误处理、测试与构建命令。

然后读取本任务包中的所有文件，并以它们为唯一规范：

```text
prompts/story_outline_prompt.md
prompts/story_opening_prompt.md
schemas/story_outline.schema.json
schemas/story_opening.schema.json
contracts/json_field_contract.md
contracts/backend_integration_contract.md
contracts/backend_validation_rules.json
fixtures/*.json
```

优先做最小、清晰、可维护的修改。沿用仓库现有架构和代码风格，不要另起一套平行后端，不要重写无关模块。

## 1. 最重要的职责边界

### AI 只负责

`STORY_OUTLINE`：

- `event_anchor`
- `primary_anomaly`
- 10 个 `story_nodes`
- 4–5 个 `reachable_endings` 的内容方向
- `initial_story_state`

`STORY_OPENING`：

- `story_text`
- `known_to_user_additions`
- `continuity_handoff`

### 后端负责

- JSON Schema 与业务语义校验；
- 运行时 `story_state`；
- 节点推进；
- 指标、用户操作、持续后果、结局判定；
- 数据库存储、事务、幂等、重试、日志和错误恢复。

### AI 不得负责

- `next_node_id`；
- 任何指标变化；
- `active_consequences` 的创建或修改；
- `last_user_action`；
- `game_state` 或 `TechnicalMetrics`；
- 结局选择；
- 数据库状态。

禁止恢复旧版 Opening 字段：

```text
state_patch
add_known_to_user
uncertainty_delta
add_active_consequences
next_node_context
next_node_id
```

## 2. Prompt 与 Schema

优先使用 OpenAI Platform 已保存 Prompt，通过配置读取 Prompt ID 与版本。建议支持：

```text
OPENAI_STORY_OUTLINE_PROMPT_ID
OPENAI_STORY_OUTLINE_PROMPT_VERSION
OPENAI_STORY_OPENING_PROMPT_ID
OPENAI_STORY_OPENING_PROMPT_VERSION
```

若项目当前使用内联 Prompt，则直接加载任务包的 Prompt/Schema 文件，作为唯一来源。禁止在路由、控制器或多个服务中复制 Prompt 文本。

变量必须使用稳定 JSON 序列化：

```text
STORY_OUTLINE: story_user_input = JSON.stringify(validatedInput)
STORY_OPENING: story_outline = JSON.stringify(validatedOutline)
```

不要硬编码 API Key，不要提交真实密钥。沿用现有 OpenAI SDK 和调用风格；若当前封装不可用，做最小修复，不要引入第二套客户端。

## 3. Outline 完整流程

实现等价服务：

```text
generateStoryOutline(input)
validateStoryOutline(output)
createRuntimeStoryState(outline.initial_story_state)
```

流程必须是：

1. 校验用户输入；
2. 调用 Outline Prompt；
3. 解析结构化 JSON；
4. 使用 `story_outline.schema.json` 校验；
5. 按 `backend_validation_rules.json` 和字段合同执行业务校验；
6. 校验通过后保存不可变 `story_outline`；
7. 深拷贝 `initial_story_state` 创建运行时 `story_state`；
8. 不得让任何后续代码直接修改 `story_outline.initial_story_state`。

Outline 至少严格验证：

- `task_type`；
- 10 个节点的数量、顺序、ID、类型和唯一性；
- 4–5 个结局、结局 ID 唯一；
- 不存在 `condition`；
- 初始节点为 `node_01`；
- 初始持续后果为空；
- `last_user_action === null`；
- 数值范围；
- 必填字符串去空白后非空；
- 事实数组去空白、禁止空项、规范化后去重；
- 不接受 Schema 之外的字段。

对 `TRAVEL_INFO_DEVIATION` 做保守语义检查：只有交通/行程本身属于核心事件，或抵达、时间、地点条件直接决定不可替代部分能否完成时才接受。不要因为文本出现“去某地”就接受。若无法可靠确定，记录清晰校验错误并按下述规则重试，不要静默接受明显赶路化的大纲。

模型结构或语义校验失败时，携带简洁错误原因自动重试一次。第二次仍失败时返回稳定错误码，不保存半成品。

## 4. Opening 完整流程

实现等价服务：

```text
generateStoryOpening(validatedOutline)
validateStoryOpening(output, runtimeState)
applyOpeningOutput(storySession, openingOutput)
```

Opening 输入使用完整、已校验的大纲，但完整大纲仅留在服务端。调用后：

1. 解析结构化 JSON；
2. 使用 `story_opening.schema.json` 校验；
3. 做轻量语义校验；
4. 保存 `node_01` 阶段；
5. 合并新已知事实；
6. 后端将 `current_node_id` 推进到 `node_02`；
7. 返回前端安全响应。

Opening 至少验证：

- 只存在三个允许字段；
- `story_text` 非空、3–5 段、中文字符长度大致 350–550；
- 不出现明显选项/分支/结局/知识解释；
- `known_to_user_additions` 为 1–4 条；
- 每条去空白后非空；
- 与 `story_state.known_to_user` 规范化去重；
- `current_situation` 非空；
- `unresolved_threads` 为 1–3 条且非空；
- 不接受任何旧字段或额外字段。

不要用大量脆弱关键词做“伪智能审查”。结构校验必须严格，叙事规则采用可解释、可测试的轻量检查。

## 5. 状态更新必须集中且原子

Outline 校验成功后：

- 保存不可变 `story_outline`；
- 深拷贝初始状态创建 `story_state`；
- `story_state.current_node_id` 仍为 `node_01`。

Opening 校验成功后，在事务或等价原子流程中：

- 插入唯一的 `node_01` stage；
- 保存原始 `known_to_user_additions` 与 `continuity_handoff`；
- 将去重后的 additions 追加到 `story_state.known_to_user`；
- 将 `story_state.current_node_id` 更新为 `node_02`；
- 不修改 `confirmed_facts`、`hidden_facts`、三个指标、持续后果、`last_user_action`；
- 将 story session 标记为可展示/READY。

`continuity_handoff` 属于阶段交接记录，不得塞进永久 `story_state`。

Opening 失败时不得推进节点、不得写入半成品 stage。重试必须幂等，保证一个 story 只有一个 `node_01` stage；优先使用数据库唯一约束、事务或 idempotency key。

## 6. 数据安全和前端响应

`story_outline` 含 `hidden_facts`：

- 不得把完整 outline 返回浏览器；
- 不得在生产日志无差别输出完整 Prompt、完整模型响应或隐藏事实；
- API 错误不得返回内部堆栈、密钥或隐藏事实。

成功响应至少提供：

```json
{
  "story_id": "...",
  "current_node_id": "node_02",
  "story_text": "..."
}
```

按项目现有前端协议适配，不要无必要破坏现有接口。

## 7. 模块化要求

不要把 OpenAI 调用、解析、Schema 校验、业务校验、数据库写入和 HTTP 返回堆在一个函数。沿用项目结构，至少形成等价边界：

```text
OpenAI adapter
Prompt/schema config
Outline service + validator
Opening service + validator
Story state reducer/service
Persistence/transaction layer
Route/controller
```

所有状态变化必须集中在 reducer/service 中，不能由前端或模型响应直接覆盖数据库对象。

## 8. 未来扩展必须保留的重要原则

这次不实现 Continue/Branch，但当前代码不能阻碍以下架构：

> 轻后端判定 + AI 动态叙事。

未来用户点击网站按钮时：

- 后端把 `action_id` 或固定游戏结果映射为 `POSITIVE / PARTIAL / NEGATIVE`；
- 后端负责指标、节点、操作记录和固定 consequence ID；
- 不把与故事无关的按钮文案强行交给 AI；
- AI根据当前故事状态和结果等级生成符合语境的影响；
- AI不判断用户是否选对，不修改指标，不创造自由文本后果标签，不决定节点或结局。

持续后果必须使用固定 ID，中文只用于展示。

## 9. 测试要求

必须使用 `fixtures/` 编写或扩展测试，至少覆盖：

### Schema/业务单元测试

- 合法 Outline 通过；
- 节点缺失、错序、重复、类型错误被拒绝；
- 旧 `condition` 被拒绝；
- 初始后果非空、起始节点错误被拒绝；
- 合法 Opening 通过；
- 旧 `state_patch` / `next_node_id` 被拒绝；
- threads 数量错误被拒绝；
- known facts 规范化去重。

### Service/流程测试

- Outline 成功创建不可变 outline 与独立 runtime state；
- 修改 runtime state 不会影响 outline.initial_story_state；
- Opening 成功后只推进到 `node_02`；
- Opening 不修改指标、后果或 last action；
- Opening 失败不推进、不写半成品；
- 相同幂等请求不会重复创建 node_01；
- 前端响应不包含 `hidden_facts`。

Mock 模型调用时，使用 fixtures 的合法/非法输出。若仓库已有集成测试环境，可增加一条完整“创建故事并返回 Opening”的测试，但不得依赖真实 API Key 才能运行默认测试。

## 10. 验证与最终汇报

完成后运行仓库实际可用的：

- 单元/集成测试；
- 类型检查；
- lint；
- build。

修复由本次修改引入的问题。若存在仓库原有失败，明确区分并提供证据，不要声称全部通过。

最终回复必须列出：

1. 阅读到的现有架构；
2. 修改/新增文件；
3. 实际数据流；
4. Schema 与业务校验实现位置；
5. 事务、幂等、错误与重试策略；
6. 前端如何调用；
7. 运行的命令和结果；
8. 尚未完成或需要人工配置的事项（例如 Prompt ID 环境变量）。

不要只输出建议。请现在开始检查仓库并完成实现。
