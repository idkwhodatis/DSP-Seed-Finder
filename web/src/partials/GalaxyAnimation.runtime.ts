import {
    AdditiveBlending,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Mesh,
    OrthographicCamera,
    PlaneGeometry,
    Points,
    Scene,
    ShaderMaterial,
    SRGBColorSpace,
    WebGLRenderer,
} from "three"
import { StarType } from "../enums"
import {
    fitGalaxyCamera,
    galaxyVisualRandom,
    getGalaxyStarColor,
    type GalaxyBounds,
} from "./GalaxyAnimation.math"
import type { GalaxyAnimationStatus } from "./GalaxyAnimation"

export interface GalaxyAnimationController {
    setEnabled: (enabled: boolean) => void
    dispose: () => void
}

const FRAME_INTERVAL = 1000 / 30
const starVertex = `
    attribute vec3 tint;
    attribute float diameter;
    attribute float phase;
    uniform float time;
    uniform float pixelScale;
    uniform float pixelRatio;
    varying vec3 vTint;
    varying float vPulse;
    void main() {
        vTint = tint;
        vPulse = 0.91 + 0.09 * sin(time * 0.72 + phase);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(diameter * pixelScale * (0.98 + 0.02 * vPulse), 10.0 * pixelRatio, 120.0 * pixelRatio);
    }
`
const starFragment = `
    varying vec3 vTint;
    varying float vPulse;
    void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float radius = length(p);
        if (radius > 1.0) discard;
        float halo = exp(-5.2 * radius) * (1.0 - smoothstep(0.65, 1.0, radius));
        float core = exp(-36.0 * radius * radius);
        float rays = pow(max(0.0, 1.0 - abs(p.x * p.y) * 95.0), 3.0)
            * exp(-5.0 * radius) * 0.12;
        gl_FragColor = vec4(mix(vTint, vec3(1.0), core * 0.4), (halo * 0.66 + core * 0.35 + rays) * vPulse);
        #include <colorspace_fragment>
    }
`
const dustVertex = `
    attribute float phase;
    attribute float diameter;
    uniform float time;
    uniform float pixelRatio;
    varying float vAlpha;
    void main() {
        vAlpha = 0.10 + 0.04 * sin(phase + time * 0.20);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = diameter * pixelRatio;
    }
`
const dustFragment = `
    varying float vAlpha;
    void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        gl_FragColor = vec4(0.58, 0.72, 0.91, (1.0 - smoothstep(0.0, 1.0, radius)) * vAlpha);
    }
`
const nebulaVertex = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`
const nebulaFragment = `
    varying vec2 vUv;
    uniform float time;
    void main() {
        vec2 p = vUv - vec2(0.5);
        float cloud = exp(-dot(p * vec2(1.35, 2.6), p * vec2(1.35, 2.6)) * 4.0);
        float folds = sin(p.x * 15.0 + sin(p.y * 11.0 + time * 0.018) * 2.0);
        float veil = 0.62 + 0.18 * folds + 0.12 * sin(p.y * 21.0 - p.x * 8.0);
        vec3 tint = mix(vec3(0.21, 0.15, 0.46), vec3(0.08, 0.36, 0.53), smoothstep(-0.5, 0.5, p.x));
        gl_FragColor = vec4(tint, cloud * veil * 0.19);
    }
`

/** Owns every WebGL resource and browser subscription for one mounted map. */
export function createGalaxyAnimation(
    canvas: HTMLCanvasElement,
    galaxy: Galaxy,
    bounds: GalaxyBounds,
    initiallyEnabled: boolean,
    onStatus: (status: GalaxyAnimationStatus) => void,
): GalaxyAnimationController {
    const geometries: BufferGeometry[] = []
    const materials: ShaderMaterial[] = []
    const cleanups: (() => void)[] = []
    let renderer: WebGLRenderer | undefined
    let disposed = false
    let failed = false
    let enabled = initiallyEnabled
    let frame: number | undefined
    let lastFrame = 0
    let elapsed = 0
    let hasSize = false
    let inView = true
    let status: GalaxyAnimationStatus | undefined
    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    camera.position.z = 10
    const uniforms = {
        time: { value: 0 },
        pixelScale: { value: 1 },
        pixelRatio: { value: 1 },
    }
    const report = (value: GalaxyAnimationStatus) => {
        if (value !== status) {
            status = value
            onStatus(value)
        }
    }
    const stop = () => {
        if (frame !== undefined) cancelAnimationFrame(frame)
        frame = undefined
        lastFrame = 0
    }
    const dispose = () => {
        if (disposed) return
        disposed = true
        stop()
        cleanups.splice(0).forEach((cleanup) => cleanup())
        geometries.forEach((geometry) => geometry.dispose())
        materials.forEach((material) => material.dispose())
        scene.clear()
        renderer?.dispose()
        // Release the context too: route changes must not accumulate idle contexts.
        renderer?.forceContextLoss()
        canvas.style.visibility = "hidden"
    }
    const fail = () => {
        if (failed || disposed) return
        failed = true
        dispose()
        report("unavailable")
    }

    try {
        renderer = new WebGLRenderer({
            canvas,
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            powerPreference: "low-power",
            failIfMajorPerformanceCaveat: true,
        })
        renderer.setClearColor(0x000000, 0)
        // Shader compile failure does not always throw, so explicitly retain the SVG fallback.
        renderer.debug.onShaderError = fail
        const geometry = (value: BufferGeometry) => {
            geometries.push(value)
            return value
        }
        const material = (vertexShader: string, fragmentShader: string) => {
            const value = new ShaderMaterial({
                uniforms,
                vertexShader,
                fragmentShader,
                transparent: true,
                blending: AdditiveBlending,
                depthTest: false,
                depthWrite: false,
                toneMapped: false,
            })
            materials.push(value)
            return value
        }
        const starGeometry = geometry(new BufferGeometry())
        const positions: number[] = [],
            tints: number[] = [],
            diameters: number[] = [],
            phases: number[] = []
        const color = new Color()
        const random = galaxyVisualRandom(galaxy.seed)
        for (const star of galaxy.stars) {
            const [x, , z] = star.position
            if (!Number.isFinite(x) || !Number.isFinite(z)) continue
            positions.push(x, z, 0)
            const [r, g, b] = getGalaxyStarColor(star)
            color.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)
            tints.push(color.r, color.g, color.b)
            diameters.push(
                star.type === StarType.GiantStar
                    ? 6.4
                    : star.type === StarType.WhiteDwarf
                      ? 2.7
                      : 4.2,
            )
            phases.push(random() * Math.PI * 2)
        }
        starGeometry.setAttribute(
            "position",
            new Float32BufferAttribute(positions, 3),
        )
        starGeometry.setAttribute("tint", new Float32BufferAttribute(tints, 3))
        starGeometry.setAttribute(
            "diameter",
            new Float32BufferAttribute(diameters, 1),
        )
        starGeometry.setAttribute(
            "phase",
            new Float32BufferAttribute(phases, 1),
        )
        const stars = new Points(
            starGeometry,
            material(starVertex, starFragment),
        )
        stars.frustumCulled = false
        stars.renderOrder = 2
        scene.add(stars)

        const dustGeometry = geometry(new BufferGeometry())
        const dustPositions: number[] = [],
            dustDiameters: number[] = [],
            dustPhases: number[] = []
        for (let i = 0; i < 180; i++) {
            dustPositions.push(
                bounds[0] + (random() * 1.5 - 0.25) * bounds[2],
                -(bounds[1] + (random() * 1.5 - 0.25) * bounds[3]),
                -1,
            )
            dustDiameters.push(0.8 + random() * 1.3)
            dustPhases.push(random() * Math.PI * 2)
        }
        dustGeometry.setAttribute(
            "position",
            new Float32BufferAttribute(dustPositions, 3),
        )
        dustGeometry.setAttribute(
            "diameter",
            new Float32BufferAttribute(dustDiameters, 1),
        )
        dustGeometry.setAttribute(
            "phase",
            new Float32BufferAttribute(dustPhases, 1),
        )
        const dust = new Points(
            dustGeometry,
            material(dustVertex, dustFragment),
        )
        dust.frustumCulled = false
        dust.renderOrder = 1
        scene.add(dust)
        const nebula = new Mesh(
            geometry(new PlaneGeometry(1, 1)),
            material(nebulaVertex, nebulaFragment),
        )
        nebula.position.z = -2
        nebula.renderOrder = 0
        scene.add(nebula)

        const media = window.matchMedia("(prefers-reduced-motion: reduce)")
        const canRender = () =>
            !disposed && !failed && hasSize && inView && !document.hidden
        const canAnimate = () => canRender() && enabled && !media.matches
        const render = () => {
            if (!canRender()) return
            try {
                renderer!.render(scene, camera)
                if (!failed) canvas.style.visibility = "visible"
            } catch {
                fail()
            }
        }
        const tick = (now: number) => {
            frame = undefined
            if (!canAnimate()) return
            const delta = now - lastFrame
            if (delta >= FRAME_INTERVAL) {
                elapsed += Math.min(delta / 1000, 0.1)
                uniforms.time.value = elapsed
                lastFrame = now
                render()
            }
            if (canAnimate()) frame = requestAnimationFrame(tick)
        }
        const sync = () => {
            stop()
            if (disposed || failed) return
            render()
            if (disposed || failed) return
            report(canAnimate() ? "animated" : "static")
            if (canAnimate()) {
                lastFrame = performance.now()
                frame = requestAnimationFrame(tick)
            }
        }
        const resize = () => {
            if (disposed) return
            const rect = canvas.getBoundingClientRect()
            hasSize = rect.width > 0 && rect.height > 0
            if (!hasSize) {
                sync()
                return
            }
            const fit = fitGalaxyCamera(bounds, rect.width, rect.height)
            camera.left = fit.left
            camera.right = fit.right
            camera.top = fit.top
            camera.bottom = fit.bottom
            camera.updateProjectionMatrix()
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
            uniforms.pixelRatio.value = dpr
            uniforms.pixelScale.value = fit.pixelsPerUnit * dpr
            nebula.position.x = (fit.left + fit.right) / 2
            nebula.position.y = (fit.top + fit.bottom) / 2
            nebula.scale.set(fit.right - fit.left, fit.top - fit.bottom, 1)
            try {
                renderer!.setPixelRatio(dpr)
                renderer!.setSize(rect.width, rect.height, false)
                sync()
            } catch {
                fail()
            }
        }
        const onContextLost = (event: Event) => {
            event.preventDefault()
            fail()
        }
        canvas.addEventListener("webglcontextlost", onContextLost)
        cleanups.push(() =>
            canvas.removeEventListener("webglcontextlost", onContextLost),
        )
        document.addEventListener("visibilitychange", sync)
        cleanups.push(() =>
            document.removeEventListener("visibilitychange", sync),
        )
        media.addEventListener("change", sync)
        cleanups.push(() => media.removeEventListener("change", sync))
        window.addEventListener("resize", resize)
        cleanups.push(() => window.removeEventListener("resize", resize))
        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(resize)
            observer.observe(canvas)
            cleanups.push(() => observer.disconnect())
        }
        if (typeof IntersectionObserver !== "undefined") {
            // Wait for the first intersection result rather than spinning offscreen.
            inView = false
            const observer = new IntersectionObserver((entries) => {
                inView = entries.some(
                    (entry) => entry.target === canvas && entry.isIntersecting,
                )
                sync()
            })
            observer.observe(canvas)
            cleanups.push(() => observer.disconnect())
        }
        resize()
        return {
            setEnabled: (value) => {
                if (enabled !== value) {
                    enabled = value
                    sync()
                }
            },
            dispose,
        }
    } catch (error) {
        dispose()
        throw error
    }
}
