# Galaxy animation

The map keeps its generated star positions, complete `xMidYMid meet` framing, compact layout, connectors, localized labels, keyboard navigation, and accessible SVG hit targets. The lazily loaded Three.js layer now renders actual stellar disks instead of placing the same glow behind every SVG circle. Successful rendering replaces the SVG artwork only; a loading, failed, or lost WebGL context retains the complete interactive SVG fallback.

## Stellar appearances

`GalaxyAnimation.stellar.ts` supplies a small, Three-independent visual model. Its shared disk-radius helper is used by the SVG and WebGL layers. Physical generator radius is compressed monotonically as `max(0.14, 0.8 * radius / (1 + radius))`: a radius of 1 maps to 0.4 map units and very large stars approach 0.8. Small main-sequence stars and neutron stars are visibly smaller, while red giants remain large because color does not determine size. Invalid radii use the radius-1 fallback. Giants use a separate smooth `0.85 + 0.35 * radius / (4 + radius)` band to stay visibly larger than hot main-sequence stars; physical ordering is preserved within each class and every spectral giant color uses the same curve. All non-giant disk sizes remain unchanged. Both SVG halos and GPU effect extents stay capped at 1.92 map units. The readable visual floor is in map units; no device-dependent point-size clamp changes centers or radii. Transparent hit targets are separate, retaining at least the original 0.4 map-unit radius and a 24-screen-pixel diameter after resizing.

`GalaxyAnimation.shaders.ts` contains the original procedural shader:

- Main-sequence stars have a rotating spherical photosphere, cellular granulation with cooler lanes, sparse active regions, limb darkening, a narrow chromosphere, irregular coronal streamers, and small magnetic-loop shapes
- Red giants have larger convection cells, warmer surfaces, and more active fringes; hotter blue giants have finer convection and whiter cores. The existing game spectral palette still supplies the surrounding warm/cool color
- White dwarfs have compact, much smoother white-blue disks and tightly decaying light rather than solar-sized coronas
- Neutron stars use a blue-white compact surface, a faint magnetic-field contour, and slow, oblique pulsing polar beams. This is an illustrative pulsar-like cue, not a claim that every neutron star has visible jets
- Black holes have an opaque dark central silhouette, narrow photon-ring cue, inclined filamented accretion disk, brighter approaching side, and a far-side lensed arc. This is an artistic impostor, not a relativistic ray tracer

The stellar batch uses normal alpha compositing so a black-hole center actually obscures the background. Bounded shader glow replaces full-screen bloom: bright cores remain readable without washing out the surface texture. Fine granulation fades as it becomes unresolved, and edge smoothing follows the actual framebuffer. Slow surface motion changes neither disk size nor star position.

## Selection and SVG layering

A star's keyboard/hover marker uses the same center as its hit target, a three-screen-pixel gap, and thin non-scaling segmented strokes. The global HTML focus outline is suppressed only for these SVG nodes; it previously expanded in viewBox units into an oversized box. Escape dismisses the label while retaining visible keyboard focus. Labels leave six pixels of clearance, and connector lines are masked inside stellar disks so they cannot obscure the WebGL surface.

## Rendering budget and lifecycle

- Three.js 0.186.1 is dynamically imported only when a map mounts
- Three draw calls: one instanced quad batch for every star, 180 faint background dust points, and a restrained procedural nebula
- Four shared vertices and six indices for all stellar billboards, with 14 per-instance floats. Quads avoid hardware point-size limits while retaining exact SVG alignment
- All stellar effects fit within 1.92 map units of their center, inside the existing 2-unit framing margin
- No downloaded textures, external asset requests, render targets, bloom/postprocessing pipeline, or additional runtime dependencies
- At most 30 rendered animation frames per second; device pixel ratio capped at 1.5
- Low-power WebGL context, no antialias/depth/stencil buffers, and fallback when the browser reports a major performance caveat
- Manual pause is remembered in local storage; the current rendered frame remains visible
- System reduced-motion preference produces a static frame with no animation loop
- Hidden tabs, offscreen maps, and zero-size surfaces do not run an animation loop. Until the first successful visible frame, status stays `loading` so SVG stars cannot disappear prematurely
- Unmount cancels RAF, disconnects observers/listeners, disposes geometries/materials/renderer, and releases its WebGL context
- Chunk, context, shader, and rendering failures leave the interactive SVG usable; controls explain when the static fallback is used

The visual RNG is deterministic and independent of galaxy generation. Star sorting copies the input array, and invalid display coordinates are skipped consistently across instance buffers. Rust, seed generation, planet/resource data, and game simulation are unchanged.

The desktop order remains star list, seed/type/resource information, then map. On narrow screens the map comes before statistics. The renderer remains a lazy Vite chunk rather than adding Three.js to the map-independent initial application payload.

## Technique references and licensing

The shader implementation is original code under this repository's Apache-2.0 license. No reference-project shader source, textures, or other assets are bundled or copied. See [Stellar rendering references](stellar-rendering-sources.md) for the verified, pinned MIT-compatible examples, scientific references, precise licensing, and explicit exclusions that informed the techniques.

## Verification and limits

Focused tests cover all five stellar model branches, warm/cool giant variation, exact shared radii, bounded effect extents, malformed spectral inputs, 64-star instance buffers, deterministic phases, non-mutation of game data, orthographic projection, and original shared colors. Lifecycle tests cover delayed import/unmount cancellation, StrictMode remounts, first-successful-frame fallback gating, paused/reduced-motion/hidden/offscreen/zero-size handling, frame/DPR caps, context/shader/render failures, and complete resource disposal. Integration tests retain accessible star links and inspect the SVG fallback and selection behavior.

The stellar vertex and fragment sources additionally passed an offline GLSL grammar/scope check with ShaderFrog's GLSL parser 7.0.1, installed only in temporary validation storage. This checks syntax, not GPU compilation or image quality. No parser dependency was added to the project.

**Live GPU visual verification remains outstanding.** This cloud browser has WebGL disabled; no browser flags, alternate GPU backend, or security bypass were used. Mocked lifecycle tests and offline parsing cannot establish shader-driver compatibility, actual frame time, or the final visual appearance. Validate on a supported WebGL device with representative 64-star maps, the five stellar types, narrow/wide viewports, pause/reduced-motion, and repeated route changes before describing the GPU visuals as verified.

Official implementation references: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [InstancedBufferGeometry](https://threejs.org/docs/pages/InstancedBufferGeometry.html), [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html).
