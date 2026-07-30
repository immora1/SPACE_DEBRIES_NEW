# JSON 字段级数据契约
## STORY_OUTLINE 与 STORY_OPENING v0.4

本文档定义每个 JSON 字段的语义、所有权、保存位置和校验规则。Prompt 保持精简；严格性由响应 Schema 与后端业务校验共同保证。

## 1. 总体所有权

| 数据 | 生成者 | 后端能否修改 | 保存位置 | 是否返回前端 |
|---|---|---:|---|---:|
| `story_outline` | Outline AI | 否；校验通过后视为不可变 | 故事会话/大纲记录 | 默认不返回完整对象 |
| `story_outline.initial_story_state` | Outline AI | 否 | 不可变大纲 | 否 |
| `story_state` | 后端 | 是 | 运行时状态 | 只返回前端需要的安全字段 |
| `story_opening.story_text` | Opening AI | 后端只做校验和保存 | `story_stages` | 是 |
| `known_to_user_additions` | Opening AI | 后端去重、过滤后合并 | 阶段记录 + `story_state.known_to_user` | 可按需返回 |
| `continuity_handoff` | Opening AI | 后端只保存 | `story_stages` | 通常不需要完整返回 |
| 节点推进、指标、持续后果、结局判定 | 后端 | 是 | `story_state`/后端配置 | 只返回必要结果 |

完整 `story_outline` 含有 `hidden_facts`，不得直接下发到浏览器。生产日志也不得无差别记录完整 Prompt 输入或隐藏事实。

## 2. Outline 字段合同

### `task_type`

- 允许值：仅 `STORY_OUTLINE`。
- 禁止：任何其他任务类型或自由文本。

### `event_anchor.characters[]`

- `label`：人物称呼、昵称或中性标识。
- `relationship`：与用户或事件的中性关系说明。
- 只允许记录用户明确提供的人物；不得推断性别、年龄、职业。
- 后端校验：数组至少一项；每项去除首尾空白后非空；同一 `label + relationship` 不得重复。

### `event_anchor.time`

- 只写用户明确给出的时间或忠实概括。
- 信息不足时不得擅自补出具体日期、钟点或时长。

### `event_anchor.location`

- 只写重要事件地点。
- 用户所在城市只有在它属于重要事件时才能出现。

### `event_anchor.core_event`

- 描述事件本身和必须完成的核心动作。
- 禁止写异常技术原因、结局判定规则或节点计划。

### `event_anchor.user_expectation`

- 描述用户希望实现的具体结果。
- 不得把模型推测写成用户期待。

### `event_anchor.core_emotion`

- 只能从事件语义合理归纳情绪。
- 不得加入用户没有表达、且无法由事件支持的强烈心理结论。

### `event_anchor.irreplaceable_part`

- 必须指出无法由普通替代方案弥补的动作、关系或时刻。
- 不是把 `core_event` 原句重复一遍，而是指出“为什么这件事不可替代”。

### `event_anchor.facts_to_preserve[]`

- 每项必须是后续节点不可违背的独立事实。
- 只包含已确认事实，不包含剧情计划、模型推测、技术解释或结局条件。
- 后端校验：至少一项；去空白后非空；规范化后去重。

### `primary_anomaly`

允许值仅为：

- `NAVIGATION_OFFSET`
- `MESSAGE_DELAY`
- `COMMUNICATION_INTERRUPTION`
- `TIME_SYNC_ERROR`
- `WEATHER_UPDATE_DELAY`
- `TRAVEL_INFO_DEVIATION`

业务规则：整条故事只有一个主要异常机制。`TRAVEL_INFO_DEVIATION` 只有在交通/行程本身是核心，或抵达、时间、地点条件直接决定不可替代部分能否完成时才可接受。不能因为故事里出现“去某地”就自动选它。

### `story_nodes[]`

- 必须正好 10 项并按顺序排列。
- `node_id` 与 `task_type` 必须严格匹配：

| 顺序 | node_id | task_type |
|---:|---|---|
| 1 | `node_01` | `STORY_OPENING` |
| 2 | `node_02` | `STORY_CONTINUE` |
| 3 | `node_03` | `STORY_CONTINUE` |
| 4 | `node_04` | `STORY_BRANCH` |
| 5 | `node_05` | `STORY_CONTINUE` |
| 6 | `node_06` | `STORY_BRANCH` |
| 7 | `node_07` | `STORY_CONTINUE` |
| 8 | `node_08` | `STORY_CONTINUE` |
| 9 | `node_09` | `STORY_ENDING` |
| 10 | `node_10` | `KNOWLEDGE_REVEAL` |

- `summary`：只规划当前节点应推进的内容，不写正式正文，不替用户选择。
- `entry_condition`：描述进入节点前已经成立的故事状态；不是 SQL、代码或结局判定表达式。
- 后端校验：顺序、唯一性、非空、固定映射全部严格验证。

### `reachable_endings[]`

- 4 至 5 项。
- `ending_id`：`ending_01` 至 `ending_05`，不得重复。
- `ending_type`：只能使用 Schema 中的五种枚举。
- `outcome`：描述该结局的内容方向，必须体现核心事件、人物关系或不可替代部分的实际差异。
- 禁止字段：`condition`。结局选择由后端决定。

### `initial_story_state.confirmed_facts[]`

- 只记录用户已经明确提供并确认的事实。
- 不得写模型推断、开场后才会发生的事实或技术原因。

### `initial_story_state.known_to_user[]`

- 只记录进入 `node_01` 前用户已经知道的信息。
- 不得提前加入开场中才被察觉的异常。

### `initial_story_state.hidden_facts[]`

- 只保存后续连续性所需、尚未向用户揭示的内部事实。
- 可以包含异常真实机制的内部方向，但不得在 Opening 输出或前端响应中泄露。
- 不得把未经支持的猜测当作确定事实。

### `initial_story_state` 其余字段

- `event_integrity`：0–100，通常 100。
- `relationship_connection`：0–100，信息不足时 50。
- `uncertainty`：5–15。
- `current_node_id`：固定 `node_01`。
- `active_consequences`：固定空数组。当前阶段不得写自由中文标签。
- `last_user_action`：固定 `null`。

校验通过后，后端深拷贝 `initial_story_state` 创建运行时 `story_state`。后续任何代码都不得直接修改 `story_outline.initial_story_state`。

## 3. Opening 字段合同

### `story_text`

- 直接展示给用户。
- 第二人称“你”，3 至 5 个自然段，约 350 至 550 个中文字符。
- 从正在发生的生活场景切入，自然带出人物、物件和约定。
- 只引入第一次轻微异常，不解释技术原因，不造成最终损失。
- 必须停在尚未解决的细节上。
- 禁止：选项、分支、结局、知识解释、后续节点正文。

后端采用轻量语义校验：非空、段落数、近似中文字符长度、不得出现明显选项结构。不要用脆弱的大量关键词规则替代模型质量评估。

### `known_to_user_additions[]`

- 只记录 Opening 正文中新察觉或确认的独立事实。
- 不得重复 `initial_story_state.known_to_user`。
- 不得把“仍未完成”等已有状态仅换一种说法后再次加入。
- 不得泄露 `hidden_facts`。
- 每条必须能在 `story_text` 中找到事实依据。
- 后端先规范化空白并去重，再合并到 `story_state.known_to_user`。
- 如果去重后为空，不得因此修改其他状态或凭空补值。

### `continuity_handoff.current_situation`

- 只描述 `node_01` 结束时的最新现场状态。
- 必须覆盖：人物位置、重要物件状态、已经发生的异常或变化。
- 不复述整段故事，不包含下一节点规划，不包含技术解释。
- 保存于当前 `story_stage`，不要写入永久 `story_state`。

### `continuity_handoff.unresolved_threads[]`

- 1 至 3 项。
- 每项是本阶段结束时仍可由后续节点推进的问题。
- 不得包含已经解决的问题、隐藏技术原因或预先确定的未来事件。

## 4. AI 禁止输出的字段

Opening 响应不得出现：

- `state_patch`
- `add_known_to_user`
- `uncertainty_delta`
- `add_active_consequences`
- `next_node_context`
- `next_node_id`
- `node_id`
- `task_type`
- 任意指标、`game_state` 或 `TechnicalMetrics`

由于 Schema 设置 `additionalProperties: false`，出现任何上述字段都应校验失败。

## 5. 后端更新规则

Outline 成功：

1. 保存不可变 `story_outline`。
2. 深拷贝 `initial_story_state` 创建 `story_state`。
3. 不向前端返回 `hidden_facts`。

Opening 成功：

1. 保存 `story_text`、原始 `known_to_user_additions` 和 `continuity_handoff` 到 `story_stages`。
2. 对 additions 规范化、去重，并追加到 `story_state.known_to_user`。
3. 将 `story_state.current_node_id` 从 `node_01` 推进为 `node_02`。
4. 不修改任何指标、持续后果或 `last_user_action`。
5. 所有写入在事务或等价原子流程中完成；失败时不得留下半更新状态。
