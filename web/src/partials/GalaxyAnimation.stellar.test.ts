import { readFileSync } from "node:fs"
import { generate, initSync } from "../../../pkg/dsp_seed_finder"
import { beforeAll, describe, expect, it } from "vitest"
import { StarType } from "../enums"
import {
    getStellarDiskRadius,
    getStellarProfile,
    STELLAR_KIND,
} from "./GalaxyAnimation.stellar"

beforeAll(() =>
    initSync({ module: readFileSync("pkg/dsp_seed_finder_bg.wasm") }),
)

const types = Object.values(StarType)

const representativeStars = [
    { type: StarType.MainSeqStar, radius: 1, kind: STELLAR_KIND.photosphere },
    { type: StarType.GiantStar, radius: 16, kind: STELLAR_KIND.giant },
    { type: StarType.WhiteDwarf, radius: 0.25, kind: STELLAR_KIND.whiteDwarf },
    { type: StarType.NeutronStar, radius: 0.4, kind: STELLAR_KIND.neutronStar },
    { type: StarType.BlackHole, radius: 4, kind: STELLAR_KIND.blackHole },
]

describe("stellar impostor profiles", () => {
    it.each(representativeStars)(
        "keeps $type aligned with its SVG disk and gives it its own shader path",
        ({ type, radius, kind }) => {
            const star = { type, radius, color: 0.5 }
            expect(getStellarProfile(star)).toMatchObject({
                radius: getStellarDiskRadius(star),
                kind,
            })
        },
    )

    it("shrinks neutron stars and small red main-sequence stars using their actual radii", () => {
        const solar = getStellarProfile({
            type: StarType.MainSeqStar,
            color: 0.5,
            radius: 1,
        })
        const red = getStellarProfile({
            type: StarType.MainSeqStar,
            color: 0,
            radius: 0.55,
        })
        const neutron = getStellarProfile({
            type: StarType.NeutronStar,
            color: 0.5,
            radius: 0.4,
        })
        expect(solar.radius).toBe(0.4)
        expect(red.radius).toBeLessThan(solar.radius * 0.75)
        expect(neutron.radius).toBeLessThan(red.radius)
    })

    it("compresses physical radius differences while preserving their ordering", () => {
        const radii = [0.25, 0.4, 0.55, 1, 3, 8, 16, 24]
        const disks = radii.map((radius) => getStellarDiskRadius({ radius }))
        for (let index = 1; index < radii.length; index++) {
            expect(disks[index]).toBeGreaterThan(disks[index - 1]!)
            expect(disks[index]! / disks[index - 1]!).toBeLessThan(
                radii[index]! / radii[index - 1]!,
            )
        }
        expect(getStellarDiskRadius({ radius: 1e-12 })).toBe(0.14)
        expect(getStellarDiskRadius({ radius: Number.MAX_VALUE })).toBe(0.8)
    })

    it("uses a color-independent giant boost while leaving every other class unchanged", () => {
        for (const radius of [0.4, 1, 8, 16]) {
            for (const type of types) {
                const expected =
                    type === StarType.GiantStar
                        ? 0.85 + (0.35 * radius) / (4 + radius)
                        : getStellarDiskRadius({ radius })
                for (const color of [0, 0.5, 1]) {
                    expect(
                        getStellarProfile({ type, color, radius }).radius,
                    ).toBe(expected)
                }
            }
        }
        const redGiant = getStellarProfile({
            type: StarType.GiantStar,
            color: 0,
            radius: 16,
        })
        const blueGiant = getStellarProfile({
            type: StarType.GiantStar,
            color: 1,
            radius: 8,
        })
        expect(redGiant.radius).toBeGreaterThan(blueGiant.radius)
        expect(redGiant.radius).toBeGreaterThan(0.7)
    })

    it.each([
        { seed: 3, index: 14, spectr: "B" },
        { seed: 150, index: 47, spectr: "A" },
        { seed: 0, index: 14, spectr: "M" },
        { seed: 54, index: 43, spectr: "F" },
        { seed: 822, index: 9, spectr: "A" },
    ])(
        "makes real seed $seed $spectr giants clearly larger than O main-sequence stars",
        ({ seed, index, spectr }) => {
            const galaxy = generate(seed, {
                starCount: 64,
                resourceMultiplier: 1,
                hiveInitialColonize: 1,
                hiveMaxDensity: 1,
                useActualVeins: false,
            }) as Galaxy
            const giant = galaxy.stars[index]!
            const hotMain = galaxy.stars[59]!
            expect(giant.type).toBe(StarType.GiantStar)
            expect(giant.spectr).toBe(spectr)
            expect(hotMain.type).toBe(StarType.MainSeqStar)
            expect(hotMain.spectr).toBe("O")
            const giantDisk = getStellarDiskRadius(giant)
            const mainDisk = getStellarDiskRadius(hotMain)
            expect(giantDisk).toBeGreaterThan(mainDisk * 1.5)
            expect(giantDisk).toBeLessThanOrEqual(1.2)
            expect(mainDisk).toBe(
                getStellarDiskRadius({ radius: hotMain.radius }),
            )
            expect(getStellarProfile(giant).radius).toBe(giantDisk)
        },
    )

    it("keeps giant radii smooth, ordered, and bounded without enlarging other stars", () => {
        let previous = 0
        for (const radius of [
            0.1,
            0.5,
            1,
            3,
            6,
            12,
            30,
            1000,
            Number.MAX_VALUE,
        ]) {
            const disk = getStellarDiskRadius({
                type: StarType.GiantStar,
                radius,
            })
            expect(disk).toBeGreaterThan(previous)
            expect(disk).toBeLessThanOrEqual(1.2)
            previous = disk
        }
    })

    it("keeps every effect inside the existing 2-unit framing margin at every size", () => {
        for (const type of types) {
            for (const physicalRadius of [
                1e-12,
                0.25,
                0.4,
                1,
                5,
                16,
                30,
                Number.MAX_VALUE,
            ]) {
                const { radius, extent } = getStellarProfile({
                    type,
                    color: 0.5,
                    radius: physicalRadius,
                })
                expect(radius * extent).toBeLessThanOrEqual(1.92 + 1e-8)
                expect(extent).toBeGreaterThan(1)
            }
        }
    })

    it("distinguishes coarse red-giant convection from hotter, finer blue-giant convection", () => {
        const red = getStellarProfile({
            type: StarType.GiantStar,
            color: 0,
            radius: 16,
        })
        const blue = getStellarProfile({
            type: StarType.GiantStar,
            color: 1,
            radius: 16,
        })
        const solar = getStellarProfile({
            type: StarType.MainSeqStar,
            color: 0.5,
            radius: 1,
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
            radius: 0.25,
        })
        const main = getStellarProfile({
            type: StarType.MainSeqStar,
            color: 0.5,
            radius: 1,
        })
        expect(dwarf.radius).toBeLessThan(main.radius)
        expect(dwarf.whiteness).toBeGreaterThan(main.whiteness)
        expect(dwarf.activity).toBeLessThan(main.activity)
    })

    it.each([-10, 10, NaN, Infinity, -Infinity])(
        "bounds visual inputs for invalid spectral color %s",
        (color) => {
            for (const type of types) {
                const profile = getStellarProfile({ type, color, radius: 1 })
                expect(Object.values(profile).every(Number.isFinite)).toBe(true)
                expect(profile.whiteness).toBeGreaterThanOrEqual(0)
                expect(profile.whiteness).toBeLessThanOrEqual(1)
                expect(profile.activity).toBeGreaterThanOrEqual(0)
                expect(profile.activity).toBeLessThanOrEqual(1)
            }
        },
    )

    it.each([0, -1, NaN, Infinity, -Infinity, undefined])(
        "uses a safe default for malformed physical radius %s without mutating input",
        (radius) => {
            for (const type of types) {
                const star = Object.freeze({ type, color: 0.5, radius }) as Star
                const profile = getStellarProfile(star)
                expect(Object.values(profile).every(Number.isFinite)).toBe(true)
                expect(profile.radius).toBeCloseTo(
                    type === StarType.GiantStar ? 0.92 : 0.4,
                )
                expect(star.radius).toBe(radius)
                expect(getStellarProfile(star)).toEqual(profile)
            }
        },
    )
})
