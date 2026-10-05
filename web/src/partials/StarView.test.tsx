import {
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { MemoryRouter } from "react-router-dom"
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
function content(selected = star, displayNames?: ReadonlyMap<number, string>) {
    return (
        <I18nProvider i18n={setupI18n({ locale: "en", messages: { en: {} } })}>
            <MemoryRouter>
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
    it("renders every planet with a direct jump link and keeps details before nearby stars", () => {
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
    it("supports repeated expansion and navigation without dropping planets", () => {
        const { rerender } = render(content())
        fireEvent.click(
            screen.getByRole("button", { name: "Expand star details" }),
        )
        expect(screen.getByText("Temperature")).toBeVisible()
        fireEvent.click(
            screen.getByRole("button", { name: "Collapse star details" }),
        )
        expect(screen.queryByText("Temperature")).not.toBeInTheDocument()
        rerender(content(other))
        expect(screen.getAllByRole("article")).toHaveLength(6)
        expect(screen.getByRole("link", { name: "VI" })).toHaveAttribute(
            "href",
            "#star-1-planet-5",
        )
    })
})
