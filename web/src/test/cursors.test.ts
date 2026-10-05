import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const filename = path.join(directory, entry.name)
        if (entry.isDirectory()) return sourceFiles(filename)
        return /\.(?:css|html|tsx?)$/.test(filename) &&
            !/\.test\.tsx?$/.test(filename)
            ? [filename]
            : []
    })
}

describe("default interaction cursors", () => {
    it("does not reintroduce hand cursors in application styles or components", () => {
        const handCursors = sourceFiles("web").filter((filename) => {
            const source = readFileSync(filename, "utf8")
            return /cursor\s*:\s*["']?pointer\b|cursor-pointer\b|\.cursor\s*=\s*["']pointer\b/.test(
                source,
            )
        })
        expect(handCursors).toEqual([])
    })

    it("uses a default cursor for native links and buttons without a universal override", () => {
        const css = readFileSync("web/src/index.css", "utf8")
        expect(css).toMatch(
            /a\[href\],\s*area\[href\],\s*summary,\s*button:not\(:disabled\),\s*\[role="button"\]:not\(:disabled\)\s*\{\s*cursor: default;/,
        )
        expect(css).not.toMatch(/\*\s*\{[^}]*cursor:/)
        expect(css).not.toMatch(/cursor:[^;]*!important/)
    })

    it("preserves contextual help and disabled-control cursors", () => {
        expect(
            readFileSync("web/src/components/Tooltip.module.css", "utf8"),
        ).toContain("cursor: help;")
        for (const component of ["Button", "Input", "NumberInput", "Select"]) {
            expect(
                readFileSync(
                    `web/src/components/${component}.module.css`,
                    "utf8",
                ),
            ).toContain("cursor: not-allowed;")
        }
    })
})
