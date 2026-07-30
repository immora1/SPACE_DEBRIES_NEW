# Story Stages Prompt Bundle v2 — Numeric State

本包将 Continue 与 Ending 改为真实数值状态驱动，并彻底停止在新流程中使用三档结果等级。

## 文件

- `00_outline_numeric_state_patch.md`：让 Outline 为后端生成结构化结局规则的最小补丁
- `01_story_continue.prompt.txt`
- `01_story_continue.schema.json`
- `02_story_ending.prompt.txt`
- `02_story_ending.schema.json`
- `03_knowledge_reveal.prompt.txt`
- `03_knowledge_reveal.schema.json`
- `04_backend_contracts.schema.json`：选项、数值状态及输入上下文的后端运行时契约
- `05_context_examples.json`
- `CODEX_INTEGRATION_PROMPT.md`

## 核心变化

- Continue 输入删除 `interaction_result`，改为 `selected_option_effect + state_transition`。
- 每个选项显式配置三个数值增量。
- 每个交互节点根据真实 options 数组保留3或4个选项，禁止硬编码数量。
- Ending 由后端根据结构化 `state_rule` 选择，模型只接收 `selected_ending`。
- Ending Schema 删除 `selected_ending_type`。
- Knowledge 不读取或修改数值状态，继续使用分块输出。
- Opening 保持不变；初始数值在创建故事实例时从 Outline 写入。

## 模型变量

| 阶段 | 变量 |
|---|---|
| Continue | `continue_context` |
| Ending | `ending_context` |
| Knowledge | `knowledge_context` |

完整接入要求见 `CODEX_INTEGRATION_PROMPT.md`。
