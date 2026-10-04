import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import {
    initSync,
    generate,
    searchStar,
    findStars,
} from "../pkg/dsp_seed_finder.js"

initSync({
    module: await readFile(
        new URL("../pkg/dsp_seed_finder_bg.wasm", import.meta.url),
    ),
})
const game = {
    starCount: 32,
    resourceMultiplier: 1,
    hiveInitialColonize: 1,
    hiveMaxDensity: 1,
    useActualVeins: false,
}
// Native serde emits compact f32 decimals; WASM exposes their expanded JS values.
// Preserve exact structure, integer counts and strings, allowing only float serialization noise.
function assertGalaxyEqual(actual, expected, location = "galaxy") {
    if (typeof actual === "number" && typeof expected === "number") {
        if (
            /\.(seed|index|orbitAround|orbitIndex|id|waterItemId|initialHiveCount|maxHiveCount|amount|minGroup|maxGroup|minPatch|maxPatch|minAmount|maxAmount)$/.test(
                location,
            )
        )
            assert.equal(actual, expected, location)
        else
            assert.ok(
                Math.abs(actual - expected) <=
                    1e-6 * Math.max(1, Math.abs(actual), Math.abs(expected)),
                `${location}: ${actual} !== ${expected}`,
            )
    } else if (Array.isArray(actual) && Array.isArray(expected)) {
        assert.equal(actual.length, expected.length, `${location}.length`)
        actual.forEach((value, index) =>
            assertGalaxyEqual(value, expected[index], `${location}[${index}]`),
        )
    } else if (
        actual &&
        expected &&
        typeof actual === "object" &&
        typeof expected === "object"
    ) {
        assert.deepEqual(
            Object.keys(actual).sort(),
            Object.keys(expected).sort(),
            `${location} keys`,
        )
        for (const key of Object.keys(actual))
            assertGalaxyEqual(actual[key], expected[key], `${location}.${key}`)
    } else assert.equal(actual, expected, location)
}
const native = spawn(
    fileURLToPath(
        new URL(
            `../target/release/dsp_seed${process.platform === "win32" ? ".exe" : ""}`,
            import.meta.url,
        ),
    ),
    [],
    { stdio: ["ignore", "pipe", "pipe"] },
)
let socket
let stderr = ""
native.stderr.on("data", (bytes) => {
    stderr += String(bytes)
})
const timeout = setTimeout(() => {
    native.kill()
    throw new Error(`Engine verification timed out. ${stderr}`)
}, 30000)
try {
    await new Promise((resolve, reject) => {
        let stdout = ""
        native.on("error", reject)
        native.on("exit", (code) =>
            reject(new Error(`Native process exited ${code}. ${stderr}`)),
        )
        native.stdout.on("data", (bytes) => {
            stdout += String(bytes)
            if (stdout.includes("Started.")) resolve()
        })
    })
    socket = new WebSocket("ws://127.0.0.1:62879")
    socket.binaryType = "arraybuffer"
    await new Promise((resolve, reject) => {
        socket.onopen = resolve
        socket.onerror = reject
    })
    const message = (payload) =>
        new Promise((resolve, reject) => {
            socket.onmessage = (event) =>
                resolve(
                    typeof event.data === "string"
                        ? JSON.parse(event.data)
                        : event.data,
                )
            socket.onerror = reject
            socket.onclose = () =>
                reject(
                    new Error("Native connection closed during verification"),
                )
            socket.send(
                typeof payload === "object" && !(payload instanceof Int32Array)
                    ? JSON.stringify(payload)
                    : payload,
            )
        })
    const scenarios = [
        { seed: 0, game },
        { seed: 12345678, game },
        {
            seed: 0,
            game: {
                ...game,
                resourceMultiplier: 2,
                hiveInitialColonize: 0,
                hiveMaxDensity: 2,
                useActualVeins: true,
            },
        },
    ]
    for (const { seed, game } of scenarios) {
        const wasm = generate(seed, game)
        const nativeGalaxy = (await message({ type: "Generate", seed, game }))
            .galaxy
        assert.equal(wasm.stars.length, game.starCount)
        assertGalaxyEqual(wasm, nativeGalaxy)
        for (const rule of [
            { type: "Birth" },
            { type: "Luminosity", condition: { type: "Gte", value: 1.5 } },
        ]) {
            assert.deepEqual(
                searchStar(seed, game, rule),
                (await message({ type: "SearchStar", seed, game, rule }))
                    .indexes,
            )
        }
    }
    for (const rule of [
        { type: "Birth" },
        {
            type: "And",
            rules: [
                { type: "Birth" },
                { type: "Luminosity", condition: { type: "Gte", value: 1 } },
            ],
        },
    ]) {
        const seeds = [
            [0, 1, 2],
            [3, 4],
        ]
        const expected = seeds.map((batch) =>
            batch.filter((seed) => searchStar(seed, game, rule).length > 0),
        )
        // The first case verifies seed zero; the second genuinely filters some seeds out.
        if (rule.type === "Birth") assert.deepEqual(expected, seeds)
        else assert.deepEqual(expected, [[2], [3]])
        assert.equal(
            (await message({ type: "Setup", concurrency: 2, game, rule }))
                .success,
            true,
        )
        for (let id = 0; id < seeds.length; id++) {
            const batch = new Int32Array(
                await message(new Int32Array([id, ...seeds[id]])),
            )
            assert.equal(batch[0], id)
            assert.deepEqual(
                [...batch.slice(1)].sort((a, b) => a - b),
                expected[id],
            )
        }
        const wasmBatches = []
        await new Promise((resolve) => {
            globalThis.worldgen = {
                found: async (result) => {
                    wasmBatches.push(result)
                    if (wasmBatches.length < seeds.length)
                        return seeds[wasmBatches.length]
                    resolve()
                    return null
                },
            }
            findStars(game, rule, seeds[0])
        })
        assert.deepEqual(wasmBatches, expected)
    }
    console.log(
        "Verified native/WebAssembly parity: 3 complete galaxies (estimated/actual veins), 6 rule searches, seed zero, and repeated filtered native/WASM batches",
    )
} finally {
    clearTimeout(timeout)
    socket?.close()
    native.kill()
}
