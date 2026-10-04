import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { getDefaultParams } from "../util"
import { MockWorker } from "./workerHarness"
vi.mock("../exporter/exporter.worker?worker", async () => {
    const { MockWorker } = await import("./workerHarness")
    return {
        default: class extends MockWorker {
            override kind = "exporter"
        },
    }
})
vi.mock("../exporter/workbookGenerator.worker?worker", async () => {
    const { MockWorker } = await import("./workerHarness")
    return {
        default: class extends MockWorker {
            override kind = "generator"
        },
    }
})
const originalHandler = self.onmessage
const messages = vi.fn()
let handler: typeof self.onmessage
beforeEach(async () => {
    MockWorker.instances = []
    vi.clearAllMocks()
    vi.stubGlobal("postMessage", messages)
    if (!handler) {
        await import("../exporter/" + "exporterManager.worker")
        handler = self.onmessage
    }
    self.onmessage = handler
})
afterEach(() => {
    self.onmessage = originalHandler
    vi.unstubAllGlobals()
})
function start(results: integer[]) {
    self.onmessage!(
        new MessageEvent("message", {
            data: {
                format: "xlsx",
                concurrency: 2,
                results,
                params: getDefaultParams(),
                language: "en",
            },
        }),
    )
}
describe("export manager", () => {
    it.each([{ results: [0, 7, 12] }, { results: [] }])(
        "finishes seed-zero and empty exports: $results",
        async ({ results }) => {
            start(results)
            const generator = MockWorker.instances.find(
                (worker) => worker.kind === "generator",
            )!
            const exporter = MockWorker.instances.find(
                (worker) => worker.kind === "exporter",
            )
            for (const seed of results) {
                expect(exporter!.postMessage).toHaveBeenLastCalledWith(seed)
                exporter!.emit({ seed, stars: [], planets: [] })
            }
            await waitFor(() =>
                expect(generator.postMessage).toHaveBeenLastCalledWith("xlsx"),
            )
            const output = new Uint8Array([1, 2, 3])
            generator.emit(output)
            await waitFor(() =>
                expect(messages).toHaveBeenCalledWith(
                    { type: "done", result: output },
                    [output.buffer],
                ),
            )
            expect(
                MockWorker.instances.every((worker) => worker.terminated),
            ).toBe(true)
        },
    )
    it.each(["generator", "exporter"])(
        "propagates %s errors and terminates every child",
        async (kind) => {
            start([0, 7])
            const worker = MockWorker.instances.find(
                (worker) => worker.kind === kind,
            )!
            worker.emit({ type: "error", error: "failed initialization" })
            await waitFor(() =>
                expect(messages).toHaveBeenCalledWith({
                    type: "error",
                    error: expect.stringContaining("failed initialization"),
                }),
            )
            expect(
                MockWorker.instances.every((worker) => worker.terminated),
            ).toBe(true)
            expect(messages).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: "done" }),
                expect.anything(),
            )
        },
    )
    it("catches generator errors before generation finishes", async () => {
        start([0, 7])
        MockWorker.instances[0]!.dispatchEvent(new Event("error"))
        await waitFor(() =>
            expect(messages).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            ),
        )
        expect(MockWorker.instances.every((worker) => worker.terminated)).toBe(
            true,
        )
    })
})
