import type { CSSProperties } from "react"
import { GasType, OceanType, VeinType } from "../enums"
import atlas from "./GameIcon.atlas.json"
import styles from "./GameIcon.module.css"

type IconName = keyof typeof atlas

export const veinIcons: Partial<Record<VeinType, IconName>> = {
    [VeinType.Iron]: "iron-ore",
    [VeinType.Copper]: "copper-ore",
    [VeinType.Silicium]: "silicium-ore",
    [VeinType.Titanium]: "titanium-ore",
    [VeinType.Stone]: "stone-ore",
    [VeinType.Coal]: "coal-ore",
    [VeinType.Oil]: "oil",
    [VeinType.Fireice]: "gas-hydrate",
    [VeinType.Diamond]: "diamond-ore",
    [VeinType.Fractal]: "fractal-silica",
    [VeinType.Crysrub]: "crystal-rubber",
    [VeinType.Grat]: "grating-ore",
    [VeinType.Bamboo]: "bamboo-crystal",
    [VeinType.Mag]: "mono-mag-ore",
}

export const gasIcons: Partial<Record<GasType, IconName>> = {
    [GasType.Fireice]: "gas-hydrate",
    [GasType.Hydrogen]: "hydrogen",
    [GasType.Deuterium]: "deuterium",
}

export const oceanIcons: Partial<Record<OceanType, IconName>> = {
    [OceanType.Water]: "water",
    [OceanType.Sulfur]: "sulphuric-acid",
}

type GameIconProps = (
    | { vein: VeinType; gas?: never; ocean?: never }
    | { gas: GasType; vein?: never; ocean?: never }
    | { ocean: OceanType; vein?: never; gas?: never }
) & { className?: string }

/** Decorative resource art: the adjacent, translated name remains the label. */
export default function GameIcon(props: GameIconProps) {
    const name =
        props.vein !== undefined
            ? veinIcons[props.vein]
            : props.gas !== undefined
              ? gasIcons[props.gas]
              : oceanIcons[props.ocean]
    if (!name) return null

    const sprite = atlas[name]
    const scale = 18 / sprite.width
    const style: CSSProperties = {
        backgroundImage: `url("${import.meta.env.BASE_URL}icons/Vanilla.a5875c769e5d3076.png")`,
        backgroundPosition: `${-sprite.x * scale}px ${-sprite.y * scale}px`,
        backgroundSize: `${sprite.total_width * scale}px ${sprite.total_height * scale}px`,
    }

    return (
        <span
            aria-hidden="true"
            className={[styles.icon, props.className].filter(Boolean).join(" ")}
            data-resource-icon={name}
            style={style}
        />
    )
}
