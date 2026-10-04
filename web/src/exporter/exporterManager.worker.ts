import ExporterWorker from "./exporter.worker?worker"
import GeneratorWorker from "./workbookGenerator.worker?worker"

async function go(options: ExportOptions) {
    const { format, concurrency, results, params, language } = options
    if (!Number.isInteger(concurrency) || concurrency < 1)
        throw new Error("Invalid export concurrency")
    const workers = new Set<Worker>()
    let stopped = false
    let fail!: (error: unknown) => void
    const failure = new Promise<never>((_, reject) => {
        fail = (error) => {
            stopped = true
            reject(error)
        }
    })
    const watch = (worker: Worker) => {
        workers.add(worker)
        worker.addEventListener("error", fail, { once: true })
        worker.addEventListener("messageerror", fail, { once: true })
        return worker
    }
    const execute = async () => {
        const generator = watch(new GeneratorWorker())
        const finished = new Promise<Uint8Array<ArrayBuffer>>((resolve) => {
            generator.onmessage = (event) => {
                if (event.data?.type === "error")
                    fail(new Error(String(event.data.error)))
                else resolve(event.data)
            }
        })
        generator.postMessage({
            language,
            useActualVeins: params.useActualVeins,
        })
        let index = 0
        let count = 0
        const threads = Math.min(Math.max(1, concurrency - 1), results.length)
        await Promise.all(
            Array.from(
                { length: threads },
                () =>
                    new Promise<void>((resolve, reject) => {
                        const worker = watch(new ExporterWorker())
                        const next = () => {
                            if (stopped) return
                            const seed = results[index++]
                            if (seed === undefined) {
                                worker.terminate()
                                resolve()
                                return
                            }
                            worker.postMessage(seed)
                        }
                        worker.onmessage = (event) => {
                            if (stopped) return
                            if (event.data?.type === "error") {
                                fail(new Error(String(event.data.error)))
                                return
                            }
                            try {
                                generator.postMessage(event.data)
                                self.postMessage({
                                    type: "progressing",
                                    current: ++count,
                                })
                                next()
                            } catch (error) {
                                reject(error)
                            }
                        }
                        worker.postMessage({ params, language })
                        next()
                    }),
            ),
        )
        if (stopped) return
        self.postMessage({ type: "generating" })
        generator.postMessage(format)
        const result = await finished
        if (!stopped)
            self.postMessage({ type: "done", result }, [result.buffer])
    }
    try {
        await Promise.race([execute(), failure])
    } finally {
        stopped = true
        workers.forEach((worker) => worker.terminate())
    }
}
self.onmessage = (event) => {
    void go(event.data).catch((error) =>
        self.postMessage({ type: "error", error: String(error) }),
    )
}
