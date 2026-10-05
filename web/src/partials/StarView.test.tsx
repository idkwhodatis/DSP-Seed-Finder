import {
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { MemoryRouter, useLocation } from "react-router-dom"
import { I18nProvider } from "@lingui/react"
import { setupI18n } from "@lingui/core"
import StarView from "./StarView"
import {
    GasType,
    OceanType,
    PlanetType,
    SpectrType,
    StarType,
    VeinType,
} from "../enums"

afterEach(cleanup)
const star: Star = {
    index: 0,
    name: "Test Star",
    position: [0, 0, 0],
    type: StarType.MainSeqStar,
    spectr: SpectrType.G,
    mass: 1,
    lifetime: 100,
    age: 0.5,
    temperature: 6000,
    luminosity: 1,
    radius: 1,
    dysonRadius: 10000,
    initialHiveCount: 1,
    maxHiveCount: 2,
    color: 0.5,
    planets: Array.from({ length: 6 }, (_, index) => ({
        index,
        orbitAround: index === 1 ? 0 : null,
        orbitIndex: index,
        orbitRadius: index + 1,
        orbitInclination: 0,
        orbitLongitude: 0,
        orbitalPeriod: 20,
        obliquity: 0,
        rotationPeriod: 5,
        sunDistance: 1,
        type: index === 0 ? PlanetType.Gas : PlanetType.Ocean,
        luminosity: 1,
        theme: {
            id: index === 0 ? 2 : 1,
            name: "",
            waterItemId: OceanType.Water,
            wind: 1,
        },
        gases: index === 0 ? [[GasType.Hydrogen, 0.5]] : [],
        actualVeins:
            index === 0 ? [] : [{ veinType: VeinType.Iron, amount: 1000 }],
    })),
}
const other: Star = {
    ...star,
    index: 1,
    name: "Other Star",
    position: [3, 0, 4],
}
function CurrentLocation() {
    const location = useLocation()
    return (
        <output data-testid="location">
            {location.pathname}
            {location.search}
            {location.hash}
        </output>
    )
}
function content(
    selected = star,
    displayNames?: ReadonlyMap<number, string>,
    initialEntry = "/",
) {
    return (
        <I18nProvider i18n={setupI18n({ locale: "en", messages: { en: {} } })}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <CurrentLocation />
                <StarView
                    star={selected}
                    displayNames={displayNames}
                    galaxy={{ seed: 0, stars: [star, other] }}
                    buildUrl={(index) => `/galaxy/0/${index}?count=32`}
                />
            </MemoryRouter>
        </I18nProvider>
    )
}
describe("complete planet details", () => {
    it("keeps planet cards in one column without responsive overrides", () => {
        const css = readFileSync("web/src/partials/StarView.module.css", "utf8")
        const planetRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
            ([, selector]) =>
                selector!
                    .split(",")
                    .some((part) => part.trim() === ".planetGrid"),
        )
        const columnDeclarations = planetRules.flatMap(([, , body]) =>
            [...body!.matchAll(/grid-template-columns:\s*([^;]+);/g)].map(
                ([, value]) => value,
            ),
        )
        expect(columnDeclarations).toEqual(["minmax(0, 1fr)"])
    })
    it("renders every planet with a direct jump link and optional nearby stars", () => {
        render(content())
        const planets = screen.getAllByRole("article")
        expect(planets).toHaveLength(6)
        const navigation = screen.getByRole("navigation", {
            name: "Jump to planet",
        })
        const links = within(navigation).getAllByRole("link")
        expect(links).toHaveLength(6)
        links.forEach((link, index) => {
            expect(link).toHaveAttribute("href", `#star-0-planet-${index}`)
            expect(planets[index]).toHaveAttribute(
                "id",
                `star-0-planet-${index}`,
            )
        })
        expect(
            within(planets[5]!).getByRole("heading", {
                name: "VI Test Star VI",
            }),
        ).toBeVisible()
        expect(
            screen.getByText("Nearby Stars").closest("details"),
        ).not.toHaveAttribute("open")
    })
    it("applies localized labels to the selected star, planets, and nearby stars without changing source data", () => {
        render(
            content(
                star,
                new Map([
                    [0, "狮子座ι"],
                    [1, "天床三"],
                ]),
            ),
        )
        expect(
            screen.getByRole("heading", { name: /狮子座ι #1/ }),
        ).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "VI 狮子座ι VI" }),
        ).toBeVisible()
        fireEvent.click(screen.getByText("Nearby Stars"))
        expect(screen.getByRole("link", { name: /天床三/ })).toHaveAttribute(
            "href",
            "/galaxy/0/1?count=32",
        )
        expect(star.name).toBe("Test Star")
    })
    it("keeps planet label/value pairs aligned with breathing room in content-sized cards", () => {
        render(content())
        const planets = screen.getAllByRole("article")
        for (const [planet, label, value] of [
            [planets[0]!, "Type", "Ice Giant"],
            [planets[0]!, "Hydrogen", "0.5 /s"],
            [planets[1]!, "Wind power", "100%"],
            [planets[1]!, "Iron Ore", "1,000"],
            [planets[1]!, "Water", "Ocean"],
        ] as const) {
            const field = within(planet).getByText(label)
            expect(field.nextElementSibling).toHaveTextContent(value)
            expect(field.parentElement?.children).toHaveLength(2)
        }
        expect(
            within(planets[1]!).getByText("Satellite").children,
        ).toHaveLength(0)
        const css = readFileSync("web/src/partials/StarView.module.css", "utf8")
        expect(css).toMatch(
            /\.planet \{[^}]*grid-template-columns: minmax\(0, max-content\) minmax\(0, max-content\)/,
        )
        expect(css).toMatch(
            /\.planet > \.row \{[^}]*grid-template-columns: subgrid/,
        )
        expect(css).toMatch(
            /\.planet > \.row > \.value \{[^}]*text-align: left;[^}]*overflow-wrap: anywhere/,
        )
        expect(css).toMatch(
            /\.planet \{[^}]*width: max-content;[^}]*max-width: 100%;[^}]*column-gap: 24px/,
        )
        expect(css).toMatch(
            /\.planets \{[^}]*width: fit-content;[^}]*max-width: 100%/,
        )
        expect(css).toMatch(/\.planetGrid \{[^}]*justify-items: start/)
        expect(css).toMatch(/\.planet > \.row \{[^}]*padding: 5px 0/)
        expect(css).toMatch(/\.planetName \{[^}]*overflow-wrap: anywhere/)
        expect(css).toMatch(/\.planetName \{[^}]*grid-column: 1 \/ -1/)
    })
    it("always shows full star details and keeps all planets after navigation", () => {
        const { rerender } = render(content())
        for (const label of ["Radius", "Mass", "Temperature", "Age"]) {
            expect(screen.getByText(label)).toBeVisible()
        }
        expect(
            screen.queryByRole("button", {
                name: /(?:Expand|Collapse) star details/,
            }),
        ).not.toBeInTheDocument()
        rerender(content(other))
        expect(screen.getAllByRole("article")).toHaveLength(6)
        expect(screen.getByText("Temperature")).toBeVisible()
        expect(screen.getByRole("link", { name: "VI" })).toHaveAttribute(
            "href",
            "#star-1-planet-5",
        )
    })
    it("exposes separate keyboard-focusable overview and planet scroll regions", () => {
        render(content())
        const overview = screen.getByRole("region", { name: "Test Star #1" })
        const planets = screen.getByRole("region", { name: "Planets 6" })
        expect(overview).toHaveAttribute("tabindex", "0")
        expect(planets).toHaveAttribute("tabindex", "0")
        expect(overview).not.toContainElement(planets)
        expect(within(planets).getAllByRole("article")).toHaveLength(6)
        const css = readFileSync("web/src/partials/StarView.module.css", "utf8")
        for (const selector of ["main", "planetGrid"]) {
            const rule = css.match(
                new RegExp(`\\.${selector} \\{([^}]+)\\}`),
            )![1]!
            expect(rule).toContain("overflow-y: auto")
            expect(rule).toContain("min-height: 0")
        }
    })
    it("bounds the stacked planet panel by its actual available pane height", () => {
        const css = readFileSync("web/src/partials/StarView.module.css", "utf8")
        const narrow = css.slice(css.indexOf("@media (max-width: 1080px)"))
        expect(narrow).toContain("height: min(70dvh, 100%)")
        expect(narrow).toContain("flex-direction: column")
        expect(narrow).not.toContain("min-height: 280px")
    })
    it("jumps repeatedly within the planet list while preserving route parameters", () => {
        render(content(star, undefined, "/galaxy/0/0?count=32&resource=2"))
        const last = screen.getAllByRole("article")[5]!
        const scroll = vi.spyOn(last, "scrollIntoView")
        fireEvent.click(screen.getByRole("link", { name: "VI" }))
        expect(scroll).toHaveBeenCalledWith({
            block: "start",
            inline: "nearest",
        })
        scroll.mockClear()
        fireEvent.click(screen.getByRole("link", { name: "VI" }))
        expect(scroll).toHaveBeenCalledWith({
            block: "start",
            inline: "nearest",
        })
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/galaxy/0/0?count=32&resource=2#star-0-planet-5",
        )
        scroll.mockRestore()
    })
    it("honors a direct planet hash when the system opens", () => {
        const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView)
        scroll.mockClear()
        render(content(star, undefined, "/#star-0-planet-5"))
        expect(scroll.mock.contexts).toContain(
            screen.getAllByRole("article")[5],
        )
    })
})
