import type { CSSProperties } from "react"
import { SpectrType, StarType } from "../enums"
import atlas from "./StarTypeIcon.atlas.json"
import styles from "./StarTypeIcon.module.css"

type SpriteName = keyof typeof atlas
type StarAppearance = {
    sprite: SpriteName
    filter?: string
}

const spectra: Record<SpectrType, StarAppearance> = {
    [SpectrType.M]: { sprite: "red" },
    [SpectrType.K]: { sprite: "orange" },
    [SpectrType.G]: { sprite: "yellow" },
    [SpectrType.F]: {
        sprite: "yellow",
        filter: "saturate(0.3) brightness(1.15)",
    },
    [SpectrType.A]: { sprite: "white" },
    [SpectrType.B]: { sprite: "blue-flare", filter: "saturate(0.55)" },
    [SpectrType.O]: { sprite: "blue-flare", filter: "saturate(1.8)" },
    [SpectrType.X]: { sprite: "white" },
}

function giantAppearance(spectr: SpectrType): StarAppearance {
    switch (spectr) {
        case SpectrType.M:
        case SpectrType.K:
            return {
                sprite: "yellow-flare",
                filter: "hue-rotate(-35deg) saturate(1.8)",
            }
        case SpectrType.G:
        case SpectrType.F:
            return { sprite: "yellow-flare" }
        case SpectrType.A:
            return {
                sprite: "blue-flare",
                filter: "saturate(0) brightness(1.15)",
            }
        default:
            return { sprite: "blue-flare", filter: "saturate(1.8)" }
    }
}

export const starIconAttributionHref = `${import.meta.env.BASE_URL}icons/stars/ATTRIBUTION.html`

export type StarTypeIconProps = {
    star: Pick<Star, "type" | "spectr">
    /** Square layout footprint in CSS pixels. Defaults to the resource-icon size. */
    size?: number
    className?: string
    /** Supply a localized label only when no adjacent textual star type is present. */
    label?: string
}

/** Licensed PNG art. Decorative beside the existing localized star-type label. */
export default function StarTypeIcon({
    star,
    size = 18,
    className,
    label,
}: StarTypeIconProps) {
    const iconSize = Number.isFinite(size) && size > 0 ? size : 18
    let appearance = spectra[star.spectr] ?? spectra[SpectrType.X]
    let fraction = 0.84
    if (star.type === StarType.GiantStar) {
        appearance = giantAppearance(star.spectr)
        fraction = 1
    } else if (star.type === StarType.WhiteDwarf) {
        appearance = { sprite: "white" }
        fraction = 0.64
    } else if (star.type === StarType.NeutronStar) {
        appearance = { sprite: "neutron" }
        fraction = 0.5
    } else if (star.type === StarType.BlackHole) {
        appearance = { sprite: "black-hole" }
        fraction = 1
    }

    const sprite = atlas[appearance.sprite]
    const scale = (iconSize * fraction) / Math.max(sprite.width, sprite.height)
    const artStyle: CSSProperties = {
        width: sprite.width * scale,
        height: sprite.height * scale,
        backgroundImage: `url("${import.meta.env.BASE_URL}icons/stars/hjm-sun-types.68c53d45d1896366.png")`,
        backgroundPosition: `${-sprite.x * scale}px ${-sprite.y * scale}px`,
        backgroundSize: `${2400 * scale}px ${1051 * scale}px`,
        filter: appearance.filter,
    }
    const accessibleLabel = label?.trim() || undefined

    return (
        <span
            role={accessibleLabel ? "img" : undefined}
            aria-label={accessibleLabel}
            aria-hidden={accessibleLabel ? undefined : true}
            className={[styles.icon, className].filter(Boolean).join(" ")}
            data-star-type={star.type}
            data-star-spectr={star.spectr}
            data-star-icon={appearance.sprite}
            style={{ width: iconSize, height: iconSize, flexBasis: iconSize }}
        >
            <span className={styles.art} style={artStyle} />
        </span>
    )
}
