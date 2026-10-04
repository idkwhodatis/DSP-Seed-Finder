import type { ComponentProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
export const buttonVariants = cva(
    "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:opacity-85",
                outline:
                    "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                destructive: "bg-destructive text-white hover:opacity-85",
                ghost: "hover:bg-accent hover:text-accent-foreground",
            },
        },
        defaultVariants: { variant: "default" },
    },
)
export function Button({
    className,
    variant,
    type = "button",
    ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
    return (
        <button
            type={type}
            className={cn(buttonVariants({ variant, className }))}
            {...props}
        />
    )
}
