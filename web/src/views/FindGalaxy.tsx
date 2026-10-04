import { type FC, useEffect, useRef } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useLiveState, useObjectState } from "../hooks/useLiveState"
import {
    constructMultiRule,
    getDefaultParams,
    getSearch,
    maxStarCount,
    minStarCount,
    validateMultiRule,
} from "../util"
import {
    clearMultiProfile,
    deleteMultiProfile,
    generateProfileId,
    getMultiProfileInfo,
    getMultiProfileProgress,
    getMultiProfileResult,
    listMultiProfiles,
    setMultiProfileInfo,
    setMultiProfileProgress,
} from "../profile"
import { startSearchingGalaxies, stopSearchingGalaxies } from "../worldgen"
import ProgressEditor from "../partials/ProgressEditor"
import ProfileManager from "../partials/ProfileManager"
import styles from "~styles"
import ProgressBar from "../components/ProgressBar"
import Button from "../components/Button"
import Pagination from "../components/Pagination"
import ProfilesModal from "../partials/ProfilesModal"
import MultiRuleEditor from "../partials/MultiRuleEditor"
import { ConditionType } from "../enums"
import { useStore } from "../store"
import ExportModal from "../partials/ExportModal"
import { useLingui } from "#lingui"
import { DEFAULT_BATCH_SIZE } from "../constants"

const PAGE_SIZE = 100
const defaultProgress = (): MultiProfileProgress => ({
    id: "",
    params: getDefaultParams(),
    concurrency: navigator.hardwareConcurrency || 1,
    autosave: 5,
    range: [0, 1e8],
    total: 0,
    found: 0,
    batchSize: DEFAULT_BATCH_SIZE,
    nextBatchId: 0,
    multiRules: [
        [
            {
                rules: [],
                condition: { type: ConditionType.Gte, value: 1 },
                name: "",
            },
        ],
    ],
})
const SearchResult: FC<{
    id: string
    page: integer
    updateKey: number
    params: GameParameters
}> = (props) => {
    const [results, setResults] = useLiveState<MultiProgressResult[]>([])
    useEffect(() => {
        setResults([])
    }, [props.id, props.page, setResults])
    useEffect(() => {
        let current = true
        getMultiProfileResult(props.id, (props.page - 1) * PAGE_SIZE, PAGE_SIZE)
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
    return (
        <div className={styles.results}>
            {results().map((result) => (
                <Link
                    key={result.seed}
                    to={`/galaxy/${result.seed}${getSearch(props.params)}`}
                    target="_blank"
                    className={styles.result}
                >
                    {String(result.seed).padStart(8, "0")}
                </Link>
            ))}
        </div>
    )
}
const FindGalaxy: FC = () => {
    const params = useParams()
    const navigate = useNavigate()
    const { t } = useLingui()
    const [name, setName] = useLiveState(t`Untitled`)
    const [profile, setProfile] = useLiveState<ProfileInfo | null>(null)
    const [progress, setProgress] =
        useObjectState<MultiProfileProgress>(defaultProgress())
    const [nativeMode, setNativeMode] = useLiveState(false)
    const [profileModal, setProfileModal] = useLiveState(false)
    const [exportModal, setExportModal] = useLiveState(false)
    const [store, setStore] = useStore()
    const [currentPage, setCurrentPage] = useLiveState(1)
    const [tick, setTick] = useLiveState(0)
    const [busy, setBusy] = useLiveState(false)
    const [loading, setLoading] = useLiveState(false)
    const [error, setError] = useLiveState("")
    const mounted = useRef(false)
    const profileVersion = useRef(0)
    const run = useRef<{
        nativeMode: boolean
        started: boolean
        stopRequested: boolean
    } | null>(null)
    const isLoaded = () => !!profile()
    const hasProgress = () => progress.nextBatchId > 0
    const isBusy = () => store.searching || busy() || loading()
    const isDisabled = () => isBusy() || hasProgress()
    const hasCompleted = () => {
        const batches = Math.ceil(progress.total / progress.batchSize)
        return batches > 0 && progress.nextBatchId >= batches
    }
    function reportError(reason: unknown) {
        console.error(reason)
        if (mounted.current)
            setError(t`Unable to complete the operation. Please try again.`)
    }
    function changeProfile(next: ProfileInfo | null) {
        ++profileVersion.current
        if (profile()?.id !== next?.id) setCurrentPage(1)
        setExportModal(false)
        setProfile(next)
        setName(next?.name ?? "")
        if (params.profileId !== next?.id)
            navigate(next ? `/find-galaxy/${next.id}` : "/find-galaxy")
    }
    async function onSelectProfile(next: ProfileInfo) {
        if (isBusy()) return
        const version = ++profileVersion.current
        setBusy(true)
        setError("")
        try {
            const saved = await getMultiProfileProgress(next.id)
            if (
                mounted.current &&
                version === profileVersion.current &&
                saved?.id === next.id
            ) {
                setProgress({ ...defaultProgress(), ...saved })
                changeProfile(next)
                setTick((value) => value + 1)
                setProfileModal(false)
            }
        } catch (reason) {
            if (version === profileVersion.current) reportError(reason)
        } finally {
            if (mounted.current) setBusy(false)
        }
    }
    function onNewProfile() {
        if (isBusy()) return
        setProgress(defaultProgress())
        changeProfile(null)
        setError("")
    }
    function onCloneProfile() {
        if (isBusy()) return
        const originalName = name()
        changeProfile(null)
        setName(originalName + t` - Copy`)
        setProgress({
            id: "",
            total: 0,
            batchSize: DEFAULT_BATCH_SIZE,
            nextBatchId: 0,
            found: 0,
        })
        setError("")
    }
    function isValid() {
        if (
            !name().trim() ||
            !Number.isInteger(progress.params.starCount) ||
            progress.params.starCount < minStarCount ||
            progress.params.starCount > maxStarCount ||
            !Number.isInteger(progress.concurrency) ||
            progress.concurrency < 1 ||
            !Number.isFinite(progress.autosave) ||
            progress.autosave <= 0
        )
            return false
        if (Array.isArray(progress.range)) {
            if (
                !progress.range.every(Number.isInteger) ||
                progress.range[0] < 0 ||
                progress.range[1] > 1e8 ||
                progress.range[0] >= progress.range[1]
            )
                return false
        } else if (progress.range.length === 0) return false
        return validateMultiRule(progress.multiRules)
    }
    // The live state view is a Proxy; IndexedDB must receive a plain snapshot.
    async function saveProfile() {
        const version = profileVersion.current
        const existing = profile()
        const next: ProfileInfo = {
            id: existing?.id ?? generateProfileId(),
            name: name(),
            createdAt: existing?.createdAt ?? Date.now(),
        }
        const snapshot: MultiProfileProgress = { ...progress, id: next.id }
        if (!existing || existing.name !== next.name)
            await setMultiProfileInfo(next)
        await setMultiProfileProgress(snapshot)
        if (!mounted.current || version !== profileVersion.current) return null
        setProgress(snapshot)
        changeProfile(next)
        return snapshot
    }
    async function onSaveProfile() {
        if (isBusy() || !isValid()) return
        setBusy(true)
        setError("")
        try {
            await saveProfile()
        } catch (reason) {
            reportError(reason)
        } finally {
            if (mounted.current) setBusy(false)
        }
    }
    async function onClearProfile() {
        if (isBusy()) return
        setBusy(true)
        setError("")
        const version = profileVersion.current
        const snapshot = {
            ...progress,
            found: 0,
            nextBatchId: 0,
            total: 0,
            batchSize: DEFAULT_BATCH_SIZE,
        }
        try {
            const existing = profile()
            if (existing) {
                await clearMultiProfile(existing.id)
                await setMultiProfileProgress(snapshot)
            }
            if (mounted.current && version === profileVersion.current) {
                setCurrentPage(1)
                setProgress(snapshot)
            }
        } catch (reason) {
            reportError(reason)
        } finally {
            if (mounted.current) setBusy(false)
        }
    }
    async function onDeleteProfile() {
        if (isBusy()) return
        setBusy(true)
        setError("")
        const version = profileVersion.current
        try {
            const existing = profile()
            if (existing) await deleteMultiProfile(existing.id)
            if (mounted.current && version === profileVersion.current) {
                setProgress(defaultProgress())
                changeProfile(null)
            }
        } catch (reason) {
            reportError(reason)
        } finally {
            if (mounted.current) setBusy(false)
        }
    }
    async function onStartSearching() {
        if (run.current || isBusy() || !isValid()) return
        // Lock synchronously before saving so rapid clicks cannot create two searches.
        const session = {
            nativeMode: nativeMode(),
            started: false,
            stopRequested: false,
        }
        run.current = session
        setStore("searching", true)
        setError("")
        setProgress(
            "total",
            Array.isArray(progress.range)
                ? progress.range[1] - progress.range[0]
                : progress.range.length,
        )
        let writes = Promise.resolve()
        let settled = false
        let failed = false
        let saved: MultiProfileProgress | null = null
        const finish = () => {
            if (settled) return
            settled = true
            void writes.finally(() => {
                if (run.current !== session) return
                run.current = null
                setStore("searching", false)
                if (
                    failed &&
                    saved &&
                    mounted.current &&
                    profile()?.id === saved.id
                )
                    setProgress(saved)
            })
        }
        try {
            const initial = await saveProfile()
            if (!initial || session.stopRequested || !mounted.current) {
                finish()
                return
            }
            saved = initial
            let snapshot = initial
            let results: integer[] = []
            session.started = true
            startSearchingGalaxies(session.nativeMode, {
                batchSize: snapshot.batchSize,
                nextBatchId: snapshot.nextBatchId,
                gameDesc: snapshot.params,
                range: snapshot.range,
                concurrency: snapshot.concurrency,
                autosave: snapshot.autosave,
                rule: constructMultiRule(snapshot.multiRules),
                onResult: (result) => {
                    if (!settled) results.push(...result)
                },
                onProgress: (nextBatchId) => {
                    if (settled || failed) return
                    const batchResults = results
                    results = []
                    snapshot = {
                        ...snapshot,
                        nextBatchId: Math.max(
                            snapshot.nextBatchId,
                            nextBatchId,
                        ),
                        found: snapshot.found + batchResults.length,
                    }
                    const checkpoint = snapshot
                    if (mounted.current && profile()?.id === checkpoint.id)
                        setProgress(checkpoint)
                    // Serialize immutable checkpoints, keeping the cursor and results atomic.
                    writes = writes
                        .then(async () => {
                            if (failed) return
                            await setMultiProfileProgress(
                                checkpoint,
                                batchResults,
                            )
                            saved = checkpoint
                            if (
                                mounted.current &&
                                profile()?.id === checkpoint.id
                            )
                                setTick((value) => value + 1)
                        })
                        .catch((reason) => {
                            failed = true
                            reportError(reason)
                            stopSearchingGalaxies(session.nativeMode)
                        })
                },
                onError: (reason) => {
                    if (settled) return
                    reportError(reason)
                    stopSearchingGalaxies(session.nativeMode)
                    finish()
                },
                onComplete: finish,
                onInterrupt: finish,
            })
        } catch (reason) {
            reportError(reason)
            finish()
        }
    }
    function onStopSearching() {
        const session = run.current
        if (!session) return
        session.stopRequested = true
        if (session.started) stopSearchingGalaxies(session.nativeMode)
    }
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            ++profileVersion.current
            const session = run.current
            if (session) {
                session.stopRequested = true
                if (session.started) stopSearchingGalaxies(session.nativeMode)
            }
        }
    }, [])
    useEffect(() => {
        const profileId = params.profileId
        // Saving can navigate to the profile already in memory. That route commit
        // must not invalidate a Start/Resume save which is already in flight.
        if (profileId === profile()?.id || (!profileId && !profile())) return
        const version = ++profileVersion.current
        let current = true
        const session = run.current
        if (session) {
            session.stopRequested = true
            if (session.started) stopSearchingGalaxies(session.nativeMode)
        }
        setCurrentPage(1)
        setExportModal(false)
        setProfileModal(false)
        setError("")
        if (!profileId) {
            setProfile(null)
            setName(t`Untitled`)
            setProgress(defaultProgress())
            setLoading(false)
            return
        }
        setLoading(true)
        setProfile(null)
        setProgress(defaultProgress())
        Promise.all([
            getMultiProfileInfo(profileId),
            getMultiProfileProgress(profileId),
        ])
            .then(([info, saved]) => {
                if (!current || version !== profileVersion.current) return
                if (info?.id === profileId) {
                    setProfile(info)
                    setName(info.name)
                    setProgress({
                        ...defaultProgress(),
                        ...(saved?.id === profileId
                            ? saved
                            : { id: profileId }),
                    })
                }
            })
            .catch((reason) => {
                if (current && version === profileVersion.current)
                    reportError(reason)
            })
            .finally(() => {
                if (current && version === profileVersion.current)
                    setLoading(false)
            })
        return () => {
            current = false
        }
    }, [
        params.profileId,
        profile,
        setCurrentPage,
        setError,
        setExportModal,
        setLoading,
        setName,
        setProfile,
        setProfileModal,
        setProgress,
    ])
    return (
        <div className={styles.content}>
            {error() && <div role="alert">{error()}</div>}
            <ProfileManager
                onLoad={() => setProfileModal(true)}
                onSave={onSaveProfile}
                onNew={onNewProfile}
                onClone={onCloneProfile}
                onClear={onClearProfile}
                onDelete={onDeleteProfile}
                disabled={isBusy()}
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
                searching={isBusy()}
            />
            <div className={styles.rules}>{t`Rules`}</div>
            <MultiRuleEditor
                value={progress.multiRules}
                onChange={(multiRules) => setProgress("multiRules", multiRules)}
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
                {store.searching ? (
                    <Button onClick={onStopSearching}>{t`Pause`}</Button>
                ) : hasCompleted() ? (
                    <span className={styles.completed}>{t`Completed!`}</span>
                ) : (
                    <Button
                        disabled={isBusy() || !isValid()}
                        onClick={onStartSearching}
                    >
                        {hasProgress() ? t`Resume` : t`Start`}
                    </Button>
                )}
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
                        updateKey={tick()}
                        params={progress.params}
                    />
                </>
            ) : null}
            <ProfilesModal
                visible={profileModal()}
                onClose={() => setProfileModal(false)}
                onSelect={onSelectProfile}
                loadProfiles={listMultiProfiles}
            />
            <ExportModal
                visible={exportModal()}
                onClose={() => setExportModal(false)}
                mode="galaxy"
                id={profile()?.id || ""}
                name={profile()?.name || ""}
                params={progress.params}
            />
        </div>
    )
}

export default FindGalaxy
