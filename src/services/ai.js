// 所有 AI 调用通过后端 /api/gpt，Key 不暴露前端
// ─────────────────────────────────────────────────────────────────────────────
// 架构说明：
//   1. generateStoryOutline — Entrance 表单提交后立即调用，生成全站故事框架
//      框架包含 7 个固定节点（checkpoints）+ 两种结局内核，全程不变
//   2. 每个模块有独立 AI 函数，调用时传入 storyOutline 作为叙事约束
//      用户选择影响"如何到达节点"，不改变"必须经过哪些节点"
//   3. M4 是故事高潮，每次决策都会更新故事走向，累积决定最终结局
//   4. 每个函数内 system/user_ 变量处有 TODO 标注，后期只替换这两处
// ─────────────────────────────────────────────────────────────────────────────

async function chat(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 512) {
  const res = await fetch('/api/gpt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userPrompt, temperature, maxTokens }),
  })
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error)
  return data.content
}

function extractJSON(raw) {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 返回格式异常')
  return JSON.parse(match[0])
}

// 把大纲序列化为简短的上下文字符串，注入到各模块 prompt 中
function outlineContext(storyOutline) {
  if (!storyOutline) return ''
  const beats = storyOutline.checkpoints
    .map((c) => `[${c.label}] ${c.beat}`)
    .join(' → ')
  return `\n\n【故事框架（必须遵守，不得偏离）】\n前提：${storyOutline.premise}\n节点：${beats}\n成功结局内核：${storyOutline.successEnding}\n失败结局内核：${storyOutline.failureEnding}`
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRANCE · 故事大纲（全站唯一，生成一次后所有模块共用）
// 输入: name, city, importantEvent, satellite
// 输出: {
//   premise: string,          ← 故事核心前提（用户最重要的事的叙事化锚点）
//   checkpoints: [            ← 7个固定节点，模块顺序对应，不可跳过
//     { id, label, beat }     ← id=模块标识, label=节点名, beat=必须发生的情节
//   ],
//   successEnding: string,    ← 守住结局的情感内核（一句话）
//   failureEnding: string,    ← 失败结局的情感内核（一句话）
// }
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStoryOutline({ name, city, importantEvent, satellite }) {
  // TODO: 替换为完整 prompt
  const system = `你是一个叙事架构师。基于用户信息生成一个太空垃圾平行叙事的故事大纲。
规则：
- 第三人称，卫星为载体，平行时空中映射用户现实中最重要的事
- 结构：启程 → 展开 → 裂缝 → 高潮（M4游戏，最密集） → 余波 → 行动 → 结局
- 每个节点（beat）描述必须发生的情节，20字以内，克制不煽情
- successEnding 和 failureEnding 是情感内核，不是完整句子，各15字以内
- 输出纯 JSON，格式严格如下：
{
  "premise": "...",
  "checkpoints": [
    {"id":"entrance","label":"启程","beat":"..."},
    {"id":"m1","label":"第一个选择","beat":"..."},
    {"id":"m2","label":"任务展开","beat":"..."},
    {"id":"m3","label":"裂缝出现","beat":"..."},
    {"id":"m4","label":"高潮·命运决战","beat":"..."},
    {"id":"m5","label":"余波","beat":"..."},
    {"id":"m6","label":"行动与尾声","beat":"..."}
  ],
  "successEnding": "...",
  "failureEnding": "..."
}`

  const user_ = `用户叫${name}，来自${city}。
对他/她现在最重要的事：${importantEvent}。
匹配卫星：${satellite.name}，轨道高度${satellite.altitudeKm}km，发射于${satellite.launchYear}年。
生成这个人的平行叙事大纲。`

  const raw = await chat(system, user_, 0.85, 800)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRANCE · 开场故事（基于大纲写第一段）
// 输入: name, city, importantEvent, satellite, storyOutline
// 输出: { story: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function generateOpeningStory({ name, city, importantEvent, satellite, storyOutline }) {
  // TODO: 替换为完整 prompt
  const system = `你是一个克制、精准的叙事者。用第三人称描写卫星视角，语气真实不煽情，禁用"美丽""壮阔"等形容词。输出纯 JSON，格式：{"story": "..."}${outlineContext(storyOutline)}`
  const user_ = `卫星名：${satellite.name}，轨道高度：${satellite.altitudeKm}km，倾角：${satellite.inclination}°，发射年份：${satellite.launchYear}。
用户叫${name}，来自${city}，最重要的事是：${importantEvent}。
按故事框架中"启程"节点写150字开场：卫星刚载入，平行时空中那件事处于前夜，结尾留悬念。`

  const raw = await chat(system, user_, 0.8, 400)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M1 · 四部位材料全部选定后的综合反馈
// 输入: materials = { frame, solar, insulation, propulsion }, satellite, user, storyOutline
// 输出: { feedback: string }  ← 100字以内，基于四部位组合描述再入特性和轨道碎片贡献
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMaterialFeedback({ materials, satellite, user, storyOutline }) {
  // TODO: 替换为完整 prompt
  const system = `你是航天材料专家，语气简洁克制，数据驱动，不煽情。输出纯 JSON，格式：{"feedback": "..."}${outlineContext(storyOutline)}`
  const matDesc = `主框架：${materials.frame}；太阳能电池板：${materials.solar}；隔热毯：${materials.insulation}；推进贮箱：${materials.propulsion}`
  const user_ = `用户${user.name}为卫星${satellite?.name ?? '未知卫星'}选择了以下材料组合：${matDesc}。
写100字以内综合评价：基于这四个部位的材料特性，描述该卫星在轨碎片产生风险和最终再入大气层时的命运。引用至少一个真实历史卫星案例作为对比。`

  const raw = await chat(system, user_, 0.7, 350)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M2 · 任务选择 → 故事第二段
// 输入: mission, satellite, user, material, storyOutline
// 输出: { story: string }  ← ~150字，按"任务展开"节点写
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMissionStory({ mission, satellite, user, material, storyOutline }) {
  // TODO: 替换为完整 prompt
  const system = `你是一个克制、精准的叙事者。第三人称卫星视角，语气真实，禁用煽情形容词。输出纯 JSON，格式：{"story": "..."}${outlineContext(storyOutline)}`
  const user_ = `卫星${satellite.name}，执行${mission}任务，主体材料${material}。
用户叫${user.name}，最重要的事：${user.importantEvent}。
按故事框架中"任务展开"节点写150字：卫星执行任务中遭遇轨道早期威胁，某项功能轻微受损，平行时空那件事的一个细节悄悄变了。`

  const raw = await chat(system, user_, 0.8, 400)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M3 · 历史事件 → 卫星第一视角叙事
// 输入: event, satellite, user, storyOutline
// 输出: { narrative: string }  ← ~100字
// ─────────────────────────────────────────────────────────────────────────────
export async function generateEventNarrative({ event, satellite, user, storyOutline }) {
  // TODO: 替换为完整 prompt
  const system = `你是一个克制的叙事者，以卫星第一视角写作，语气客观冷静。输出纯 JSON，格式：{"narrative": "..."}${outlineContext(storyOutline)}`
  const user_ = `历史事件：${event.year}年 ${event.name}，描述：${event.description}。
卫星${satellite.name}，轨道高度${satellite.altitudeKm}km。
写100字第一视角叙事：距碎片云多远、是否需要机动、传感器记录了什么。`

  const raw = await chat(system, user_, 0.75, 300)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M3 · 全部历史事件浏览完 → 故事第三段
// 输入: visitedEvents, satellite, user, damageLevel, storyOutline
// 输出: { story: string }  ← ~150字，按"裂缝出现"节点写，故事走向开始不确定
// ─────────────────────────────────────────────────────────────────────────────
export async function generateHistoryStory({ visitedEvents, satellite, user, damageLevel, storyOutline }) {
  // TODO: 替换为完整 prompt
  const system = `你是一个克制、精准的叙事者。第三人称卫星视角，输出纯 JSON，格式：{"story": "..."}${outlineContext(storyOutline)}`
  const eventNames = visitedEvents.map((e) => `${e.year}年${e.name}`).join('、')
  const user_ = `卫星${satellite.name}经历了：${eventNames}，累积受损值${damageLevel}。
用户最重要的事：${user.importantEvent}。
按故事框架中"裂缝出现"节点写150字：历史事件在平行时空制造偏移，那件事的走向开始不确定，为M4高潮蓄势。`

  const raw = await chat(system, user_, 0.8, 400)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M4 · 游戏决策 → 即时反馈（高潮段，调用最频繁）
// 输入: decision, threat, outcome, satellite, user, storyOutline, decisionIndex, totalDecisions
// 输出: { feedback: string, storyUpdate: string }
//   feedback    ← 任务日志（正确）或故障报告（错误）
//   storyUpdate ← 同步推进平行时空故事一句话（感知高潮节奏逐渐收紧）
// ─────────────────────────────────────────────────────────────────────────────
export async function generateGameDecisionFeedback({
  decision, threat, outcome, satellite, user, storyOutline,
  decisionIndex = 0, totalDecisions = 6,
}) {
  const progress = `第${decisionIndex + 1}/${totalDecisions}个决策，故事正在向高潮推进`
  // TODO: 替换为完整 prompt
  const system = `你是航天任务控制专家，语气专业克制。输出纯 JSON，格式：{"feedback": "...", "storyUpdate": "..."}${outlineContext(storyOutline)}`
  const user_ = `卫星${satellite.name}遭遇威胁：${threat}，用户选择：${decision}，结果：${outcome}。
${progress}。用户最重要的事：${user.importantEvent}。
feedback（60字以内）：${outcome === 'correct' ? '任务日志+真实历史数据支撑' : '故障报告+历史先例'}。
storyUpdate（70字以内）：基于本次决策结果（${outcome}），写平行时空中那件最重要的事此刻发生了什么具体变化，要有细节感，随决策编号逐渐加重叙事张力，让用户感受到每一步选择的重量。`

  const raw = await chat(system, user_, 0.75, 300)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M4 · 游戏结束 → 反思页（高潮落幕）
// 输入: gameResult, decisions, satellite, user, material, storyOutline
// 输出: { knowledgePoints: string[], satFate: string, debrisDescription: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function generateGameReflection({ gameResult, decisions, satellite, user, material, storyOutline }) {
  // TODO: 替换为完整 prompt
  const system = `你是航天知识总结专家，语气克制准确。输出纯 JSON，格式：{"knowledgePoints": ["...","...","..."], "satFate": "...", "debrisDescription": "..."}${outlineContext(storyOutline)}`
  const correctCount = decisions.filter((d) => d.outcome === 'correct').length
  const user_ = `卫星${satellite.name}（${material}材质）游戏结果：${gameResult}，共${decisions.length}次决策，正确${correctCount}次。
用户最重要的事：${user.importantEvent}，结果：${gameResult === 'success' ? '守住' : '改写'}。
输出：knowledgePoints（3条知识点各30字）、satFate（卫星命运一句话）、debrisDescription（碎片描述一句话，用于M6匹配题）。`

  const raw = await chat(system, user_, 0.7, 600)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M5 · 再入叙事 → 故事结局（基于大纲的成功/失败内核展开）
// 输入: gameResult, material, satellite, user, storyOutline
// 输出: { ending: string }  ← ~120字
// ─────────────────────────────────────────────────────────────────────────────
export async function generateReentryEnding({ gameResult, material, satellite, user, storyOutline }) {
  // TODO: 替换为完整 prompt
  const system = `你是一个克制的叙事者，第三人称，不煽情。输出纯 JSON，格式：{"ending": "..."}${outlineContext(storyOutline)}`
  const endingCore = gameResult === 'success'
    ? storyOutline?.successEnding ?? '守住了'
    : storyOutline?.failureEnding ?? '改写了'
  const user_ = `卫星${satellite.name}，材质${material}，游戏结果：${gameResult}。
本次结局内核：「${endingCore}」。用户最重要的事：${user.importantEvent}。
按故事框架中"余波"和结局节点写120字：正式收尾平行时空，呼应开篇悬念。`

  const raw = await chat(system, user_, 0.8, 400)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M6 · 拖拽匹配 → 即时反馈
// 输入: debris, technology, isCorrect
// 输出: { feedback: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function generateCleanupFeedback({ debris, debrisDetail = '', debrisSource = '', debrisContext = '', technology, isCorrect }) {
  // TODO: 替换为完整 prompt
  const system = `你是太空垃圾清理技术专家，语气简洁。输出纯 JSON，格式：{"feedback": "..."}`
  const user_ = `碎片类型：${debris}
碎片细节：${debrisDetail}
来源：${debrisSource}
个性化依据：${debrisContext}
选择清理技术：${technology}
匹配结果：${isCorrect ? '匹配正确' : '匹配错误'}
写55字以内反馈：必须点到材料或事件来源，说明匹配${isCorrect ? '正确' : '错误'}的原因。`

  const raw = await chat(system, user_, 0.7, 150)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M6 · 全部匹配完成 → 故事尾声（收束全站叙事）
// 输入: accuracy, satellite, user, storyOutline
// 输出: { epilogue: string }  ← ~80字，结尾是开口不是结论
// ─────────────────────────────────────────────────────────────────────────────
export async function generateCleanupEpilogue({ accuracy, satellite, user, storyOutline }) {
  // TODO: 替换为完整 prompt
  const system = `你是一个克制的叙事者，输出纯 JSON，格式：{"epilogue": "..."}${outlineContext(storyOutline)}`
  const user_ = `用户${user.name}完成清理匹配，准确率${Math.round(accuracy * 100)}%。
按故事框架中"行动与尾声"节点写80字尾声：平行时空的用户开始行动，最后一句是开口不是结论。`

  const raw = await chat(system, user_, 0.8, 300)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M7 · 视频结束 → 生成问题
// 输入: satellite, user
// 输出: { question: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function generateVideoQuestion({ satellite, user }) {
  // TODO: 替换为完整 prompt
  const system = `你是太空垃圾科普专家，基于卫星数据提问。输出纯 JSON，格式：{"question": "..."}`
  const user_ = `卫星${satellite.name}，轨道高度${satellite.altitudeKm}km，用户来自${user.city}。
生成一个具体问题，让用户思考这颗卫星与太空垃圾问题的关联。（50字以内）`

  const raw = await chat(system, user_, 0.8, 200)
  return extractJSON(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// M7 · 用户自由作答 → AI 解释
// 输入: question, answer, satellite, user
// 输出: { explanation: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function generateAnswerExplanation({ question, answer, satellite, user }) {
  // TODO: 替换为完整 prompt
  const system = `你是太空垃圾科普专家，语气友善克制，不评价对错。输出纯 JSON，格式：{"explanation": "..."}`
  const user_ = `问题：${question}
用户${user.name}的回答：${answer}
基于卫星${satellite.name}给出100字以内的解释，补充用户回答中缺失的关键视角。`

  const raw = await chat(system, user_, 0.7, 350)
  return extractJSON(raw)
}
