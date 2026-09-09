// Persist descriptors, not promises: a reload can resume the same session and choices.
export function createStoryQueue({ run, complete = () => {}, persist = () => {}, change = () => {}, jobs: initialJobs = [] }) {
  let jobs = [...initialJobs]
  let error = null
  let running = false
  let epoch = 0
  let controller
  const snapshot = () => ({ jobs: [...jobs], error, running })
  function publish() {
    persist(jobs)
    change(snapshot())
  }
  async function drain() {
    if (running || error || !jobs.length) return
    const generation = epoch
    running = true
    controller = new AbortController()
    change(snapshot())
    try {
      while (jobs.length && generation === epoch) {
        const job = jobs[0]
        const result = await run(job, controller.signal)
        if (generation !== epoch) return
        complete(result, job)
        jobs.shift()
        publish()
      }
    } catch (failure) {
      if (generation === epoch) error = failure.message || 'Story generation failed.'
    } finally {
      if (generation === epoch) {
        running = false
        change(snapshot())
      }
    }
  }
  return {
    snapshot,
    enqueue(job) { jobs.push(structuredClone(job)); publish(); void drain() },
    retry() { error = null; publish(); void drain() },
    reset() {
      epoch += 1
      controller?.abort()
      jobs = []
      running = false
      error = null
      publish()
    },
  }
}
