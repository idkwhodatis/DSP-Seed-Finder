import {
    useEffect,
    useId,
    useRef,
    useMemo,
    useState,
    useCallback,
    type FC,
    type SVGProps,
} from "react"
import { createPortal } from "react-dom"
import { Link, useNavigate } from "react-router-dom"
import { computePosition, flip } from "@floating-ui/dom"
import { useLiveState } from "../hooks/useLiveState"
import { StarType } from "../enums"
import { useLingui } from "#lingui"
import styles from "~styles"
import GalaxyAnimation, { type GalaxyAnimationStatus } from "./GalaxyAnimation"
import { getStellarDiskRadius } from "./GalaxyAnimation.stellar"
import {
    getGalaxyBounds,
    getGalaxyStarColor,
    fitGalaxyCamera,
} from "./GalaxyAnimation.math"

function sqrDistance([x1, y1, z1]: Position, [x2, y2, z2]: Position) {
    const x = x2 - x1
    const y = y2 - y1
    const z = z2 - z1
    return x * x + y * y + z * z
}

function getConnectors(stars: Star[]) {
    const connectors = new Map<Star, Star[]>()
    const lines = new Map<Star, Set<Star>>()

    function addLine(star1: Star, star2: Star) {
        if (lines.has(star1)) {
            lines.get(star1)!.add(star2)
        } else {
            lines.set(star1, new Set([star2]))
        }
        if (lines.has(star2)) {
            lines.get(star2)!.add(star1)
        } else {
            lines.set(star2, new Set([star1]))
        }
    }

    function removeLine(star1: Star, star2: Star) {
        lines.get(star1)?.delete(star2)
        lines.get(star2)?.delete(star1)
    }

    for (const star of stars) {
        const conns: Star[] = []
        connectors.set(star, conns)
        for (let i = 0; i < star.index; ++i) {
            const otherStar = stars[i]!
            const dist = sqrDistance(star.position, otherStar.position)
            if (dist < 64) {
                conns.push(otherStar)
                const otherConns = connectors.get(otherStar)!
                otherConns.push(star)
                otherConns.sort((a, b) => a.index - b.index)
            }
        }
        const tmpState: Record<number, number> = {}
        conns.forEach((otherStar, index1) => {
            const otherConns = connectors.get(otherStar)!
            for (let index2 = index1 + 1; index2 < conns.length; ++index2) {
                const thirdStar = conns[index2]!
                const hasTrangle = otherConns.find((s) => s === thirdStar)
                if (hasTrangle) {
                    const dist12 = sqrDistance(
                        star.position,
                        otherStar.position,
                    )
                    const dist13 = sqrDistance(
                        star.position,
                        thirdStar.position,
                    )
                    const dist23 = sqrDistance(
                        otherStar.position,
                        thirdStar.position,
                    )
                    const maxDist = Math.max(dist12, dist13, dist23)
                    if (maxDist === dist12) {
                        tmpState[index1] = -1
                        removeLine(star, otherStar)
                    } else if (tmpState[index1] === undefined) {
                        tmpState[index1] = 1
                        addLine(star, otherStar)
                    }
                    if (maxDist === dist13) {
                        tmpState[index2] = -1
                        removeLine(star, thirdStar)
                    } else if (tmpState[index2] === undefined) {
                        tmpState[index2] = 1
                        addLine(star, thirdStar)
                    }
                    if (maxDist === dist23) {
                        removeLine(otherStar, thirdStar)
                    }
                }
            }
            if (tmpState[index1] === undefined) {
                addLine(star, otherStar)
                tmpState[index1] = 1
            }
        })
    }

    const output: [Position, Position][] = Array.from(lines.entries()).flatMap(
        ([s1, conns]) =>
            [...conns]
                .filter((s2) => s1.index < s2.index)
                .map((s2) => [s1.position, s2.position]),
    )
    return output
}

const StarNode: FC<{
    star: Star
    seed: number
    search: string
    displayName?: string
    enhanced: boolean
    pixelsPerUnit: number | null
}> = (props) => {
    const navigate = useNavigate()
    const [hover, setHover] = useLiveState(false)
    const [focused, setFocused] = useLiveState(false)
    const [dismissed, setDismissed] = useLiveState(false)
    const node = useRef<SVGCircleElement>(null)
    const popup = useRef<HTMLAnchorElement>(null)
    const popupId = useId()
    const gradientId = useId()
    const highlighted = hover() || focused()
    const visible = highlighted && !dismissed()
    const color = `rgb(${getGalaxyStarColor(props.star).join(", ")})`
    const url = `/galaxy/${props.seed}/${props.star.index}${props.search}`

    useEffect(() => {
        if (!visible) return
        const nodeElement = node.current
        const popupElement = popup.current
        if (!nodeElement || !popupElement) return
        let active = true
        let requestId = 0
        popupElement.style.visibility = "hidden"
        const placePopup = () => {
            const id = ++requestId
            void computePosition(nodeElement, popupElement, {
                strategy: "fixed",
                placement: "top",
                middleware: [flip({ fallbackPlacements: ["bottom"] })],
            })
                .then(({ x, y }) => {
                    if (
                        !active ||
                        id !== requestId ||
                        node.current !== nodeElement ||
                        popup.current !== popupElement ||
                        !nodeElement.isConnected ||
                        !popupElement.isConnected
                    )
                        return
                    popupElement.style.left = `${x}px`
                    popupElement.style.top = `${y}px`
                    popupElement.style.visibility = "visible"
                })
                .catch(() => {
                    /* Positioning is optional; the star itself remains navigable. */
                })
        }
        placePopup()
        window.addEventListener("resize", placePopup)
        window.addEventListener("scroll", placePopup, true)
        return () => {
            active = false
            window.removeEventListener("resize", placePopup)
            window.removeEventListener("scroll", placePopup, true)
        }
    }, [visible, props.star, url])

    const size = getStellarDiskRadius(props.star)
    const x = props.star.position[0]
    const y = -props.star.position[2]
    const highlightRadius =
        size + (props.pixelsPerUnit ? 3 / props.pixelsPerUnit : 0.3)
    const dashRadius = highlightRadius * (props.pixelsPerUnit ?? 1)
    const starStyle: SVGProps<SVGCircleElement> = {
        r: size,
        cx: x,
        cy: y,
        fill: "transparent",
        strokeWidth: 8,
        stroke: "transparent",
        vectorEffect: "non-scaling-stroke",
        role: "link",
        tabIndex: 0,
        "aria-label": `${props.displayName ?? props.star.name}, #${props.star.index + 1}`,
        "aria-describedby": visible ? popupId : undefined,
        onClick: () => navigate(url),
        onMouseEnter: () => {
            setHover(true)
            setDismissed(false)
        },
        onMouseLeave: () => setHover(false),
        onFocus: () => {
            setFocused(true)
            setDismissed(false)
        },
        onBlur: () => setFocused(false),
        onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                navigate(url)
            }
            if (event.key === "Escape") {
                setHover(false)
                setDismissed(true)
            }
        },
    }

    return (
        <>
            <defs>
                <radialGradient id={gradientId} cx="40%" cy="35%" r="65%">
                    <stop offset="0" stopColor="#fffdf3" />
                    <stop offset="0.32" stopColor={color} />
                    <stop offset="0.76" stopColor={color} stopOpacity="0.94" />
                    <stop offset="1" stopColor={color} stopOpacity="0.4" />
                </radialGradient>
            </defs>
            <g aria-hidden="true" pointerEvents="none">
                {!props.enhanced && (
                    <g data-star-fallback={props.star.index}>
                        <circle
                            cx={x}
                            cy={y}
                            r={size * 1.9}
                            fill={color}
                            opacity={0.07}
                        />
                        {props.star.type === StarType.BlackHole ? (
                            <>
                                <ellipse
                                    cx={x}
                                    cy={y}
                                    rx={size * 1.8}
                                    ry={size * 0.65}
                                    transform={`rotate(-24 ${x} ${y})`}
                                    fill="none"
                                    stroke="#f4bf83"
                                    strokeWidth={0.14}
                                />
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={size}
                                    fill="#030710"
                                    stroke="#dfb2ff"
                                    strokeWidth={0.07}
                                />
                            </>
                        ) : (
                            <>
                                {props.star.type === StarType.NeutronStar && (
                                    <path
                                        d={`M ${x - size * 0.6} ${y + size * 2.4} L ${x + size * 0.6} ${y - size * 2.4}`}
                                        stroke="#bddfff"
                                        strokeWidth={0.09}
                                        opacity={0.8}
                                    />
                                )}
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={size}
                                    fill={`url(#${gradientId})`}
                                />
                            </>
                        )}
                    </g>
                )}
                {props.star.index === 0 && (
                    <circle
                        r={size + 0.3}
                        cx={x}
                        cy={y}
                        fill="none"
                        stroke="#56d697"
                        strokeWidth={1.2}
                        vectorEffect="non-scaling-stroke"
                    />
                )}
                {highlighted && (
                    <circle
                        data-star-highlight={props.star.index}
                        r={highlightRadius}
                        cx={x}
                        cy={y}
                        fill="none"
                        stroke="#dcf2ff"
                        strokeWidth={1.3}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={`${dashRadius * Math.PI * 0.34} ${dashRadius * Math.PI * 0.16}`}
                    />
                )}
            </g>
            <circle ref={node} className={styles.star} {...starStyle} />
            {createPortal(
                <Link
                    id={popupId}
                    to={url}
                    ref={popup}
                    tabIndex={-1}
                    style={{ color, display: visible ? "block" : "none" }}
                    className={styles.popup}
                >
                    {props.displayName ?? props.star.name}
                </Link>,
                document.getElementById("portal") ?? document.body,
            )}
        </>
    )
}

const Starmap: FC<{
    galaxy: Galaxy
    search: string
    displayNames?: ReadonlyMap<number, string>
    animationEnabled?: boolean
    onAnimationStatus?: (status: GalaxyAnimationStatus) => void
}> = (props) => {
    const { t } = useLingui()
    const bounds = useMemo(
        () => getGalaxyBounds(props.galaxy.stars),
        [props.galaxy.stars],
    )
    const svg = useRef<SVGSVGElement>(null)
    const connectorMaskId = useId()
    const [pixelsPerUnit, setPixelsPerUnit] = useState<number | null>(null)
    const [animationStatus, setAnimationStatus] =
        useState<GalaxyAnimationStatus>("loading")
    const reportAnimationStatus = useCallback(
        (status: GalaxyAnimationStatus) => {
            setAnimationStatus(status)
            props.onAnimationStatus?.(status)
        },
        [props.onAnimationStatus],
    )
    useEffect(() => {
        const element = svg.current
        if (!element) return
        const measure = () => {
            const { width, height } = element.getBoundingClientRect()
            setPixelsPerUnit(
                width > 0 && height > 0
                    ? fitGalaxyCamera(bounds, width, height).pixelsPerUnit
                    : null,
            )
        }
        measure()
        const observer =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(measure)
                : undefined
        observer?.observe(element)
        window.addEventListener("resize", measure)
        return () => {
            observer?.disconnect()
            window.removeEventListener("resize", measure)
        }
    }, [bounds])
    const enhanced =
        animationStatus === "animated" || animationStatus === "static"
    return (
        <div
            className={styles.stage}
            data-stellar-renderer={enhanced ? "webgl" : "svg"}
        >
            <GalaxyAnimation
                galaxy={props.galaxy}
                bounds={bounds}
                enabled={props.animationEnabled ?? true}
                onStatus={reportAnimationStatus}
            />
            <svg
                ref={svg}
                viewBox={bounds.join(" ")}
                preserveAspectRatio="xMidYMid meet"
                role="group"
                aria-label={t`Starmap`}
                className={styles.starmap}
            >
                <defs>
                    <mask
                        id={connectorMaskId}
                        maskUnits="userSpaceOnUse"
                        x={bounds[0]}
                        y={bounds[1]}
                        width={bounds[2]}
                        height={bounds[3]}
                    >
                        <rect
                            x={bounds[0]}
                            y={bounds[1]}
                            width={bounds[2]}
                            height={bounds[3]}
                            fill="white"
                        />
                        {props.galaxy.stars.map((star) => (
                            <circle
                                key={star.index}
                                data-star-occlusion={star.index}
                                cx={star.position[0]}
                                cy={-star.position[2]}
                                r={getStellarDiskRadius(star) + 0.06}
                                fill="black"
                            />
                        ))}
                    </mask>
                </defs>
                <g
                    mask={`url(#${connectorMaskId})`}
                    aria-hidden="true"
                    pointerEvents="none"
                >
                    {getConnectors(props.galaxy.stars).map(
                        ([[x1, , y1], [x2, , y2]], index) => (
                            <line
                                key={index}
                                x1={x1}
                                y1={-y1}
                                x2={x2}
                                y2={-y2}
                                strokeWidth={0.07}
                                stroke="currentColor"
                                className={styles.connector}
                            />
                        ),
                    )}
                </g>
                {props.galaxy.stars
                    .toSorted((a, b) => a.position[1] - b.position[1])
                    .map((star) => (
                        <StarNode
                            key={star.index}
                            star={star}
                            seed={props.galaxy.seed}
                            search={props.search}
                            enhanced={enhanced}
                            pixelsPerUnit={pixelsPerUnit}
                            displayName={props.displayNames?.get(star.index)}
                        />
                    ))}
            </svg>
        </div>
    )
}

export default Starmap
