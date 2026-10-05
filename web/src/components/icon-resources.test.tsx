import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setupI18n } from "@lingui/core"
import { I18nProvider } from "@lingui/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { readFileSync } from "node:fs"
import {
    ConditionType,
    GasType,
    OceanType,
    PlanetType,
    RuleType,
    SpectrType,
    StarType,
    VeinType,
} from "../enums"
import GameIcon, { gasIcons, oceanIcons, veinIcons } from "./GameIcon"
import atlas from "./GameIcon.atlas.json"
import RuleEditor from "../partials/RuleEditor"
import StarView from "../partials/StarView"
import GalaxyOverview from "../partials/GalaxyOverview"

vi.mock("../partials/Starmap", () => ({
    default: () => <div data-testid="starmap" />,
}))
afterEach(cleanup)

function localized(children: ReactNode) {
    return (
        <I18nProvider i18n={setupI18n({ locale: "en", messages: { en: {} } })}>
            <MemoryRouter>{children}</MemoryRouter>
        </I18nProvider>
    )
}

describe("compact vanilla resource icons", () => {
    it("covers every displayed vein, collectible gas, and resource ocean", () => {
        expect(Object.keys(veinIcons)).toEqual(
            Object.values(VeinType).filter((type) => type !== VeinType.None),
        )
        expect(Object.keys(gasIcons).map(Number).sort()).toEqual(
            [GasType.Fireice, GasType.Hydrogen, GasType.Deuterium].sort(),
        )
        expect(Object.keys(oceanIcons).map(Number).sort()).toEqual(
            [OceanType.Water, OceanType.Sulfur].sort(),
        )
        expect(
            new Set([
                ...Object.values(veinIcons),
                ...Object.values(gasIcons),
                ...Object.values(oceanIcons),
            ]).size,
        ).toBe(18)
        for (const sprite of Object.values(atlas)) {
            expect(sprite.x + sprite.width).toBeLessThanOrEqual(
                sprite.total_width,
            )
            expect(sprite.y + sprite.height).toBeLessThanOrEqual(
                sprite.total_height,
            )
            expect(sprite.width).toBe(80)
            expect(sprite.height).toBe(80)
        }
    })

    it("uses the matched atlas at 18px without adding an accessible duplicate label", () => {
        const { container } = render(
            <span>
                <GameIcon vein={VeinType.Iron} />
                Iron Ore
            </span>,
        )
        const icon = container.querySelector<HTMLElement>(
            "[data-resource-icon='iron-ore']",
        )!
        const sprite = atlas["iron-ore"]
        expect(icon.getAttribute("aria-hidden")).toBe("true")
        expect(icon.style.backgroundImage).toContain(
            `${import.meta.env.BASE_URL}icons/Vanilla.a5875c769e5d3076.png`,
        )
        expect(icon.style.backgroundPosition).toBe(
            `${(-sprite.x * 18) / 80}px ${(-sprite.y * 18) / 80}px`,
        )
        expect(icon.style.backgroundSize).toBe("252px 252px")
        const css = readFileSync(
            "web/src/components/GameIcon.module.css",
            "utf8",
        )
        expect(css).toMatch(/width:\s*18px/)
        expect(css).toMatch(/height:\s*18px/)
        expect(screen.getByText("Iron Ore")).toBeTruthy()
        expect(screen.queryByRole("img")).toBeNull()
    })

    it("does not invent icons for absent resources or non-collectible oceans", () => {
        const { container } = render(
            <>
                <GameIcon vein={VeinType.None} />
                <GameIcon gas={GasType.None} />
                <GameIcon ocean={OceanType.None} />
                <GameIcon ocean={OceanType.Lava} />
                <GameIcon ocean={OceanType.Ice} />
            </>,
        )
        expect(container.childElementCount).toBe(0)
    })
})

const condition: Condition = { type: ConditionType.Gte, value: 2 }
const rules: Array<{ rule: SimpleRule; selects: number; inputs: number }> = [
    { rule: { type: RuleType.Luminosity, condition }, selects: 2, inputs: 1 },
    { rule: { type: RuleType.DysonRadius, condition }, selects: 2, inputs: 1 },
    {
        rule: {
            type: RuleType.AverageVeinAmount,
            vein: VeinType.Iron,
            condition,
        },
        selects: 4,
        inputs: 1,
    },
    {
        rule: { type: RuleType.Spectr, spectr: [SpectrType.O] },
        selects: 2,
        inputs: 0,
    },
    {
        rule: { type: RuleType.TidalLockCount, condition },
        selects: 2,
        inputs: 1,
    },
    {
        rule: { type: RuleType.OceanType, oceanType: OceanType.Water },
        selects: 2,
        inputs: 0,
    },
    {
        rule: { type: RuleType.StarType, starType: [StarType.MainSeqStar] },
        selects: 2,
        inputs: 0,
    },
    {
        rule: { type: RuleType.GasCount, ice: null, condition },
        selects: 3,
        inputs: 1,
    },
    {
        rule: { type: RuleType.SatelliteCount, condition },
        selects: 2,
        inputs: 1,
    },
    {
        rule: { type: RuleType.PlanetCount, excludeGiant: false, condition },
        selects: 3,
        inputs: 1,
    },
    {
        rule: { type: RuleType.BirthDistance, condition },
        selects: 2,
        inputs: 1,
    },
    {
        rule: { type: RuleType.XDistance, all: false, condition },
        selects: 3,
        inputs: 1,
    },
    {
        rule: {
            type: RuleType.SpectrDistance,
            spectr: SpectrType.O,
            countCondition: condition,
            distanceCondition: condition,
        },
        selects: 4,
        inputs: 2,
    },
    {
        rule: { type: RuleType.GasRate, gasType: GasType.Hydrogen, condition },
        selects: 3,
        inputs: 1,
    },
    {
        rule: {
            type: RuleType.PlanetInDysonCount,
            includeGiant: false,
            condition,
        },
        selects: 3,
        inputs: 1,
    },
    { rule: { type: RuleType.ThemeId, themeIds: [1] }, selects: 3, inputs: 0 },
    {
        rule: { type: RuleType.HiveCount, initial: true, condition },
        selects: 3,
        inputs: 1,
    },
    { rule: { type: RuleType.Birth }, selects: 1, inputs: 0 },
]

describe("React rule editor resource labels", () => {
    it.each(rules)(
        "renders the $rule.type editor controls",
        ({ rule, selects, inputs }) => {
            render(
                localized(<RuleEditor value={[[rule]]} onChange={vi.fn()} />),
            )
            expect(screen.getAllByRole("combobox")).toHaveLength(selects)
            expect(screen.queryAllByRole("textbox")).toHaveLength(inputs)
            if (rule.type === RuleType.Birth)
                expect(screen.getByText("Is the Starting system")).toBeTruthy()
        },
    )

    it.each([
        {
            rule: {
                type: RuleType.AverageVeinAmount,
                vein: VeinType.Mag,
                condition,
            } as SimpleRule,
            icon: "mono-mag-ore",
            label: "Unipolar Magnet",
        },
        {
            rule: {
                type: RuleType.GasRate,
                gasType: GasType.Deuterium,
                condition,
            } as SimpleRule,
            icon: "deuterium",
            label: "Deuterium",
        },
        {
            rule: {
                type: RuleType.OceanType,
                oceanType: OceanType.Sulfur,
            } as SimpleRule,
            icon: "sulphuric-acid",
            label: "Sulfuric Acid",
        },
    ])("keeps $label text alongside its icon", ({ rule, icon, label }) => {
        const { container } = render(
            localized(<RuleEditor value={[[rule]]} onChange={vi.fn()} />),
        )
        expect(
            container.querySelector(`[data-resource-icon='${icon}']`),
        ).toBeTruthy()
        expect(
            screen.getByText(label).closest("button")?.getAttribute("role"),
        ).toBe("combobox")
    })

    it.each([
        {
            rule: {
                type: RuleType.AverageVeinAmount,
                vein: VeinType.Iron,
                condition,
                useActual: true,
            } as SimpleRule,
            selected: "Iron Ore",
            next: "Copper Ore",
            icon: "copper-ore",
            update: { vein: VeinType.Copper },
        },
        {
            rule: {
                type: RuleType.GasRate,
                gasType: GasType.Hydrogen,
                condition,
            } as SimpleRule,
            selected: "Hydrogen",
            next: "Deuterium",
            icon: "deuterium",
            update: { gasType: GasType.Deuterium },
        },
        {
            rule: {
                type: RuleType.OceanType,
                oceanType: OceanType.Water,
            } as SimpleRule,
            selected: "Water",
            next: "Sulfuric Acid",
            icon: "sulphuric-acid",
            update: { oceanType: OceanType.Sulfur },
        },
    ])(
        "changes $selected to $next through its icon-bearing option",
        ({ rule, selected, next, icon, update }) => {
            const onChange = vi.fn()
            render(
                localized(<RuleEditor value={[[rule]]} onChange={onChange} />),
            )
            fireEvent.keyDown(screen.getByText(selected).closest("button")!, {
                key: "ArrowDown",
            })
            const option = screen.getByRole("option", { name: next })
            expect(
                option.querySelector(`[data-resource-icon='${icon}']`),
            ).toBeTruthy()
            fireEvent.click(option)
            expect(onChange).toHaveBeenLastCalledWith([
                [{ ...rule, ...update }],
            ])
            expect(screen.queryByRole("listbox")).toBeNull()
        },
    )

    it("keeps edited numeric values and actual-resource selection in the same rule", () => {
        const onChange = vi.fn()
        const rule: Rule.AverageVeinAmount = {
            type: RuleType.AverageVeinAmount,
            vein: VeinType.Oil,
            condition,
            useActual: true,
        }
        render(localized(<RuleEditor value={[[rule]]} onChange={onChange} />))
        fireEvent.change(screen.getByRole("textbox"), {
            target: { value: "25" },
        })
        expect(onChange).toHaveBeenLastCalledWith([
            [{ ...rule, condition: { ...condition, value: 25 } }],
        ])
        expect(
            screen.getByText("Warning: using actual values is much slower."),
        ).toBeTruthy()
    })
})

const planet: Planet = {
    index: 0,
    orbitAround: null,
    orbitIndex: 1,
    orbitRadius: 1,
    orbitInclination: 0,
    orbitLongitude: 0,
    orbitalPeriod: 100,
    obliquity: 0,
    rotationPeriod: 30,
    sunDistance: 1,
    type: PlanetType.Ocean,
    luminosity: 1,
    theme: {
        id: 1,
        name: "Mediterranean",
        waterItemId: OceanType.Water,
        wind: 1,
    },
    gases: [[GasType.Hydrogen, 0.5]],
    actualVeins: [
        { veinType: VeinType.Iron, amount: 20000 },
        { veinType: VeinType.Oil, amount: 50000 },
    ],
}
const star: Star = {
    index: 0,
    position: [0, 0, 0],
    name: "Test star",
    mass: 1,
    lifetime: 10000,
    age: 0.5,
    temperature: 5000,
    type: StarType.MainSeqStar,
    spectr: SpectrType.G,
    luminosity: 1,
    radius: 1,
    dysonRadius: 40000,
    initialHiveCount: 0,
    maxHiveCount: 1,
    color: 1,
    planets: [planet],
}

describe("resource detail integration", () => {
    it("shows compact icons in star and planet labels without changing resource rates", () => {
        const { container } = render(
            localized(
                <StarView star={star} buildUrl={(index) => `/star/${index}`} />,
            ),
        )
        for (const name of ["iron-ore", "oil", "hydrogen", "water"]) {
            expect(
                container.querySelectorAll(`[data-resource-icon='${name}']`),
            ).toHaveLength(2)
        }
        expect(screen.getAllByText("20,000")).toHaveLength(2)
        expect(screen.getAllByText("2 /s")).toHaveLength(2)
        expect(screen.getAllByText("0.5 /s")).toHaveLength(2)
    })

    it("shows vein and gas icons in the existing galaxy overview rows", () => {
        const { container } = render(
            localized(
                <GalaxyOverview
                    galaxy={{ seed: 123, stars: [star] }}
                    search=""
                />,
            ),
        )
        for (const name of ["iron-ore", "oil", "hydrogen"]) {
            expect(
                container.querySelectorAll(`[data-resource-icon='${name}']`),
            ).toHaveLength(1)
        }
        expect(screen.getByText("Seed: 123")).toBeTruthy()
        expect(screen.getByText("20,000")).toBeTruthy()
        expect(screen.getByTestId("starmap")).toBeTruthy()
    })
})

describe("read-only rules and keyboard controls", () => {
    it.each([
        { name: "no groups", value: [] as SimpleRule[][] },
        { name: "empty group", value: [[]] as SimpleRule[][] },
        { name: "multiple empty groups", value: [[], []] as SimpleRule[][] },
    ])("keeps $name read-only", ({ value }) => {
        const onChange = vi.fn()
        render(
            localized(
                <RuleEditor value={value} onChange={onChange} disabled />,
            ),
        )
        for (const select of screen.getAllByRole("combobox")) {
            expect(select).toBeDisabled()
            fireEvent.keyDown(select, { key: "ArrowDown" })
        }
        expect(screen.queryByRole("listbox")).toBeNull()
        expect(screen.queryByRole("button", { name: "Delete rule" })).toBeNull()
        expect(
            screen.queryByRole("button", { name: "Add AND rule" }),
        ).toBeNull()
        expect(onChange).not.toHaveBeenCalled()
    })

    it("deletes a rule with the keyboard", async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        const rule: SimpleRule = { type: RuleType.Birth }
        render(
            localized(
                <RuleEditor value={[[rule, rule]]} onChange={onChange} />,
            ),
        )
        screen.getAllByRole("button", { name: "Delete rule" })[0]!.focus()
        await user.keyboard("{Enter}")
        expect(onChange).toHaveBeenLastCalledWith([[rule]])
    })

    it("always exposes full star details without a disclosure control", () => {
        render(
            localized(
                <StarView star={star} buildUrl={(index) => `/star/${index}`} />,
            ),
        )
        expect(screen.getByText("Mass")).toBeVisible()
        expect(screen.getByText("Temperature")).toBeVisible()
        expect(
            screen.queryByRole("button", {
                name: /(?:Expand|Collapse) star details/,
            }),
        ).not.toBeInTheDocument()
    })
})
