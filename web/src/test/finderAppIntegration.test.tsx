import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App from "../App"
import FindGalaxy from "../views/FindGalaxy"
import {
    getMultiProfileProgress,
    getMultiProfileResult,
    listMultiProfiles,
    deleteMultiProfile,
} from "../profile"
import { constructMultiRule } from "../util"
import { RuleType } from "../enums"
import { startSearchingGalaxies, stopSearchingGalaxies } from "../worldgen"

// Keep the App, providers, controls, ruleset dialogs, and IndexedDB real.
vi.mock("../worldgen", () => ({
    startSearchingGalaxies: vi.fn(),
    stopSearchingGalaxies: vi.fn(),
    generateGalaxy: vi.fn(),
    searchStar: vi.fn(),
}))
const createdProfiles: string[] = []
function mountApp() {
    return render(
        <MemoryRouter initialEntries={["/find-galaxy"]}>
            <Routes>
                <Route element={<App />}>
                    <Route
                        path="/find-galaxy/:profileId?"
                        element={<FindGalaxy />}
                    />
                </Route>
            </Routes>
        </MemoryRouter>,
    )
}
function field(label: string) {
    let container = screen.getByText(label, { exact: true }).parentElement!
    while (!container.querySelector("input")) container = container.parentElement!
    return within(container)
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
})
afterEach(async () => {
    cleanup()
    for (const id of createdProfiles.splice(0)) await deleteMultiProfile(id)
})

describe("Real App finder integration", () => {
    it("edits a real ruleset dialog, saves a new profile and searches seed zero", async () => {
        const user = userEvent.setup()
        mountApp()
        const start = await screen.findByRole("button", { name: "Start" })
        expect(start).toBeDisabled()
        await user.clear(screen.getByDisplayValue("Untitled"))
        await user.type(
            field("New Profile Name").getByRole("textbox"),
            "Seed zero integration",
        )
        const endSeed = field("Seed range").getAllByRole("textbox")[1]!
        fireEvent.change(endSeed, { target: { value: "0" } })
        await user.click(screen.getByRole("button", { name: "this ruleset" }))
        const ruleset = await screen.findByRole("dialog")
        expect(
            within(ruleset).getByRole("heading", { name: "Ruleset" }),
        ).toBeInTheDocument()
        await user.click(within(ruleset).getByRole("combobox"))
        await user.click(
            await screen.findByRole("option", { name: "Starting system" }),
        )
        expect(
            within(ruleset).getByText("Is the Starting system"),
        ).toBeInTheDocument()
        await user.click(
            within(ruleset).getByRole("button", { name: "Close dialog" }),
        )
        expect(screen.queryByRole("dialog")).toBeNull()
        expect(start).toBeEnabled()
        await user.click(screen.getByRole("button", { name: "Save" }))
        await screen.findByRole("button", { name: "Clone" })
        const info = (await listMultiProfiles()).find(
            (item) => item.name === "Seed zero integration",
        )!
        expect(info).toBeTruthy()
        createdProfiles.push(info.id)
        const saved = await getMultiProfileProgress(info.id)
        expect(saved?.range).toEqual([0, 1])
        expect(saved?.multiRules[0]?.[0]?.rules).toEqual([
            [{ type: RuleType.Birth }],
        ])
        await user.click(screen.getByRole("button", { name: "Start" }))
        await waitFor(() =>
            expect(startSearchingGalaxies).toHaveBeenCalledTimes(1),
        )
        const [native, options] = vi.mocked(startSearchingGalaxies).mock
            .calls[0]!
        expect(native).toBe(false)
        expect(options.range).toEqual([0, 1])
        expect(options.rule).toEqual(constructMultiRule(saved!.multiRules))
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
        await act(async () => {
            options.onResult?.([0])
            options.onProgress(1)
            options.onComplete()
        })
        await screen.findByText("Completed!")
        expect(await getMultiProfileResult(info.id, 0, 100)).toEqual([
            { seed: 0 },
        ])
        expect(await getMultiProfileProgress(info.id)).toMatchObject({
            found: 1,
            nextBatchId: 1,
        })
        expect(
            await screen.findByRole("link", { name: "00000000" }),
        ).toHaveAttribute("href", expect.stringContaining("/galaxy/0"))
    })

    it("changes the real app theme and language while preserving entered settings", async () => {
        const user = userEvent.setup()
        mountApp()
        await screen.findByRole("button", { name: "Start" })
        const profileName = field("New Profile Name").getByRole("textbox")
        fireEvent.change(profileName, {
            target: { value: "Keep this profile name" },
        })
        const wasDark = document.documentElement.classList.contains("dark")
        await user.click(
            screen.getByRole("button", { name: "Toggle dark mode" }),
        )
        expect(document.documentElement.classList.contains("dark")).toBe(
            !wasDark,
        )
        expect(localStorage.getItem("dsp-seed-finder-theme")).toBe(
            wasDark ? "light" : "dark",
        )
        await user.click(
            screen.getByRole("button", { name: "Change language" }),
        )
        await screen.findByRole("button", { name: "开始搜索" })
        expect(document.documentElement.lang).toBe("zh-CN")
        expect(localStorage.getItem("dsp-seed-finder-language")).toBe("zh-CN")
        expect(
            screen.getByRole("link", { name: "星系查找器" }),
        ).toBeInTheDocument()
        expect(
            screen.getByDisplayValue("Keep this profile name"),
        ).toBeInTheDocument()
        await user.click(
            screen.getByRole("button", { name: "Change language" }),
        )
        await screen.findByRole("button", { name: "Start" })
        expect(document.documentElement.lang).toBe("en")
        expect(
            screen.getByDisplayValue("Keep this profile name"),
        ).toBeInTheDocument()
    })

    it("preserves a leading decimal while replacing a numeric setting", async () => {
        const user = userEvent.setup()
        mountApp()
        await screen.findByRole("button", { name: "Start" })
        const autosave = field("Autosave interval").getByRole("textbox")
        await user.click(autosave)
        await user.keyboard("{Control>}a{/Control}.5")
        expect(autosave).toHaveValue(".5")
    })

    it("retains compact controls and only offers a native download when its asset exists", async () => {
        mountApp()
        await screen.findByRole("button", { name: "Start" })
        for (const label of [
            "Seed range",
            "Number of stars",
            "Resource multiplier",
            "Dark Fog initial occupation",
            "Dark Fog max density",
            "Concurrency",
            "Autosave interval",
            "Native Mode",
        ]) {
            expect(screen.getByText(label, { exact: true })).toBeInTheDocument()
        }
        expect(field("Number of stars").getByRole("textbox")).toHaveClass("h-8")
        expect(
            screen.getByRole("combobox", { name: "Resource multiplier" }),
        ).toHaveClass("h-8")
        const download = screen.queryByRole("link", { name: "Download" })
        if (__HAS_NATIVE_DOWNLOAD__) {
            expect(download).toHaveAttribute("download", "DSP-Seed-Finder.exe")
            expect(download).toHaveAttribute(
                "href",
                "/DSP-Seed-Finder/downloads/DSP-Seed-Finder.exe",
            )
        } else expect(download).toBeNull()
        expect(stopSearchingGalaxies).not.toHaveBeenCalled()
    })
})
