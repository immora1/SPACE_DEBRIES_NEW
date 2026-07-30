# Outline 数值状态补丁（最小修改）

后端要依据真实累计数值确定结局，Outline 必须提供可执行的结构化结局规则。自然语言 `condition` 不够可靠，也不能让 Ending 模型临时选择。

## 保留的初始状态

`initial_story_state` 至少包含以下0至100整数：

```json
{
  "event_integrity": 70,
  "relationship_connection": 65,
  "uncertainty": 35
}
```

语义固定：

- `event_integrity`：越高，核心事件和不可替代部分越完整
- `relationship_connection`：越高，人物关系与合作越稳固
- `uncertainty`：越高，信息、时间或结果越难确认

## reachable_endings 最小新增字段

在每个 `reachable_endings[]` 项目中新增 `state_rule`：

```json
{
  "ending_id": "ending_02",
  "ending_type": "原有字段可继续保留，但不传给 Ending 模型",
  "outcome": "结局方向",
  "state_rule": {
    "priority": 20,
    "conditions": [
      {
        "metric": "event_integrity",
        "operator": "gte",
        "value": 50
      },
      {
        "metric": "uncertainty",
        "operator": "lte",
        "value": 70
      }
    ],
    "required_consequence_ids": [],
    "forbidden_consequence_ids": [],
    "fallback": false
  }
}
```

支持的 `metric`：

```text
event_integrity
relationship_connection
uncertainty
```

支持的 `operator`：

```text
gte | lte | gt | lt | eq
```

规则要求：

1. 每个 `ending_id` 只能有一条 `state_rule`。
2. 每个故事必须且只能有一个 `fallback: true` 的结局；fallback 的 `conditions`、`required_consequence_ids` 和 `forbidden_consequence_ids` 必须为空。
3. 非 fallback 规则按 `priority` 从高到低评估。
4. 多条规则同时命中时，先选 `priority` 更高者；仍相同则选约束数量更多者；仍相同则按 `reachable_endings` 原始顺序。
5. 所有规则都未命中时使用 fallback。
6. 结局规则只供后端执行，不传给 Ending 模型。

## Outline Prompt 需要增加的最小要求

在“reachable_endings”要求中加入：

```text
为每个结局生成结构化 `state_rule`，仅使用 event_integrity、relationship_connection、uncertainty 与 consequence ID 作为条件。必须提供且只能提供一个 fallback 结局。不得生成自然语言程序条件。
```

Outline 的其他叙事规划内容无需修改。
