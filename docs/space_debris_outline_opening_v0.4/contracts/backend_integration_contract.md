# 后端接入合同
## 仅 STORY_OUTLINE + STORY_OPENING v0.4

## 1. 本阶段范围

本次只完成：

```text
用户故事输入
→ STORY_OUTLINE
→ 严格校验
→ 保存不可变 story_outline
→ 创建运行时 story_state
→ STORY_OPENING
→ 严格校验
→ 保存 node_01 阶段
→ 合并新已知信息
→ 后端推进到 node_02
→ 返回开场正文
```

不实现 Continue、Branch、Ending、Knowledge Reveal 的生成接口；但代码结构必须能继续扩展，不能把 Outline/Opening 写死在一个不可维护的大函数里。

## 2. 推荐分层

沿用现有项目架构。若仓库没有明确分层，至少拆分为：

- Prompt/配置读取
- OpenAI 客户端适配层
- JSON Schema 校验
- 业务语义校验
- Outline 服务
- Opening 服务
- Story session/state reducer
- 数据持久化
- HTTP/Server Action 路由

路由只负责鉴权、解析输入、调用 service、映射错误和返回响应。模型调用、事务、状态推进不得散落在路由或前端。

## 3. 配置

优先使用 OpenAI Platform 已保存 Prompt，并通过环境变量提供 Prompt ID/版本。推荐配置名：

```text
OPENAI_STORY_OUTLINE_PROMPT_ID
OPENAI_STORY_OUTLINE_PROMPT_VERSION
OPENAI_STORY_OPENING_PROMPT_ID
OPENAI_STORY_OPENING_PROMPT_VERSION
```

如果项目当前使用内联 Prompt，则以 `prompts/` 和 `schemas/` 中的文件为唯一来源，集中加载，禁止在业务代码中复制多份。

密钥必须走现有环境变量体系，不提交真实值。变量传入时对 JSON 使用稳定序列化：

- Outline：`story_user_input = JSON.stringify(validatedUserInput)`
- Opening：`story_outline = JSON.stringify(validatedOutline)`

## 4. 数据模型

至少需要等价数据：

### Story session

- `id`
- `status`: `GENERATING | READY | FAILED` 或现有等价状态
- `story_outline`（完整、服务端保存、不可变）
- `story_state`（后端可变）
- `created_at` / `updated_at`
- 可选：Prompt ID、版本、模型、请求追踪 ID

### Story stage

- `story_id`
- `node_id`
- `task_type`
- `story_text`
- `known_to_user_additions`（原始 AI 输出）
- `continuity_handoff`
- Prompt/模型元数据
- `created_at`

若项目已有数据库结构，做最小兼容改造，不另起平行存储。

## 5. 事务和状态一致性

推荐流程：

1. Outline 校验成功后创建/更新 story session 为 `GENERATING`，保存 outline 和初始 runtime state。
2. 调用 Opening。
3. Opening 校验通过后，在一个事务或等价原子操作中：
   - 插入 node_01 stage；
   - 合并去重后的 known additions；
   - 将 `current_node_id` 更新为 `node_02`；
   - 将 session 标记为 `READY`。
4. Opening 失败时，不推进节点、不写入半成品 stage；session 保持可重试状态或标记 `FAILED`，按现有项目策略处理。

任何重试都必须具备幂等保护，避免同一故事重复生成两个 node_01 阶段。可使用 story ID + node ID 唯一约束、idempotency key 或事务内检查。

## 6. 错误与重试

错误至少区分：

- 输入校验失败
- 模型请求失败/超时
- 结构化输出解析失败
- JSON Schema 校验失败
- 业务语义校验失败
- 持久化失败

对模型输出的结构或语义错误，允许携带简洁错误原因重试一次。第二次仍失败则返回稳定错误码，禁止保存半成品。网络重试沿用项目现有策略，不要无限重试。

## 7. 前端返回

创建故事成功时，前端只需要获得安全字段，例如：

```json
{
  "story_id": "...",
  "current_node_id": "node_02",
  "story_text": "..."
}
```

可按现有产品需要增加安全元数据，但不得返回：

- `hidden_facts`
- 完整 `story_outline`
- 模型内部交接信息（除非前端确实需要且已评估）
- OpenAI 密钥或内部错误栈

## 8. 未来 Continue/Branch 的不可违背原则

当前阶段暂不实现，但架构必须预留以下原则：

> 轻后端判定 + AI 动态叙事。

未来用户点击与故事无关的站内按钮时：

- 后端根据 `action_id` 或游戏规则判断 `POSITIVE / PARTIAL / NEGATIVE`；
- 后端负责指标变化、节点推进、用户操作记录和固定 consequence ID；
- 不把无关按钮文案强行交给 AI 写进故事；
- AI根据当前故事状态与结果等级，生成符合故事语境的具体影响；
- AI不得自行判断用户是否选对、修改指标、创建自由文本后果标签、决定下一节点或结局。

持续后果后续必须使用固定 ID，不能使用随意中文标签。代码设计不要阻碍这一扩展。

## 9. 完成标准

- Outline 与 Opening 真实调用链可运行。
- Schema 与业务校验全部执行。
- `story_outline` 不可变，`story_state` 可控。
- `hidden_facts` 不泄露到前端。
- Opening 成功后只由后端推进到 `node_02`。
- 失败不会留下半更新状态。
- 重试不会重复创建 stage。
- 单元测试、服务测试、流程测试、构建、类型检查和 lint 全部通过，或明确报告仓库原有阻塞。
