import test from 'node:test'
import assert from 'node:assert/strict'
import { StoryService } from '../../functions/_story/story-service.js'
import { MemoryStoryRepository } from '../../functions/_story/repository.js'
import { createFixtureStoryGenerator } from '../../functions/_story/fixtures.js'
import { ORBITAL_EVENTS } from '../../functions/_story/config/orbital-events.js'
import { CLEANUP_PAIRS } from '../../functions/_story/config/cleanup-pairs.js'

function storage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
async function until(check) {
  for (let i = 0; i < 300; i++) {
    if (check()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.fail('Background queue did not reach expected state')
}

test('full product flow stays interactive before opening and retries a lost response without duplicate actions', async () => {
  globalThis.localStorage = storage()
  globalThis.window = { sessionStorage: storage(), localStorage: globalThis.localStorage }
  const { default: store } = await import('../store/useAppStore.js')
  const api = await import('./ai.js')
  const service = new StoryService({ repository: new MemoryStoryRepository(), generateOutput: createFixtureStoryGenerator() })
  let releaseOpening
  let loseMaterialResponse = true
  let materialPosts = 0
  let remote
  globalThis.fetch = async (path, init) => {
    const request = init.body ? JSON.parse(init.body) : null
    let story
    if (path === '/api/stories') {
      await new Promise(resolve => { releaseOpening = resolve })
      story = await service.createStory(request)
    } else if (init.method === 'GET') {
      const url = new URL(path, 'https://test.local')
      story = await service.getStory(url.pathname.split('/')[3], url.searchParams.get('session_id'))
    } else {
      const id = path.split('/')[3]
      story = await service.advanceStory(id, request)
      if (request.action_type === 'MATERIALS_COMMIT') {
        materialPosts++
        if (loseMaterialResponse) { loseMaterialResponse = false; throw new Error('Response lost after commit') }
      }
    }
    remote = story
    return Response.json({ ok: true, story })
  }
  await api.createStorySession({ name: '南枝', city: '泉州', importantEvent: '与外婆共同完成走马灯点灯。', satellite: { name: 'TEST-SAT' } })
  const materials = { frame: 'aluminum', solar: 'silicon', insulation: 'kapton', propulsion: 'aluminum-tank' }
  await api.submitMaterialStoryAction(materials)
  await api.submitMissionStoryAction('weather_monitoring')
  for (const event of ORBITAL_EVENTS) await api.submitOrbitalEventStoryAction(event.id, event.options[0].id)
  for (const [idealMethodId, pair] of Object.entries(CLEANUP_PAIRS)) {
    const method = pair.method_id === 'LASER_ABLATION' ? 'laser' : pair.method_id === 'ROBOTIC_ARM_CAPTURE' ? 'arm' : 'sail'
    await api.submitCleanupPairStoryAction({ idealMethodId: method, uiTargetId: pair.accepted_ui_ids[0] })
    assert.ok(idealMethodId)
  }
  const projected = structuredClone(store.getState().publicGameState)
  assert.equal(store.getState().storyCheckpoint, 'completed')
  assert.equal(store.getState().storyId, null)
  assert.equal(store.getState().storyTimeline.length, 0)
  assert.equal(store.getState().storyBackgroundPending, 12)
  assert.equal(JSON.parse(window.sessionStorage.getItem('space-debris-story-queue')).length, 12)
  releaseOpening()
  await until(() => store.getState().storyBackgroundError)
  assert.equal(store.getState().storyBackgroundPending, 11)
  assert.deepEqual(store.getState().publicGameState, projected, 'late opening must not rewind gameplay')
  api.retryBackgroundStory()
  await until(() => store.getState().storyBackgroundPending === 0)
  assert.equal(materialPosts, 1, 'retry recognizes the already committed material choice')
  assert.equal(store.getState().storyTimeline.length, 6)
  assert.equal(remote.status, 'completed')
  assert.deepEqual(remote.public_game_state, projected, 'local immediate results match trusted server results')
})
