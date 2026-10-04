import { type FC, useEffect } from "react"
import { useLiveState, useObjectState } from "../hooks/useLiveState"
import Modal from "../components/Modal"
import Button from "../components/Button"
import { getMultiProfileResultRange, getProfileResultRange } from "../profile"
import { getExporter } from "../exporter"
import { TinyEmitter } from "tiny-emitter"
import styles from "~styles"
import StarCountSelector from "./StarCountSelector"
import ResourceMultiplierSelector from "./ResourceMultiplierSelector"
import NumberInput from "../components/NumberInput"
import Tooltip from "../components/Tooltip"
import Toggle from "../components/Toggle"
import Select from "../components/Select"
import { getDefaultParams, minStarCount, maxStarCount } from "../util"
import HiveInitialColonizeSelector from "./HiveInitialColonizeSelector"
import HiveMaxDensitySelector from "./HiveMaxDensitySelector"
import { useLingui } from "#lingui"
import { useStore } from "../store"

type Mode = "star" | "galaxy" | "single"
interface Options extends Pick<
    ExportOptions,
    "format" | "concurrency" | "params" | "language"
> {
    start: number
    end: number
}
function formatName(name: string, format: ExportOptions["format"]) {
    const safeName = name
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
        .trim()
        .replace(/[. ]+$/, "")
    return (safeName || "export") + "." + (format === "csv" ? "zip" : format)
}
async function getStarResults(id: string, start: number, end: number) {
    const results = await getProfileResultRange(id, start, end)
    return [...new Set(results.map((result) => result.seed))]
}
async function getGalaxyResults(id: string, start: number, end: number) {
    return (await getMultiProfileResultRange(id, start, end)).map(
        (result) => result.seed,
    )
}
async function execute(
    emitter: TinyEmitter,
    mode: Mode,
    id: string,
    { start, end, format, concurrency, params, language }: Options,
    signal: AbortSignal,
) {
    const getResults =
        mode === "star"
            ? getStarResults
            : mode === "galaxy"
              ? getGalaxyResults
              : () => [start]
    const results = await getResults(id, start, end)
    if (signal.aborted) return null
    if (format === "txt")
        return new Blob([results.join("\n")], { type: "text/plain" })
    emitter.emit("start", results.length)
    const blob = await getExporter(false)({
        format,
        concurrency,
        params,
        results,
        language,
        signal,
        onProgress: (current) => {
            if (!signal.aborted) emitter.emit("progress", current)
            return signal.aborted
        },
        onGenerate: () => {
            if (!signal.aborted) emitter.emit("end")
        },
    })
    return signal.aborted ? null : blob
}
enum Status {
    Starting,
    Progressing,
    Generating,
    Done,
    Failed,
}
const ProgressModal: FC<{
    visible: boolean
    onClose: () => void
    mode: Mode
    options: Options
    name: string
    id: string
}> = (props) => {
    const [progress, setProgress] = useLiveState(0)
    const [total, setTotal] = useLiveState(0)
    const [status, setStatus] = useLiveState<Status>(Status.Starting)
    const [url, setUrl] = useLiveState("")
    const { t } = useLingui()
    const progressText = () => {
        switch (status()) {
            case Status.Starting:
                return t`Retriving data`
            case Status.Progressing:
                return t`Exporting ${progress()} / ${total()}`
            case Status.Generating:
                return t`Generating file`
            case Status.Done:
                return t`Done`
            case Status.Failed:
                return t`Export failed. Please try again.`
        }
    }
    useEffect(() => {
        if (!props.visible) return
        let current = true
        let objectUrl = ""
        const controller = new AbortController()
        const emitter = new TinyEmitter()
        setUrl("")
        setProgress(0)
        setTotal(0)
        setStatus(Status.Starting)
        emitter.once("start", (count: integer) => {
            if (current) {
                setTotal(count)
                setStatus(Status.Progressing)
            }
        })
        emitter.on("progress", (count: integer) => {
            if (current) setProgress(count)
        })
        emitter.once("end", () => {
            if (current) setStatus(Status.Generating)
        })
        void execute(
            emitter,
            props.mode,
            props.id,
            props.options,
            controller.signal,
        )
            .then((blob) => {
                if (!current || !blob) return
                objectUrl = URL.createObjectURL(blob)
                setUrl(objectUrl)
                setStatus(Status.Done)
            })
            .catch((error) => {
                if (current) {
                    console.error(error)
                    setStatus(Status.Failed)
                }
            })
        return () => {
            current = false
            controller.abort()
            emitter.off("start")
            emitter.off("progress")
            emitter.off("end")
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [
        props.visible,
        props.mode,
        props.id,
        props.options,
        setProgress,
        setStatus,
        setTotal,
        setUrl,
    ])
    return (
        <Modal visible={props.visible}>
            <div className={styles.progressText}>{progressText()}</div>
            {url() && (
                <a
                    className={styles.download}
                    download={props.name}
                    href={url()}
                >
                    <Button className={styles.button}>{t`Download`}</Button>
                </a>
            )}
            <Button
                className={styles.button}
                kind="outline"
                onClick={props.onClose}
            >
                {status() === Status.Done || status() === Status.Failed
                    ? t`Close`
                    : t`Stop`}
            </Button>
        </Modal>
    )
}
const ExportModal: FC<{
    visible: boolean
    onClose: () => void
    mode: Mode
    id: string
    singleSeed?: integer
    name: string
    params: GameParameters
}> = (props) => {
    const [store] = useStore()
    const [options, setOptions] = useObjectState<Options>({
        start: 0,
        end: 99999999,
        params: getDefaultParams(),
        format: "xlsx",
        concurrency: navigator.hardwareConcurrency || 1,
        language: store.settings.language,
    })
    const { t } = useLingui()
    const [job, setJob] = useLiveState<{
        mode: Mode
        id: string
        name: string
        options: Options
    } | null>(null)
    useEffect(() => {
        if (props.visible)
            setOptions({
                params: { ...props.params },
                language: store.settings.language,
                start: props.singleSeed ?? 0,
            })
        else setJob(null)
    }, [
        props.visible,
        props.id,
        props.singleSeed,
        props.params,
        store.settings.language,
        setOptions,
        setJob,
    ])
    useEffect(() => {
        setJob(null)
    }, [props.visible, props.mode, props.id, props.singleSeed, setJob])
    const isValid = () =>
        Number.isInteger(options.start) &&
        Number.isInteger(options.end) &&
        options.start >= 0 &&
        options.start < 1e8 &&
        (props.mode === "single" ||
            (options.end >= options.start && options.end < 1e8)) &&
        (options.format === "txt" ||
            (Number.isInteger(options.concurrency) &&
                options.concurrency >= 1 &&
                Number.isInteger(options.params.starCount) &&
                options.params.starCount >= minStarCount &&
                options.params.starCount <= maxStarCount))
    function onExport() {
        if (job() || !isValid()) return
        setJob({
            mode: props.mode,
            id: props.id,
            name: formatName(props.name, options.format),
            options: { ...options, params: { ...options.params } },
        })
    }
    return (
        <Modal visible={props.visible} onClose={props.onClose} backdropDismiss>
            <div className={styles.title}>{t`Export`}</div>
            {props.mode !== "single" && options.format !== "txt" ? (
                <>
                    <div className={styles.warn}>
                        {t`Warning: Exporting too many seeds may cause out of memory error.`}
                    </div>
                </>
            ) : null}
            <div className={styles.fields}>
                <div className={styles.label}>{t`Format`}</div>
                <div className={styles.input}>
                    <Select
                        className={styles.inputStandard}
                        value={options.format}
                        onChange={(value) => setOptions("format", value)}
                        options={
                            props.mode === "single"
                                ? (["xlsx", "csv"] as const)
                                : (["xlsx", "csv", "txt"] as const)
                        }
                        getLabel={(value) =>
                            value === "txt" ? t`Seed only` : value
                        }
                    />
                </div>
                {options.format !== "txt" ? (
                    <>
                        <div className={styles.label}>{t`Number of stars`}</div>
                        <div className={styles.input}>
                            <StarCountSelector
                                className={styles.inputStandard}
                                value={options.params.starCount}
                                onChange={(value) =>
                                    setOptions("params", "starCount", value)
                                }
                            />
                        </div>
                        <div
                            className={styles.label}
                        >{t`Resource multiplier`}</div>
                        <div className={styles.input}>
                            <ResourceMultiplierSelector
                                className={styles.inputStandard}
                                value={options.params.resourceMultiplier}
                                onChange={(value) =>
                                    setOptions(
                                        "params",
                                        "resourceMultiplier",
                                        value,
                                    )
                                }
                            />
                        </div>
                        <div
                            className={styles.label}
                        >{t`Dark Fog initial occupation`}</div>
                        <div className={styles.input}>
                            <HiveInitialColonizeSelector
                                className={styles.inputStandard}
                                value={options.params.hiveInitialColonize}
                                onChange={(value) =>
                                    setOptions(
                                        "params",
                                        "hiveInitialColonize",
                                        value,
                                    )
                                }
                            />
                        </div>
                        <div
                            className={styles.label}
                        >{t`Dark Fog max density`}</div>
                        <div className={styles.input}>
                            <HiveMaxDensitySelector
                                className={styles.inputStandard}
                                value={options.params.hiveMaxDensity}
                                onChange={(value) =>
                                    setOptions(
                                        "params",
                                        "hiveMaxDensity",
                                        value,
                                    )
                                }
                            />
                        </div>
                        <div className={styles.label}>
                            <Tooltip
                                text={t`It is much faster to estimate the amount of veins over generating the excat numbers.`}
                            >
                                {t`Use estimated veins`}
                            </Tooltip>
                            :
                        </div>
                        <div className={styles.input}>
                            <Toggle
                                value={!options.params.useActualVeins}
                                onChange={(value) =>
                                    setOptions(
                                        "params",
                                        "useActualVeins",
                                        !value,
                                    )
                                }
                            />
                        </div>
                    </>
                ) : null}
                {props.mode !== "single" ? (
                    <>
                        <div className={styles.label}>{t`Seed range`}</div>
                        <div className={styles.input}>
                            <NumberInput
                                className={styles.inputSeed}
                                value={options.start}
                                onChange={(value) => setOptions("start", value)}
                                emptyValue={-1}
                                maxLength={8}
                                error={
                                    options.start < 0 ||
                                    options.start > options.end
                                }
                            />{" "}
                            to{" "}
                            <NumberInput
                                className={styles.inputSeed}
                                value={options.end}
                                onChange={(value) => setOptions("end", value)}
                                emptyValue={-1}
                                maxLength={8}
                                error={
                                    options.end >= 1e8 ||
                                    options.start > options.end
                                }
                            />
                        </div>
                    </>
                ) : null}
                {props.mode !== "single" && options.format !== "txt" ? (
                    <>
                        <div className={styles.label}>{t`Concurrency`}</div>
                        <div className={styles.input}>
                            <NumberInput
                                className={styles.inputStandard}
                                value={options.concurrency}
                                onChange={(value) =>
                                    setOptions("concurrency", value)
                                }
                                emptyValue={-1}
                                maxLength={2}
                                error={
                                    !Number.isInteger(options.concurrency) ||
                                    options.concurrency < 1
                                }
                            />
                        </div>
                    </>
                ) : null}
            </div>
            <Button
                className={styles.button}
                disabled={!isValid() || !!job()}
                onClick={onExport}
            >
                {t`Export`}
            </Button>
            {props.visible && job() && (
                <ProgressModal
                    visible
                    onClose={() => setJob(null)}
                    {...job()!}
                />
            )}
        </Modal>
    )
}

export default ExportModal
