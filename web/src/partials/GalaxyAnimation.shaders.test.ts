import { describe, expect, it } from "vitest"
import { stellarFragment, stellarVertex } from "./GalaxyAnimation.shaders"

// These are source-contract regressions, not a substitute for driver compilation.
const source = stellarFragment.replace(/\/\/[^\n]*/g, "")

describe("stellar shader portability contracts", () => {
    it("uses explicit multiplication for all signed Gaussian offsets", () => {
        expect(source).toContain("return exp(-(offset * offset));")
        expect(source).not.toContain("exp(-pow(")
        expect(source.match(/gaussian\(/g)).toHaveLength(8)
        // Ensure no accidentally reintroduced exponent-two pow, including nested args.
        expect(source).not.toMatch(/,\s*2\.0\s*\)/)
    })

    it("guards the zero-vector angle before the only atan call", () => {
        expect(source).toMatch(
            /if \(dot\(p, p\) < 0\.00000001\) return 0\.0;\s*return atan\(p.y, p.x\);/,
        )
        expect(source.match(/atan\(/g)).toHaveLength(1)
        expect(source).toContain("float angle = safeAngle(p);")
        expect(source).toContain(
            "float swirlAngle = safeAngle(vec2(q.x, q.y * 3.1));",
        )
    })

    it("does not use hardware point limits or shadow the GLSL texture function", () => {
        expect(stellarVertex).not.toContain("gl_PointSize")
        expect(stellarVertex).toContain("position.xy * profile.x * profile.y")
        expect(source).not.toMatch(/float\s+texture\b/)
        expect(source).toContain("float surfaceTexture")
    })
})
