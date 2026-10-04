import type { ComponentProps } from "react"
import { cn } from "../lib/utils"
export type InputProps = Omit<ComponentProps<"input">, "onChange"> & {
    onChange?: (value: string) => void
    error?: boolean
}
export default function Input({
    className,
    onChange,
    error,
    ...props
}: InputProps) {
    return (
        <input
            className={cn(
                "h-8 min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50",
                error && "border-destructive",
                className,
            )}
            aria-invalid={error || undefined}
            onChange={(e) => onChange?.(e.currentTarget.value)}
            {...props}
        />
    )
}
