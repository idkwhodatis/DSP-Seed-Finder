import { beforeEach, describe, expect, it, vi } from "vitest"
import { getDefaultParams } from "../util"
import { RuleType } from "../enums"
import { MockWorker } from "./workerHarness"
vi.mock("../worldgen/worldgen.worker?worker", async () => ({
    default: (await import("./workerHarness")).MockWorker,
}))
import { WorldGenBrowser } from "../worldgen/browser"
beforeEach(() => {
    MockWorker.instances = []
})
function options(): InternalFindOptions {
    return {
        batchSize: 1,
        nextBatchId: 0,
        gameDesc: getDefaultParams(),
        range: [0, 3],
        rule: { type: RuleType.Birth },
        concurrency: 2,
        onBatchResult: vi.fn(),
        onInterrupt: vi.fn(),
    }
}
describe("browser worker lifecycle", () => {
    it("delivers seed zero and subsequent batches, then terminates all workers", async () => {
        const engine = new WorldGenBrowser(),
            callbacks = options(),
            run = engine.find(callbacks)
        const [a, b] = MockWorker.instances
        expect(a!.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({ seeds: [0] }),
            }),
        )
        b!.emit({ type: "find", data: [1] })
        expect(b!.postMessage).toHaveBeenLastCalledWith({
            type: "next",
            input: [2],
        })
        a!.emit({ type: "find", data: [0] })
        b!.emit({ type: "find", data: [2] })
        await run
        expect(vi.mocked(callbacks.onBatchResult).mock.calls).toEqual([
            [1, [1]],
            [0, [0]],
            [2, [2]],
        ])
        expect(MockWorker.instances.every((worker) => worker.terminated)).toBe(
            true,
        )
    })
    it("keeps a paused old run stopped when a newer run starts", async () => {
        const engine = new WorldGenBrowser()
        const old = engine.find({ ...options(), concurrency: 1 }),
            oldWorker = MockWorker.instances[0]!
        engine.stop()
        const current = engine.find({
                ...options(),
                concurrency: 1,
                range: [10, 13],
            }),
            currentWorker = MockWorker.instances[1]!
        oldWorker.emit({ type: "find", data: [0] })
        await old
        expect(oldWorker.postMessage).toHaveBeenCalledTimes(1)
        engine.stop()
        currentWorker.emit({ type: "find", data: [10] })
        await current
        expect(currentWorker.postMessage).toHaveBeenCalledTimes(1)
    })
    it.each(["error", "messageerror", "explicit"])(
        "terminates the entire pool after %s",
        async (kind) => {
            const engine = new WorldGenBrowser(),
                run = engine.find(options()),
                rejected = expect(run).rejects.toBeTruthy()
            if (kind === "explicit")
                MockWorker.instances[0]!.emit({
                    type: "error",
                    error: "WASM unavailable",
                })
            else MockWorker.instances[0]!.dispatchEvent(new Event(kind))
            await rejected
            expect(
                MockWorker.instances.every((worker) => worker.terminated),
            ).toBe(true)
        },
    )
    it("rejects failed generation and terminates its worker", async () => {
        const promise = new WorldGenBrowser().generate(0, getDefaultParams()),
            rejected = expect(promise).rejects.toThrow("unavailable")
        MockWorker.instances[0]!.emit({ type: "error", error: "unavailable" })
        await rejected
        expect(MockWorker.instances[0]!.terminated).toBe(true)
    })
    it("returns star indexes including zero and terminates its worker", async () => {
        const promise = new WorldGenBrowser().searchStar(
            0,
            getDefaultParams(),
            { type: RuleType.Birth },
        )
        MockWorker.instances[0]!.emit({ type: "search_star", data: [0] })
        expect(await promise).toEqual([0])
        expect(MockWorker.instances[0]!.terminated).toBe(true)
    })
})
