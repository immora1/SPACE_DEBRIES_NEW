import test from 'node:test'
import assert from 'node:assert/strict'

const SESSION_KEY = 'space-debris-story-session'
const QUEUE_KEY = 'space-debris-story-queue'

function storage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
}

async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.fail('Background story did not reach the expected state')
}

function story(id) {
  return {
    story_id: id,
    version: 1,
    status: 'active',
    current_checkpoint: 'materials',
    current_node_id: 'node_02',
    current_options: [],
    current_stage: { stage_id: `${id}-opening` },
    timeline: [{ stage_id: `${id}-opening` }],
    public_game_state: { satellite: { name: id } },
  }
}

test('background sessions survive refresh and ignore obsolete restore responses', async (suite) => {
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  const previousFetch = globalThis.fetch
  globalThis.localStorage = storage()
  globalThis.window = { sessionStorage: storage(), localStorage: globalThis.localStorage }
  const restoredRequest = {
    session_id: 'persisted-create-session', nickname: '南枝', city: '泉州',
    important_event: '共同点亮走马灯', satellite: { name: 'RESTORED-SAT' },
  }
  window.sessionStorage.setItem(QUEUE_KEY, JSON.stringify([{ type: 'create', request: restoredRequest }]))
  const { default: store } = await import('../store/useAppStore.js')
  const api = await import('./ai.js')

  try {
    await suite.test('pending create resumes visibly and retains a retryable failure', async () => {
      let shouldFail = true
      const requests = []
      globalThis.fetch = async (path, init) => {
        assert.equal(path, '/api/stories')
        requests.push(JSON.parse(init.body))
        if (shouldFail) throw new Error('Model temporarily unavailable')
        return Response.json({ ok: true, story: story('restored-story') })
      }
      assert.equal(store.getState().storyId, null)
      assert.equal(store.getState().storySessionReady, false)
      await api.resumeBackgroundStory()
      await until(() => store.getState().storyBackgroundError)
      assert.equal(store.getState().storySessionReady, true, 'the story HUD and retry must remain available after refresh')
      assert.equal(store.getState().storyBackgroundPending, 1)
      assert.equal(store.getState().storyBackgroundError, 'Model temporarily unavailable')
      assert.equal(store.getState().storyLoading, false)
      assert.deepEqual(JSON.parse(window.sessionStorage.getItem(QUEUE_KEY)), [{ type: 'create', request: restoredRequest }])

      shouldFail = false
      api.retryBackgroundStory()
      await until(() => store.getState().storyBackgroundPending === 0)
      assert.equal(store.getState().storyBackgroundError, null)
      assert.equal(store.getState().storyId, 'restored-story')
      assert.deepEqual(requests, [restoredRequest, restoredRequest], 'retry must reuse the original session request')
      assert.equal(JSON.parse(window.sessionStorage.getItem(SESSION_KEY)).sessionId, restoredRequest.session_id)
    })

    for (const status of [200, 404]) {
      await suite.test(`late restore ${status} cannot replace or clear a newly created session`, async () => {
        store.getState().reset()
        store.getState().setStorySnapshot(story('old-story'))
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ storyId: 'old-story', sessionId: 'old-session' }))
        let releaseRestore
        globalThis.fetch = async (path, init) => {
          if (init.method === 'GET') {
            assert.equal(path, '/api/stories/old-story?session_id=old-session')
            return new Promise(resolve => { releaseRestore = resolve })
          }
          assert.equal(path, '/api/stories')
          return Response.json({ ok: true, story: story(`new-story-${status}`) })
        }
        const restoring = api.restoreStorySession()
        assert.equal(typeof releaseRestore, 'function')
        await api.createStorySession({
          name: '新旅人', city: '泉州', importantEvent: '新的起点', satellite: { name: 'NEW-SAT' },
        })
        await until(() => store.getState().storyBackgroundPending === 0)
        const current = store.getState()
        const projection = structuredClone(current.storyLocalProgress)
        const timeline = structuredClone(current.storyTimeline)
        const credentials = window.sessionStorage.getItem(SESSION_KEY)
        assert.equal(current.storyId, `new-story-${status}`)

        releaseRestore(status === 200
          ? Response.json({ ok: true, story: story('old-story') })
          : Response.json({ ok: false, error: { code: 'STORY_NOT_FOUND', message: 'Old story expired' } }, { status: 404 }))
        assert.equal(await restoring, null)
        assert.equal(store.getState().storyId, `new-story-${status}`)
        assert.equal(store.getState().storySessionReady, true)
        assert.equal(store.getState().storyError, null)
        assert.deepEqual(store.getState().storyLocalProgress, projection)
        assert.deepEqual(store.getState().storyTimeline, timeline)
        assert.equal(window.sessionStorage.getItem(SESSION_KEY), credentials)
      })
    }
  } finally {
    globalThis.window = previousWindow
    globalThis.localStorage = previousStorage
    globalThis.fetch = previousFetch
  }
})
