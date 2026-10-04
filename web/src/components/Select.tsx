import type { ReactNode } from "react"
import { Select as Primitive } from "radix-ui"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "../lib/utils"
export default function Select<T>(props: {
    className?: string
    value?: T
    placeholder?: string
    onChange?: (value: T) => void
    getLabel: (value: T) => ReactNode
    options: readonly T[]
    isSelected?: (value: T) => boolean
    error?: boolean
    disabled?: boolean
    "aria-label"?: string
}) {
    const index = props.options.findIndex(
        (x) => props.isSelected?.(x) || x === props.value,
    )
    return (
        <Primitive.Root
            value={index < 0 ? "" : String(index)}
            onValueChange={(i) => props.onChange?.(props.options[Number(i)]!)}
            disabled={props.disabled}
        >
            <Primitive.Trigger
                aria-label={props["aria-label"]}
                aria-invalid={props.error || undefined}
                className={cn(
                    "inline-flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50",
                    props.error && "border-destructive",
                    props.className,
                )}
            >
                <Primitive.Value placeholder={props.placeholder} />
                <Primitive.Icon>
                    <ChevronDown size={14} />
                </Primitive.Icon>
            </Primitive.Trigger>
            <Primitive.Portal>
                <Primitive.Content
                    position="popper"
                    sideOffset={4}
                    className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
                >
                    <Primitive.ScrollUpButton className="flex justify-center">
                        <ChevronUp size={14} />
                    </Primitive.ScrollUpButton>
                    <Primitive.Viewport className="p-1">
                        {props.options.map((option, i) => (
                            <Primitive.Item
                                key={i}
                                value={String(i)}
                                className="relative flex min-h-8 cursor-default items-center rounded-sm py-1 pr-7 pl-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                            >
                                <Primitive.ItemText>
                                    {props.getLabel(option)}
                                </Primitive.ItemText>
                                <Primitive.ItemIndicator className="absolute right-2">
                                    <Check size={14} />
                                </Primitive.ItemIndicator>
                            </Primitive.Item>
                        ))}
                    </Primitive.Viewport>
                    <Primitive.ScrollDownButton className="flex justify-center">
                        <ChevronDown size={14} />
                    </Primitive.ScrollDownButton>
                </Primitive.Content>
            </Primitive.Portal>
        </Primitive.Root>
    )
}
