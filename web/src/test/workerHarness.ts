import { vi } from "vitest"

export class MockWorker extends EventTarget {
    static instances: MockWorker[] = []
    kind = "worker"
    terminated = false
    onmessage: ((event: MessageEvent) => void) | null = null
    onPost: ((value: unknown) => void) | null = null
    postMessage = vi.fn((value: unknown) => {
        this.onPost?.(value)
    })
    terminate = vi.fn(() => {
        this.terminated = true
    })
    constructor() {
        super()
        MockWorker.instances.push(this)
    }
    emit(data: unknown) {
        if (this.terminated) return
        const event = new MessageEvent("message", { data })
        this.dispatchEvent(event)
        this.onmessage?.(event)
    }
}
