import { describe, expect, it } from "vitest"
import { StarType } from "../enums"
import {
    getStellarDiskRadius,
    getStellarProfile,
    STELLAR_KIND,
} from "./GalaxyAnimation.stellar"

const types = Object.values(StarType)

describe("stellar impostor profiles", () => {
    it.each([
        [StarType.MainSeqStar, 0.4, STELLAR_KIND.photosphere],
        [StarType.GiantStar, 0.8, STELLAR_KIND.giant],
        [StarType.WhiteDwarf, 0.2, STELLAR_KIND.whiteDwarf],
        [StarType.NeutronStar, 0.4, STELLAR_KIND.neutronStar],
        [StarType.BlackHole, 0.4, STELLAR_KIND.blackHole],
    ])(
        "keeps %s aligned with its SVG disk and gives it its own shader path",
        (type, radius, kind) => {
            const star = { type, color: 0.5 }
            expect(getStellarDiskRadius(star)).toBe(radius)
            expect(getStellarProfile(star)).toMatchObject({ radius, kind })
        },
    )

    it("keeps every effect inside the existing 2-unit framing margin", () => {
        for (const type of types) {
            const { radius, extent } = getStellarProfile({ type, color: 0.5 })
            expect(radius * extent).toBeLessThanOrEqual(1.92 + 1e-8)
            expect(extent).toBeGreaterThan(1)
        }
    })

    it("distinguishes coarse red-giant convection from hotter, finer blue-giant convection", () => {
        const red = getStellarProfile({ type: StarType.GiantStar, color: 0 })
        const blue = getStellarProfile({ type: StarType.GiantStar, color: 1 })
        const solar = getStellarProfile({
            type: StarType.MainSeqStar,
            color: 0.5,
        })
        expect(red.granulation).toBeLessThan(blue.granulation)
        expect(red.granulation).toBeLessThan(solar.granulation / 2)
        expect(red.activity).toBeGreaterThan(blue.activity)
        expect(red.whiteness).toBeLessThan(blue.whiteness)
        expect(red.radius).toBe(blue.radius)
    })

    it("keeps white dwarfs compact, quiet and substantially whiter than ordinary stars", () => {
        const dwarf = getStellarProfile({
            type: StarType.WhiteDwarf,
            color: 0.5,
        })
        const main = getStellarProfile({
            type: StarType.MainSeqStar,
            color: 0.5,
        })
        expect(dwarf.radius).toBeLessThan(main.radius)
        expect(dwarf.whiteness).toBeGreaterThan(main.whiteness)
        expect(dwarf.activity).toBeLessThan(main.activity)
    })

    it.each([-10, 10, NaN, Infinity, -Infinity])(
        "bounds visual inputs for invalid spectral color %s",
        (color) => {
            for (const type of types) {
                const profile = getStellarProfile({ type, color })
                expect(Object.values(profile).every(Number.isFinite)).toBe(true)
                expect(profile.whiteness).toBeGreaterThanOrEqual(0)
                expect(profile.whiteness).toBeLessThanOrEqual(1)
                expect(profile.activity).toBeGreaterThanOrEqual(0)
                expect(profile.activity).toBeLessThanOrEqual(1)
            }
        },
    )
})
