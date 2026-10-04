import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { generate, initSync } from "../../../pkg/dsp_seed_finder"
import { StarType } from "../enums"
import {
    generateChineseStarName,
    generateChineseStarNames,
    getGalaxyDisplayNames,
    reconstructEnglishStarNames,
    type NameGalaxy,
} from "./starNames"
import {
    constellationEn,
    constellationZh,
    giantEn,
    giantZh,
    rawEn,
    rawZh,
} from "./starNames.data"
import fixtures from "./starNames.fixtures.json"

const game = {
    resourceMultiplier: 1,
    hiveInitialColonize: 1,
    hiveMaxDensity: 1,
    useActualVeins: false,
}

function galaxy(seed: number, starCount = 64): Galaxy {
    return generate(seed, { ...game, starCount }) as Galaxy
}

beforeAll(() => {
    initSync({
        module: readFileSync("pkg/dsp_seed_finder_bg.wasm"),
    })
})

describe("source-backed Chinese names", () => {
    it("retains complete, ordered source pools, including untranslated entries and duplicates", () => {
        expect([
            rawEn.length,
            rawZh.length,
            giantEn.length,
            giantZh.length,
            constellationEn.length,
            constellationZh.length,
        ]).toEqual([425, 548, 60, 60, 88, 88])
        expect(rawZh[0]).toBe("Kat")
        expect(rawZh[18]).toBe("三角座α")
        expect(rawZh[21]).toBe("三角座α")
        expect(rawZh[31]).toBe("三角座α")
        expect(giantZh[58]).toBe("WOH G64")
        const rust = readFileSync("src/worldgen/name_gen.rs", "utf8")
        for (const [constant, expected] of [
            ["RAW_STAR_NAMES", rawEn],
            ["RAW_GIANT_NAMES", giantEn],
            ["CONSTELLATIONS", constellationEn],
        ] as const) {
            const body = rust.match(
                new RegExp(
                    `const ${constant}:[\\s\\S]*?= &\\[([\\s\\S]*?)\\];`,
                ),
            )![1]!
            expect(
                [...body.matchAll(/"([^"]*)"/g)].map((match) => match[1]),
            ).toEqual(expected)
        }
    })

    it.each(fixtures.nameSeeds)(
        "matches independent source fixture $type seed $nameSeed ($branch)",
        ({ nameSeed, type, name }) => {
            expect(generateChineseStarName(nameSeed, type as StarType)).toBe(
                name,
            )
        },
    )

    it("retries against the entire Chinese-name set without mutating it", () => {
        const used = new Set(["太阿"])
        expect(generateChineseStarName(0, StarType.MainSeqStar, used)).toBe(
            "内屏三",
        )
        expect([...used]).toEqual(["太阿"])
        used.add("内屏三")
        const next = generateChineseStarName(0, StarType.MainSeqStar, used)
        expect(used.has(next)).toBe(false)
    })

    it("stops after the game's 256 attempts", () => {
        const used = new Set<string>()
        const has = vi.spyOn(used, "has").mockReturnValue(true)
        expect(generateChineseStarName(0, StarType.MainSeqStar, used)).toBe(
            "XStar",
        )
        expect(has).toHaveBeenCalledTimes(256)
    })

    it("reconstructs canonical English labels from the real Rust/WASM engine over diverse seeds and counts", () => {
        const seeds = [
            0, 1, 2, 3, 42, 65535, 1000000, 12345678, 76543210, 99999999,
        ]
        for (const seed of seeds) {
            for (const starCount of [32, 40, 48, 56, 64]) {
                const data = galaxy(seed, starCount)
                const names = reconstructEnglishStarNames(data)
                expect(
                    [...names.values()],
                    `seed ${seed}, stars ${starCount}`,
                ).toEqual(data.stars.map((star) => star.name))
                const chinese = generateChineseStarNames(data)
                expect(new Set(chinese.values()).size).toBe(starCount)
                expect(
                    [...chinese.values()].some((name) =>
                        /[\u3400-\u9fff]/.test(name),
                    ),
                ).toBe(true)
            }
        }
    })

    it("matches galaxy fixtures including Chinese-only collision retries", () => {
        const cache = new Map<
            number,
            { data: Galaxy; names: ReadonlyMap<number, string> }
        >()
        for (const fixture of fixtures.galaxies) {
            if (!cache.has(fixture.seed)) {
                const data = galaxy(fixture.seed, fixture.starCount)
                cache.set(fixture.seed, {
                    data,
                    names: generateChineseStarNames(data),
                })
            }
            const { data, names } = cache.get(fixture.seed)!
            expect(data.stars[fixture.index]!.name).toBe(fixture.english)
            expect(
                names.get(fixture.index),
                `seed ${fixture.seed}, index ${fixture.index}`,
            ).toBe(fixture.name)
        }
        expect(fixtures.galaxies.some((entry) => entry.attempt >= 2)).toBe(true)
    })

    it("does not translate the same English label to one fixed Chinese name", () => {
        const first = galaxy(12345678)
        const second = galaxy(99999999)
        expect(first.stars[0]!.name).toBe("AngelStern")
        expect(second.stars[0]!.name).toBe("AngelStern")
        expect(getGalaxyDisplayNames(first, "zh-CN").get(0)).toBe("天床三")
        expect(getGalaxyDisplayNames(second, "zh-CN").get(0)).toBe("天市左垣九")
    })

    it("uses original star index order even after presentation sorting", () => {
        const data = galaxy(42)
        const sorted = { ...data, stars: [...data.stars].reverse() }
        expect([...getGalaxyDisplayNames(sorted, "zh-CN")]).toEqual([
            ...getGalaxyDisplayNames(data, "zh-CN"),
        ])
    })

    it("leaves canonical galaxy objects unchanged through repeated locale switching", () => {
        const data = galaxy(1)
        const original = JSON.stringify(data)
        const stars = data.stars
        const star = data.stars[0]
        for (const locale of ["en", "zh-CN", "en", "zh-CN"])
            getGalaxyDisplayNames(data, locale)
        expect(JSON.stringify(data)).toBe(original)
        expect(data.stars).toBe(stars)
        expect(data.stars[0]).toBe(star)
        expect([...getGalaxyDisplayNames(data, "en").values()]).toEqual(
            data.stars.map((value) => value.name),
        )
    })

    it("falls back to original labels for custom/unsupported/incomplete legacy input", () => {
        const original = galaxy(0)
        const cases: NameGalaxy[] = [
            { ...original, seed: NaN },
            { ...original, seed: 100000000 },
            { ...original, seed: undefined as unknown as number },
            { ...original, stars: original.stars.slice(1) },
            {
                ...original,
                stars: original.stars.map((star, index) =>
                    index === 3 ? { ...star, name: "My custom star" } : star,
                ),
            },
            {
                ...original,
                stars: original.stars.map((star, index) =>
                    index === 3
                        ? { ...star, type: undefined as unknown as StarType }
                        : star,
                ),
            },
        ]
        for (const data of cases) {
            expect([...getGalaxyDisplayNames(data, "zh-CN")]).toEqual(
                data.stars.map((star) => [star.index, star.name]),
            )
        }
        expect([...getGalaxyDisplayNames(original, "zh-TW").values()]).toEqual(
            original.stars.map((star) => star.name),
        )
        expect([
            ...getGalaxyDisplayNames({ seed: 0, stars: [] }, "zh-CN"),
        ]).toEqual([])
    })
})
