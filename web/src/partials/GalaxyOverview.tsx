import GameIcon from "../components/GameIcon"
import StarTypeIcon, {
    starIconAttributionHref,
} from "../components/StarTypeIcon"
import styles from "~styles"
import Starmap from "./Starmap"
import { type FC, Fragment } from "react"
import { useLingui } from "#lingui"
import { useStarTypeFullName, useVeinNames, useGasTypeNames } from "../names"
import {
    statVein,
    veinOrder,
    gasOrder,
    formatNumber,
    toPrecision,
} from "../util"
import { VeinType, GasType, StarType, SpectrType } from "../enums"
import Tooltip from "../components/Tooltip"
function combineAllVeins(stars: Star[]): VeinStat[] {
    const veins: Record<VeinType, VeinStat> = {} as any
    for (const star of stars) {
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
    }
    return veinOrder.map((type) => veins[type]).filter((x) => x)
}
function combineAllGases(stars: Star[]): Gas[] {
    const gases: Record<GasType, float> = {} as any
    for (const star of stars) {
        for (const planet of star.planets) {
            for (const [type, amount] of planet.gases) {
                gases[type] = (gases[type] ?? 0) + amount
            }
        }
    }
    return gasOrder
        .filter((type) => gases[type])
        .map((type) => [type, gases[type]])
}
function formatVein(amount: number, isOil: boolean): string {
    if (isOil) {
        return formatNumber(amount * 4e-5, 2) + " /s"
    } else {
        return toPrecision(amount, 0)
    }
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
const GalaxyOverview: FC<{
    galaxy: Galaxy
    search: string
    displayNames?: ReadonlyMap<number, string>
}> = (props) => {
    const { t } = useLingui()
    const getStarType = useStarTypeFullName()
    const veinNames = useVeinNames()
    const gasTypeNames = useGasTypeNames()
    const starTypeCounts = () => {
        const order = [
            getStarType({
                type: StarType.MainSeqStar,
                spectr: SpectrType.M,
            }),
            getStarType({
                type: StarType.MainSeqStar,
                spectr: SpectrType.K,
            }),
            getStarType({
                type: StarType.MainSeqStar,
                spectr: SpectrType.G,
            }),
            getStarType({
                type: StarType.MainSeqStar,
                spectr: SpectrType.F,
            }),
            getStarType({
                type: StarType.MainSeqStar,
                spectr: SpectrType.A,
            }),
            getStarType({
                type: StarType.MainSeqStar,
                spectr: SpectrType.B,
            }),
            getStarType({
                type: StarType.MainSeqStar,
                spectr: SpectrType.O,
            }),
            getStarType({
                type: StarType.GiantStar,
                spectr: SpectrType.M,
            }),
            getStarType({
                type: StarType.GiantStar,
                spectr: SpectrType.G,
            }),
            getStarType({
                type: StarType.GiantStar,
                spectr: SpectrType.A,
            }),
            getStarType({
                type: StarType.GiantStar,
                spectr: SpectrType.B,
            }),
            getStarType({
                type: StarType.WhiteDwarf,
                spectr: SpectrType.X,
            }),
            getStarType({
                type: StarType.NeutronStar,
                spectr: SpectrType.X,
            }),
            getStarType({
                type: StarType.BlackHole,
                spectr: SpectrType.X,
            }),
        ]
        const counts: Record<string, number> = {}
        const representatives: Record<string, Star> = {}
        for (const star of props.galaxy.stars) {
            const name = getStarType(star)
            counts[name] = (counts[name] ?? 0) + 1
            representatives[name] = star
        }
        return order
            .filter((name) => counts[name])
            .map(
                (name) =>
                    [name, counts[name]!, representatives[name]!] as const,
            )
    }
    const allVeins = () => combineAllVeins(props.galaxy.stars)
    const allGases = () => combineAllGases(props.galaxy.stars)
    return (
        <div className={styles.root}>
            <div className={styles.map}>
                <div className={styles.mapHeader}>
                    <span>{t`Starmap`}</span>
                    <span
                        className={styles.mapHint}
                    >{t`Select a star to view its planets`}</span>
                </div>
                <Starmap
                    galaxy={props.galaxy}
                    search={props.search}
                    displayNames={props.displayNames}
                />
                <div className={styles.mapFooter}>
                    <span className={styles.startMarker} />
                    {t`Starting system`}
                    <span
                        className={styles.mapHint}
                    >{t`2D projection · All stars shown`}</span>
                    <a
                        className={styles.credits}
                        href={starIconAttributionHref}
                        target="_blank"
                        rel="noreferrer"
                    >{t`Icon credits`}</a>
                </div>
            </div>
            <div className={styles.info}>
                <div className={styles.card}>
                    <div className={styles.title}>
                        <span>
                            {t`Seed`}: {props.galaxy.seed}
                        </span>
                    </div>
                </div>
                {starTypeCounts().length > 0 ? (
                    <>
                        <div className={styles.card}>
                            <div className={styles.title}>
                                <span>{t`Star types`}</span>
                            </div>
                            {starTypeCounts().map(
                                ([name, count, star], _index) => (
                                    <Fragment key={_index}>
                                        {
                                            <div className={styles.row}>
                                                <div className={styles.field}>
                                                    <StarTypeIcon star={star} />
                                                    {name}:
                                                </div>
                                                <div className={styles.value}>
                                                    {count}
                                                </div>
                                            </div>
                                        }
                                    </Fragment>
                                ),
                            )}
                        </div>
                    </>
                ) : null}
                {allVeins().length > 0 ? (
                    <>
                        <div className={styles.card}>
                            <div className={styles.title}>
                                <span>{t`Resources`}</span>
                            </div>
                            {allVeins().map((vein, _index2) => (
                                <Fragment key={_index2}>
                                    {
                                        <div className={styles.row}>
                                            <div className={styles.field}>
                                                <GameIcon
                                                    vein={vein.veinType}
                                                />
                                                {veinNames[vein.veinType]()}:
                                            </div>
                                            <Vein
                                                className={styles.value}
                                                stat={vein}
                                            />
                                        </div>
                                    }
                                </Fragment>
                            ))}
                        </div>
                    </>
                ) : null}
                {allGases().length > 0 ? (
                    <>
                        <div className={styles.card}>
                            <div className={styles.title}>
                                <span>{t`Gas rate`}</span>
                            </div>
                            {allGases().map(([type, amount], _index3) => (
                                <Fragment key={_index3}>
                                    {
                                        <div className={styles.row}>
                                            <div className={styles.field}>
                                                <GameIcon gas={type} />
                                                {gasTypeNames[type]()}:
                                            </div>
                                            <div className={styles.value}>
                                                {formatNumber(amount, 4)} /s
                                            </div>
                                        </div>
                                    }
                                </Fragment>
                            ))}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    )
}
export default GalaxyOverview
