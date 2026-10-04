import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react"
import { I18nProvider } from "@lingui/react"
import { i18n } from "@lingui/core"
import { StrictMode, type PropsWithChildren, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ExportModal from "../partials/ExportModal"
import { StoreContext } from "../store"
import { useObjectState } from "../hooks/useLiveState"
import { getDefaultParams } from "../util"
import { getMultiProfileResultRange, getProfileResultRange } from "../profile"
import { getExporter } from "../exporter"
vi.mock("../profile", () => ({
    getMultiProfileResultRange: vi.fn(),
    getProfileResultRange: vi.fn(),
}))
vi.mock("../exporter", () => ({ getExporter: vi.fn() }))
vi.mock("../components/Modal", () => ({
    default: ({
        visible,
        children,
    }: PropsWithChildren<{ visible: boolean }>) =>
        visible ? <div>{children}</div> : null,
}))
vi.mock("../components/Tooltip", () => ({
    default: ({ children }: PropsWithChildren) => <>{children}</>,
}))
vi.mock("../components/Select", () => ({
    default: <T,>(props: {
        options: readonly T[]
        value: T
        getLabel: (value: T) => ReactNode
        onChange: (value: T) => void
    }) => (
        <select
            aria-label={
                props.options.includes("xlsx" as T) ? "Format" : "Setting"
            }
            value={String(props.value)}
            onChange={(event) =>
                props.onChange(
                    props.options.find(
                        (option) => String(option) === event.target.value,
                    )!,
                )
            }
        >
            {props.options.map((option) => (
                <option key={String(option)} value={String(option)}>
                    {props.getLabel(option)}
                </option>
            ))}
        </select>
    ),
}))
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}
function Wrapper({ children }: PropsWithChildren) {
    const store = useObjectState<Store>({
        searching: false,
        settings: { darkMode: false, language: "en", view: getDefaultParams() },
    })
    return (
        <I18nProvider i18n={i18n}>
            <StoreContext.Provider value={store}>
                {children}
            </StoreContext.Provider>
        </I18nProvider>
    )
}
const params = getDefaultParams()
const defaults = {
    visible: true,
    onClose: vi.fn(),
    mode: "galaxy" as const,
    id: "profile",
    name: "My profile",
    params,
}
const exporter = vi.fn<Exporter>()
const createObjectURL = vi.fn(() => "blob:download")
const revokeObjectURL = vi.fn()
beforeEach(() => {
    vi.clearAllMocks()
    i18n.load("en", {})
    i18n.activate("en")
    vi.mocked(getMultiProfileResultRange).mockResolvedValue([
        { seed: 12 },
        { seed: 34 },
    ])
    vi.mocked(getProfileResultRange).mockResolvedValue([])
    vi.mocked(getExporter).mockReturnValue(exporter)
    exporter.mockResolvedValue(new Blob(["data"]))
    Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: revokeObjectURL,
    })
})
afterEach(cleanup)
describe("Export lifecycle", () => {
    it("does not begin generation if cancelled while retrieving saved seeds", async () => {
        const retrieval = deferred<MultiProgressResult[]>()
        vi.mocked(getMultiProfileResultRange).mockReturnValueOnce(
            retrieval.promise,
        )
        render(
            <Wrapper>
                <ExportModal {...defaults} />
            </Wrapper>,
        )
        fireEvent.click(screen.getByRole("button", { name: "Export" }))
        fireEvent.click(screen.getByRole("button", { name: "Stop" }))
        await act(async () => retrieval.resolve([{ seed: 99 }]))
        expect(exporter).not.toHaveBeenCalled()
        expect(createObjectURL).not.toHaveBeenCalled()
    })
    it("starts one exporter under StrictMode and uses one immutable options snapshot", async () => {
        const generation = deferred<Blob | null>()
        exporter.mockReturnValue(generation.promise)
        const { rerender } = render(
            <StrictMode>
                <Wrapper>
                    <ExportModal {...defaults} />
                </Wrapper>
            </StrictMode>,
        )
        fireEvent.click(screen.getByRole("button", { name: "Export" }))
        await waitFor(() => expect(exporter).toHaveBeenCalledTimes(1))
        const options = exporter.mock.calls[0]![0]
        act(() => {
            options.onProgress(1)
            options.onProgress(2)
            options.onGenerate()
        })
        rerender(
            <StrictMode>
                <Wrapper>
                    <ExportModal {...defaults} name="Renamed" />
                </Wrapper>
            </StrictMode>,
        )
        expect(exporter).toHaveBeenCalledTimes(1)
        expect(options.params).toEqual(params)
        expect(() => structuredClone(options.params)).not.toThrow()
        await act(async () => generation.resolve(new Blob(["data"])))
        expect(
            screen
                .getByRole("link", { name: "Download" })
                .getAttribute("download"),
        ).toBe("My profile.xlsx")
    })
    it("aborts worker generation and discards completion from a cancelled export", async () => {
        const generation = deferred<Blob | null>()
        exporter.mockReturnValue(generation.promise)
        render(
            <Wrapper>
                <ExportModal {...defaults} />
            </Wrapper>,
        )
        fireEvent.click(screen.getByRole("button", { name: "Export" }))
        await waitFor(() => expect(exporter).toHaveBeenCalledTimes(1))
        const options = exporter.mock.calls[0]![0]
        expect(options.signal?.aborted).toBe(false)
        fireEvent.click(screen.getByRole("button", { name: "Stop" }))
        expect(options.signal?.aborted).toBe(true)
        expect(options.onProgress(1)).toBe(true)
        act(() => options.onGenerate())
        await act(async () => generation.resolve(new Blob(["stale"])))
        expect(createObjectURL).not.toHaveBeenCalled()
        expect(screen.queryByRole("link", { name: "Download" })).toBeNull()
    })
    it("sanitizes CSV download names and revokes the URL on close", async () => {
        render(
            <Wrapper>
                <ExportModal {...defaults} name={'My\\/:*?"<>| profile.'} />
            </Wrapper>,
        )
        fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
            target: { value: "csv" },
        })
        fireEvent.click(screen.getByRole("button", { name: "Export" }))
        expect(
            (
                await screen.findByRole("link", { name: "Download" })
            ).getAttribute("download"),
        ).toBe("My profile.zip")
        fireEvent.click(screen.getByRole("button", { name: "Close" }))
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:download")
    })
    it("exports unique star seeds as text without starting a worker", async () => {
        vi.mocked(getProfileResultRange).mockResolvedValue([
            { id: 1, seed: 12, index: 0 },
            { id: 2, seed: 34, index: 0 },
            { id: 3, seed: 12, index: 1 },
        ])
        render(
            <Wrapper>
                <ExportModal {...defaults} mode="star" />
            </Wrapper>,
        )
        fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
            target: { value: "txt" },
        })
        fireEvent.click(screen.getByRole("button", { name: "Export" }))
        await screen.findByRole("link", { name: "Download" })
        expect(exporter).not.toHaveBeenCalled()
        expect(getProfileResultRange).toHaveBeenCalledWith(
            "profile",
            0,
            99999999,
        )
        expect(createObjectURL).toHaveBeenCalledWith(
            expect.objectContaining({ size: 5, type: "text/plain" }),
        )
    })
})
