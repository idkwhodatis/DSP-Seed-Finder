import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, useLocation } from "react-router-dom"
import { computePosition } from "@floating-ui/dom"
import Starmap from "./Starmap"
import { StarType } from "../enums"
import { setupI18n } from "@lingui/core"
import { I18nProvider } from "@lingui/react"

const animation = vi.hoisted(() => ({
    report: undefined as
        | undefined
        | ((status: "loading" | "static" | "animated" | "unavailable") => void),
}))
vi.mock("./GalaxyAnimation", () => ({
    default: ({ onStatus }: { onStatus: typeof animation.report }) => {
        animation.report = onStatus
        return null
    },
}))
vi.mock("@floating-ui/dom", () => ({ computePosition: vi.fn(), flip: vi.fn() }))
afterEach(cleanup)
beforeEach(() => {
    vi.mocked(computePosition).mockReset()
    animation.report = undefined
})

const star = {
    index: 0,
    name: "Alpha",
    position: [0, 0, 0],
    type: StarType.MainSeqStar,
    color: 0.5,
} as Star
const galaxy: Galaxy = { seed: 0, stars: [star] }
const position: Awaited<ReturnType<typeof computePosition>> = {
    x: 12,
    y: 34,
    placement: "top",
    strategy: "fixed",
    middlewareData: {},
}
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((yes) => {
        resolve = yes
    })
    return { promise, resolve }
}
function Location() {
    const location = useLocation()
    return (
        <output data-testid="location">
            {location.pathname}
            {location.search}
        </output>
    )
}
function content(value: Galaxy = galaxy) {
    return (
        <I18nProvider i18n={setupI18n({ locale: "en", messages: { en: {} } })}>
            <MemoryRouter initialEntries={["/galaxy/0"]}>
                <Starmap galaxy={value} search="?count=32" />
                <Location />
            </MemoryRouter>
        </I18nProvider>
    )
}

describe("starmap lifecycle and keyboard access", () => {
    it.each(["Enter", " "])(
        "navigates a focused star with %s and preserves query parameters",
        (key) => {
            vi.mocked(computePosition).mockResolvedValue(position)
            render(content())
            const node = screen.getByRole("link", { name: "Alpha, #1" })
            expect(node).toHaveAttribute("tabindex", "0")
            fireEvent.keyDown(node, { key })
            expect(screen.getByTestId("location")).toHaveTextContent(
                "/galaxy/0/0?count=32",
            )
        },
    )

    it("positions the popup only after both mounted refs are available", async () => {
        vi.mocked(computePosition).mockResolvedValue(position)
        render(content())
        fireEvent.focus(screen.getByRole("link", { name: "Alpha, #1" }))
        await act(async () => {})
        const popup = screen.getByRole("link", { name: "Alpha" })
        expect(computePosition).toHaveBeenCalledWith(
            expect.any(SVGElement),
            popup,
            expect.objectContaining({ strategy: "fixed" }),
        )
        expect(popup).toHaveStyle({
            left: "12px",
            top: "34px",
            visibility: "visible",
        })
        fireEvent.keyDown(screen.getByRole("link", { name: "Alpha, #1" }), {
            key: "Escape",
        })
        expect(popup).toHaveStyle({ display: "none" })
    })

    it("does not mutate a detached popup when positioning resolves after unmount", async () => {
        const pending = deferred<typeof position>()
        vi.mocked(computePosition).mockReturnValue(pending.promise)
        const { unmount } = render(content())
        fireEvent.mouseEnter(screen.getByRole("link", { name: "Alpha, #1" }))
        const popup = document.querySelector<HTMLAnchorElement>(
            "a[href='/galaxy/0/0?count=32']",
        )!
        unmount()
        await act(async () => {
            pending.resolve(position)
        })
        expect(popup.style.left).toBe("")
        expect(popup.isConnected).toBe(false)
        fireEvent.resize(window)
        expect(computePosition).toHaveBeenCalledTimes(1)
    })

    it("ignores an older placement across close and reopen", async () => {
        const old = deferred<typeof position>(),
            current = deferred<typeof position>()
        vi.mocked(computePosition)
            .mockReturnValueOnce(old.promise)
            .mockReturnValueOnce(current.promise)
        render(content())
        const node = screen.getByRole("link", { name: "Alpha, #1" })
        fireEvent.mouseEnter(node)
        fireEvent.mouseLeave(node)
        fireEvent.mouseEnter(node)
        await act(async () => {
            current.resolve(position)
        })
        const popup = screen.getByRole("link", { name: "Alpha" })
        await act(async () => {
            old.resolve({ ...position, x: 90, y: 90 })
        })
        expect(popup).toHaveStyle({ left: "12px", top: "34px" })
    })

    it("handles a failed placement without preventing navigation", async () => {
        vi.mocked(computePosition).mockRejectedValue(
            new Error("layout unavailable"),
        )
        render(content())
        const node = screen.getByRole("link", { name: "Alpha, #1" })
        fireEvent.mouseEnter(node)
        await act(async () => {})
        fireEvent.click(node)
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/galaxy/0/0?count=32",
        )
    })

    it("uses a finite viewport for an empty galaxy", () => {
        const { container } = render(content({ seed: 0, stars: [] }))
        expect(container.querySelector("svg")).toHaveAttribute(
            "viewBox",
            "-2 -2 4 4",
        )
    })
})

describe("complete galaxy framing", () => {
    it("fits every star instead of cropping the map to fill the panel", () => {
        const { container } = render(
            content({
                seed: 0,
                stars: [
                    { ...star, position: [-30, 0, -2] },
                    { ...star, index: 1, name: "Beta", position: [30, 0, 2] },
                ],
            }),
        )
        const map = container.querySelector("svg")!
        expect(map).toHaveAttribute("preserveAspectRatio", "xMidYMid meet")
        expect(map).toHaveAttribute("viewBox", "-32 -4 64 8")
        expect(map.querySelectorAll("circle[role=link]")).toHaveLength(2)
    })
})

describe("centered stellar highlights and layered rendering", () => {
    it.each(Object.values(StarType))(
        "centers the custom focus marker exactly on a %s",
        (type) => {
            vi.mocked(computePosition).mockResolvedValue(position)
            const value = {
                seed: 12,
                stars: [
                    { ...star, type, position: [-17.25, 3, 8.75] as Position },
                ],
            }
            const { container } = render(content(value))
            const node = screen.getByRole("link", { name: "Alpha, #1" })
            fireEvent.focus(node)
            const highlight = container.querySelector(
                "[data-star-highlight='0']",
            )!
            expect(highlight.getAttribute("cx")).toBe(node.getAttribute("cx"))
            expect(highlight.getAttribute("cy")).toBe(node.getAttribute("cy"))
            expect(highlight).toHaveAttribute("cx", "-17.25")
            expect(highlight).toHaveAttribute("cy", "-8.75")
            expect(highlight).toHaveAttribute(
                "vector-effect",
                "non-scaling-stroke",
            )
            expect(highlight).toHaveAttribute("stroke-width", "1.3")
            expect(highlight).not.toHaveAttribute("transform")
            expect(Number(highlight.getAttribute("r"))).toBeLessThan(1.2)
            fireEvent.keyDown(node, { key: "Escape" })
            expect(container.querySelector("[data-star-highlight]")).toBe(
                highlight,
            )
            fireEvent.blur(node)
            expect(container.querySelector("[data-star-highlight]")).toBeNull()
        },
    )

    it("preserves hit targets and SVG fallback until a real frame, then restores it on failure", () => {
        const { container } = render(content())
        const node = screen.getByRole("link", { name: "Alpha, #1" })
        expect(container.querySelectorAll("[data-star-fallback]")).toHaveLength(
            1,
        )
        expect(node).toHaveAttribute("fill", "transparent")
        act(() => animation.report?.("loading"))
        expect(container.querySelectorAll("[data-star-fallback]")).toHaveLength(
            1,
        )
        for (const status of ["animated", "static"] as const) {
            act(() => animation.report?.(status))
            expect(
                container.querySelectorAll("[data-star-fallback]"),
            ).toHaveLength(0)
            expect(screen.getByRole("link", { name: "Alpha, #1" })).toBe(node)
        }
        act(() => animation.report?.("unavailable"))
        expect(container.querySelectorAll("[data-star-fallback]")).toHaveLength(
            1,
        )
        fireEvent.click(node)
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/galaxy/0/0?count=32",
        )
    })

    it("masks foreground connectors away from every rendered photosphere", () => {
        const value = {
            seed: 0,
            stars: Object.values(StarType).map((type, index) => ({
                ...star,
                type,
                index,
                position: [index * 2, 0, -index] as Position,
            })),
        }
        const { container } = render(content(value))
        const mask = container.querySelector("mask")!
        expect(mask).toHaveAttribute("maskUnits", "userSpaceOnUse")
        expect(mask.querySelectorAll("[data-star-occlusion]")).toHaveLength(5)
        const line = container.querySelector("line")!
        expect(line.parentElement).toHaveAttribute("mask", `url(#${mask.id})`)
        for (const star of value.stars) {
            const hole = mask.querySelector(
                `[data-star-occlusion='${star.index}']`,
            )!
            expect(hole).toHaveAttribute("cx", String(star.position[0]))
            expect(hole).toHaveAttribute("cy", String(-star.position[2]))
            expect(hole).toHaveAttribute("fill", "black")
        }
    })

    it("shows a centered hover marker without changing the link geometry", () => {
        vi.mocked(computePosition).mockResolvedValue(position)
        const { container } = render(content())
        const node = screen.getByRole("link", { name: "Alpha, #1" })
        const radius = node.getAttribute("r")
        fireEvent.mouseEnter(node)
        expect(
            container.querySelector("[data-star-highlight]"),
        ).toHaveAttribute("cx", "0")
        fireEvent.mouseLeave(node)
        expect(container.querySelector("[data-star-highlight]")).toBeNull()
        expect(node).toHaveAttribute("r", radius)
    })
})
