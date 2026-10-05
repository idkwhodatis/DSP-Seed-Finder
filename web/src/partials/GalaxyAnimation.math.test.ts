import { describe, expect, it } from "vitest"
import { Vector3, OrthographicCamera } from "three"
import { StarType } from "../enums"
import {
    fitGalaxyCamera,
    galaxyVisualRandom,
    getGalaxyBounds,
    getGalaxyStarColor,
} from "./GalaxyAnimation.math"

describe("galaxy projection", () => {
    it("uses exactly two units of padding and safely frames empty/invalid input", () => {
        expect(getGalaxyBounds([])).toEqual([-2, -2, 4, 4])
        expect(getGalaxyBounds([{ position: [NaN, 0, 0] }])).toEqual([
            -2, -2, 4, 4,
        ])
        expect(
            getGalaxyBounds([
                { position: [-30, 2, -2] },
                { position: [30, -1, 2] },
            ]),
        ).toEqual([-32, -4, 64, 8])
    })

    it.each([
        [800, 600],
        [360, 640],
        [1200, 200],
        [320, 320],
    ])(
        "aligns Three and SVG pixels at %i × %i including letterboxing",
        (width, height) => {
            const points: Position[] = [
                [-23, 1, -11],
                [16, -2, 9],
                [7, 0, -2],
            ]
            const bounds = getGalaxyBounds(
                points.map((position) => ({ position })),
            )
            const fit = fitGalaxyCamera(bounds, width, height)
            const camera = new OrthographicCamera(
                fit.left,
                fit.right,
                fit.top,
                fit.bottom,
                0.1,
                100,
            )
            camera.position.z = 10
            camera.updateMatrixWorld()
            const scale = Math.min(width / bounds[2], height / bounds[3])
            for (const [x, , z] of points) {
                const projected = new Vector3(x, z, 0).project(camera)
                const svgX =
                    (width - bounds[2] * scale) / 2 + (x - bounds[0]) * scale
                const svgY =
                    (height - bounds[3] * scale) / 2 + (-z - bounds[1]) * scale
                expect(((projected.x + 1) * width) / 2).toBeCloseTo(svgX, 9)
                expect(((1 - projected.y) * height) / 2).toBeCloseTo(svgY, 9)
            }
        },
    )

    it.each([1, 1.25, 1.5, 2, 3])(
        "keeps centers identical under DPR/zoom %s and repeated resizes",
        (dpr) => {
            const point: Position = [-17.25, 12, 8.75]
            const bounds = getGalaxyBounds([
                { position: point },
                { position: [21.1, -5, -15.2] },
            ])
            for (const [width, height] of [
                [1180, 757],
                [400, 620],
                [767.5, 345.25],
                [1180, 757],
            ]) {
                const fit = fitGalaxyCamera(bounds, width!, height!)
                const camera = new OrthographicCamera(
                    fit.left,
                    fit.right,
                    fit.top,
                    fit.bottom,
                    0.1,
                    100,
                )
                camera.position.z = 10
                camera.updateMatrixWorld()
                const v = new Vector3(point[0], point[2], 0).project(camera)
                const cssX = ((1 + v.x) * width!) / 2
                const cssY = ((1 - v.y) * height!) / 2
                const svgX =
                    (width! - bounds[2] * fit.pixelsPerUnit) / 2 +
                    (point[0] - bounds[0]) * fit.pixelsPerUnit
                const svgY =
                    (height! - bounds[3] * fit.pixelsPerUnit) / 2 +
                    (-point[2] - bounds[1]) * fit.pixelsPerUnit
                expect((cssX * dpr) / dpr).toBeCloseTo(svgX, 8)
                expect((cssY * dpr) / dpr).toBeCloseTo(svgY, 8)
            }
        },
    )

    it("keeps zero-size measurements finite", () => {
        expect(
            Object.values(fitGalaxyCamera([-2, -2, 4, 4], 0, 0)).every(
                Number.isFinite,
            ),
        ).toBe(true)
    })
})

describe("visual-only star properties", () => {
    it("retains the exact SVG color endpoints and special star colors", () => {
        expect(
            getGalaxyStarColor({ type: StarType.MainSeqStar, color: 0 }),
        ).toEqual([254, 36, 59])
        expect(
            getGalaxyStarColor({ type: StarType.MainSeqStar, color: 1 }),
        ).toEqual([0, 114, 254])
        expect(
            getGalaxyStarColor({ type: StarType.NeutronStar, color: 0 }),
        ).toEqual([182, 133, 254])
        expect(
            getGalaxyStarColor({ type: StarType.BlackHole, color: 0 }),
        ).toEqual([109, 64, 177])
    })

    it("uses deterministic, bounded visual randomness independent of global random", () => {
        const a = galaxyVisualRandom(42),
            b = galaxyVisualRandom(42),
            c = galaxyVisualRandom(43)
        const values = Array.from({ length: 180 }, () => a())
        expect(Array.from({ length: 180 }, () => b())).toEqual(values)
        expect(Array.from({ length: 180 }, () => c())).not.toEqual(values)
        expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
    })
})
