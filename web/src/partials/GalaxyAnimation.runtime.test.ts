import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    BufferGeometry,
    InstancedBufferGeometry,
    NormalBlending,
    ShaderMaterial,
    type Scene,
    type OrthographicCamera,
    type Mesh,
} from "three"
import { StarType } from "../enums"
import {
    createGalaxyAnimation,
    type GalaxyAnimationController,
} from "./GalaxyAnimation.runtime"
import { getGalaxyBounds } from "./GalaxyAnimation.math"
import { getStellarProfile } from "./GalaxyAnimation.stellar"

const mocked = vi.hoisted(() => ({
    constructor: vi.fn(),
    instances: [] as any[],
}))
vi.mock("three", async (importOriginal) => {
    const actual = await importOriginal<typeof import("three")>()
    return {
        ...actual,
        WebGLRenderer: vi.fn(function (options) {
            mocked.constructor(options)
            const renderer = {
                setClearColor: vi.fn(),
                setPixelRatio: vi.fn(),
                setSize: vi.fn(),
                render: vi.fn(),
                dispose: vi.fn(),
                forceContextLoss: vi.fn(),
                debug: {} as { onShaderError?: () => void },
            }
            mocked.instances.push(renderer)
            return renderer
        }),
    }
})

const stars = [
    {
        index: 0,
        position: [-8, 2, -3],
        type: StarType.MainSeqStar,
        color: 0.5,
        radius: 1,
    },
    {
        index: 1,
        position: [13, -1, 11],
        type: StarType.GiantStar,
        color: 0.1,
        radius: 16,
    },
] as Star[]
const galaxy: Galaxy = { seed: 12345, stars }
class Media extends EventTarget {
    matches = false
}
let media: Media
let hidden: boolean
let frameId: number
let frames: Map<number, FrameRequestCallback>
let canvas: HTMLCanvasElement
let controllers: GalaxyAnimationController[]
let intersections: {
    trigger: (visible: boolean) => void
    disconnect: ReturnType<typeof vi.fn>
}[]
let resizes: { trigger: () => void; disconnect: ReturnType<typeof vi.fn> }[]

function runFrame(now: number) {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(now))
}
function start(input = galaxy) {
    const onStatus = vi.fn()
    const controller = createGalaxyAnimation(
        canvas,
        input,
        getGalaxyBounds(input.stars),
        true,
        onStatus,
    )
    controllers.push(controller)
    const renderer = mocked.instances.at(-1)!
    return { controller, renderer, onStatus }
}
beforeEach(() => {
    mocked.constructor.mockReset()
    mocked.instances.length = 0
    hidden = false
    frameId = 0
    frames = new Map()
    controllers = []
    intersections = []
    resizes = []
    media = new Media()
    vi.spyOn(window, "matchMedia").mockReturnValue(
        media as unknown as MediaQueryList,
    )
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden)
    vi.spyOn(performance, "now").mockReturnValue(0)
    vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn((callback) => {
            frames.set(++frameId, callback)
            return frameId
        }),
    )
    vi.stubGlobal(
        "cancelAnimationFrame",
        vi.fn((id) => {
            frames.delete(id)
        }),
    )
    vi.stubGlobal(
        "ResizeObserver",
        class {
            disconnect = vi.fn()
            constructor(callback: ResizeObserverCallback) {
                resizes.push({
                    trigger: () =>
                        callback([], this as unknown as ResizeObserver),
                    disconnect: this.disconnect,
                })
            }
            observe() {}
        },
    )
    vi.stubGlobal(
        "IntersectionObserver",
        class {
            disconnect = vi.fn()
            constructor(callback: IntersectionObserverCallback) {
                intersections.push({
                    trigger: (visible) =>
                        callback(
                            [
                                {
                                    target: canvas,
                                    isIntersecting: visible,
                                    boundingClientRect:
                                        canvas.getBoundingClientRect(),
                                    intersectionRect:
                                        canvas.getBoundingClientRect(),
                                    intersectionRatio: visible ? 1 : 0,
                                    rootBounds: null,
                                    time: 0,
                                } satisfies IntersectionObserverEntry,
                            ],
                            this as unknown as IntersectionObserver,
                        ),
                    disconnect: this.disconnect,
                })
            }
            observe() {}
        },
    )
    canvas = document.createElement("canvas")
    document.body.append(canvas)
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 800, 600),
    )
})
afterEach(() => {
    controllers.forEach((controller) => controller.dispose())
    canvas.remove()
    vi.unstubAllGlobals()
})

describe("Three galaxy resources and scheduling", () => {
    it("uses a low-power transparent context and capped DPR with actual star coordinates", () => {
        vi.stubGlobal("devicePixelRatio", 3)
        const { renderer, onStatus } = start()
        expect(mocked.constructor).toHaveBeenCalledWith(
            expect.objectContaining({
                canvas,
                alpha: true,
                antialias: false,
                powerPreference: "low-power",
                failIfMajorPerformanceCaveat: true,
            }),
        )
        expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1.5)
        expect(frames.size).toBe(0)
        intersections[0]!.trigger(true)
        expect(onStatus).toHaveBeenLastCalledWith("animated")
        const [scene, camera] = renderer.render.mock.calls[0] as [
            Scene,
            OrthographicCamera,
        ]
        const actualStars = scene.children.find(
            (child) => child.renderOrder === 2,
        ) as Mesh<InstancedBufferGeometry, ShaderMaterial>
        expect([...actualStars.geometry.getAttribute("center").array]).toEqual([
            13, 11, 0, -8, -3, 0,
        ])
        expect(actualStars.geometry.instanceCount).toBe(2)
        expect(actualStars.geometry.getAttribute("position").count).toBe(4)
        expect(actualStars.geometry.index?.count).toBe(6)
        expect(actualStars.material.blending).toBe(NormalBlending)
        expect(actualStars.material.depthWrite).toBe(false)
        expect(actualStars.material.vertexShader).not.toContain("gl_PointSize")
        expect(camera.isOrthographicCamera).toBe(true)
        expect(scene.children).toHaveLength(3)
    })

    it("keeps the SVG fallback until the first visible frame actually renders", () => {
        const { renderer, onStatus } = start()
        expect(renderer.render).not.toHaveBeenCalled()
        expect(onStatus).toHaveBeenLastCalledWith("loading")
        hidden = true
        intersections[0]!.trigger(true)
        expect(onStatus).toHaveBeenLastCalledWith("loading")
        hidden = false
        document.dispatchEvent(new Event("visibilitychange"))
        expect(renderer.render).toHaveBeenCalledTimes(1)
        expect(canvas.style.visibility).toBe("visible")
        expect(onStatus).toHaveBeenLastCalledWith("animated")
    })

    it("batches 64 distinct stellar profiles without mutating or moving generator data", () => {
        const types = Object.values(StarType)
        const input: Galaxy = {
            seed: 8675309,
            stars: Array.from(
                { length: 64 },
                (_, index) =>
                    ({
                        index,
                        type: types[index % types.length]!,
                        color: index / 63,
                        radius:
                            [0.55, 16, 0.25, 0.4, 4][index % types.length]! *
                            (1 + index / 200),
                        position: [index % 8, index, Math.floor(index / 8)],
                    }) as Star,
            ),
        }
        const before = structuredClone(input)
        const { renderer } = start(input)
        intersections[0]!.trigger(true)
        const [scene] = renderer.render.mock.calls[0] as [Scene]
        const batch = scene.children.find(
            (child) => child.renderOrder === 2,
        ) as Mesh<InstancedBufferGeometry, ShaderMaterial>
        const geometry = batch.geometry
        expect(geometry.instanceCount).toBe(64)
        for (let index = 0; index < 64; index++) {
            const star = input.stars[index]!
            const profile = getStellarProfile(star)
            const center = geometry.getAttribute("center")
            const attributes = geometry.getAttribute("profile")
            const detail = geometry.getAttribute("detail")
            expect([center.getX(index), center.getY(index)]).toEqual([
                star.position[0],
                star.position[2],
            ])
            expect(attributes.getX(index)).toBeCloseTo(profile.radius)
            expect(attributes.getY(index)).toBeCloseTo(profile.extent)
            expect(attributes.getZ(index)).toBe(profile.kind)
            expect(detail.getX(index)).toBeCloseTo(profile.granulation)
            expect(detail.getY(index)).toBeCloseTo(profile.activity)
            expect(detail.getZ(index)).toBeCloseTo(profile.whiteness)
        }
        expect(input).toEqual(before)
        expect(scene.children).toHaveLength(3)
    })

    it("reproduces surface phases and skips invalid coordinates in all instance buffers", () => {
        const input = {
            ...galaxy,
            stars: [...stars, { ...stars[0]!, position: [NaN, 0, 5] } as Star],
        }
        const first = start(input)
        intersections[0]!.trigger(true)
        const second = start(input)
        intersections[1]!.trigger(true)
        const getGeometry = (renderer: typeof first.renderer) => {
            const [scene] = renderer.render.mock.calls[0] as [Scene]
            return (
                scene.children.find(
                    (child) => child.renderOrder === 2,
                ) as Mesh<InstancedBufferGeometry>
            ).geometry
        }
        const a = getGeometry(first.renderer)
        const b = getGeometry(second.renderer)
        expect(a.instanceCount).toBe(2)
        for (const name of ["center", "tint", "profile", "detail"]) {
            expect(a.getAttribute(name).count).toBe(2)
            expect([...a.getAttribute(name).array]).toEqual([
                ...b.getAttribute(name).array,
            ])
            expect([...a.getAttribute(name).array].every(Number.isFinite)).toBe(
                true,
            )
        }
    })

    it("caps rendered frames at 30fps and stops on a manual pause without freeing the scene", () => {
        const { renderer, controller, onStatus } = start()
        intersections[0]!.trigger(true)
        for (let now = 0; now <= 1000; now += 1000 / 120) runFrame(now)
        expect(renderer.render.mock.calls.length).toBeLessThanOrEqual(31)
        expect(renderer.render.mock.calls.length).toBeGreaterThan(20)
        controller.setEnabled(false)
        expect(frames.size).toBe(0)
        expect(onStatus).toHaveBeenLastCalledWith("static")
        expect(renderer.dispose).not.toHaveBeenCalled()
        const calls = renderer.render.mock.calls.length
        runFrame(2000)
        expect(renderer.render).toHaveBeenCalledTimes(calls)
        controller.setEnabled(true)
        expect(frames.size).toBe(1)
    })

    it("renders a static reduced-motion frame without an ongoing loop and responds to preference changes", () => {
        media.matches = true
        const { renderer, onStatus } = start()
        intersections[0]!.trigger(true)
        expect(renderer.render).toHaveBeenCalledTimes(1)
        expect(onStatus).toHaveBeenLastCalledWith("static")
        expect(frames.size).toBe(0)
        media.matches = false
        media.dispatchEvent(new Event("change"))
        expect(frames.size).toBe(1)
        media.matches = true
        media.dispatchEvent(new Event("change"))
        expect(frames.size).toBe(0)
    })

    it("pauses hidden and offscreen maps and only resumes when both are visible", () => {
        const { renderer, onStatus } = start()
        hidden = true
        intersections[0]!.trigger(true)
        expect(renderer.render).not.toHaveBeenCalled()
        expect(frames.size).toBe(0)
        hidden = false
        document.dispatchEvent(new Event("visibilitychange"))
        expect(frames.size).toBe(1)
        intersections[0]!.trigger(false)
        expect(frames.size).toBe(0)
        expect(onStatus).toHaveBeenLastCalledWith("static")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(frames.size).toBe(0)
        intersections[0]!.trigger(true)
        hidden = true
        document.dispatchEvent(new Event("visibilitychange"))
        expect(frames.size).toBe(0)
    })

    it("fits after resize and suspends zero-size maps", () => {
        const { renderer } = start()
        intersections[0]!.trigger(true)
        vi.mocked(canvas.getBoundingClientRect).mockReturnValue(
            new DOMRect(0, 0, 360, 640),
        )
        resizes[0]!.trigger()
        expect(renderer.setSize).toHaveBeenLastCalledWith(360, 640, false)
        const [, camera] = renderer.render.mock.calls.at(-1) as [
            Scene,
            OrthographicCamera,
        ]
        expect(
            (camera.right - camera.left) / (camera.top - camera.bottom),
        ).toBeCloseTo(360 / 640)
        vi.mocked(canvas.getBoundingClientRect).mockReturnValue(
            new DOMRect(0, 0, 0, 0),
        )
        resizes[0]!.trigger()
        expect(frames.size).toBe(0)
    })

    it.each(["context loss", "render error", "shader error"])(
        "disposes all GPU resources and falls back safely on %s",
        (failure) => {
            const geometryDispose = vi.spyOn(
                BufferGeometry.prototype,
                "dispose",
            )
            const materialDispose = vi.spyOn(
                ShaderMaterial.prototype,
                "dispose",
            )
            const { renderer, controller, onStatus } = start()
            intersections[0]!.trigger(true)
            if (failure === "context loss") {
                const event = new Event("webglcontextlost", {
                    cancelable: true,
                })
                canvas.dispatchEvent(event)
                expect(event.defaultPrevented).toBe(true)
            } else if (failure === "render error") {
                renderer.render.mockImplementationOnce(() => {
                    throw new Error("driver failure")
                })
                runFrame(40)
            } else renderer.debug.onShaderError()
            expect(onStatus).toHaveBeenLastCalledWith("unavailable")
            expect(canvas.style.visibility).toBe("hidden")
            expect(frames.size).toBe(0)
            expect(geometryDispose).toHaveBeenCalledTimes(3)
            expect(materialDispose).toHaveBeenCalledTimes(3)
            expect(renderer.dispose).toHaveBeenCalledTimes(1)
            expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1)
            controller.dispose()
            controller.setEnabled(true)
            expect(renderer.dispose).toHaveBeenCalledTimes(1)
            expect(frames.size).toBe(0)
        },
    )

    it("releases every observer, listener, frame, geometry, material and context across repeated mounts", () => {
        const geometryDispose = vi.spyOn(BufferGeometry.prototype, "dispose")
        const materialDispose = vi.spyOn(ShaderMaterial.prototype, "dispose")
        const removeDocument = vi.spyOn(document, "removeEventListener")
        const removeWindow = vi.spyOn(window, "removeEventListener")
        const removeMedia = vi.spyOn(media, "removeEventListener")
        const removeCanvas = vi.spyOn(canvas, "removeEventListener")
        for (let route = 0; route < 5; route++) {
            const { controller, renderer } = start()
            intersections[route]!.trigger(true)
            runFrame(40)
            controller.dispose()
            expect(renderer.dispose).toHaveBeenCalledTimes(1)
            expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1)
        }
        expect(geometryDispose).toHaveBeenCalledTimes(15)
        expect(materialDispose).toHaveBeenCalledTimes(15)
        expect(frames.size).toBe(0)
        for (const observer of [...intersections, ...resizes])
            expect(observer.disconnect).toHaveBeenCalledTimes(1)
        expect(removeDocument).toHaveBeenCalledTimes(5)
        expect(removeWindow).toHaveBeenCalledTimes(5)
        expect(removeMedia).toHaveBeenCalledTimes(5)
        expect(removeCanvas).toHaveBeenCalledTimes(5)
        document.dispatchEvent(new Event("visibilitychange"))
        window.dispatchEvent(new Event("resize"))
        media.dispatchEvent(new Event("change"))
        expect(frames.size).toBe(0)
    })

    it("handles WebGL construction failure before any resources are allocated", () => {
        mocked.constructor.mockImplementationOnce(() => {
            throw new Error("WebGL unavailable")
        })
        expect(() => start()).toThrow("WebGL unavailable")
        expect(frames.size).toBe(0)
        expect(intersections).toHaveLength(0)
        expect(resizes).toHaveLength(0)
    })
})
