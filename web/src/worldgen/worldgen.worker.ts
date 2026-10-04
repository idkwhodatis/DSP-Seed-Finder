import { TinyEmitter } from "tiny-emitter"
import init, { generate, findStars, searchStar } from "worldgen-wasm"

const TYPE_GENERATE = "generate"
const TYPE_SEARCH_STAR = "search_star"
const TYPE_FIND = "find"
const TYPE_NEXT = "next"
const emitter = new TinyEmitter()
let initialization: ReturnType<typeof init> | undefined
let failed = false
function reportError(error: unknown) {
    if (failed) return
    failed = true
    emitter.emit(TYPE_NEXT, null)
    self.postMessage({ type: "error", error: String(error) })
}
// Rust's asynchronous find loop can reject after the entrypoint has returned.
self.addEventListener("unhandledrejection", (event) => {
    event.preventDefault()
    reportError(event.reason)
})
const worldgen = {
    async found(result: integer[]) {
        if (failed) return null
        const wait = new Promise<number[] | null>((resolve) =>
            emitter.once(TYPE_NEXT, resolve),
        )
        self.postMessage({ type: TYPE_FIND, data: result })
        return wait
    },
}
;(self as unknown as { worldgen: typeof worldgen }).worldgen = worldgen

function parameters({
    resourceMultiplier = 1,
    starCount = 64,
    hiveInitialColonize = 1,
    hiveMaxDensity = 1,
    useActualVeins = true,
}: Partial<GameParameters>): GameParameters {
    return {
        resourceMultiplier,
        starCount,
        hiveInitialColonize,
        hiveMaxDensity,
        useActualVeins,
    }
}
async function handle(type: string, input: any) {
    if (failed) return
    if (type === TYPE_NEXT) {
        emitter.emit(TYPE_NEXT, input)
        return
    }
    initialization ??= init()
    await initialization
    if (type === TYPE_GENERATE) {
        self.postMessage({
            type,
            data: generate(input.seed, parameters(input.gameDesc)),
        })
    } else if (type === TYPE_SEARCH_STAR) {
        self.postMessage({
            type,
            data: searchStar(
                input.seed,
                parameters(input.gameDesc),
                input.rule,
            ),
        })
    } else if (type === TYPE_FIND) {
        await findStars(parameters(input.game), input.rule, input.seeds)
    }
}
self.onmessage = (event) => {
    void handle(event.data.type, event.data.input).catch(reportError)
}
