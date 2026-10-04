import { StrictMode } from "react"
import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import GalaxyAnimation from "./GalaxyAnimation"
import { loadGalaxyAnimation } from "./GalaxyAnimation.loader"
import type { GalaxyAnimationController } from "./GalaxyAnimation.runtime"

vi.mock("./GalaxyAnimation.loader", () => ({ loadGalaxyAnimation: vi.fn() }))
const galaxy: Galaxy = { seed: 0, stars: [] }
const bounds = [-2, -2, 4, 4] as const
const controllers: GalaxyAnimationController[] = []
const createGalaxyAnimation = vi.fn(() => {
    const controller = { dispose: vi.fn(), setEnabled: vi.fn() }
    controllers.push(controller)
    return controller
})
const module = { createGalaxyAnimation }
function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: Error) => void
    const promise = new Promise<T>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}
beforeEach(() => {
    controllers.length = 0
    createGalaxyAnimation.mockClear()
    vi.mocked(loadGalaxyAnimation).mockReset().mockResolvedValue(module)
})

describe("lazy galaxy canvas lifecycle", () => {
    it("keeps its canvas decorative and dynamically creates the renderer only after mount", async () => {
        const onStatus = vi.fn()
        const view = render(
            <GalaxyAnimation
                galaxy={galaxy}
                bounds={bounds}
                onStatus={onStatus}
            />,
        )
        const canvas = view.container.querySelector("canvas")!
        expect(canvas).toHaveAttribute("aria-hidden", "true")
        expect(canvas).not.toHaveAttribute("tabindex")
        expect(canvas).toHaveStyle({
            pointerEvents: "none",
            position: "absolute",
        })
        expect(onStatus).toHaveBeenCalledWith("loading")
        await act(async () => {})
        expect(createGalaxyAnimation).toHaveBeenCalledTimes(1)
        view.unmount()
        expect(controllers[0]!.dispose).toHaveBeenCalledTimes(1)
    })

    it("cancels a lazy import completed after route unmount", async () => {
        const pending = deferred<typeof module>()
        vi.mocked(loadGalaxyAnimation).mockReturnValue(pending.promise)
        const view = render(<GalaxyAnimation galaxy={galaxy} bounds={bounds} />)
        view.unmount()
        await act(async () => {
            pending.resolve(module)
        })
        expect(createGalaxyAnimation).not.toHaveBeenCalled()
    })

    it("contains a rejected chunk import and preserves the SVG fallback", async () => {
        const pending = deferred<typeof module>()
        vi.mocked(loadGalaxyAnimation).mockReturnValue(pending.promise)
        const onStatus = vi.fn()
        const view = render(
            <div>
                <GalaxyAnimation
                    galaxy={galaxy}
                    bounds={bounds}
                    onStatus={onStatus}
                />
                <svg role="group" aria-label="Starmap" />
            </div>,
        )
        await act(async () => {
            pending.reject(new Error("offline chunk"))
        })
        expect(onStatus).toHaveBeenLastCalledWith("unavailable")
        expect(view.container.querySelector("canvas")).toHaveStyle({
            visibility: "hidden",
        })
        expect(view.getByRole("group", { name: "Starmap" })).toBeInTheDocument()
    })

    it("does not report a late import rejection after unmount", async () => {
        const pending = deferred<typeof module>()
        vi.mocked(loadGalaxyAnimation).mockReturnValue(pending.promise)
        const onStatus = vi.fn()
        const view = render(
            <GalaxyAnimation
                galaxy={galaxy}
                bounds={bounds}
                onStatus={onStatus}
            />,
        )
        view.unmount()
        await act(async () => {
            pending.reject(new Error("offline chunk"))
        })
        expect(onStatus).toHaveBeenCalledTimes(1)
    })

    it("handles an unavailable WebGL context as a decorative failure", async () => {
        createGalaxyAnimation.mockImplementationOnce(() => {
            throw new Error("WebGL blocked")
        })
        const onStatus = vi.fn()
        render(
            <GalaxyAnimation
                galaxy={galaxy}
                bounds={bounds}
                onStatus={onStatus}
            />,
        )
        await act(async () => {})
        expect(onStatus).toHaveBeenLastCalledWith("unavailable")
    })

    it("updates pause without re-importing or re-creating resources", async () => {
        const view = render(<GalaxyAnimation galaxy={galaxy} bounds={bounds} />)
        await act(async () => {})
        view.rerender(
            <GalaxyAnimation
                galaxy={galaxy}
                bounds={[...bounds]}
                enabled={false}
            />,
        )
        expect(controllers[0]!.setEnabled).toHaveBeenLastCalledWith(false)
        expect(controllers[0]!.dispose).not.toHaveBeenCalled()
        expect(createGalaxyAnimation).toHaveBeenCalledTimes(1)
        expect(loadGalaxyAnimation).toHaveBeenCalledTimes(1)
    })

    it("uses the latest pause choice when the import resolves", async () => {
        const pending = deferred<typeof module>()
        vi.mocked(loadGalaxyAnimation).mockReturnValue(pending.promise)
        const view = render(<GalaxyAnimation galaxy={galaxy} bounds={bounds} />)
        view.rerender(
            <GalaxyAnimation galaxy={galaxy} bounds={bounds} enabled={false} />,
        )
        await act(async () => {
            pending.resolve(module)
        })
        expect(createGalaxyAnimation).toHaveBeenCalledWith(
            expect.any(HTMLCanvasElement),
            galaxy,
            bounds,
            false,
            expect.any(Function),
        )
    })

    it("disposes on seed replacement and repeated StrictMode route mounts", async () => {
        for (let route = 0; route < 4; route++) {
            const view = render(
                <StrictMode>
                    <GalaxyAnimation galaxy={galaxy} bounds={bounds} />
                </StrictMode>,
            )
            await act(async () => {})
            view.rerender(
                <StrictMode>
                    <GalaxyAnimation
                        galaxy={{ seed: route + 1, stars: [] }}
                        bounds={bounds}
                    />
                </StrictMode>,
            )
            await act(async () => {})
            view.unmount()
        }
        expect(controllers).toHaveLength(8)
        for (const controller of controllers)
            expect(controller.dispose).toHaveBeenCalledTimes(1)
    })
})
