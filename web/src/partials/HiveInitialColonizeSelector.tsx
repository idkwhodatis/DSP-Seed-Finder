import type { FC as Component } from "react"
import Select from "../components/Select"
import { hiveInitialColonizeValues } from "../util"
const HiveInitialColonizeSelector: Component<{
    className?: string
    value: float
    onChange: (value: float) => void
    disabled?: boolean
}> = (props) => {
    return (
        <Select
            aria-label="Dark Fog initial occupation"
            className={props.className}
            value={props.value}
            onChange={(v) => props.onChange(v)}
            options={hiveInitialColonizeValues}
            getLabel={(x) => x * 100 + "%"}
            disabled={props.disabled}
        />
    )
}
export default HiveInitialColonizeSelector
