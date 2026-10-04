import { useEffect, useRef } from "react"
import { loadGalaxyAnimation } from "./GalaxyAnimation.loader"
import type { GalaxyBounds } from "./GalaxyAnimation.math"
import type { GalaxyAnimationController } from "./GalaxyAnimation.runtime"

export type GalaxyAnimationStatus =
    "loading" | "animated" | "static" | "unavailable"

export interface GalaxyAnimationProps {
    galaxy: Galaxy
    bounds: GalaxyBounds
    /** Pause motion while preserving the current decorative frame. */
    enabled?: boolean
    className?: string
    onStatus?: (status: GalaxyAnimationStatus) => void
}

export default function GalaxyAnimation({
    galaxy,
    bounds,
    enabled = true,
    className,
    onStatus,
}: GalaxyAnimationProps) {
    const canvas = useRef<HTMLCanvasElement>(null)
    const controller = useRef<GalaxyAnimationController | null>(null)
    const latest = useRef({ enabled, onStatus })
    const [x, y, width, height] = bounds

    useEffect(() => {
        latest.current = { enabled, onStatus }
        controller.current?.setEnabled(enabled)
    }, [enabled, onStatus])

    useEffect(() => {
        const element = canvas.current
        if (!element) return
        let active = true
        let instance: GalaxyAnimationController | undefined
        element.style.visibility = "hidden"
        latest.current.onStatus?.("loading")
        void loadGalaxyAnimation()
            .then(({ createGalaxyAnimation }) => {
                if (!active || !element.isConnected) return
                instance = createGalaxyAnimation(
                    element,
                    galaxy,
                    [x, y, width, height],
                    latest.current.enabled,
                    (status) => {
                        if (active) latest.current.onStatus?.(status)
                    },
                )
                controller.current = instance
            })
            .catch(() => {
                // Missing chunks, blocked WebGL, and driver failures are decorative only.
                if (active) {
                    element.style.visibility = "hidden"
                    latest.current.onStatus?.("unavailable")
                }
            })
        return () => {
            active = false
            instance?.dispose()
            controller.current = null
        }
    }, [galaxy, x, y, width, height])

    return (
        <canvas
            ref={canvas}
            className={className}
            aria-hidden="true"
            data-galaxy-animation=""
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                pointerEvents: "none",
            }}
        />
    )
}
