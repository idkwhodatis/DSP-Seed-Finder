import WorldgenWorker from "./worldgen.worker?worker"

const TYPE_GENERATE = "generate"
const TYPE_SEARCH_STAR = "search_star"
const TYPE_FIND = "find"
const TYPE_NEXT = "next"

interface Batch {
    id: integer
    seeds: integer[]
}

function* generateBatchFromRange(
    batchSize: integer,
    nextBatchId: integer,
    range: InternalFindOptions["range"],
): Generator<Batch, void, void> {
    const start = Array.isArray(range) ? range[0] : 0
    const end = Array.isArray(range) ? range[1] : range.length
    for (
        let current = start + batchSize * nextBatchId;
        current < end;
        current += batchSize
    ) {
        const next = Math.min(current + batchSize, end)
        const seeds = Array.isArray(range)
            ? Array.from({ length: next - current }, (_, i) => current + i)
            : Array.from(range.slice(current, next))
        yield { id: nextBatchId++, seeds }
    }
}

async function request<T>(type: string, input: unknown): Promise<T> {
    const worker = new WorldgenWorker()
    try {
        return await new Promise<T>((resolve, reject) => {
            worker.addEventListener("error", reject, { once: true })
            worker.addEventListener("messageerror", reject, { once: true })
            worker.addEventListener("message", (event) => {
                if (event.data.type === "error")
                    reject(new Error(String(event.data.error)))
                else if (event.data.type === type) resolve(event.data.data)
            })
            worker.postMessage({ type, input })
        })
    } finally {
        worker.terminate()
    }
}

export class WorldGenBrowser implements WorldGen {
    private activeRun: { stopped: boolean } | null = null

    generate(seed: integer, gameDesc: GameParameters): Promise<Galaxy> {
        return request(TYPE_GENERATE, { seed, gameDesc })
    }

    searchStar(
        seed: integer,
        gameDesc: GameParameters,
        rule: Rule,
    ): Promise<integer[]> {
        return request(TYPE_SEARCH_STAR, { seed, gameDesc, rule })
    }

    async find({
        batchSize,
        nextBatchId,
        gameDesc,
        range,
        rule,
        concurrency,
        onBatchResult,
    }: InternalFindOptions) {
        if (
            !Number.isInteger(batchSize) ||
            batchSize < 1 ||
            !Number.isInteger(concurrency) ||
            concurrency < 1
        )
            throw new Error("Invalid search batch size or concurrency")
        if (this.activeRun) this.activeRun.stopped = true
        const session = { stopped: false }
        this.activeRun = session
        const workers = new Set<Worker>()
        const batch = generateBatchFromRange(batchSize, nextBatchId, range)
        let failed = false
        const run = (worker: Worker) => {
            workers.add(worker)
            let currentBatch = batch.next()
            if (currentBatch.done) {
                worker.terminate()
                return Promise.resolve()
            }
            return new Promise<void>((resolve, reject) => {
                let ended = false
                const fail = (error: unknown) => {
                    if (!ended) {
                        ended = true
                        failed = true
                        reject(error)
                    }
                }
                const finish = () => {
                    ended = true
                    worker.terminate()
                    resolve()
                }
                worker.addEventListener("error", fail, { once: true })
                worker.addEventListener("messageerror", fail, { once: true })
                worker.addEventListener("message", (event) => {
                    if (ended || failed) return
                    if (event.data.type === "error") {
                        fail(new Error(String(event.data.error)))
                        return
                    }
                    if (event.data.type !== TYPE_FIND) return
                    try {
                        onBatchResult(currentBatch.value!.id, event.data.data)
                        if (session.stopped) {
                            finish()
                            return
                        }
                        currentBatch = batch.next()
                        if (currentBatch.done) finish()
                        else
                            worker.postMessage({
                                type: TYPE_NEXT,
                                input: currentBatch.value.seeds,
                            })
                    } catch (error) {
                        fail(error)
                    }
                })
                worker.postMessage({
                    type: TYPE_FIND,
                    input: {
                        game: gameDesc,
                        rule,
                        seeds: currentBatch.value!.seeds,
                    },
                })
            })
        }
        try {
            await Promise.all(
                Array.from({ length: concurrency }, () =>
                    run(new WorldgenWorker()),
                ),
            )
        } finally {
            session.stopped = true
            failed = true
            workers.forEach((worker) => worker.terminate())
            if (this.activeRun === session) this.activeRun = null
        }
    }

    stop() {
        if (this.activeRun) this.activeRun.stopped = true
    }
}
