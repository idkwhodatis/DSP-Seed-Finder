# Galaxy animation

The map retains its SVG star nodes, connectors, localized labels, keyboard navigation, and complete `xMidYMid meet` framing. A decorative Three.js canvas behind the SVG adds softly pulsing coronas at the real star positions, 180 faint dust points, and a slow procedural nebula. It never moves the generated star positions or consumes the game generator's random stream.

The original desktop order is restored: star list, seed/type/resource information panel, then the map. On narrow screens the map comes before the statistics to keep the visualization reachable without scrolling past the whole resource inventory.

## Rendering budget

- Three.js 0.186.1 is loaded through a dynamic import only when a map mounts
- Three draw calls, no textures, external asset requests, bloom/postprocessing pipeline, or 3D physics
- At most 30 rendered animation frames per second; device pixel ratio capped at 1.5
- Low-power WebGL context, no antialias/depth/stencil buffers, and fallback when the browser reports a major performance caveat
- Manual pause is remembered in local storage; the current decorative frame remains visible
- System reduced-motion preference produces a static frame with no animation loop
- Hidden tabs, offscreen maps, and zero-size surfaces do not run an animation loop
- Unmount cancels RAF, disconnects observers/listeners, disposes geometries/materials/renderer and releases its WebGL context
- Chunk, context, shader, and rendering failures leave the interactive SVG usable; controls explain when a static map is used

The lazy renderer chunk is approximately 131 kB gzip. It does not inflate the initial map-independent JavaScript by the full Three.js payload. It produces Vite's informational 500 kB uncompressed chunk warning alongside the existing application/workbook chunks.

## Verification

Tests cover projection alignment at four aspect ratios, shared star colors, deterministic visual-only randomness, delayed import/unmount cancellation, StrictMode remounts, paused/reduced-motion/hidden/offscreen handling, frame/DPR caps, context loss, shader/render failures, and complete resource disposal. Integration tests retain every accessible star link and verify manual pause persistence and restored panel order. These mocked tests do not replace live GPU visual verification.

Official references: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html).
