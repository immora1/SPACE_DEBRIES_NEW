import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryQueue } from './background-story.js'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('jobs remain sequential while callers immediately enqueue later choices', async () => {
  const calls = []
  let release
  const queue = createStoryQueue({ run: async job => {
    calls.push(job.id)
    if (job.id === 1) await new Promise(resolve => { release = resolve })
  } })
  queue.enqueue({ id: 1 })
  queue.enqueue({ id: 2 })
  assert.deepEqual(calls, [1])
  assert.equal(queue.snapshot().jobs.length, 2)
  release()
  await tick()
  assert.deepEqual(calls, [1, 2])
  assert.equal(queue.snapshot().jobs.length, 0)
})

test('failure retains the exact action and pauses later choices until retry', async () => {
  let fail = true
  const calls = []
  const queue = createStoryQueue({ run: async job => {
    calls.push(job.id)
    if (fail) throw new Error('offline')
  } })
  queue.enqueue({ id: 1, sessionId: 'same-session' })
  queue.enqueue({ id: 2 })
  await tick()
  assert.equal(queue.snapshot().error, 'offline')
  assert.deepEqual(calls, [1])
  fail = false
  queue.retry()
  await tick()
  assert.deepEqual(calls, [1, 1, 2])
  assert.equal(queue.snapshot().error, null)
})

test('reset aborts old work and prevents its result being delivered to a new session', async () => {
  let release
  let oldSignal
  const delivered = []
  const queue = createStoryQueue({
    run: async (job, signal) => {
      if (job.id === 1) { oldSignal = signal; await new Promise(resolve => { release = resolve }) }
      return job.id
    },
    complete: value => delivered.push(value),
  })
  queue.enqueue({ id: 1 })
  queue.reset()
  queue.enqueue({ id: 2 })
  release()
  await tick()
  assert.equal(oldSignal.aborted, true)
  assert.deepEqual(delivered, [2])
})

test('restored jobs are persisted before execution and resume explicitly', async () => {
  const order = []
  const queue = createStoryQueue({ jobs: [{ id: 'restored' }],
    persist: jobs => order.push(`save:${jobs.length}`),
    run: async job => order.push(job.id),
  })
  assert.deepEqual(order, [])
  queue.retry()
  await tick()
  assert.deepEqual(order, ['save:1', 'restored', 'save:0'])
})
