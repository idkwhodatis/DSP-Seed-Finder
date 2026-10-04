import type { FC as Component } from "react"
import Input from "../components/Input"
import styles from "~styles"
import StarCountSelector from "./StarCountSelector"
import Tooltip from "../components/Tooltip"
import Toggle from "../components/Toggle"
const ExeUrl = `${import.meta.env.BASE_URL}downloads/DSP-Seed-Finder.exe`
import Button from "../components/Button"
import ResourceMultiplierSelector from "./ResourceMultiplierSelector"
import NumberInput from "../components/NumberInput"
import HiveInitialColonizeSelector from "./HiveInitialColonizeSelector"
import HiveMaxDensitySelector from "./HiveMaxDensitySelector"
import { Trans, useLingui } from "#lingui"
import type { SetObjectState as SetStoreFunction } from "../hooks/useLiveState"
import { Trash2 as IoTrash } from "lucide-react"
function extractSeeds(contents: string[]): FindRange | null {
    const raw = new Set<integer>()
    const regex = /^\d{1,8}(?!\d)/gm
    for (const content of contents) {
        const extracted = content.match(regex)
        if (extracted) {
            for (const num of extracted) {
                raw.add(Number(num))
            }
        }
    }
    if (raw.size === 0) {
        return null
    }
    const output = [...raw]
    output.sort((a, b) => a - b)
    return new Int32Array<ArrayBuffer>(output as any)
}
const MAX_SIZE = 10 * 1024 * 1024
const SeedImport: Component<{
    value: FindRange
    onChange: (value: FindRange) => void
    disabled: boolean
}> = (props) => {
    const { t } = useLingui()
    const onChange = (seeds: FindRange | null) => {
        if (seeds && !props.disabled) {
            props.onChange(seeds)
        }
    }
    const chooseFile = () => {
        if (props.disabled) return
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".txt, .csv, .tsv"
        input.multiple = true
        input.onchange = () => {
            if (!input.files) return
            const files = Array.from(input.files)
            const size = files.reduce((acc, file) => acc + file.size, 0)
            if (size > MAX_SIZE) return
            Promise.all(files.map((file) => file.text()))
                .then(extractSeeds)
                .then(onChange)
        }
        input.click()
    }
    return props.value instanceof Int32Array ? (
        <>
            <div className={styles.seedImport}>
                {t`Imported ${props.value.length} seeds`}
                {!props.disabled ? (
                    <>
                        <button
                            type="button"
                            aria-label="Remove imported seeds"
                            className={styles.delete}
                            onClick={() => onChange([0, 1e8])}
                        >
                            <IoTrash />
                        </button>
                    </>
                ) : null}
            </div>
        </>
    ) : (
        <Button
            disabled={props.disabled}
            onClick={chooseFile}
        >{t`Choose file`}</Button>
    )
}
const ProgressEditor: Component<{
    progress: ProfileProgressInfo
    onProgressChange: SetStoreFunction<ProfileProgressInfo>
    name: string
    onNameChange: (v: string) => void
    nativeMode: boolean
    onNativeModeChange: (v: boolean) => void
    isLoaded: boolean
    searching: boolean
}> = (props) => {
    const hasProgress = () => props.progress.nextBatchId > 0
    const isDisabled = () => props.searching || hasProgress()
    const { t } = useLingui()
    const isUsingImportSeed = () => props.progress.range instanceof Int32Array
    const seedStart = () => (isUsingImportSeed() ? 0 : props.progress.range[0])
    const seedEnd = () => (isUsingImportSeed() ? 1e8 : props.progress.range[1])
    return (
        <div className={styles.fields}>
            <div className={styles.field}>
                <div className={styles.label}>
                    {props.isLoaded ? t`Profile Name` : t`New Profile Name`}
                </div>
                <div className={styles.input}>
                    <Input
                        aria-label="Profile name"
                        value={props.name}
                        onChange={props.onNameChange}
                        error={props.name === ""}
                        disabled={props.searching}
                    />
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.label}>{t`Seed range`}</div>
                <div className={styles.input}>
                    <Trans>
                        <NumberInput
                            aria-label="First seed"
                            className={styles.inputSeed}
                            value={seedStart()}
                            onChange={(value) =>
                                props.onProgressChange("range", [
                                    value,
                                    seedEnd(),
                                ])
                            }
                            emptyValue={-1}
                            maxLength={8}
                            error={seedStart() < 0 || seedStart() >= seedEnd()}
                            disabled={isDisabled() || isUsingImportSeed()}
                        />{" "}
                        to{" "}
                        <NumberInput
                            aria-label="Last seed"
                            className={styles.inputSeed}
                            value={seedEnd() - 1}
                            onChange={(value) =>
                                props.onProgressChange("range", [
                                    seedStart(),
                                    value + 1,
                                ])
                            }
                            emptyValue={-1}
                            maxLength={8}
                            error={seedEnd() > 1e8 || seedStart() >= seedEnd()}
                            disabled={isDisabled() || isUsingImportSeed()}
                        />
                    </Trans>
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.label}>{t`Number of stars`}</div>
                <div className={styles.input}>
                    <StarCountSelector
                        className={styles.inputStandard}
                        value={props.progress.params.starCount}
                        onChange={(value) =>
                            props.onProgressChange("params", "starCount", value)
                        }
                        disabled={isDisabled()}
                    />
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.label}>
                    <Tooltip
                        text={t`Provide a seed list to limit the search to these seeds only. Must be .txt / .csv / .tsv. One seed per line. Maximum 10MB.`}
                    >
                        {t`Import seeds`}
                    </Tooltip>
                </div>
                <div className={styles.input}>
                    <SeedImport
                        value={props.progress.range}
                        onChange={(value) =>
                            props.onProgressChange("range", value)
                        }
                        disabled={isDisabled()}
                    />
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.label}>{t`Resource multiplier`}</div>
                <div className={styles.input}>
                    <ResourceMultiplierSelector
                        className={styles.inputStandard}
                        value={props.progress.params.resourceMultiplier}
                        onChange={(value) =>
                            props.onProgressChange(
                                "params",
                                "resourceMultiplier",
                                value,
                            )
                        }
                        disabled={isDisabled()}
                    />
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.label}>
                    <Tooltip
                        text={t`To run the search in (faster) native mode, click the download button and run the program on your PC, then enable this option.`}
                    >
                        {t`Native Mode`}
                    </Tooltip>
                </div>
                <div className={styles.input}>
                    <Toggle
                        aria-label="Native mode"
                        value={props.nativeMode}
                        onChange={props.onNativeModeChange}
                        disabled={props.searching}
                    />
                    {__HAS_NATIVE_DOWNLOAD__ && (
                        <a href={ExeUrl} download="DSP-Seed-Finder.exe">
                            <Button kind="outline">{t`Download`}</Button>
                        </a>
                    )}
                </div>
            </div>
            <div className={styles.field}>
                <div
                    className={styles.label}
                >{t`Dark Fog initial occupation`}</div>
                <div className={styles.input}>
                    <HiveInitialColonizeSelector
                        className={styles.inputStandard}
                        value={props.progress.params.hiveInitialColonize}
                        onChange={(value) =>
                            props.onProgressChange(
                                "params",
                                "hiveInitialColonize",
                                value,
                            )
                        }
                        disabled={isDisabled()}
                    />
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.label}>
                    <Tooltip
                        text={t`The number of parallel processes to run the search.`}
                    >
                        {t`Concurrency`}
                    </Tooltip>
                </div>
                <div className={styles.input}>
                    <NumberInput
                        aria-label="Concurrency"
                        className={styles.inputStandard}
                        value={props.progress.concurrency}
                        onChange={(value) =>
                            props.onProgressChange("concurrency", value)
                        }
                        emptyValue={-1}
                        maxLength={2}
                        error={
                            !Number.isInteger(props.progress.concurrency) ||
                            props.progress.concurrency < 1
                        }
                        disabled={props.searching}
                    />
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.label}>{t`Dark Fog max density`}</div>
                <div className={styles.input}>
                    <HiveMaxDensitySelector
                        className={styles.inputStandard}
                        value={props.progress.params.hiveMaxDensity}
                        onChange={(value) =>
                            props.onProgressChange(
                                "params",
                                "hiveMaxDensity",
                                value,
                            )
                        }
                        disabled={isDisabled()}
                    />
                </div>
            </div>
            <div className={styles.field}>
                <div className={styles.label}>
                    <Tooltip
                        text={t`Running autosave too frequently may decrease search performance.`}
                    >
                        {t`Autosave interval`}
                    </Tooltip>
                </div>
                <div className={styles.input}>
                    <Trans>
                        Every{" "}
                        <NumberInput
                            aria-label="Autosave interval"
                            className={styles.inputSmall}
                            value={props.progress.autosave}
                            onChange={(value) =>
                                props.onProgressChange("autosave", value)
                            }
                            emptyValue={-1}
                            error={props.progress.autosave <= 0}
                            disabled={props.searching}
                        />{" "}
                        seconds
                    </Trans>
                </div>
            </div>
        </div>
    )
}
export default ProgressEditor
