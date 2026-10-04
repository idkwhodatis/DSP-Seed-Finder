import { StarType } from "../enums"

/** The exact SVG viewBox, in the map's x / -z coordinate space. */
export type GalaxyBounds = readonly [
    x: number,
    y: number,
    width: number,
    height: number,
]

export function getGalaxyBounds(
    stars: readonly Pick<Star, "position">[],
): GalaxyBounds {
    let left = Infinity,
        right = -Infinity,
        top = Infinity,
        bottom = -Infinity
    for (const {
        position: [x, , z],
    } of stars) {
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, -z)
        bottom = Math.max(bottom, -z)
    }
    return Number.isFinite(left)
        ? [left - 2, top - 2, right - left + 4, bottom - top + 4]
        : [-2, -2, 4, 4]
}

/** Expand the camera to match SVG xMidYMid meet, including its letterboxing. */
export function fitGalaxyCamera(
    bounds: GalaxyBounds,
    width: number,
    height: number,
) {
    const [x, y, viewWidth, viewHeight] = bounds
    const pixelsPerUnit = Math.min(
        Math.max(width, 1) / viewWidth,
        Math.max(height, 1) / viewHeight,
    )
    const halfWidth = Math.max(width, 1) / pixelsPerUnit / 2
    const halfHeight = Math.max(height, 1) / pixelsPerUnit / 2
    const centerX = x + viewWidth / 2
    const centerY = -(y + viewHeight / 2)
    return {
        left: centerX - halfWidth,
        right: centerX + halfWidth,
        top: centerY + halfHeight,
        bottom: centerY - halfHeight,
        pixelsPerUnit,
    }
}

type RGB = readonly [number, number, number]
const colors: readonly (readonly [number, string])[] = [
    [0, "#fe243b"],
    [0.05400363728404045, "#fe902f"],
    [0.08210773766040802, "#feb524"],
    [0.09922304004430771, "#fec721"],
    [0.15128976106643677, "#fef71e"],
    [0.23878754675388336, "#fefa00"],
    [0.27973926067352295, "#fefe00"],
    [0.3280837833881378, "#fefe07"],
    [0.42586174607276917, "#fefe98"],
    [0.5108104348182678, "#fefef3"],
    [0.54461669921875, "#fefefe"],
    [0.7830636501312256, "#fefefe"],
    [0.8255955576896667, "#cafefe"],
    [0.8672537803649902, "#43fefe"],
    [0.883392870426178, "#00fefe"],
    [0.9545682668685913, "#01d3fe"],
    [1, "#0072fe"],
]
const toRGB = (color: string): RGB => [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5), 16),
]
const palette = colors.map(([value, hex]) => [value, toRGB(hex)] as const)

/** Shared with the accessible SVG; rendering never changes generator data. */
export function getGalaxyStarColor(star: Pick<Star, "type" | "color">): RGB {
    if (star.type === StarType.BlackHole) return toRGB("#6d40b1")
    if (star.type === StarType.NeutronStar) return toRGB("#b685fe")
    const value = Number.isFinite(star.color)
        ? Math.max(0, Math.min(1, star.color))
        : 0.5
    const index = palette.findLastIndex(([stop]) => stop <= value)
    const [start, color] = palette[index]!
    const next = palette[index + 1]
    if (!next || start === value) return color
    const amount = (value - start) / (next[0] - start)
    return [
        color[0] + amount * (next[1][0] - color[0]),
        color[1] + amount * (next[1][1] - color[1]),
        color[2] + amount * (next[1][2] - color[2]),
    ]
}

/** A separate, deterministic visual-only PRNG. Never used by world generation. */
export function galaxyVisualRandom(seed: number) {
    let state = (seed ^ 0x9e3779b9) >>> 0
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        return state / 0x100000000
    }
}
