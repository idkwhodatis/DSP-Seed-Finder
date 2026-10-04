import { Switch } from "radix-ui"
import { cn } from "../lib/utils"
export default function Toggle(props: {
    className?: string
    value: boolean
    onChange?: (value: boolean) => void
    disabled?: boolean
    "aria-label"?: string
}) {
    return (
        <Switch.Root
            checked={props.value}
            onCheckedChange={props.onChange}
            disabled={props.disabled}
            aria-label={props["aria-label"] || "Toggle option"}
            className={cn(
                "inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent bg-input transition-colors data-[state=checked]:bg-primary disabled:opacity-50",
                props.className,
            )}
        >
            <Switch.Thumb className="block size-4 rounded-full bg-background shadow-sm transition-transform data-[state=checked]:translate-x-4" />
        </Switch.Root>
    )
}
