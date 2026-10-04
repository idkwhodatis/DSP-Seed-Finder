import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getDefaultParams } from "../util"
import { RuleType } from "../enums"
const mock = vi.hoisted(() => ({
    find: vi.fn(),
    stop: vi.fn(),
    generate: vi.fn(),
    searchStar: vi.fn(),
}))
vi.mock("../worldgen/browser", () => ({
    WorldGenBrowser: class {
        find = mock.find
        stop = mock.stop
        generate = mock.generate
        searchStar = mock.searchStar
    },
}))
vi.mock("../worldgen/native", () => ({
    WorldGenNative: class {
        find = mock.find
        stop = mock.stop
    },
}))
import { startSearchingGalaxies } from "../worldgen"
beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())
const flush = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}
function options(): FindOptions {
    return {
        gameDesc: getDefaultParams(),
        batchSize: 1,
        nextBatchId: 0,
        range: [0, 3],
        rule: { type: RuleType.None },
        concurrency: 2,
        autosave: 5,
        onError: vi.fn(),
        onResult: vi.fn(),
        onProgress: vi.fn(),
        onComplete: vi.fn(),
        onInterrupt: vi.fn(),
    }
}
describe("search orchestration", () => {
    it("commits contiguous batches, ignores duplicates, and flushes its final checkpoint", async () => {
        let finish!: () => void
        mock.find.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve
                }),
        )
        const callbacks = options()
        startSearchingGalaxies(false, callbacks)
        const engine = mock.find.mock.calls[0]![0] as InternalFindOptions
        engine.onBatchResult(1, [8])
        expect(callbacks.onResult).not.toHaveBeenCalled()
        engine.onBatchResult(0, [0])
        expect(callbacks.onResult).toHaveBeenLastCalledWith([0, 8])
        engine.onBatchResult(0, [0])
        expect(callbacks.onResult).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(5000)
        expect(callbacks.onProgress).toHaveBeenLastCalledWith(2)
        engine.onBatchResult(2, [9])
        finish()
        await flush()
        expect(callbacks.onProgress).toHaveBeenLastCalledWith(3)
        expect(callbacks.onComplete).toHaveBeenCalledTimes(1)
        expect(vi.getTimerCount()).toBe(0)
        engine.onBatchResult(3, [10])
        expect(callbacks.onResult).toHaveBeenCalledTimes(2)
    })
    it("cleans autosave timers after rejection and supports a later run", async () => {
        mock.find.mockRejectedValue(new Error("WASM failed"))
        const callbacks = options()
        startSearchingGalaxies(false, callbacks)
        await flush()
        expect(callbacks.onError).toHaveBeenCalledTimes(1)
        expect(callbacks.onComplete).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        mock.find.mockResolvedValue(undefined)
        const again = options()
        startSearchingGalaxies(false, again)
        await flush()
        expect(again.onComplete).toHaveBeenCalledTimes(1)
    })
    it("reports only one terminal event when an interrupted engine later rejects", async () => {
        mock.find.mockImplementation(async (options: InternalFindOptions) => {
            options.onInterrupt()
            throw new Error("closed")
        })
        const callbacks = options()
        startSearchingGalaxies(false, callbacks)
        await flush()
        expect(callbacks.onInterrupt).toHaveBeenCalledTimes(1)
        expect(callbacks.onError).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
    })
})
