import type { FC as Component } from "react"
import NumberInput from "../components/NumberInput"
import { maxStarCount, minStarCount } from "../util"
const StarCountSelector: Component<{
    className?: string
    value: integer
    onChange: (value: integer) => void
    disabled?: boolean
}> = (props) => {
    return (
        <NumberInput
            aria-label="Number of stars"
            className={props.className}
            value={props.value}
            onChange={(value) => props.onChange(value)}
            error={props.value < minStarCount || props.value > maxStarCount}
            emptyValue={0}
            disabled={props.disabled}
        />
    )
}
export default StarCountSelector
