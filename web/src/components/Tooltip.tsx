import type { PropsWithChildren } from "react"
import { Tooltip as Primitive } from "radix-ui"
export default function Tooltip(
    props: PropsWithChildren<{ text: string; className?: string }>,
) {
    return (
        <Primitive.Provider delayDuration={250}>
            <Primitive.Root>
                <Primitive.Trigger asChild>
                    <span tabIndex={0} className={props.className}>
                        {props.children}
                    </span>
                </Primitive.Trigger>
                <Primitive.Portal>
                    <Primitive.Content
                        sideOffset={5}
                        className="z-50 max-w-80 rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
                    >
                        {props.text}
                        <Primitive.Arrow className="fill-popover" />
                    </Primitive.Content>
                </Primitive.Portal>
            </Primitive.Root>
        </Primitive.Provider>
    )
}
