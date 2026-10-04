import { beforeEach, describe, expect, it, vi } from "vitest"
import { getDefaultParams } from "../util"
import { MockWorker } from "./workerHarness"
vi.mock("../exporter/exporterManager.worker?worker", async () => ({
    default: (await import("./workerHarness")).MockWorker,
}))
import { browserExportGalaxies } from "../exporter/browser"
beforeEach(() => {
    MockWorker.instances = []
})
function options(): ExportOptions {
    return {
        language: "en",
        format: "xlsx",
        concurrency: 2,
        params: getDefaultParams(),
        results: [0],
        onProgress: vi.fn(() => false),
        onGenerate: vi.fn(),
    }
}
describe("browser export", () => {
    it("returns a workbook and does not serialize its abort signal", async () => {
        const controller = new AbortController(),
            result = browserExportGalaxies({
                ...options(),
                signal: controller.signal,
            }),
            worker = MockWorker.instances[0]!
        expect(worker.postMessage.mock.calls[0]![0]).not.toHaveProperty(
            "signal",
        )
        worker.emit({ type: "done", result: new Uint8Array([1, 2]) })
        expect(await result).toMatchObject({
            size: 2,
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
        expect(worker.terminated).toBe(true)
    })
    it("aborts immediately while generating the workbook", async () => {
        const controller = new AbortController(),
            callbacks = options(),
            result = browserExportGalaxies({
                ...callbacks,
                signal: controller.signal,
            }),
            worker = MockWorker.instances[0]!
        worker.emit({ type: "generating" })
        expect(callbacks.onGenerate).toHaveBeenCalledTimes(1)
        controller.abort()
        expect(await result).toBeNull()
        expect(worker.terminated).toBe(true)
    })
    it("does not start a worker for an already cancelled operation", async () => {
        const controller = new AbortController()
        controller.abort()
        expect(
            await browserExportGalaxies({
                ...options(),
                signal: controller.signal,
            }),
        ).toBeNull()
        expect(MockWorker.instances).toHaveLength(0)
    })
    it("supports the existing onProgress stop callback", async () => {
        const result = browserExportGalaxies({
                ...options(),
                onProgress: () => true,
            }),
            worker = MockWorker.instances[0]!
        worker.emit({ type: "progressing", current: 1 })
        expect(await result).toBeNull()
        expect(worker.terminated).toBe(true)
    })
    it.each(["error", "messageerror", "explicit"])(
        "rejects %s failures and terminates the manager",
        async (kind) => {
            const result = browserExportGalaxies(options()),
                worker = MockWorker.instances[0]!,
                rejected = expect(result).rejects.toBeTruthy()
            if (kind === "explicit")
                worker.emit({ type: "error", error: "generation failed" })
            else worker.dispatchEvent(new Event(kind))
            await rejected
            expect(worker.terminated).toBe(true)
        },
    )
})
