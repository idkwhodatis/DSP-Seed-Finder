import GameIcon from "../components/GameIcon"
import StarTypeIcon from "../components/StarTypeIcon"
import { useObjectState } from "../hooks/useLiveState"
import { GasType, OceanType, PlanetType, StarType, VeinType } from "../enums"
import {
    distanceFromBirth,
    formatNumber,
    furthestDistanceFrom,
    gasOrder,
    metersPerAU,
    nearestDistanceFrom,
    romans,
    statVein,
    toPrecision,
    veinOrder,
} from "../util"
import styles from "~styles"
import { type FC, Fragment } from "react"
import { ChevronDown as IoChevronDown } from "lucide-react"
import clsx from "clsx"
import { Link } from "react-router-dom"
import Tooltip from "../components/Tooltip"
import { Trans, useLingui } from "#lingui"
import {
    useGasTypeNames,
    usePlanetTypeNames,
    useStarTypeFullName,
    useVeinNames,
} from "../names"
function combineVeins(star: Star): VeinStat[] {
    const veins: Record<VeinType, VeinStat> = {} as any
    for (const planet of star.planets) {
        if ("veins" in planet) {
            for (const vein of planet.veins) {
                const stat = statVein(vein)
                const existing = veins[vein.veinType]
                if (existing) {
                    existing.min += stat.min
                    existing.max += stat.max
                    existing.avg += stat.avg
                } else {
                    veins[vein.veinType] = {
                        ...stat,
                    }
                }
            }
        } else {
            for (const vein of planet.actualVeins) {
                const existing = veins[vein.veinType]
                if (existing) {
                    existing.avg += vein.amount
                } else {
                    veins[vein.veinType] = {
                        veinType: vein.veinType,
                        min: 0,
                        max: 0,
                        avg: vein.amount,
                    }
                }
            }
        }
    }
    return veinOrder.map((type) => veins[type]).filter((x) => x)
}
function combineGases(star: Star): Gas[] {
    const veins: Record<GasType, float> = {} as any
    for (const planet of star.planets) {
        for (const [type, amount] of planet.gases) {
            veins[type] ??= 0
            veins[type] += amount
        }
    }
    return gasOrder
        .filter((type) => veins[type])
        .map((type) => [type, veins[type]])
}
function hasWater(star: Star): boolean {
    return !!star.planets.find(
        (planet) => planet.theme.waterItemId === OceanType.Water,
    )
}
function hasSulfur(star: Star): boolean {
    return !!star.planets.find(
        (planet) => planet.theme.waterItemId === OceanType.Sulfur,
    )
}
function planetVeins(planet: Planet): VeinStat[] {
    const veins: Record<VeinType, VeinStat> = {} as any
    if ("veins" in planet) {
        for (const vein of planet.veins) {
            veins[vein.veinType] = statVein(vein)
        }
    } else {
        for (const vein of planet.actualVeins) {
            veins[vein.veinType] = {
                veinType: vein.veinType,
                min: 0,
                max: 0,
                avg: vein.amount,
            }
        }
    }
    return veinOrder.map((type) => veins[type]).filter((x) => x)
}
function planetGases(planet: Planet): Gas[] {
    const veins: Record<GasType, float> = {} as any
    for (const [type, amount] of planet.gases) {
        veins[type] ??= 0
        veins[type] += amount
    }
    return gasOrder
        .filter((type) => veins[type])
        .map((type) => [type, veins[type]])
}
function formatVein(amount: number, isOil: boolean): string {
    if (isOil) {
        return formatNumber(amount * 4e-5, 2) + " /s"
    } else {
        return toPrecision(amount, 0)
    }
}
function nearbyStars(
    star: Star,
    stars: Star[],
): {
    star: Star
    distance: float
}[] {
    const [x1, y1, z1] = star.position
    const result = stars
        .filter((s) => s.index !== star.index)
        .map((s) => {
            const [x2, y2, z2] = s.position
            const dx = x1 - x2
            const dy = y1 - y2
            const dz = z1 - z2
            return {
                star: s,
                distance: Math.sqrt(dx * dx + dy * dy + dz * dz),
            }
        })
    result.sort((a, b) => a.distance - b.distance)
    return result
}
const Expand: FC<{
    expand: boolean
    toggle: () => void
}> = (props) => {
    const { t } = useLingui()
    return (
        <button
            type="button"
            aria-expanded={props.expand}
            aria-label={
                props.expand ? t`Collapse star details` : t`Expand star details`
            }
            className={clsx(styles.expand, props.expand && styles.expanded)}
            style={{ background: "transparent", border: 0, padding: 0 }}
            onClick={props.toggle}
        >
            <IoChevronDown />
        </button>
    )
}
const XStarText: FC = () => {
    const { t } = useLingui()
    return <Tooltip text={t`Black Hole / Neutron Star`}>{t`X star`}</Tooltip>
}
const StarDetail: FC<{
    star: Star
    expand: boolean
    positions?: Position[]
}> = (props) => {
    const { t } = useLingui()
    const getStarType = useStarTypeFullName()
    return (
        <>
            <div className={styles.row}>
                <div className={styles.field}>{t`Type`}</div>
                <div className={styles.value}>
                    <StarTypeIcon star={props.star} />
                    {getStarType(props.star)}
                </div>
            </div>
            <div className={styles.row}>
                <div className={styles.field}>{t`Spectral class`}</div>
                <div className={styles.value}>{props.star.spectr}</div>
            </div>
            <div className={styles.row}>
                <div className={styles.field}>{t`Luminosity`}</div>
                <div className={styles.value}>
                    {formatNumber(props.star.luminosity, 3)} L
                </div>
            </div>
            <div className={styles.row}>
                <div className={styles.field}>{t`Distance from start`}</div>
                <div className={styles.value}>
                    {formatNumber(distanceFromBirth(props.star.position), 1)} ly
                </div>
            </div>
            {props.positions ? (
                <>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <Trans>
                                Distance from nearest <XStarText />
                            </Trans>
                        </div>
                        <div className={styles.value}>
                            {formatNumber(
                                nearestDistanceFrom(
                                    props.star.position,
                                    props.positions!,
                                ),
                                1,
                            )}{" "}
                            ly
                        </div>
                    </div>
                </>
            ) : null}
            {props.positions ? (
                <>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <Trans>
                                Distance from furthest <XStarText />
                            </Trans>
                        </div>
                        <div className={styles.value}>
                            {formatNumber(
                                furthestDistanceFrom(
                                    props.star.position,
                                    props.positions!,
                                ),
                                1,
                            )}{" "}
                            ly
                        </div>
                    </div>
                </>
            ) : null}
            <div className={styles.row}>
                <div className={styles.field}>{t`Max dyson sphere radius`}</div>
                <div className={styles.value}>
                    {toPrecision(props.star.dysonRadius, 0)} m
                </div>
            </div>
            <div className={styles.row}>
                <div className={styles.field}>{t`Initial number of hives`}</div>
                <div className={styles.value}>
                    {props.star.initialHiveCount}
                </div>
            </div>
            <div className={styles.row}>
                <div className={styles.field}>{t`Maximum number of hives`}</div>
                <div className={styles.value}>{props.star.maxHiveCount}</div>
            </div>
            {props.expand ? (
                <>
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Radius`}</div>
                        <div className={styles.value}>
                            {toPrecision(props.star.radius * 1600, 0)} m
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Mass`}</div>
                        <div className={styles.value}>
                            {formatNumber(props.star.mass, 3)} M
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Temperature`}</div>
                        <div className={styles.value}>
                            {toPrecision(props.star.temperature, 0)} K
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Age`}</div>
                        <div className={styles.value}>
                            {toPrecision(
                                props.star.age * props.star.lifetime,
                                0,
                            )}{" "}
                            Myrs
                        </div>
                    </div>
                </>
            ) : null}
        </>
    )
}
const Vein: FC<{
    stat: VeinStat
    className?: string
}> = (props) => {
    const isOil = () => props.stat.veinType === VeinType.Oil
    const avg = () => formatVein(props.stat.avg, isOil())
    const min = () => formatVein(props.stat.min, isOil())
    const max = () => formatVein(props.stat.max, isOil())
    const { t } = useLingui()
    return (
        <div className={props.className}>
            {props.stat.min !== props.stat.max ? (
                <>
                    ~{" "}
                    <Tooltip text={t`Estimated:\n${min()} - ${max()}`}>
                        {avg()}
                    </Tooltip>
                </>
            ) : (
                avg()
            )}
        </div>
    )
}
const StarVeins: FC<{
    star: Star
}> = (props) => {
    const { t } = useLingui()
    const veinNames = useVeinNames()
    const gasTypeNames = useGasTypeNames()
    return (
        <>
            {combineVeins(props.star).map((vein, _index) => (
                <Fragment key={_index}>
                    {
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <GameIcon vein={vein.veinType} />
                                {veinNames[vein.veinType]()}
                            </div>
                            <Vein className={styles.value} stat={vein} />
                        </div>
                    }
                </Fragment>
            ))}
            {hasWater(props.star) ? (
                <>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <GameIcon ocean={OceanType.Water} />
                            {t`Water`}
                        </div>
                        <div className={styles.value}>{t`Ocean`}</div>
                    </div>
                </>
            ) : null}
            {hasSulfur(props.star) ? (
                <>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <GameIcon ocean={OceanType.Sulfur} />
                            {t`Sulfuric Acid`}
                        </div>
                        <div className={styles.value}>{t`Ocean`}</div>
                    </div>
                </>
            ) : null}
            {combineGases(props.star).map(([type, amount], _index2) => (
                <Fragment key={_index2}>
                    {
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <GameIcon gas={type} />
                                {gasTypeNames[type]()}
                            </div>
                            <div className={styles.value}>
                                {formatNumber(amount, 4)} /s
                            </div>
                        </div>
                    }
                </Fragment>
            ))}
        </>
    )
}
const NearbyStar: FC<{
    seed: integer
    star: Star
    distance: float
    url: string
    newPage?: boolean
    displayNames?: ReadonlyMap<number, string>
}> = (props) => {
    const getStarType = useStarTypeFullName()
    return (
        <Link
            to={props.url}
            target={props.newPage ? "_blank" : undefined}
            className={clsx(styles.row, styles.nearbyRow)}
        >
            <div className={styles.nearbyName}>
                <StarTypeIcon star={props.star} />
                <span>
                    {props.displayNames?.get(props.star.index) ??
                        props.star.name}
                </span>
                <span className={styles.index}>#{props.star.index + 1}</span>
            </div>
            <div>
                <span className={styles.nearbyType}>
                    {getStarType(props.star)}
                </span>
                <span className={styles.nearbyDistance}>
                    {formatNumber(props.distance, 1)} ly
                </span>
            </div>
        </Link>
    )
}
const PlanetView: FC<{
    star: Star
    planet: Planet
    displayNames?: ReadonlyMap<number, string>
}> = (props) => {
    function isGas() {
        return props.planet.type === PlanetType.Gas
    }
    const { t } = useLingui()
    const veinNames = useVeinNames()
    const gasTypeNames = useGasTypeNames()
    const planetTypes = usePlanetTypeNames()
    return (
        <article
            id={`star-${props.star.index}-planet-${props.planet.index}`}
            className={clsx(styles.card, styles.planet)}
            aria-labelledby={`star-${props.star.index}-planet-${props.planet.index}-name`}
        >
            <h3
                id={`star-${props.star.index}-planet-${props.planet.index}-name`}
                className={styles.planetName}
            >
                <span className={styles.planetNumber}>
                    {romans[props.planet.index]}
                </span>
                {props.displayNames?.get(props.star.index) ?? props.star.name}{" "}
                {romans[props.planet.index]}
            </h3>
            {isGas() ? (
                <>
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Type`}</div>
                        <div className={styles.value}>
                            {props.planet.gases.find(
                                ([g]) => g === GasType.Deuterium,
                            )
                                ? t`Gas Giant`
                                : t`Ice Giant`}
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Orbit radius`}</div>
                        <div className={styles.value}>
                            {toPrecision(
                                props.planet.orbitRadius * metersPerAU,
                                0,
                            )}{" "}
                            m
                        </div>
                    </div>
                </>
            ) : null}
            {!isGas() ? (
                <>
                    {props.planet.orbitAround != null ? (
                        <>
                            <div className={styles.row}>{t`Satellite`}</div>
                        </>
                    ) : null}
                    {props.planet.orbitalPeriod ===
                    props.planet.rotationPeriod ? (
                        <>
                            <div
                                className={styles.row}
                            >{t`Tidally locked`}</div>
                        </>
                    ) : null}
                    {props.planet.orbitalPeriod * 0.5 ===
                    props.planet.rotationPeriod ? (
                        <>
                            <div
                                className={styles.row}
                            >{t`Orbital resonance 1 : 2`}</div>
                        </>
                    ) : null}
                    {props.planet.orbitalPeriod * 0.25 ===
                    props.planet.rotationPeriod ? (
                        <>
                            <div
                                className={styles.row}
                            >{t`Orbital resonance 1 : 4`}</div>
                        </>
                    ) : null}
                    {Math.abs(props.planet.obliquity) > 70 ? (
                        <>
                            <div
                                className={styles.row}
                            >{t`Horizontal rotation`}</div>
                        </>
                    ) : null}
                    {props.planet.orbitAround == null ? (
                        <>
                            <div className={styles.row}>
                                <div
                                    className={styles.field}
                                >{t`Orbit radius`}</div>
                                <div className={styles.value}>
                                    {toPrecision(
                                        props.planet.orbitRadius * metersPerAU,
                                        0,
                                    )}{" "}
                                    m
                                </div>
                            </div>
                        </>
                    ) : null}
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Wind power`}</div>
                        <div className={styles.value}>
                            {toPrecision(props.planet.theme.wind * 100, 0)}%
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Solar power`}</div>
                        <div className={styles.value}>
                            {toPrecision(props.planet.luminosity * 100, 0)}%
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>{t`Type`}</div>
                        <div className={styles.value}>
                            {planetTypes[props.planet.theme.id]?.() ||
                                props.planet.theme.id}
                        </div>
                    </div>
                </>
            ) : null}
            {planetVeins(props.planet).map((vein, _index3) => (
                <Fragment key={_index3}>
                    {
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <GameIcon vein={vein.veinType} />
                                {veinNames[vein.veinType]()}
                            </div>
                            <Vein className={styles.value} stat={vein} />
                        </div>
                    }
                </Fragment>
            ))}
            {props.planet.theme.waterItemId === OceanType.Water ? (
                <>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <GameIcon ocean={OceanType.Water} />
                            {t`Water`}
                        </div>
                        <div className={styles.value}>{t`Ocean`}</div>
                    </div>
                </>
            ) : null}
            {props.planet.theme.waterItemId === OceanType.Sulfur ? (
                <>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <GameIcon ocean={OceanType.Sulfur} />
                            {t`Sulfuric Acid`}
                        </div>
                        <div className={styles.value}>{t`Ocean`}</div>
                    </div>
                </>
            ) : null}
            {planetGases(props.planet).map(([type, amount], _index4) => (
                <Fragment key={_index4}>
                    {
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <GameIcon gas={type} />
                                {gasTypeNames[type]()}
                            </div>
                            <div className={styles.value}>
                                {formatNumber(amount, 4)} /s
                            </div>
                        </div>
                    }
                </Fragment>
            ))}
        </article>
    )
}
const StarView: FC<{
    star: Star
    galaxy?: Galaxy
    buildUrl: (starIndex: integer) => string
    newPage?: boolean
    displayNames?: ReadonlyMap<number, string>
}> = (props) => {
    const [expand, setExpand] = useObjectState({
        detail: false,
        planets: {} as Record<number, boolean>,
    })
    const xStarPostions = () =>
        props.galaxy?.stars
            .filter(
                (star) =>
                    star.type === StarType.BlackHole ||
                    star.type === StarType.NeutronStar,
            )
            .map((star) => star.position)
    const { t } = useLingui()
    return (
        <div className={styles.view}>
            <div className={styles.main}>
                <section className={styles.card}>
                    <Expand
                        expand={expand.detail}
                        toggle={() => setExpand("detail", (x) => !x)}
                    />
                    <h1 className={clsx(styles.title, styles.starTitle)}>
                        <StarTypeIcon star={props.star} size={24} />
                        <span>
                            {props.displayNames?.get(props.star.index) ??
                                props.star.name}
                        </span>
                        <span className={styles.index}>
                            #{props.star.index + 1}
                        </span>
                    </h1>
                    <nav
                        className={styles.planetNav}
                        aria-label={t`Jump to planet`}
                    >
                        <span className={styles.planetNavLabel}>
                            {t`Planets`} · {props.star.planets.length}
                        </span>
                        {props.star.planets.map((planet) => (
                            <a
                                key={planet.index}
                                className={styles.planetLink}
                                href={`#star-${props.star.index}-planet-${planet.index}`}
                            >
                                {romans[planet.index]}
                            </a>
                        ))}
                    </nav>
                    <StarDetail
                        star={props.star}
                        expand={expand.detail}
                        positions={xStarPostions()}
                    />
                </section>
                <section className={styles.card}>
                    <h2 className={styles.title}>{t`Resources`}</h2>
                    <StarVeins star={props.star} />
                </section>
            </div>
            <section className={styles.planets} aria-label={t`Planets`}>
                <h2 className={styles.title}>
                    {t`Planets`}{" "}
                    <span className={styles.count}>
                        {props.star.planets.length}
                    </span>
                </h2>

                <div className={styles.planetGrid}>
                    {props.star.planets.map((planet) => (
                        <PlanetView
                            key={planet.index}
                            star={props.star}
                            planet={planet}
                            displayNames={props.displayNames}
                        />
                    ))}
                </div>
            </section>
            {props.galaxy && (
                <details className={clsx(styles.card, styles.nearby)}>
                    <summary className={styles.title}>
                        {t`Nearby Stars`}{" "}
                        <span className={styles.count}>
                            {props.galaxy.stars.length - 1}
                        </span>
                    </summary>
                    <div className={styles.nearbyList}>
                        {nearbyStars(props.star, props.galaxy.stars).map(
                            ({ star, distance }) => (
                                <NearbyStar
                                    key={star.index}
                                    seed={props.galaxy!.seed}
                                    star={star}
                                    distance={distance}
                                    url={props.buildUrl(star.index)}
                                    newPage={props.newPage}
                                    displayNames={props.displayNames}
                                />
                            ),
                        )}
                    </div>
                </details>
            )}
        </div>
    )
}
export default StarView
