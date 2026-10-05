import { StarType } from "../enums"

/** Shader discriminants, intentionally unrelated to the generator's enums/RNG. */
export const STELLAR_KIND = {
    photosphere: 0,
    giant: 1,
    whiteDwarf: 2,
    neutronStar: 3,
    blackHole: 4,
} as const

export interface StellarProfile {
    kind: number
    /** Exact radius used by the accessible SVG, in map units. */
    radius: number
    /** Billboard half-width / disk radius; their product stays within the map margin. */
    extent: number
    /** Surface cell density; cooler giants have visibly larger convection cells. */
    granulation: number
    activity: number
    /** Amount of white light in the photosphere, leaving the spectral fringe colored. */
    whiteness: number
}

/**
 * Compress the generator's physical radius into a readable map disk: one radius
 * unit maps to 0.4, larger stars approach 0.8, and tiny remnants retain a floor.
 * Type and spectral color never override size, so a red giant stays a giant.
 */
export function getStellarDiskRadius(star: Pick<Star, "radius">) {
    const radius =
        Number.isFinite(star.radius) && star.radius > 0 ? star.radius : 1
    return Math.max(0.14, 0.8 * (radius / (1 + radius)))
}

/** Physically ordered, compressed disks with illustrative type-specific effects. */
export function getStellarProfile(
    star: Pick<Star, "type" | "color" | "radius">,
): StellarProfile {
    const temperature = Number.isFinite(star.color)
        ? Math.max(0, Math.min(1, star.color))
        : 0.5
    const radius = getStellarDiskRadius(star)
    // Large disks need less halo padding to remain inside the 2-unit map margin.
    const extent = (preferred: number) => Math.min(preferred, 1.92 / radius)
    switch (star.type) {
        case StarType.GiantStar:
            return {
                kind: STELLAR_KIND.giant,
                radius,
                extent: extent(2.4),
                granulation: 3.0 + temperature * 4.0,
                activity: 0.95 - temperature * 0.3,
                whiteness: 0.2 + temperature * 0.45,
            }
        case StarType.WhiteDwarf:
            return {
                kind: STELLAR_KIND.whiteDwarf,
                radius,
                extent: extent(5.0),
                granulation: 12,
                activity: 0.12,
                whiteness: 0.92,
            }
        case StarType.NeutronStar:
            return {
                kind: STELLAR_KIND.neutronStar,
                radius,
                extent: extent(4.8),
                granulation: 0,
                activity: 0.8,
                whiteness: 0.9,
            }
        case StarType.BlackHole:
            return {
                kind: STELLAR_KIND.blackHole,
                radius,
                extent: extent(4.8),
                granulation: 0,
                activity: 0.7,
                whiteness: 0,
            }
        default:
            return {
                kind: STELLAR_KIND.photosphere,
                radius,
                extent: extent(4.6),
                granulation: 6.0 + temperature * 3.0,
                activity: 0.55,
                whiteness: 0.35 + temperature * 0.4,
            }
    }
}
