import { type FC, useEffect, useRef } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ExternalLink } from "lucide-react"
import { useLiveState, useObjectState } from "../hooks/useLiveState"
import {
    getProfileInfo,
    getProfileProgress,
    getProfileResult,
    listProfiles,
} from "../profile"
import {
    getDefaultParams,
    getSearch,
    maxStarCount,
    minStarCount,
    validateRules,
} from "../util"
import Button from "../components/Button"
import RuleEditor from "../partials/RuleEditor"
import styles from "~styles"
import ProfilesModal from "../partials/ProfilesModal"
import Modal from "../components/Modal"
import ProgressBar from "../components/ProgressBar"
import StarView from "../partials/StarView"
import ProgressEditor from "../partials/ProgressEditor"
import ProfileManager from "../partials/ProfileManager"
import Pagination from "../components/Pagination"
import { useStore } from "../store"
import ExportModal from "../partials/ExportModal"
import { useLingui } from "#lingui"
import { DEFAULT_BATCH_SIZE } from "../constants"
import { generateGalaxy } from "../worldgen"

const defaultProgress = (): ProfileProgress => ({
    id: "",
    params: getDefaultParams(),
    concurrency: navigator.hardwareConcurrency || 1,
    autosave: 5,
    range: [0, 1e8],
    total: 0,
    found: 0,
    batchSize: DEFAULT_BATCH_SIZE,
    nextBatchId: 0,
    rules: [],
})
const PAGE_SIZE = 100
const StarViewModal: FC<{
    seed: integer
    index: integer
    params: GameParameters
    search: string
}> = (props) => {
    const [galaxy, setGalaxy] = useLiveState<Galaxy | null>(null)
    const { t } = useLingui()
    useEffect(() => {
        let current = true
        setGalaxy(null)
        generateGalaxy(false, props.seed, props.params)
            .then((value) => {
                if (current) setGalaxy(value)
            })
            .catch((error) => {
                if (current) console.error(error)
            })
        return () => {
            current = false
        }
    }, [props.seed, props.params, setGalaxy])
    function buildUrl(starIndex: integer) {
        return `/galaxy/${props.seed}/${starIndex}${props.search}`
    }
    return galaxy() ? (
        <>
            <div className={styles.viewTop}>
                <div className={styles.viewTitle}>
                    {t`Seed: `}
                    {String(props.seed).padStart(8, "0")}
                </div>
                <Link
                    className={styles.viewNewTab}
                    to={buildUrl(props.index)}
                    target="_blank"
                >
                    {t`View in new tab`}
                    <ExternalLink />
                </Link>
            </div>
            <StarView
                star={galaxy()!.stars[props.index]!}
                galaxy={galaxy()!}
                buildUrl={buildUrl}
                newPage
            />
        </>
    ) : null
}
const SearchResult: FC<{
    id: string
    page: integer
    updateKey: number
    params: GameParameters
}> = (props) => {
    const [results, setResults] = useLiveState<ProgressResult[]>([])
    const [active, setActive] = useLiveState<ProgressResult | null>(null)
    const searchString = () => getSearch(props.params)
    useEffect(() => {
        setResults([])
        setActive(null)
    }, [props.id, props.page, setResults, setActive])
    useEffect(() => {
        let current = true
        getProfileResult(props.id, (props.page - 1) * PAGE_SIZE, PAGE_SIZE)
            .then((list) => {
                if (current) setResults(list)
            })
            .catch((error) => {
                if (current) console.error(error)
            })
        return () => {
            current = false
        }
    }, [props.id, props.page, props.updateKey, setResults])
    function buildUrl(item: ProgressResult) {
        return `/galaxy/${item.seed}/${item.index}${searchString()}`
    }
    return (
        <>
            <div className={styles.results}>
                {results().map((result) => (
                    <Link
                        key={result.id}
                        to={buildUrl(result)}
                        target="_blank"
                        className={styles.result}
                        onClick={(event) => {
                            event.preventDefault()
                            setActive(result)
                        }}
                    >
                        <span className={styles.resultSeed}>
                            {String(result.seed).padStart(8, "0")}
                        </span>
                        <span className={styles.resultIndex}>
                            #{result.index + 1}
                        </span>
                    </Link>
                ))}
            </div>
            {active() && (
                <Modal visible onClose={() => setActive(null)} backdropDismiss>
                    <StarViewModal
                        seed={active()!.seed}
                        index={active()!.index}
                        params={props.params}
                        search={searchString()}
                    />
                </Modal>
            )}
        </>
    )
}
const FindStar: FC = () => {
    const params = useParams()
    const navigate = useNavigate()
    const { t } = useLingui()
    const [name, setName] = useLiveState(t`Untitled`)
    const [profile, setProfile] = useLiveState<ProfileInfo | null>(null)
    const [progress, setProgress] =
        useObjectState<ProfileProgress>(defaultProgress())
    const [nativeMode, setNativeMode] = useLiveState(false)
    const [profileModal, setProfileModal] = useLiveState(false)
    const [exportModal, setExportModal] = useLiveState(false)
    const [store] = useStore()
    const [currentPage, setCurrentPage] = useLiveState(1)
    const loadVersion = useRef(0)
    const [loading, setLoading] = useLiveState(false)
    const isLoaded = () => !!profile()
    const hasProgress = () => progress.nextBatchId > 0
    const isDisabled = () => true
    const hasCompleted = () => {
        const batches = Math.ceil(progress.total / progress.batchSize)
        return batches > 0 && progress.nextBatchId >= batches
    }
    async function onSelectProfile(next: ProfileInfo) {
        const version = ++loadVersion.current
        setLoading(true)
        try {
            const saved = await getProfileProgress(next.id)
            if (version !== loadVersion.current || saved?.id !== next.id) return
            setCurrentPage(1)
            setProfile(next)
            setName(next.name)
            setProgress({ ...defaultProgress(), ...saved })
            setProfileModal(false)
            setExportModal(false)
            if (params.profileId !== next.id) navigate(`/find-star/${next.id}`)
        } catch (error) {
            if (version === loadVersion.current) console.error(error)
        } finally {
            if (version === loadVersion.current) setLoading(false)
        }
    }
    function isValid() {
        if (
            !name().trim() ||
            progress.params.starCount < minStarCount ||
            progress.params.starCount > maxStarCount ||
            !Number.isInteger(progress.concurrency) ||
            progress.concurrency < 1 ||
            progress.autosave <= 0
        )
            return false
        if (
            Array.isArray(progress.range) &&
            (progress.range[0] < 0 ||
                progress.range[1] > 1e8 ||
                progress.range[0] >= progress.range[1])
        )
            return false
        return validateRules(progress.rules)
    }
    useEffect(() => {
        const profileId = params.profileId
        if (profileId === profile()?.id) return
        const version = ++loadVersion.current
        setCurrentPage(1)
        setExportModal(false)
        setProfile(null)
        setProgress(defaultProgress())
        if (!profileId) {
            setLoading(false)
            return
        }
        setLoading(true)
        Promise.all([getProfileInfo(profileId), getProfileProgress(profileId)])
            .then(([info, saved]) => {
                if (version !== loadVersion.current || info?.id !== profileId)
                    return
                setProfile(info)
                setName(info.name)
                if (saved?.id === profileId)
                    setProgress({ ...defaultProgress(), ...saved })
            })
            .catch((error) => {
                if (version === loadVersion.current) console.error(error)
            })
            .finally(() => {
                if (version === loadVersion.current) setLoading(false)
            })
        return () => {
            ++loadVersion.current
        }
    }, [
        params.profileId,
        profile,
        setCurrentPage,
        setExportModal,
        setLoading,
        setName,
        setProfile,
        setProgress,
    ])
    useEffect(
        () => () => {
            ++loadVersion.current
        },
        [],
    )
    return (
        <div className={styles.content}>
            <div
                className={styles.warning}
            >{t`Star Finder is no longer supported. Please use Galaxy Finder instead.`}</div>
            <ProfileManager
                onLoad={() => setProfileModal(true)}
                disabled={store.searching || loading()}
                isValid={isValid()}
                isLoaded={isLoaded()}
            />
            <ProgressEditor
                progress={progress}
                onProgressChange={setProgress}
                name={name()}
                onNameChange={setName}
                nativeMode={nativeMode()}
                onNativeModeChange={setNativeMode}
                isLoaded={isLoaded()}
                searching={store.searching || loading()}
            />
            <div className={styles.rules}>{t`Rules`}</div>
            <RuleEditor
                value={progress.rules}
                onChange={(rules) => setProgress("rules", rules)}
                disabled={isDisabled()}
            />
            <div className={styles.execute}>
                <div className={styles.progress}>
                    {store.searching || (hasProgress() && !hasCompleted()) ? (
                        <>
                            <div
                                className={styles.progressText}
                            >{t`Progress:`}</div>
                            <ProgressBar
                                className={styles.progressBar}
                                current={
                                    progress.nextBatchId * progress.batchSize
                                }
                                total={progress.total}
                            />
                        </>
                    ) : null}
                </div>
                {hasProgress() && profile() ? (
                    <>
                        <Button
                            onClick={() => setExportModal(true)}
                        >{t`Export`}</Button>
                    </>
                ) : null}
            </div>
            {hasProgress() && profile() ? (
                <>
                    <Pagination
                        current={currentPage()}
                        total={
                            Math.max(
                                0,
                                Math.floor((progress.found - 1) / PAGE_SIZE),
                            ) + 1
                        }
                        onChange={setCurrentPage}
                    />
                    <SearchResult
                        id={profile()!.id}
                        page={currentPage()}
                        updateKey={0}
                        params={progress.params}
                    />
                </>
            ) : null}
            <ProfilesModal
                visible={profileModal()}
                onClose={() => setProfileModal(false)}
                onSelect={onSelectProfile}
                loadProfiles={listProfiles}
            />
            <ExportModal
                visible={exportModal()}
                onClose={() => setExportModal(false)}
                mode="star"
                id={profile()?.id || ""}
                name={profile()?.name || ""}
                params={progress.params}
            />
        </div>
    )
}

export default FindStar
