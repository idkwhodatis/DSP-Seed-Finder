import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { getDefaultParams } from "../util"
const mocks = vi.hoisted(() => ({
    init: vi.fn(),
    generate: vi.fn(),
    findStars: vi.fn(),
    searchStar: vi.fn(),
    loadLanguage: vi.fn(),
    writeBuffer: vi.fn(),
    addRows: vi.fn(),
}))
vi.mock("worldgen-wasm", () => ({
    default: mocks.init,
    generate: mocks.generate,
    findStars: mocks.findStars,
    searchStar: mocks.searchStar,
}))
vi.mock("../linguiCore", () => ({ loadLanguage: mocks.loadLanguage }))
vi.mock("exceljs", () => ({
    Workbook: class {
        xlsx = { writeBuffer: mocks.writeBuffer }
        csv = { writeBuffer: mocks.writeBuffer }
        addWorksheet() {
            return { id: 1, addRow: vi.fn(), addRows: mocks.addRows }
        }
    },
}))
const originalHandler = self.onmessage
const messages = vi.fn()
beforeEach(async () => {
    vi.resetModules()
    vi.resetAllMocks()
    vi.stubGlobal("postMessage", messages)
    const { i18n } = await import("@lingui/core")
    i18n.load("en", {})
    i18n.activate("en")
    // Keep temporary workers from leaving global rejection listeners in jsdom.
    const original = self.addEventListener.bind(self)
    vi.spyOn(self, "addEventListener").mockImplementation(
        (...args: Parameters<typeof self.addEventListener>) => {
            if (args[0] !== "unhandledrejection") original(...args)
        },
    )
    mocks.init.mockResolvedValue({})
    mocks.loadLanguage.mockResolvedValue("en")
    mocks.writeBuffer.mockResolvedValue(new Uint8Array([1]))
})
afterEach(() => {
    self.onmessage = originalHandler
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
const send = (data: unknown) =>
    self.onmessage!(new MessageEvent("message", { data }))
const expectFailure = async (text: string) =>
    waitFor(() =>
        expect(messages).toHaveBeenCalledWith({
            type: "error",
            error: expect.stringContaining(text),
        }),
    )
describe("asynchronous worker failures", () => {
    it("reports failed WASM initialization instead of hanging galaxy generation", async () => {
        mocks.init.mockRejectedValue(new Error("WASM fetch failed"))
        await import("../worldgen/" + "worldgen.worker")
        send({
            type: "generate",
            input: { seed: 0, gameDesc: getDefaultParams() },
        })
        await expectFailure("WASM fetch failed")
        expect(mocks.generate).not.toHaveBeenCalled()
    })
    it("reports engine errors thrown after initialization", async () => {
        mocks.generate.mockImplementation(() => {
            throw new Error("generation failed")
        })
        await import("../worldgen/" + "worldgen.worker")
        send({
            type: "generate",
            input: { seed: 0, gameDesc: getDefaultParams() },
        })
        await expectFailure("generation failed")
    })
    it("reports failed exporter translation loading once, even with a queued seed zero", async () => {
        mocks.loadLanguage.mockRejectedValue(new Error("catalog unavailable"))
        await import("../exporter/" + "exporter.worker")
        send({ params: getDefaultParams(), language: "en" })
        send(0)
        await expectFailure("catalog unavailable")
        expect(messages).toHaveBeenCalledTimes(1)
        expect(mocks.generate).not.toHaveBeenCalled()
    })
    it("reports failed exporter WASM initialization", async () => {
        mocks.init.mockRejectedValue(new Error("WASM unavailable"))
        await import("../exporter/" + "exporter.worker")
        send({ params: getDefaultParams(), language: "en" })
        send(0)
        await expectFailure("WASM unavailable")
    })
    it("reports workbook serialization failures instead of hanging generation", async () => {
        mocks.writeBuffer.mockRejectedValue(new Error("workbook failed"))
        await import("../exporter/" + "workbookGenerator.worker")
        send({ language: "en", useActualVeins: false })
        send("xlsx")
        await expectFailure("workbook failed")
    })
    it("serializes pending workbook rows before creating the download", async () => {
        let complete!: () => void
        mocks.loadLanguage.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    complete = resolve
                }),
        )
        await import("../exporter/" + "workbookGenerator.worker")
        send({ language: "en", useActualVeins: false })
        send({ seed: 0, stars: [["star"]], planets: [["planet"]] })
        send("xlsx")
        await waitFor(() => expect(mocks.loadLanguage).toHaveBeenCalledTimes(1))
        expect(mocks.writeBuffer).not.toHaveBeenCalled()
        complete()
        await waitFor(() =>
            expect(messages).toHaveBeenCalledWith(
                expect.any(Uint8Array),
                expect.any(Array),
            ),
        )
        expect(mocks.addRows.mock.calls).toEqual([[[["star"]]], [[["planet"]]]])
        expect(mocks.addRows.mock.invocationCallOrder[1]).toBeLessThan(
            mocks.writeBuffer.mock.invocationCallOrder[0]!,
        )
    })
})
