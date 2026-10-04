import { useEffect, useRef, useState } from "react"
import Input, { type InputProps } from "./Input"
type Props = Omit<InputProps, "value" | "onChange" | "onBlur"> & {
    value: number
    emptyValue: number
    onChange?: (value: number) => void
    onBlur?: () => void
}
export default function NumberInput({
    value,
    emptyValue,
    onChange,
    onBlur,
    ...props
}: Props) {
    const getText = () => (value === emptyValue ? "" : String(value))
    const [text, setText] = useState(getText)
    const emitted = useRef<number | undefined>(undefined)
    useEffect(() => {
        // Keep transient drafts (".", "-", "1.") when a parent echoes our value.
        // A different external value still replaces the draft immediately.
        if (Object.is(emitted.current, value)) {
            emitted.current = undefined
            return
        }
        setText((old) =>
            (old === "" && value === emptyValue) ||
            (old !== "" && Number(old) === value)
                ? old
                : getText(),
        )
    }, [value, emptyValue])
    return (
        <Input
            {...props}
            inputMode="decimal"
            value={text}
            onBlur={() => {
                if (text !== "" && !Number.isFinite(Number(text)))
                    setText(getText())
                onBlur?.()
            }}
            onChange={(next) => {
                setText(next)
                const numeric =
                    next !== "" && Number.isFinite(Number(next))
                        ? Number(next)
                        : emptyValue
                emitted.current = numeric
                onChange?.(numeric)
            }}
        />
    )
}
