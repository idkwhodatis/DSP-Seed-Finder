import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { I18nProvider } from "@lingui/react"
import { setupI18n } from "@lingui/core"
import GalaxyOverview from "./GalaxyOverview"
import { SpectrType, StarType } from "../enums"
vi.mock("./Starmap", () => ({
    default: ({
        animationEnabled,
        onAnimationStatus,
    }: {
        animationEnabled: boolean
        onAnimationStatus: (status: string) => void
    }) => (
        <div data-testid="starmap" data-animation-enabled={animationEnabled}>
            <button onClick={() => onAnimationStatus("unavailable")}>
                Simulate renderer failure
            </button>
        </div>
    ),
}))
beforeEach(() => localStorage.removeItem("dsp-seed-finder-animation"))
afterEach(cleanup)
const galaxy = {
    seed: 0,
    stars: [
        {
            index: 0,
            name: "Alpha",
            type: StarType.MainSeqStar,
            spectr: SpectrType.G,
            planets: [],
        },
    ],
} as unknown as Galaxy
function content() {
    return (
        <I18nProvider i18n={setupI18n({ locale: "en", messages: { en: {} } })}>
            <GalaxyOverview galaxy={galaxy} search="?count=32" />
        </I18nProvider>
    )
}
describe("galaxy panels and motion controls", () => {
    it("places the seed/type/resource panel before the map on desktop", () => {
        const { container } = render(content())
        const root = container.firstElementChild!
        expect(root.children[0]).toHaveTextContent("Star types")
        expect(root.children[1]).toContainElement(screen.getByTestId("starmap"))
    })
    it("persists manual pause across map navigation and supports repeated toggles", () => {
        const first = render(content())
        fireEvent.click(
            screen.getByRole("button", { name: "Pause star animation" }),
        )
        expect(screen.getByTestId("starmap")).toHaveAttribute(
            "data-animation-enabled",
            "false",
        )
        expect(localStorage.getItem("dsp-seed-finder-animation")).toBe("off")
        first.unmount()
        render(content())
        expect(
            screen.getByRole("button", { name: "Enable star animation" }),
        ).toHaveAttribute("aria-pressed", "false")
        fireEvent.click(
            screen.getByRole("button", { name: "Enable star animation" }),
        )
        expect(screen.getByTestId("starmap")).toHaveAttribute(
            "data-animation-enabled",
            "true",
        )
        expect(localStorage.getItem("dsp-seed-finder-animation")).toBe("on")
    })
    it("keeps the map and information readable when WebGL is unavailable", () => {
        render(content())
        fireEvent.click(
            screen.getByRole("button", { name: "Simulate renderer failure" }),
        )
        expect(screen.getByText("Static map").closest("button")).toBeDisabled()
        expect(screen.getByTestId("starmap")).toBeVisible()
        expect(screen.getByText("Star types")).toBeVisible()
    })
})
