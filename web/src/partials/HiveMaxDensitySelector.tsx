import type { FC as Component } from "react"
import Select from "../components/Select"
import { hiveMaxDensityValues } from "../util"
const HiveMaxDensitySelector: Component<{
    className?: string
    value: float
    onChange: (value: float) => void
    disabled?: boolean
}> = (props) => {
    return (
        <Select
            aria-label="Dark Fog max density"
            className={props.className}
            value={props.value}
            onChange={(v) => props.onChange(v)}
            options={hiveMaxDensityValues}
            getLabel={(x) => x + "x"}
            disabled={props.disabled}
        />
    )
}
export default HiveMaxDensitySelector
