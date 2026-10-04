import styles from "~styles"
import StarTypeIcon from "../components/StarTypeIcon"
import { getGalaxyDisplayNames } from "../lib/starNames"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useEffect, useMemo, useRef, type FC, type FormEvent } from "react"
import { useLiveState } from "../hooks/useLiveState"
import NumberInput from "../components/NumberInput"
import Button from "../components/Button"
import { generateGalaxy, searchStar } from "../worldgen"
import { useStore } from "../store"
import clsx from "clsx"
import StarView from "../partials/StarView"
import {
    constructRule,
    defaultHiveInitialColonize,
    defaultHiveMaxDensity,
    defaultResourceMultiplier,
    defaultStarCount,
    defaultUseActualVeins,
    getSearch,
    hiveInitialColonizeValues,
    hiveMaxDensityValues,
    maxStarCount,
    minStarCount,
    resourceMultipliers,
    validateRules,
} from "../util"
import StarCountSelector from "../partials/StarCountSelector"
import ResourceMultiplierSelector from "../partials/ResourceMultiplierSelector"
import HiveInitialColonizeSelector from "../partials/HiveInitialColonizeSelector"
import HiveMaxDensitySelector from "../partials/HiveMaxDensitySelector"
import { useLingui } from "#lingui"
import ExportModal from "../partials/ExportModal"
import Tooltip from "../components/Tooltip"
import Toggle from "../components/Toggle"
import GalaxyOverview from "../partials/GalaxyOverview"
import RuleEditor from "../partials/RuleEditor"
import { getInitialStarSearchRules, setStarSearchRules } from "../localStorage"

function randomSeed() {
    return Math.floor(Math.random() * 1e8)
}

const Search: FC = () => {
    const [store, setStore] = useStore()
    const [value, setValue] = useLiveState<number>(-1)
    const navigate = useNavigate()

    function isValueValid() {
        const v = value()
        return Number.isInteger(v) && v >= 0 && v < 1e8
    }

    function handleSubmit(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault()
        if (!isValueValid()) return
        navigate(`/galaxy/${value()}${getSearch(store.settings.view)}`)
    }

    const { t } = useLingui()

    return (
        <form className={styles.search} onSubmit={handleSubmit}>
            <div className={styles.searchTitle}>{t`Seed`}:</div>
            <div className={styles.searchRow}>
                <NumberInput
                    className={styles.searchInput}
                    value={value()}
                    onChange={setValue}
                    emptyValue={-1}
                />
                <Button
                    className={styles.searchRandom}
                    kind="outline"
                    onClick={() => setValue(randomSeed())}
                >
                    {t`Random`}
                </Button>
                <Button
                    className={styles.searchSubmit}
                    type="submit"
                    disabled={!isValueValid()}
                >
                    {t`View`}
                </Button>
            </div>
            <div className={styles.searchTitle}>{t`Number of stars`}:</div>
            <StarCountSelector
                className={styles.searchInput}
                value={store.settings.view.starCount}
                onChange={(v) => setStore("settings", "view", "starCount", v)}
            />
            <div className={styles.searchTitle}>{t`Resource multiplier`}:</div>
            <ResourceMultiplierSelector
                className={styles.searchInput}
                value={store.settings.view.resourceMultiplier}
                onChange={(v) =>
                    setStore("settings", "view", "resourceMultiplier", v)
                }
            />
            <div className={styles.searchTitle}>
                {t`Dark Fog initial occupation`}:
            </div>
            <HiveInitialColonizeSelector
                className={styles.searchInput}
                value={store.settings.view.hiveInitialColonize}
                onChange={(v) =>
                    setStore("settings", "view", "hiveInitialColonize", v)
                }
            />
            <div className={styles.searchTitle}>{t`Dark Fog max density`}:</div>
            <HiveMaxDensitySelector
                className={styles.searchInput}
                value={store.settings.view.hiveMaxDensity}
                onChange={(v) =>
                    setStore("settings", "view", "hiveMaxDensity", v)
                }
            />
            <div className={styles.searchTitle}>
                <Tooltip
                    text={t`It is much faster to estimate the amount of veins over generating the excat numbers.`}
                >
                    {t`Use estimated veins`}
                </Tooltip>
                :
            </div>
            <Toggle
                value={!store.settings.view.useActualVeins}
                onChange={(v) =>
                    setStore("settings", "view", "useActualVeins", !v)
                }
            />
        </form>
    )
}

const StarSearch: FC<{
    seed: number
    params: GameParameters
    galaxy: Galaxy
    searchString: string
    rules: SimpleRule[][]
    onChangeRules: (value: SimpleRule[][]) => void
    results: integer[]
    onChangeResults: (value: integer[]) => void
    displayNames: ReadonlyMap<number, string>
}> = (props) => {
    const isRuleValid = validateRules(props.rules)
    const { t } = useLingui()
    const [searching, setSearching] = useLiveState(false)
    const [failed, setFailed] = useLiveState(false)
    const requestId = useRef(0)

    useEffect(() => {
        ++requestId.current
        setSearching(false)
        setFailed(false)
        return () => {
            ++requestId.current
        }
    }, [props.seed, props.params, props.rules, setSearching, setFailed])

    async function search() {
        if (searching() || !isRuleValid) return
        const id = ++requestId.current
        setSearching(true)
        setFailed(false)
        try {
            const results = await searchStar(
                false,
                props.seed,
                props.params,
                constructRule(props.rules),
            )
            if (id === requestId.current) props.onChangeResults(results)
        } catch {
            if (id === requestId.current) setFailed(true)
        } finally {
            if (id === requestId.current) setSearching(false)
        }
    }

    function changeRules(value: SimpleRule[][]) {
        ++requestId.current
        setSearching(false)
        setFailed(false)
        props.onChangeRules(value)
        props.onChangeResults([])
    }

    return (
        <div className={styles.starSearch}>
            <div
                className={styles.starSearchTitle}
            >{t`Find stars matching the following criteria in seed ${props.seed}.`}</div>
            <RuleEditor value={props.rules} onChange={changeRules} />
            <Button
                className={styles.starSearchButton}
                disabled={!isRuleValid || searching()}
                onClick={search}
            >
                {searching() ? t`Searching...` : t`Search`}
            </Button>
            {failed() && (
                <div role="alert">{t`Unable to search this galaxy. Please try again.`}</div>
            )}
            <div className={styles.results}>
                {props.results.map((index) => (
                    <Link
                        key={index}
                        to={`/galaxy/${props.seed}/${index}${props.searchString}`}
                        className={styles.result}
                    >
                        {props.galaxy.stars[index] && (
                            <StarTypeIcon star={props.galaxy.stars[index]!} />
                        )}
                        <span>
                            {props.displayNames.get(index) ??
                                props.galaxy.stars[index]?.name}
                        </span>
                        <span className={styles.resultIndex}>#{index + 1}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export function parseGameParameters(search: URLSearchParams): GameParameters {
    const count = Number(search.get("count"))
    const choose = (
        name: string,
        allowed: readonly number[],
        fallback: number,
    ) => {
        const raw = search.get(name)
        const value = Number(raw)
        return raw !== null && raw !== "" && allowed.includes(value)
            ? value
            : fallback
    }
    const actual = search.get("useActualVeins")
    return {
        starCount:
            Number.isInteger(count) &&
            count >= minStarCount &&
            count <= maxStarCount
                ? count
                : defaultStarCount,
        resourceMultiplier: choose(
            "multiplier",
            resourceMultipliers,
            defaultResourceMultiplier,
        ),
        hiveInitialColonize: choose(
            "hiveInitialColonize",
            hiveInitialColonizeValues,
            defaultHiveInitialColonize,
        ),
        hiveMaxDensity: choose(
            "hiveMaxDensity",
            hiveMaxDensityValues,
            defaultHiveMaxDensity,
        ),
        useActualVeins: !actual
            ? defaultUseActualVeins
            : defaultUseActualVeins
              ? actual !== "0" && actual !== "false"
              : actual === "1" || actual === "true",
    }
}

const View: FC<{ seed: number; index?: number; isSearch: boolean }> = (
    props,
) => {
    const [searchParams] = useSearchParams()
    const params = useMemo(
        () => parseGameParameters(searchParams),
        [searchParams],
    )
    const search = getSearch(params)
    const key = `${props.seed}:${search}`
    const [request, setRequest] = useLiveState<{
        key: string
        galaxy?: Galaxy
        failed?: boolean
    }>({ key: "" })
    const [retry, setRetry] = useLiveState(0)
    const retryNumber = retry()
    const [exportModal, setExportModal] = useLiveState(false)
    const [rules, setRules] = useLiveState<SimpleRule[][]>(
        getInitialStarSearchRules,
    )
    const [starSearchResults, setStarSearchResults] = useLiveState<integer[]>(
        [],
    )
    const { t, i18n } = useLingui()

    useEffect(() => {
        let active = true
        setRequest({ key })
        setStarSearchResults([])
        setExportModal(false)
        void Promise.resolve()
            .then(() => generateGalaxy(false, props.seed, params))
            .then((galaxy) => {
                if (active) setRequest({ key, galaxy })
            })
            .catch(() => {
                if (active) setRequest({ key, failed: true })
            })
        return () => {
            active = false
        }
    }, [
        props.seed,
        params,
        key,
        retryNumber,
        setRequest,
        setStarSearchResults,
        setExportModal,
    ])

    const current = request()
    const displayNames = useMemo(
        () =>
            current.key === key && current.galaxy
                ? getGalaxyDisplayNames(current.galaxy, i18n.locale)
                : new Map<number, string>(),
        [current, key, i18n.locale],
    )
    if (current.key === key && current.failed)
        return (
            <div className={styles.loading} role="alert">
                <span>{t`Unable to generate this galaxy.`}</span>
                <Button
                    onClick={() => setRetry((value) => value + 1)}
                >{t`Retry`}</Button>
            </div>
        )
    if (current.key !== key || !current.galaxy)
        return (
            <div className={styles.loading} role="status">{t`Loading...`}</div>
        )
    const galaxy = current.galaxy
    const selectedStar =
        props.index === undefined ? undefined : galaxy.stars[props.index]
    const buildUrl = (starIndex: integer) =>
        `/galaxy/${props.seed}/${starIndex}${search}`

    return (
        <>
            <div className={styles.view}>
                <div className={styles.left}>
                    <div className={styles.leftButtons}>
                        <Link to={`/galaxy/${props.seed}${search}`}>
                            <Button
                                className={styles.button}
                            >{t`Starmap`}</Button>
                        </Link>
                        <Button
                            className={styles.button}
                            onClick={() => setExportModal(true)}
                        >{t`Export`}</Button>
                        <Link to={`/galaxy/${props.seed}/search${search}`}>
                            <Button
                                className={styles.button}
                            >{t`Search`}</Button>
                        </Link>
                    </div>
                    <div className={styles.starList}>
                        {galaxy.stars.map((star) => (
                            <Link
                                key={star.index}
                                to={buildUrl(star.index)}
                                aria-current={
                                    star.index === props.index
                                        ? "page"
                                        : undefined
                                }
                                className={clsx(
                                    styles.star,
                                    star.index === props.index && styles.active,
                                )}
                            >
                                <StarTypeIcon star={star} />
                                <span
                                    className={styles.starName}
                                    title={star.name}
                                >
                                    {displayNames.get(star.index) ?? star.name}
                                </span>
                                <span className={styles.index}>
                                    #{star.index + 1}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
                <div
                    key={`${key}:${props.isSearch ? "search" : (props.index ?? "map")}`}
                    className={styles.right}
                >
                    {props.isSearch ? (
                        <StarSearch
                            seed={props.seed}
                            params={params}
                            galaxy={galaxy}
                            searchString={search}
                            rules={rules()}
                            onChangeRules={(value) => {
                                setRules(value)
                                setStarSearchRules(value)
                            }}
                            results={starSearchResults()}
                            onChangeResults={setStarSearchResults}
                            displayNames={displayNames}
                        />
                    ) : props.index !== undefined ? (
                        selectedStar ? (
                            <StarView
                                star={selectedStar}
                                galaxy={galaxy}
                                buildUrl={buildUrl}
                                displayNames={displayNames}
                            />
                        ) : (
                            <div role="alert">{t`Invalid star index.`}</div>
                        )
                    ) : (
                        <GalaxyOverview
                            galaxy={galaxy}
                            search={search}
                            displayNames={displayNames}
                        />
                    )}
                </div>
            </div>
            <ExportModal
                visible={exportModal()}
                onClose={() => setExportModal(false)}
                mode="single"
                id=""
                name={String(props.seed)}
                singleSeed={props.seed}
                params={params}
            />
        </>
    )
}

export default function Galaxy() {
    const params = useParams()
    const { t } = useLingui()
    if (params.seed === undefined) return <Search />
    const seed = Number(params.seed)
    if (
        !/^\d+$/.test(params.seed) ||
        !Number.isSafeInteger(seed) ||
        seed < 0 ||
        seed >= 1e8
    )
        return <div role="alert">{t`Invalid seed.`}</div>
    const isSearch = params.index === "search"
    const index =
        params.index === undefined || isSearch
            ? undefined
            : Number(params.index)
    if (
        index !== undefined &&
        (!/^\d+$/.test(params.index!) ||
            !Number.isSafeInteger(index) ||
            index < 0)
    )
        return <div role="alert">{t`Invalid star index.`}</div>
    return <View seed={seed} index={index} isSearch={isSearch} />
}
