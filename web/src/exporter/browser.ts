import ExporterManager from "./exporterManager.worker?worker"

export const browserExportGalaxies: Exporter = async (options) => {
    const { onProgress, onGenerate, signal, ...rest } = options
    if (signal?.aborted) return null
    const manager = new ExporterManager()
    try {
        return await new Promise<Blob | null>((resolve, reject) => {
            const abort = () => resolve(null)
            signal?.addEventListener("abort", abort, { once: true })
            const cleanup = () => signal?.removeEventListener("abort", abort)
            manager.addEventListener(
                "error",
                (event) => {
                    cleanup()
                    reject(event)
                },
                { once: true },
            )
            manager.addEventListener(
                "messageerror",
                (event) => {
                    cleanup()
                    reject(event)
                },
                { once: true },
            )
            manager.addEventListener("message", (event) => {
                if (signal?.aborted) return
                const { type, current, result } = event.data
                try {
                    if (type === "error") {
                        cleanup()
                        reject(new Error(String(event.data.error)))
                    } else if (type === "progressing") {
                        if (onProgress(current)) {
                            cleanup()
                            resolve(null)
                        }
                    } else if (type === "generating") onGenerate()
                    else if (type === "done") {
                        cleanup()
                        resolve(
                            new Blob([result], {
                                type:
                                    rest.format === "xlsx"
                                        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                        : "application/zip",
                            }),
                        )
                    }
                } catch (error) {
                    cleanup()
                    reject(error)
                }
            })
            try {
                manager.postMessage(rest)
            } catch (error) {
                cleanup()
                reject(error)
            }
        })
    } finally {
        manager.terminate()
    }
}
