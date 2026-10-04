import {
    useEffect,
    useId,
    useRef,
    useMemo,
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
import { getGalaxyBounds, getGalaxyStarColor } from "./GalaxyAnimation.math"

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
}> = (props) => {
    const navigate = useNavigate()
    const [hover, setHover] = useLiveState(false)
    const [focused, setFocused] = useLiveState(false)
    const node = useRef<SVGCircleElement>(null)
    const popup = useRef<HTMLAnchorElement>(null)
    const popupId = useId()
    const visible = hover() || focused()
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

    const size =
        props.star.type === StarType.GiantStar
            ? 0.8
            : props.star.type === StarType.WhiteDwarf
              ? 0.2
              : 0.4
    const starStyle: SVGProps<SVGCircleElement> = {
        r: size,
        cx: props.star.position[0],
        cy: -props.star.position[2],
        fill: color,
        strokeWidth: focused() ? 0.12 : 1,
        stroke: focused() ? "#ffffff" : "transparent",
        role: "link",
        tabIndex: 0,
        "aria-label": `${props.displayName ?? props.star.name}, #${props.star.index + 1}`,
        "aria-describedby": visible ? popupId : undefined,
        onClick: () => navigate(url),
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                navigate(url)
            }
            if (event.key === "Escape") {
                setHover(false)
                setFocused(false)
            }
        },
    }

    return (
        <>
            {props.star.index === 0 && (
                <circle
                    r={0.7}
                    cx={props.star.position[0]}
                    cy={-props.star.position[2]}
                    fill="none"
                    stroke="#56d697"
                    strokeWidth={0.14}
                    aria-hidden="true"
                />
            )}
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
    return (
        <div className={styles.stage}>
            <GalaxyAnimation
                galaxy={props.galaxy}
                bounds={bounds}
                enabled={props.animationEnabled ?? true}
                onStatus={props.onAnimationStatus}
            />
            <svg
                viewBox={bounds.join(" ")}
                preserveAspectRatio="xMidYMid meet"
                role="group"
                aria-label={t`Starmap`}
                className={styles.starmap}
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
                {props.galaxy.stars
                    .toSorted((a, b) => a.position[1] - b.position[1])
                    .map((star) => (
                        <StarNode
                            key={star.index}
                            star={star}
                            seed={props.galaxy.seed}
                            search={props.search}
                            displayName={props.displayNames?.get(star.index)}
                        />
                    ))}
            </svg>
        </div>
    )
}

export default Starmap
