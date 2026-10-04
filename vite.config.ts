import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { lingui } from "@lingui/vite-plugin"
import path from "node:path"
import fs from "node:fs"
const nativePath = path.resolve("target/release/dsp_seed.exe")
const nativeName = "downloads/DSP-Seed-Finder.exe"
const babel = { plugins: ["@lingui/babel-plugin-lingui-macro"] }
export default defineConfig({
    root: path.resolve("web"),
    base: "/DSP-Seed-Finder/",
    define: {
        __HAS_NATIVE_DOWNLOAD__: JSON.stringify(fs.existsSync(nativePath)),
    },
    build: { outDir: path.resolve("dist"), emptyOutDir: true },
    worker: { format: "es", plugins: () => [react({ babel }), lingui()] },
    plugins: [
        react({ babel }),
        tailwindcss(),
        lingui(),
        {
            name: "optional-native-download",
            generateBundle() {
                if (fs.existsSync(nativePath))
                    this.emitFile({
                        type: "asset",
                        fileName: nativeName,
                        source: fs.readFileSync(nativePath),
                    })
            },
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (
                        req.url?.split("?")[0] !==
                            `/DSP-Seed-Finder/${nativeName}` ||
                        !fs.existsSync(nativePath)
                    )
                        return next()
                    res.setHeader("Content-Type", "application/octet-stream")
                    res.setHeader(
                        "Content-Disposition",
                        'attachment; filename="DSP-Seed-Finder.exe"',
                    )
                    fs.createReadStream(nativePath).pipe(res)
                })
            },
        },
    ],
    resolve: {
        alias: [
            { find: "worldgen-wasm", replacement: path.resolve("pkg") },
            {
                find: "#lingui",
                replacement: path.resolve("web/src/lingui.tsx"),
            },
            {
                find: "#linguiCore",
                replacement: path.resolve("web/src/linguiCore.ts"),
            },
            {
                find: "~styles",
                replacement: "",
                customResolver: (_, importer) => {
                    if (!importer) return null
                    const p = path.parse(importer)
                    return path.join(p.dir, p.name + ".module.css")
                },
            },
        ],
    },
    test: {
        environment: "jsdom",
        setupFiles: [path.resolve("web/src/test/setup.ts")],
        include: ["src/**/*.test.{ts,tsx}"],
        restoreMocks: true,
    },
})
