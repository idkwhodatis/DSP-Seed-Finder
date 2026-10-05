import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { SpectrType, StarType } from "../enums"
import StarTypeIcon, { starIconAttributionHref } from "./StarTypeIcon"
import atlas from "./StarTypeIcon.atlas.json"

afterEach(cleanup)

const star = (type: StarType, spectr = SpectrType.G) => ({ type, spectr })

function iconIn(container: HTMLElement) {
    return container.querySelector<HTMLElement>("[data-star-icon]")!
}

describe("compact licensed star icons", () => {
    it("uses an 18px decorative footprint beside the existing text label", () => {
        const { container } = render(
            <span>
                <StarTypeIcon star={star(StarType.MainSeqStar)} />G type Star
            </span>,
        )
        const icon = iconIn(container)
        expect(icon).toHaveAttribute("aria-hidden", "true")
        expect(icon).not.toHaveAttribute("aria-label")
        expect(icon).not.toHaveAttribute("role")
        expect(icon.style.width).toBe("18px")
        expect(icon.style.height).toBe("18px")
        expect(icon.style.flexBasis).toBe("18px")
        expect(screen.queryByRole("img")).not.toBeInTheDocument()
        expect(screen.getByText("G type Star")).toBeInTheDocument()
    })

    it("supports a translated accessible label when used without adjacent text", () => {
        render(
            <StarTypeIcon
                star={star(StarType.BlackHole, SpectrType.X)}
                label="黑洞"
                size={24}
                className="custom-icon"
            />,
        )
        const icon = screen.getByRole("img", { name: "黑洞" })
        expect(icon).not.toHaveAttribute("aria-hidden")
        expect(icon).toHaveClass("custom-icon")
        expect(icon.style.width).toBe("24px")
        expect(icon.style.height).toBe("24px")
    })

    it.each(Object.values(SpectrType))(
        "renders the %s spectrum, with distinct color treatments for normal spectra",
        (spectr) => {
            const { container } = render(
                <StarTypeIcon star={star(StarType.MainSeqStar, spectr)} />,
            )
            const icon = iconIn(container)
            expect(icon).toHaveAttribute("data-star-spectr", spectr)
            expect(icon).toHaveAttribute("data-star-type", StarType.MainSeqStar)
            expect(icon.firstElementChild).toHaveStyle({
                backgroundImage: `url("${import.meta.env.BASE_URL}icons/stars/hjm-sun-types.68c53d45d1896366.png")`,
            })
        },
    )

    it("keeps all seven main-sequence spectral treatments distinct", () => {
        const appearances = Object.values(SpectrType)
            .filter((spectr) => spectr !== SpectrType.X)
            .map((spectr) => {
                const { container } = render(
                    <StarTypeIcon star={star(StarType.MainSeqStar, spectr)} />,
                )
                const icon = iconIn(container)
                return `${icon.dataset.starIcon}:${(icon.firstElementChild as HTMLElement).style.filter}`
            })
        expect(new Set(appearances).size).toBe(7)
    })

    it("outlines pale sprites in light theme without changing their type colors", () => {
        const css = readFileSync(
            "web/src/components/StarTypeIcon.module.css",
            "utf8",
        )
        // Keep contrast on the wrapper so each sprite retains its own color filter.
        expect(css).toMatch(
            /\.icon\s*\{[^}]*filter:\s*drop-shadow\(0 0 0\.75px rgb\(15 23 42 \/ 75%\)\)/,
        )
        expect(css).toMatch(/:global\(\.dark\) \.icon\s*\{\s*filter: none;/)

        const paleStars = [
            [StarType.MainSeqStar, SpectrType.A, "white", ""],
            [
                StarType.MainSeqStar,
                SpectrType.F,
                "yellow",
                "saturate(0.3) brightness(1.15)",
            ],
            [
                StarType.GiantStar,
                SpectrType.A,
                "blue-flare",
                "saturate(0) brightness(1.15)",
            ],
            [StarType.WhiteDwarf, SpectrType.X, "white", ""],
            [StarType.NeutronStar, SpectrType.X, "neutron", ""],
        ] as const
        for (const [type, spectr, sprite, filter] of paleStars) {
            const { container } = render(
                <StarTypeIcon star={star(type, spectr)} />,
            )
            const icon = iconIn(container)
            expect(icon.dataset.starIcon).toBe(sprite)
            expect((icon.firstElementChild as HTMLElement).style.filter).toBe(
                filter,
            )
            expect(icon.style.width).toBe("18px")
            expect(icon.style.height).toBe("18px")
        }
    })

    it.each([
        [SpectrType.M, "yellow-flare", "hue-rotate(-35deg) saturate(1.8)"],
        [SpectrType.K, "yellow-flare", "hue-rotate(-35deg) saturate(1.8)"],
        [SpectrType.G, "yellow-flare", ""],
        [SpectrType.F, "yellow-flare", ""],
        [SpectrType.A, "blue-flare", "saturate(0) brightness(1.15)"],
        [SpectrType.B, "blue-flare", "saturate(1.8)"],
        [SpectrType.O, "blue-flare", "saturate(1.8)"],
    ])("matches the giant color group for %s", (spectr, sprite, filter) => {
        const { container } = render(
            <StarTypeIcon
                star={star(StarType.GiantStar, spectr as SpectrType)}
            />,
        )
        const icon = iconIn(container)
        expect(icon.dataset.starIcon).toBe(sprite)
        const art = icon.firstElementChild as HTMLElement
        expect(art.style.width).toBe("18px")
        expect(art.style.filter).toBe(filter)
    })

    it.each([
        [StarType.WhiteDwarf, "white", 18 * 0.64],
        [StarType.NeutronStar, "neutron", 18 * 0.5],
        [StarType.BlackHole, "black-hole", 18],
    ])(
        "selects %s by evolutionary type rather than spectral class",
        (type, sprite, width) => {
            const { container } = render(
                <StarTypeIcon star={star(type as StarType, SpectrType.X)} />,
            )
            const icon = iconIn(container)
            expect(icon.dataset.starIcon).toBe(sprite)
            expect(
                parseFloat((icon.firstElementChild as HTMLElement).style.width),
            ).toBeCloseTo(width as number)
        },
    )

    it.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY])(
        "falls back to 18px for invalid size %s and ignores a blank label",
        (size) => {
            const { container } = render(
                <StarTypeIcon
                    star={star(StarType.MainSeqStar)}
                    size={size}
                    label="  "
                />,
            )
            expect(iconIn(container).style.width).toBe("18px")
            expect(iconIn(container)).toHaveAttribute("aria-hidden", "true")
        },
    )

    it("keeps sprite selections within the unmodified transparent source PNG", () => {
        const bytes = readFileSync(
            "web/public/icons/stars/hjm-sun-types.68c53d45d1896366.png",
        )
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(
            "68c53d45d1896366c5c8fa71f6c8ae0ce4d8be249bd8974084a26de3131dd296",
        )
        expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG")
        expect(bytes.readUInt32BE(16)).toBe(2400)
        expect(bytes.readUInt32BE(20)).toBe(1051)
        expect(bytes[25]).toBe(6) // PNG color type RGBA, including an alpha channel.
        for (const sprite of Object.values(atlas)) {
            expect(sprite.x).toBeGreaterThanOrEqual(0)
            expect(sprite.y).toBeGreaterThanOrEqual(0)
            expect(sprite.x + sprite.width).toBeLessThanOrEqual(2400)
            expect(sprite.y + sprite.height).toBeLessThanOrEqual(1051)
        }
    })

    it("ships browser-readable credit and license notices under the deployment base", () => {
        expect(starIconAttributionHref).toBe(
            `${import.meta.env.BASE_URL}icons/stars/ATTRIBUTION.html`,
        )
        const credit = readFileSync(
            "web/public/icons/stars/ATTRIBUTION.html",
            "utf8",
        )
        expect(credit).toContain("Hansjörg Malthaner (Varkalandar)")
        expect(credit).toContain("https://opengameart.org/users/varkalandar")
        expect(credit).toContain("https://creativecommons.org/licenses/by/3.0/")
        expect(credit).toContain(
            "Some Suns, White/Brown Dwarf, Pulsar and Black Hole",
        )
        expect(credit).toMatch(/CSS selects\s+regions/)
    })
})
