import type { ComponentProps } from "react"
import { Button as Base } from "./ui/button"
type Props = ComponentProps<"button"> & {
    kind?: "solid" | "outline"
    theme?: "default" | "error"
}
export default function Button({ kind, theme, ...props }: Props) {
    return (
        <Base
            variant={
                theme === "error"
                    ? "destructive"
                    : kind === "outline"
                      ? "outline"
                      : "default"
            }
            {...props}
        />
    )
}
