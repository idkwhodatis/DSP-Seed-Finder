import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { I18nProvider } from "@lingui/react"
import { i18n } from "@lingui/core"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import type { PropsWithChildren } from "react"
import FindStar from "../views/FindStar"
import { StoreContext } from "../store"
import { useObjectState } from "../hooks/useLiveState"
import { getDefaultParams } from "../util"
import {
    getProfileInfo,
    getProfileProgress,
    getProfileResult,
} from "../profile"
import { generateGalaxy } from "../worldgen"
vi.mock("../profile", () => ({
    getProfileInfo: vi.fn(),
    getProfileProgress: vi.fn(),
    getProfileResult: vi.fn(),
    listProfiles: vi.fn(),
}))
vi.mock("../worldgen", () => ({ generateGalaxy: vi.fn() }))
vi.mock("../partials/ProgressEditor", () => ({ default: () => null }))
vi.mock("../partials/ProfileManager", () => ({ default: () => null }))
vi.mock("../partials/RuleEditor", () => ({ default: () => null }))
vi.mock("../partials/ExportModal", () => ({ default: () => null }))
vi.mock("../partials/StarView", () => ({
    default: () => <div>Rendered star</div>,
}))
vi.mock("../components/Modal", () => ({
    default: ({
        visible,
        children,
    }: PropsWithChildren<{ visible: boolean }>) =>
        visible ? <div>{children}</div> : null,
}))
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
beforeEach(() => {
    vi.clearAllMocks()
    i18n.load("en", {})
    i18n.activate("en")
    vi.mocked(getProfileInfo).mockResolvedValue({
        id: "legacy",
        name: "Legacy stars",
        createdAt: 0,
    })
    vi.mocked(getProfileProgress).mockResolvedValue({
        id: "legacy",
        params: getDefaultParams(),
        concurrency: 1,
        autosave: 5,
        range: [0, 1000],
        total: 1000,
        found: 201,
        batchSize: 100,
        nextBatchId: 1,
        rules: [],
    })
})
it("keeps legacy star browsing read-only and generates a selected star only once", async () => {
    let resolveFirst!: (value: ProgressResult[]) => void
    const firstPage = new Promise<ProgressResult[]>((resolve) => {
        resolveFirst = resolve
    })
    vi.mocked(getProfileResult).mockImplementation((_id, start) =>
        start === 0
            ? firstPage
            : Promise.resolve([{ id: 20, seed: 222, index: 0 }]),
    )
    vi.mocked(generateGalaxy).mockResolvedValue({ stars: [{}] } as Galaxy)
    render(
        <Wrapper>
            <MemoryRouter initialEntries={["/find-star/legacy"]}>
                <Routes>
                    <Route
                        path="/find-star/:profileId"
                        element={<FindStar />}
                    />
                </Routes>
            </MemoryRouter>
        </Wrapper>,
    )
    expect(screen.getByText(/Star Finder is no longer supported/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull()
    fireEvent.click(await screen.findByRole("button", { name: "Next page" }))
    fireEvent.click(await screen.findByText("00000222"))
    await screen.findByText("Rendered star")
    await act(async () => resolveFirst([{ id: 10, seed: 111, index: 0 }]))
    expect(screen.queryByText("00000111")).toBeNull()
    await waitFor(() => expect(generateGalaxy).toHaveBeenCalledTimes(1))
    expect(generateGalaxy).toHaveBeenCalledWith(false, 222, getDefaultParams())
    expect(
        screen
            .getByRole("link", { name: "View in new tab" })
            .getAttribute("href"),
    ).toMatch(/^\/galaxy\/222\/0/)
})
