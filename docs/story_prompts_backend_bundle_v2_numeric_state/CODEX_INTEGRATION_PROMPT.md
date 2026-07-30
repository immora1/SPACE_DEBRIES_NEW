# Codex 任务：以真实数值状态接入 STORY_CONTINUE、STORY_ENDING、KNOWLEDGE_REVEAL

请在当前项目中接入以下阶段，并与已完成的 `STORY_OPENING / node_01` 保持同一套架构和编码风格：

- `STORY_CONTINUE`：`node_02` 至 `node_08`，其中 `STORY_BRANCH` 复用同一 Prompt
- `STORY_ENDING`：`node_09`
- `KNOWLEDGE_REVEAL`：`node_10`

本版本废弃 `POSITIVE / PARTIAL / NEGATIVE`。新请求不得写入或传递这些等级。每个用户选项必须使用真实数值增量影响累计状态，后端负责计算、持久化和结局选择，模型只负责叙事。

请先审查现有项目，再做最小修改。不要重写可用的 Opening、System Prompt、数据库访问层或模型封装。

## 1. 单一事实来源

使用本包中的文件：

```text
01_story_continue.prompt.txt
01_story_continue.schema.json
02_story_ending.prompt.txt
02_story_ending.schema.json
03_knowledge_reveal.prompt.txt
03_knowledge_reveal.schema.json
04_backend_contracts.schema.json
00_outline_numeric_state_patch.md
```

如果项目使用远程 Prompt ID，按现有方式创建或更新远程 Prompt，并保持变量名：

```text
continue_context
ending_context
knowledge_context
```

不要同时引入第二套 Prompt 管理方式。

## 2. 开工前必须完成的检查

在修改代码前检查并记录：

1. Opening 如何调用模型、传变量、启用 Structured Output、解析和持久化。
2. `story_outline`、故事实例、节点记录、用户操作、选项配置和累计状态的真实存储位置。
3. `initial_story_state` 是否已经包含 `event_integrity`、`relationship_connection`、`uncertainty`。
4. 当前选项数据是内嵌在节点、引用 `option_set_id`，还是来自独立配置表。
5. 每个选项现有字段及状态值来源；不要凭文案猜测增量。
6. 旧版 `interaction_result` 是否已落库、被接口引用或被前端使用。
7. 是否已有 consequence、known facts、handoff、幂等键、版本号和并发控制。
8. reachable endings 是否已有可执行规则；若没有，按 `00_outline_numeric_state_patch.md` 做最小补丁。

最终报告中列出复用点、迁移点和未修改区域。

## 3. 不可违反的架构边界

### 后端负责

- 精确读取当前节点与该节点真实选项数组；
- 保留每个节点实际配置的选项数量；
- 校验用户选择的 `option_id`；
- 读取该选项的数值增量和具体故事效果；
- 计算 before、delta、after，并将结果限制在0至100；
- 增加或解决 consequence；
- 累计 known facts 与 key outcomes；
- 选择 node_09 的结局；
- 节点推进、幂等、事务、并发、日志和错误恢复。

### 模型负责

- 根据后端给出的当前节点、具体操作效果和数值变化生成故事；
- 生成 handoff 与新增已知事实；
- 根据后端已经选定的 ending 写结局；
- 在 node_10 解释故事中实际使用的异常机制。

### 禁止

- 让模型读取按钮文案后判断好坏；
- 让模型输出或修改状态值；
- 继续使用 `interaction_result` 或三档等级；
- 把完整历史正文或聊天历史发送给模型；
- 让 Ending 模型从候选结局中自行选择；
- 根据节点类型硬编码所有节点都显示三个选项；
- 为凑数量补选项、截断第四个选项或打乱原顺序。

## 4. 数值状态模型

复用项目已有字段；若缺失，按以下语义最小补齐：

```ts
type StoryState = {
  event_integrity: number;          // 0..100，越高表示核心事件越完整
  relationship_connection: number;  // 0..100，越高表示关系与合作越稳固
  uncertainty: number;              // 0..100，越高表示信息和结果越不确定
};
```

要求：

1. 只接受整数；持久化前 clamp 到 `[0, 100]`。
2. 初始值来自 `story_outline.initial_story_state`，不得在 Opening 后重新初始化。
3. 每次选择必须保存 `state_before`、`state_delta`、`state_after`。
4. `state_after = clamp(state_before + state_delta)`，逐字段计算。
5. 不允许模型响应覆盖任何数值。
6. 新写入数据不再保存三档结果字段。

建议使用一个纯函数：

```ts
applyStateDelta(before, delta): after
```

并对边界、负数、上限、重试和重复提交编写单元测试。

## 5. 选项配置与三/四选项处理

### 5.1 选项是节点级数据，不是阶段级常量

Codex 必须从当前节点真实绑定的选项数组判断数量：

```ts
const options = resolveOptionsForNode(story, currentNodeId);
const optionCount = options.length;
```

交互节点允许3或4个选项：

```text
options.length === 3  -> 原样保留并展示3个
options.length === 4  -> 原样保留并展示4个
```

不得根据 `STORY_CONTINUE` 或 `STORY_BRANCH` 固定数量。不得默认只取前三个。不得新增占位选项。Ending 和 Knowledge 不生成选择项。

若交互节点解析出的数量不是3或4，停止该节点流程并返回可诊断的配置错误，不能静默修复。

### 5.2 每个选项必须具备的后端字段

在不破坏现有前端字段的前提下，使每个选项至少可解析为：

```ts
type StoryOption = {
  option_id: string;
  label: string; // 只给前端展示，不传给模型
  effect_summary: string; // 具体说明该操作在当前故事中造成什么效果
  state_delta: {
    event_integrity: number;
    relationship_connection: number;
    uncertainty: number;
  };
  add_consequence_ids: string[];
  resolve_consequence_ids: string[];
  key_outcome: string; // 没有持久关键结果时使用空字符串
};
```

规则：

- `option_id` 在当前节点内唯一；
- 三个 delta 字段必须全部存在且为整数；
- 除非产品明确允许中性选择，否则三个 delta 不得同时为0；
- `effect_summary` 必须是具体故事效果，不是“较好结果”“一般结果”等等级描述；
- 原始 `label` 不传给模型，避免网站按钮文案污染故事；
- consequence ID 必须在已有 consequence 配置中存在；
- 同一个 ID 不得同时出现在 add 和 resolve；
- 前端按原数组顺序渲染，后端按 `option_id` 校验，不能依赖数组下标作为永久标识。

若当前项目的状态值已存在于选项配置中，原样复用。若缺失，不要根据按钮文案自动猜值；应新增明确配置并在最终报告中列出所有缺失项。

### 5.3 选项选择流程

1. 读取数据库中的 `current_node_id` 和 version。
2. 解析该节点完整选项数组，并保留实际3或4个。
3. 验证提交的 `option_id` 属于该数组。
4. 读取选项的 `state_delta`、`effect_summary`、consequence 变化和 `key_outcome`。
5. 基于当前落库状态计算 `state_after`。
6. 在内存中生成“待提交”的 consequence 状态和 key outcome 台账。
7. 构建 Continue 输入并调用模型。
8. 模型和业务校验通过后，使用短事务一次性提交操作、状态、后果、节点输出、known facts、handoff 和节点推进。

模型失败时不得写入 state_after，也不得消费用户选择。

## 6. Continue 后端输入

实现或适配：

```ts
buildContinueContext(...)
```

只返回：

```json
{
  "current_node": {
    "node_id": "node_02 至 node_08",
    "task_type": "STORY_CONTINUE 或 STORY_BRANCH",
    "summary": "Outline 原始 summary",
    "entry_condition": "Outline 原始 entry_condition"
  },
  "selected_option_effect": {
    "option_id": "当前已验证的选项ID",
    "effect_summary": "该选项配置中的具体故事效果"
  },
  "state_transition": {
    "before": {
      "event_integrity": 0,
      "relationship_connection": 0,
      "uncertainty": 0
    },
    "delta": {
      "event_integrity": 0,
      "relationship_connection": 0,
      "uncertainty": 0
    },
    "after": {
      "event_integrity": 0,
      "relationship_connection": 0,
      "uncertainty": 0
    },
    "active_consequences": [
      {
        "consequence_id": "id",
        "description": "模型可理解的持续结果"
      }
    ]
  },
  "previous_handoff": {
    "current_situation": "上一节点最新状态",
    "unresolved_threads": ["仍未解决的问题"]
  },
  "story_context": {
    "core_event": "核心事件",
    "irreplaceable_part": "不可替代部分",
    "primary_anomaly": "主要异常"
  },
  "known_to_user": ["累计已知事实"]
}
```

字段来源：

- `current_node`：按 node ID 从 Outline 精确读取，禁止重写 summary/entry_condition；
- `selected_option_effect`：来自本次选项配置，不传 label；
- `before`：本次操作前数据库状态；
- `delta`：选项配置中的原始数值；
- `after`：后端纯函数计算结果；
- `active_consequences`：应用本次 add/resolve 后仍有效的 consequence，传 ID 和可读描述；
- `previous_handoff`：node_02 读取 Opening 输出，node_03 至 node_08 读取上一 Continue 输出；
- `story_context`：只取 Outline 的核心字段，不传完整大纲；
- `known_to_user`：初始 known facts 加所有已完成节点 additions，规范化去重并保留首次出现顺序。

调用前做一致性校验：

```text
after === clamp(before + delta)
selected option 属于当前节点
active consequences 与待提交状态一致
current_node 与数据库 current_node_id 一致
```

Continue 输出不含状态字段，这是有意设计。状态以本次后端计算结果为准。

## 7. 数值规则驱动的 Ending 选择

Ending 必须由后端在调用模型前选定。

### 7.1 结局规则来源

优先复用现有结构化 ending rules。若不存在，按 `00_outline_numeric_state_patch.md` 给 `reachable_endings[]` 增加 `state_rule`。禁止让模型阅读 outcome 后自行判断结局。

### 7.2 规则评估

实现纯函数：

```ts
selectEnding({ reachableEndings, storyState, activeConsequenceIds })
```

规则：

1. 验证每个 `state_rule` 引用合法 metric/operator/consequence ID。
2. 验证每个故事恰好有一个 fallback。
3. 按 priority 从高到低评估非 fallback 规则。
4. 一条规则只有在所有 numeric conditions、required consequence 和 forbidden consequence 都满足时才命中。
5. 多条命中时：priority 高者优先；再比较约束总数；仍相同按 Outline 原始顺序。
6. 无规则命中时选择 fallback。
7. 保存规则评估轨迹，至少包含 state snapshot、命中/未命中原因和 selected ending ID，便于调试；不要把轨迹传给模型。

不要在代码中散落固定分数阈值。阈值属于每个故事的 `state_rule` 数据。

### 7.3 Ending 输入

实现：

```ts
buildEndingContext(...)
```

只返回：

```json
{
  "current_node": {
    "node_id": "node_09",
    "task_type": "STORY_ENDING",
    "summary": "Outline 原始 summary",
    "entry_condition": "Outline 原始 entry_condition"
  },
  "selected_ending": {
    "ending_id": "后端已选择的 ending_id",
    "outcome": "对应 reachable ending 的原始 outcome"
  },
  "previous_handoff": {
    "current_situation": "node_08 最新状态",
    "unresolved_threads": ["结局需回收的问题"]
  },
  "story_context": {
    "core_event": "核心事件",
    "user_expectation": "用户期待",
    "irreplaceable_part": "不可替代部分",
    "primary_anomaly": "主要异常"
  },
  "story_state": {
    "event_integrity": 0,
    "relationship_connection": 0,
    "uncertainty": 0
  },
  "active_consequences": [
    {
      "consequence_id": "id",
      "description": "仍持续的结果"
    }
  ],
  "key_outcomes": ["真正影响结局的关键事实"],
  "known_to_user": ["累计已知事实"]
}
```

`key_outcomes` 来自后端台账，不从完整正文临时总结。来源只包括：

- 选项配置中的非空 `key_outcome`；
- consequence 的新增、持续和解决；
- STORY_BRANCH 形成的持久事实；
- 核心物件、核心动作、承诺是否完成的结构化记录；
- node_08 handoff 中直接决定结局的事实。

去重后建议4至12条。不得传完整 story stages。

Ending 响应必须验证：

```text
task_type === STORY_ENDING
node_id === node_09
selected_ending_id === ending_context.selected_ending.ending_id
next_node_id === node_10
```

模型无权改变 selected ending。

## 8. Knowledge 输入

实现：

```ts
buildKnowledgeContext(...)
```

结构保持：

```json
{
  "current_node": {
    "node_id": "node_10",
    "task_type": "KNOWLEDGE_REVEAL",
    "summary": "Outline 原始 summary"
  },
  "primary_anomaly": "主要异常",
  "hidden_facts": ["与该异常有关的隐藏事实"],
  "ending_summary": "Ending 输出",
  "next_node_context": "Ending 输出",
  "story_anomaly_effects": ["故事中实际出现的异常及影响"]
}
```

规则：

- hidden facts 来自 Outline，只传与 primary anomaly 相关内容；
- ending summary 与 next node context 直接读取已保存的 Ending；
- anomaly effects 优先来自 next node context 和已有 anomaly 台账，1至4条；
- 不调用另一个模型总结历史，不传完整大纲或正文；
- Knowledge 不读取或修改数值状态。

## 9. 与 Opening 和旧版本接轨

1. Opening 的 Prompt 与输出 Schema 保持不变。
2. 创建故事实例时，从 Outline 的 `initial_story_state` 写入三个数值字段。
3. node_02 的 `previous_handoff` 直接使用 Opening 的 `continuity_handoff`。
4. Opening 结束后展示哪个选项集合，继续沿用项目现有节点/选项绑定机制；只修复“固定取3个”的实现。
5. 删除新流程对 `interaction_result` 的读取和写入。
6. 若数据库中存在旧测试记录：
   - 旧记录可只读保留；
   - 不要在新生成流程中动态把旧三档结果换算成数值；
   - 需要续写的旧故事必须有明确的数值状态快照，否则标记为旧版本不可续写或执行一次受控迁移；
   - 迁移映射必须来自已有 option/state 配置，不能由 Codex猜测。
7. API 响应如仍包含旧等级字段，先确认前端是否使用；若无使用，移除；若仍使用，提供短期兼容字段但不落库，并在代码中标记弃用。

## 10. 独立模型调用

三个阶段复用 Opening 已验证的底层调用函数。每次调用：

- 只传一个 JSON 变量；
- 不传历史 messages、previous response ID 或长期模型会话；
- 使用对应 Structured Output Schema；
- 先做 JSON Schema 校验，再做业务跨字段校验；
- 最多一次受控重试；
- 记录 story ID、node ID、stage、prompt version、request ID 和脱敏错误；
- 不记录完整私密故事正文。

## 11. 幂等、并发与原子提交

每个选择请求必须有稳定幂等键，例如：

```text
story_id + current_node_id + option_id + client_action_id
```

推荐流程：

1. 短事务校验 version/current node，创建 `generation_pending`，保存 state_before 和选项配置快照。
2. 事务外调用模型。
3. 返回后再次校验 story version 与 pending 状态。
4. 短事务一次性写入：用户操作、state_delta、state_after、consequence 变化、key outcome、模型输出、known facts、handoff、next node、version。
5. 版本冲突时不提交模型结果，不重复应用状态。

重复请求处理：

- 已成功：返回已保存结果；
- 处理中：返回处理中或复用同一任务；
- 可重试失败：复用同一 pending/action ID，不重新应用 delta；
- 不得出现“状态已变但节点没生成”的半完成数据。

## 12. 运行时校验

复用现有 Zod/Pydantic/JSON Schema/Joi，不新增重复依赖。至少校验：

### Option set

- 交互节点选项数恰好为3或4；
- option ID 唯一；
- 三个 delta 字段齐全且为整数；
- consequence 引用合法；
- effect summary 非空。

### Continue context

- node 为 node_02 至 node_08；
- before/delta/after 数学一致；
- after 在0至100；
- selected option 属于当前节点；
- 不含 label、完整历史正文或旧等级字段。

### Ending context

- node 固定 node_09；
- selected ending 来自 reachable endings；
- selected ending 是规则引擎的结果；
- state 是 node_08 后最终快照；
- 不含 ending candidates 或自然语言 conditions。

### Knowledge context

- node 固定 node_10；
- anomaly 非空；
- ending outputs 已成功保存；
- anomaly effects 至少1条；
- 不含状态写入字段。

## 13. 测试要求

至少补充：

1. 三选项节点原样返回3个；
2. 四选项节点原样返回4个，第四个不会被截断；
3. 非3/4数量配置失败并给出可诊断错误；
4. 不同选项产生不同 delta，after 计算正确；
5. clamp 处理0和100边界；
6. 相同请求不会重复累计状态；
7. consequence add/resolve 与 active 列表一致；
8. node_02 正确读取 Opening handoff；
9. Continue 输入不含按钮 label 和旧等级字段；
10. Ending 规则命中、并列消解和 fallback；
11. Ending 模型返回错误 ending ID 时被拒绝；
12. Knowledge 只有 Ending 成功后才能完成；
13. 并发提交只有一个成功推进；
14. 模型失败时状态、后果和节点均不改变。

## 14. 完成标准

交付前确认：

- node_02 至 node_08 使用数值状态的 Continue；
- 全部新流程不再使用三档等级；
- 每个交互节点按真实选项数组保留3或4个；
- 状态变化可追踪到具体 option ID；
- node_09 由后端规则选择结局，模型只写正文；
- node_10 输出分块知识内容；
- 每个模型阶段独立调用；
- 输入上下文无完整历史正文；
- 幂等、事务、并发和失败恢复通过测试；
- Opening 现有流程未被破坏。

最终回复请包含：修改文件、数据迁移、接口变化、Prompt/Schema 配置、测试结果、仍需人工配置的 option delta 或 ending rules。不要声称未运行的测试已经通过。
