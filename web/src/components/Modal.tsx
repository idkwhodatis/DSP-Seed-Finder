import type { PropsWithChildren } from "react"
import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import { cn } from "../lib/utils"
export default function Modal(
    props: PropsWithChildren<{
        className?: string
        visible: boolean
        onClose?: () => void
        backdropDismiss?: boolean
        title?: string
    }>,
) {
    return (
        <Dialog.Root
            open={props.visible}
            onOpenChange={(open) => {
                if (!open) props.onClose?.()
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
                <Dialog.Content
                    aria-describedby={undefined}
                    onInteractOutside={(e) => {
                        if (!props.backdropDismiss) e.preventDefault()
                    }}
                    className={cn(
                        "fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-max max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-xl",
                        props.className,
                    )}
                >
                    <Dialog.Title className="sr-only">
                        {props.title || "DSP Seed Finder"}
                    </Dialog.Title>
                    {props.onClose && (
                        <Dialog.Close
                            aria-label="Close dialog"
                            className="absolute top-2 right-2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                        >
                            <X size={16} />
                        </Dialog.Close>
                    )}
                    {props.children}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
