// Locale-specific name generation, isolated from the canonical Rust galaxy data.
// Adapted from DSPSeedCalc (MIT, copyright (c) 2022 Soar Qin).
// Algorithm, source commit, limitations, and license: docs/star-names-provenance.md.
import { StarType } from "../enums"
import {
    constellationEn,
    constellationZh,
    giantEn,
    giantZh,
    rawEn,
    rawZh,
} from "./starNames.data"

export interface NameStar {
    readonly index: number
    readonly name: string
    readonly type: StarType
}

export interface NameGalaxy {
    readonly seed: number
    readonly stars: readonly NameStar[]
}

const MAX_INT = 2147483647
const letters = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ"]
const words = [
    "Alpha",
    "Beta",
    "Gamma",
    "Delta",
    "Epsilon",
    "Zeta",
    "Eta",
    "Theta",
    "Iota",
    "Kappa",
    "Lambda",
]
const starTypes = new Set<string>(Object.values(StarType))

/** The game's legacy DotNet35Random, including double-based Next() conversion. */
class NameRandom {
    private values = new Int32Array(56)
    private nextIndex = 0
    private nextPair = 31

    constructor(seed: number) {
        let previous =
            161803398 - (seed === -2147483648 ? MAX_INT : Math.abs(seed))
        this.values[55] = previous
        let current = 1
        for (let i = 1; i < 55; i++) {
            const index = (21 * i) % 55
            this.values[index] = current
            current = (previous - current) | 0
            if (current < 0) current += MAX_INT
            previous = this.values[index]!
        }
        for (let pass = 0; pass < 4; pass++) {
            for (let i = 1; i < 56; i++) {
                let value =
                    (this.values[i]! - this.values[1 + ((i + 30) % 55)]!) | 0
                if (value < 0) value += MAX_INT
                this.values[i] = value
            }
        }
    }

    sample(): number {
        if (++this.nextIndex >= 56) this.nextIndex = 1
        if (++this.nextPair >= 56) this.nextPair = 1
        let value = this.values[this.nextIndex]! - this.values[this.nextPair]!
        if (value < 0) value += MAX_INT
        this.values[this.nextIndex] = value
        return value * (1 / MAX_INT)
    }

    next(max = MAX_INT): number {
        return Math.trunc(this.sample() * max)
    }
}

const pad = (value: number, length: number) =>
    String(value).padStart(length, "0")

function candidate(seed: number, type: StarType, chinese: boolean): string {
    const select = new NameRandom(seed)
    const nameSeed = select.next()
    const ordinaryChoice = select.sample()
    const giantChoice = select.sample()
    const random = new NameRandom(nameSeed)

    if (type === StarType.NeutronStar || type === StarType.BlackHole) {
        const format = random.next() % 2
        const hours = random.next(24)
        const minutes = random.next(60)
        const seconds = random.next(60)
        const prefix = type === StarType.NeutronStar ? "NTR" : "DSR"
        return `${prefix} J${pad(hours, 2)}${pad(minutes, 2)}${format === 0 ? "+" : "-"}${pad(seconds, 2)}`
    }

    if (type === StarType.GiantStar) {
        if (giantChoice < (chinese ? 0.40000000596046448 : 0.4)) {
            const names = chinese ? giantZh : giantEn
            return names[random.next() % names.length]!
        }
        if (giantChoice < (chinese ? 0.699999988079071 : 0.7)) {
            const index = random.next() % 88
            const first = 65 + 15 + random.next(11)
            const second = 65 + random.next(26)
            // Preserve the existing Rust's English char-addition behavior only
            // for compatibility checking. Chinese uses two literal letters.
            return chinese
                ? `${constellationZh[index]}${String.fromCharCode(first, second)}`
                : `${first + second} ${constellationEn[index]}`
        }
        const format = random.next() % 7
        const first = pad(random.next(10000), 4)
        const second = pad(random.next(100), 2)
        return [
            `HD ${first}${second}`,
            `HDE ${first}${second}`,
            `HR ${first}`,
            `HV ${first}`,
            `LBV ${first}-${second}`,
            `NSV ${first}`,
            `YSC ${first}-${second}`,
        ][format]!
    }

    if (ordinaryChoice < (chinese ? 0.60000002384185791 : 0.6)) {
        const names = chinese ? rawZh : rawEn
        return names[random.next() % names.length]!
    }
    const englishIndex = random.next() % 88
    if (ordinaryChoice < (chinese ? 0.93000000715255737 : 0.93)) {
        const letterIndex = random.next() % 11
        if (chinese) {
            // Deliberately consume a third sample: this is not translation.
            return `${constellationZh[random.next() % 88]}${letters[letterIndex]}`
        }
        const constellation = constellationEn[englishIndex]!
        return `${constellation.length > 10 ? letters[letterIndex] : words[letterIndex]} ${constellation}`
    }
    const number = 27 + random.next(48)
    return chinese
        ? `${constellationZh[random.next() % 88]} ${number}`
        : `${number} ${constellationEn[englishIndex]}`
}

/** Generate an LCID 2052 name from Star.name_seed and already assigned Chinese names. */
export function generateChineseStarName(
    nameSeed: number,
    type: StarType,
    usedNames: ReadonlySet<string> = new Set(),
): string {
    const random = new NameRandom(nameSeed)
    for (let attempt = 0; attempt < 256; attempt++) {
        const name = candidate(random.next(), type, true)
        if (!usedNames.has(name)) return name
    }
    return "XStar"
}

function canonicalNames(galaxy: NameGalaxy): Map<number, string> {
    return new Map(galaxy.stars.map((star) => [star.index, star.name]))
}

function orderedStars(galaxy: NameGalaxy): NameStar[] | undefined {
    if (
        !Number.isInteger(galaxy.seed) ||
        galaxy.seed < 0 ||
        galaxy.seed > 99999999 ||
        galaxy.stars.length < 1 ||
        galaxy.stars.length > 256
    )
        return undefined
    const stars = [...galaxy.stars].sort((a, b) => a.index - b.index)
    if (
        stars.some(
            (star, index) =>
                star.index !== index ||
                typeof star.name !== "string" ||
                !starTypes.has(star.type),
        )
    )
        return undefined
    return stars
}

function nameSeeds(galaxySeed: number, count: number): number[] {
    const random = new NameRandom(galaxySeed)
    // The pose generator has its own random stream. The outer stream consumes
    // exactly one pose seed and four stellar type-quota samples before the stars.
    for (let i = 0; i < 5; i++) random.sample()
    return Array.from({ length: count }, () =>
        new NameRandom(random.next()).next(),
    )
}

/** Reproduce canonical Rust labels as a compatibility signature, not UI translation. */
export function reconstructEnglishStarNames(
    galaxy: NameGalaxy,
): ReadonlyMap<number, string> {
    const stars = orderedStars(galaxy)
    if (!stars) return canonicalNames(galaxy)
    const seeds = nameSeeds(galaxy.seed, stars.length)
    const previous: string[] = []
    const result = new Map<number, string>()
    for (const star of stars) {
        const random = new NameRandom(seeds[star.index]!)
        let name = "XStar"
        // Existing name_gen.rs carries its Iterator across attempts. Preserve
        // this historical quirk here so validation never changes canonical data.
        let checked = 0
        for (let attempt = 0; attempt < 256; attempt++) {
            const next = candidate(random.next(), star.type, false)
            let collision = false
            while (checked < previous.length) {
                if (previous[checked++] === next) {
                    collision = true
                    break
                }
            }
            if (!collision) {
                name = next
                break
            }
        }
        previous.push(name)
        result.set(star.index, name)
    }
    return result
}

/** Regenerate Chinese names in galaxy order. Unknown generator signatures fall back safely. */
export function generateChineseStarNames(
    galaxy: NameGalaxy,
): ReadonlyMap<number, string> {
    const stars = orderedStars(galaxy)
    if (!stars) return canonicalNames(galaxy)
    const english = reconstructEnglishStarNames(galaxy)
    if (stars.some((star) => english.get(star.index) !== star.name)) {
        return canonicalNames(galaxy)
    }
    const seeds = nameSeeds(galaxy.seed, stars.length)
    const used = new Set<string>()
    const result = new Map<number, string>()
    for (const star of stars) {
        const name = generateChineseStarName(
            seeds[star.index]!,
            star.type,
            used,
        )
        used.add(name)
        result.set(star.index, name)
    }
    return result
}

/** Call once per full galaxy/locale, then look up labels by immutable star index. */
export function getGalaxyDisplayNames(
    galaxy: NameGalaxy,
    locale: string,
): ReadonlyMap<number, string> {
    return locale === "zh-CN"
        ? generateChineseStarNames(galaxy)
        : canonicalNames(galaxy)
}
