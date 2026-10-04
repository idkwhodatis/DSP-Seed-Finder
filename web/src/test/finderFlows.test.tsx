import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nProvider } from "@lingui/react"
import { i18n } from "@lingui/core"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PropsWithChildren } from "react"
import FindGalaxy from "../views/FindGalaxy"
import ProfilesModal from "../partials/ProfilesModal"
import { StoreContext } from "../store"
import { useObjectState } from "../hooks/useLiveState"
import { getDefaultParams } from "../util"
import * as profileDb from "../profile"
import * as worldgen from "../worldgen"

vi.mock("../profile", () => ({
    clearMultiProfile: vi.fn(),
    deleteMultiProfile: vi.fn(),
    generateProfileId: vi.fn(() => "new-profile"),
    getMultiProfileInfo: vi.fn(),
    getMultiProfileProgress: vi.fn(),
    getMultiProfileResult: vi.fn(),
    listMultiProfiles: vi.fn(),
    setMultiProfileInfo: vi.fn(),
    setMultiProfileProgress: vi.fn(),
}))
vi.mock("../worldgen", () => ({
    startSearchingGalaxies: vi.fn(),
    stopSearchingGalaxies: vi.fn(),
}))
vi.mock("../util", async (original) => ({
    ...(await original<typeof import("../util")>()),
    validateMultiRule: () => true,
}))
vi.mock("../partials/ProgressEditor", () => ({
    default: (props: {
        name: string
        onNameChange: (name: string) => void
        progress: ProfileProgressInfo
    }) => (
        <>
            <input
                aria-label="Profile name"
                value={props.name}
                onChange={(event) => props.onNameChange(event.target.value)}
            />
            <span data-testid="checkpoint">
                {props.progress.nextBatchId}:{props.progress.found}
            </span>
        </>
    ),
}))
vi.mock("../partials/ProfileManager", () => ({
    default: (props: {
        onClear: () => void
        onClone: () => void
        onSave: () => void
        disabled: boolean
    }) => (
        <>
            <button onClick={props.onClear} disabled={props.disabled}>
                Clear profile
            </button>
            <button onClick={props.onClone} disabled={props.disabled}>
                Clone profile
            </button>
            <button onClick={props.onSave} disabled={props.disabled}>
                Save profile
            </button>
        </>
    ),
}))
vi.mock("../partials/MultiRuleEditor", () => ({ default: () => null }))
vi.mock("../partials/ExportModal", () => ({ default: () => null }))
vi.mock("../components/Modal", () => ({
    default: ({
        visible,
        children,
    }: PropsWithChildren<{ visible: boolean }>) =>
        visible ? <div>{children}</div> : null,
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
function RouteSwitcher() {
    const navigate = useNavigate()
    return (
        <button onClick={() => navigate("/find-galaxy/second")}>
            Load second route
        </button>
    )
}
function mountFinder(path = "/find-galaxy") {
    return render(
        <Wrapper>
            <MemoryRouter initialEntries={[path]}>
                <RouteSwitcher />
                <Routes>
                    <Route
                        path="/find-galaxy/:profileId?"
                        element={<FindGalaxy />}
                    />
                </Routes>
            </MemoryRouter>
        </Wrapper>,
    )
}
function savedProgress(id: string, nextBatchId = 1): MultiProfileProgress {
    return {
        id,
        params: getDefaultParams(),
        concurrency: 1,
        autosave: 5,
        range: [0, 1000],
        total: 1000,
        found: 1,
        batchSize: 100,
        nextBatchId,
        multiRules: [],
    }
}
beforeEach(() => {
    vi.clearAllMocks()
    i18n.load("en", {})
    i18n.activate("en")
    vi.mocked(profileDb.getMultiProfileResult).mockResolvedValue([])
    vi.mocked(profileDb.listMultiProfiles).mockResolvedValue([])
    vi.mocked(profileDb.setMultiProfileInfo).mockResolvedValue()
    vi.mocked(profileDb.setMultiProfileProgress).mockResolvedValue()
    vi.mocked(profileDb.clearMultiProfile).mockResolvedValue()
})
afterEach(cleanup)
describe("Galaxy finder lifecycle", () => {
    it("locks repeated starts before saving and waits for the final checkpoint before Resume", async () => {
        const initialWrite = deferred<void>()
        vi.mocked(profileDb.setMultiProfileProgress).mockImplementationOnce(
            () => initialWrite.promise,
        )
        mountFinder()
        const start = screen.getByRole("button", { name: "Start" })
        act(() => {
            fireEvent.click(start)
            fireEvent.click(start)
        })
        expect(profileDb.generateProfileId).toHaveBeenCalledTimes(1)
        expect(worldgen.startSearchingGalaxies).not.toHaveBeenCalled()
        await act(async () => initialWrite.resolve())
        await waitFor(() =>
            expect(worldgen.startSearchingGalaxies).toHaveBeenCalledTimes(1),
        )
        const options = vi.mocked(worldgen.startSearchingGalaxies).mock
            .calls[0]![1]
        const checkpointWrite = deferred<void>()
        vi.mocked(profileDb.setMultiProfileProgress).mockImplementationOnce(
            () => checkpointWrite.promise,
        )
        act(() => {
            options.onResult?.([42])
            options.onProgress(1)
        })
        await waitFor(() =>
            expect(profileDb.setMultiProfileProgress).toHaveBeenCalledTimes(2),
        )
        const [snapshot, results] = vi.mocked(profileDb.setMultiProfileProgress)
            .mock.calls[1]!
        expect(() => structuredClone(snapshot)).not.toThrow()
        expect(snapshot).toMatchObject({
            id: "new-profile",
            nextBatchId: 1,
            found: 1,
        })
        expect(results).toEqual([42])
        fireEvent.click(screen.getByRole("button", { name: "Pause" }))
        expect(worldgen.stopSearchingGalaxies).toHaveBeenCalledWith(false)
        act(() => options.onComplete())
        expect(screen.queryByRole("button", { name: "Resume" })).toBeNull()
        await act(async () => checkpointWrite.resolve())
        fireEvent.click(await screen.findByRole("button", { name: "Resume" }))
        await waitFor(() =>
            expect(worldgen.startSearchingGalaxies).toHaveBeenCalledTimes(2),
        )
        expect(
            vi.mocked(worldgen.startSearchingGalaxies).mock.calls[1]![1]
                .nextBatchId,
        ).toBe(1)
        act(() => options.onError(new Error("Late callback")))
        expect(worldgen.stopSearchingGalaxies).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole("alert")).toBeNull()
        act(() =>
            vi
                .mocked(worldgen.startSearchingGalaxies)
                .mock.calls[1]![1].onComplete(),
        )
    })
    it("serializes immutable checkpoints and saves final results after unmount", async () => {
        const { unmount } = mountFinder()
        fireEvent.click(screen.getByRole("button", { name: "Start" }))
        await waitFor(() =>
            expect(worldgen.startSearchingGalaxies).toHaveBeenCalledTimes(1),
        )
        const options = vi.mocked(worldgen.startSearchingGalaxies).mock
            .calls[0]![1]
        const firstWrite = deferred<void>()
        vi.mocked(profileDb.setMultiProfileProgress).mockImplementationOnce(
            () => firstWrite.promise,
        )
        act(() => {
            options.onResult?.([11])
            options.onProgress(1)
        })
        await waitFor(() =>
            expect(profileDb.setMultiProfileProgress).toHaveBeenCalledTimes(2),
        )
        const firstSnapshot = vi.mocked(profileDb.setMultiProfileProgress).mock
            .calls[1]![0]
        unmount()
        expect(worldgen.stopSearchingGalaxies).toHaveBeenCalledWith(false)
        act(() => {
            options.onResult?.([22])
            options.onProgress(2)
            options.onComplete()
        })
        expect(profileDb.setMultiProfileProgress).toHaveBeenCalledTimes(2)
        expect(firstSnapshot).toMatchObject({ nextBatchId: 1, found: 1 })
        await act(async () => firstWrite.resolve())
        await waitFor(() =>
            expect(profileDb.setMultiProfileProgress).toHaveBeenCalledTimes(3),
        )
        expect(
            vi.mocked(profileDb.setMultiProfileProgress).mock.calls[2],
        ).toEqual([
            expect.objectContaining({
                id: "new-profile",
                nextBatchId: 2,
                found: 2,
            }),
            [22],
        ])
        expect(firstSnapshot).toMatchObject({ nextBatchId: 1, found: 1 })
    })
    it("ignores old result pages after pagination", async () => {
        const oldPage = deferred<MultiProgressResult[]>()
        vi.mocked(profileDb.getMultiProfileInfo).mockResolvedValue({
            id: "saved",
            name: "Saved",
            createdAt: 0,
        })
        vi.mocked(profileDb.getMultiProfileProgress).mockResolvedValue({
            ...savedProgress("saved"),
            found: 201,
        })
        vi.mocked(profileDb.getMultiProfileResult).mockImplementation(
            (_id, start) =>
                start === 0
                    ? oldPage.promise
                    : Promise.resolve([{ seed: 222 }]),
        )
        mountFinder("/find-galaxy/saved")
        fireEvent.click(
            await screen.findByRole("button", { name: "Next page" }),
        )
        await screen.findByText("00000222")
        await act(async () => oldPage.resolve([{ seed: 111 }]))
        expect(screen.queryByText("00000111")).toBeNull()
        expect(screen.getByText("00000222")).toBeTruthy()
    })
    it("ignores profile loads from the previous route", async () => {
        const firstInfo = deferred<ProfileInfo | null>()
        const firstProgress = deferred<MultiProfileProgress | null>()
        vi.mocked(profileDb.getMultiProfileInfo).mockImplementation((id) =>
            id === "first"
                ? firstInfo.promise
                : Promise.resolve({ id, name: "Second profile", createdAt: 0 }),
        )
        vi.mocked(profileDb.getMultiProfileProgress).mockImplementation((id) =>
            id === "first"
                ? firstProgress.promise
                : Promise.resolve(savedProgress(id)),
        )
        mountFinder("/find-galaxy/first")
        fireEvent.click(screen.getByText("Load second route"))
        await waitFor(() =>
            expect(
                (screen.getByLabelText("Profile name") as HTMLInputElement)
                    .value,
            ).toBe("Second profile"),
        )
        await act(async () => {
            firstInfo.resolve({
                id: "first",
                name: "Stale profile",
                createdAt: 0,
            })
            firstProgress.resolve(savedProgress("first"))
        })
        expect(
            (screen.getByLabelText("Profile name") as HTMLInputElement).value,
        ).toBe("Second profile")
    })
    it("persists a cleared cursor and resets cloning to a fresh profile", async () => {
        vi.mocked(profileDb.getMultiProfileInfo).mockResolvedValue({
            id: "saved",
            name: "Saved",
            createdAt: 0,
        })
        vi.mocked(profileDb.getMultiProfileProgress).mockResolvedValue(
            savedProgress("saved", 3),
        )
        mountFinder("/find-galaxy/saved")
        await screen.findByRole("button", { name: "Resume" })
        fireEvent.click(screen.getByText("Clear profile"))
        await waitFor(() =>
            expect(profileDb.setMultiProfileProgress).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: "saved",
                    nextBatchId: 0,
                    found: 0,
                }),
            ),
        )
        await screen.findByRole("button", { name: "Start" })
        fireEvent.click(screen.getByText("Clone profile"))
        expect(
            (screen.getByLabelText("Profile name") as HTMLInputElement).value,
        ).toBe("Saved - Copy")
        expect(screen.getByTestId("checkpoint").textContent).toBe("0:0")
    })
})
describe("Saved profile chooser", () => {
    it("distinguishes loading and errors from an empty list", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        render(
            <Wrapper>
                <ProfilesModal
                    visible
                    onClose={vi.fn()}
                    onSelect={vi.fn()}
                    loadProfiles={vi
                        .fn()
                        .mockRejectedValue(new Error("Storage unavailable"))}
                />
            </Wrapper>,
        )
        expect(screen.getByRole("status").textContent).toBe("Loading profiles…")
        expect(screen.queryByText("No saved profiles.")).toBeNull()
        expect((await screen.findByRole("alert")).textContent).toContain(
            "Unable to load saved profiles",
        )
        expect(screen.queryByText("No saved profiles.")).toBeNull()
        error.mockRestore()
    })
    it("lets keyboard users select a profile", async () => {
        const user = userEvent.setup()
        const profile = {
            id: "keyboard",
            name: "Keyboard profile",
            createdAt: 0,
        }
        const onSelect = vi.fn()
        render(
            <Wrapper>
                <ProfilesModal
                    visible
                    onClose={vi.fn()}
                    onSelect={onSelect}
                    loadProfiles={vi.fn().mockResolvedValue([profile])}
                />
            </Wrapper>,
        )
        const button = await screen.findByRole("button", {
            name: /Keyboard profile/,
        })
        await user.tab()
        expect(document.activeElement).toBe(button)
        await user.keyboard("{Enter}")
        expect(onSelect).toHaveBeenCalledWith(profile)
    })
    it("loads once per opening and ignores a closed modal's stale response", async () => {
        const old = deferred<ProfileInfo[]>()
        const loadProfiles = vi
            .fn()
            .mockReturnValueOnce(old.promise)
            .mockResolvedValue([
                { id: "new", name: "Current profile", createdAt: 0 },
            ])
        const props = { onClose: vi.fn(), onSelect: vi.fn(), loadProfiles }
        const { rerender } = render(
            <Wrapper>
                <ProfilesModal {...props} visible />
            </Wrapper>,
        )
        rerender(
            <Wrapper>
                <ProfilesModal {...props} visible />
            </Wrapper>,
        )
        expect(loadProfiles).toHaveBeenCalledTimes(1)
        rerender(
            <Wrapper>
                <ProfilesModal {...props} visible={false} />
            </Wrapper>,
        )
        rerender(
            <Wrapper>
                <ProfilesModal {...props} visible />
            </Wrapper>,
        )
        await screen.findByText("Current profile")
        await act(async () =>
            old.resolve([{ id: "old", name: "Stale profile", createdAt: 0 }]),
        )
        expect(screen.queryByText("Stale profile")).toBeNull()
        expect(loadProfiles).toHaveBeenCalledTimes(2)
    })
})
