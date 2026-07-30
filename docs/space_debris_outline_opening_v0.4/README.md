# SPACE DEBRIS Outline + Opening 接入包 v0.4

本包只用于接入 `STORY_OUTLINE` 与 `STORY_OPENING`。

## 文件说明

- `space_debris_outline_opening_spec_v0.4.md`：Prompt 与 Schema 合并阅读版。
- `prompts/`：可直接复制到 OpenAI Platform 的最终 Prompt。
- `schemas/`：严格 Structured Output Schema。
- `contracts/json_field_contract.md`：逐字段内容、所有权、存储和禁止项。
- `contracts/backend_integration_contract.md`：后端流程、事务、幂等、安全与未来扩展原则。
- `contracts/backend_validation_rules.json`：可供代码读取或照着实现的机器可读规则。
- `fixtures/`：合法样例和校验测试用例。
- `codex/codex_prompt_integrate_outline_opening_v0.4.md`：直接交给 Codex 的实现 Prompt。

## 推荐使用顺序

1. 在 OpenAI Platform 更新/确认两个 Prompt 和 Schema。
2. 把整个目录放到项目可读位置。
3. 将 `codex/codex_prompt_integrate_outline_opening_v0.4.md` 交给 Codex。
4. 配置 Prompt ID/版本环境变量。
5. 让 Codex 实际运行测试、类型检查、lint 和 build。

## 已冻结的关键原则

- `story_outline` 校验通过后不可变。
- 后端从 `initial_story_state` 深拷贝创建运行时 `story_state`。
- Opening 只输出 `story_text`、`known_to_user_additions`、`continuity_handoff`。
- 后端负责节点推进、指标、持续后果、用户操作和结局。
- `continuity_handoff` 保存到阶段记录，不进入永久 `story_state`。
- 完整 outline 含 `hidden_facts`，不得返回前端。
- 未来 Continue/Branch 使用“轻后端判定 + AI 动态叙事”。
