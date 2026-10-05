# Stellar rendering references

Reviewed on 2026-10-05. These projects inform the rendering techniques and visual vocabulary; they are not vendored shader dependencies. The implementation uses its own shaders and does not import the referenced projects' textures. This is a record of technique-only inspiration, not a claim that third-party code was copied.

## Pinned source references

### Farfall: resolved stellar surfaces

- Revision: [`84ad5cb389093216818c3c238b1c3e95df84ac0a`](https://github.com/Detcader101/farfall/commit/84ad5cb389093216818c3c238b1c3e95df84ac0a), resolved from `m1-planet`
- Source: [`shaders/bodies.wgsl`, Sun section](https://github.com/Detcader101/farfall/blob/84ad5cb389093216818c3c238b1c3e95df84ac0a/shaders/bodies.wgsl#L250-L334)
- License: [MIT](https://github.com/Detcader101/farfall/blob/84ad5cb389093216818c3c238b1c3e95df84ac0a/LICENSE-MIT), copyright 2026 The Farfall contributors. The [README](https://github.com/Detcader101/farfall/blob/84ad5cb389093216818c3c238b1c3e95df84ac0a/README.md) offers MIT or Apache-2.0 at the recipient's option

Useful ideas are object-space rotating surface noise, limb darkening, separate sunspot umbra and penumbra, and plasma beyond the stellar limb. The distant source is allowed to saturate, while a resolved surface uses lower brightness so its detail remains visible. Its surface pattern uses value noise; a cellular pattern can produce clearer convection boundaries. This is a WGSL implementation, not a drop-in Three.js shader.

### Otto Seiskari's black-hole: dark silhouette and luminous accretion

- Revision: [`74bdf38cb822605a5d3411f1561c965fe5fd5c0f`](https://github.com/oseiskar/black-hole/commit/74bdf38cb822605a5d3411f1561c965fe5fd5c0f), resolved from `master`
- Source: [`raytracer.glsl`](https://github.com/oseiskar/black-hole/blob/74bdf38cb822605a5d3411f1561c965fe5fd5c0f/raytracer.glsl)
- License: [COPYRIGHT.md](https://github.com/oseiskar/black-hole/blob/74bdf38cb822605a5d3411f1561c965fe5fd5c0f/COPYRIGHT.md) explicitly licenses this shader under MIT, copyright 2015 Otto Seiskari

The shader integrates curved light paths, intersects an accretion disk, applies Doppler/beaming effects, and keeps captured rays dark. These establish the visual distinction between a black hole and a glowing star. A compact galaxy-map representation can suggest the dark center, tilted disk, and uneven brightness without claiming to perform relativistic ray tracing. The upstream project itself documents numerical approximations and artificial disk textures.

The upstream `img/milkyway.jpg` is separately CC-BY-NC 2.0 and is excluded. The repository's MIT shader license must not be treated as a blanket license for that image or its bundled libraries.

### ESO/HITS Habitable Zones: animated stellar material in Three.js

- Revision: [`3aed8971007b690c80cbfc097c85dff3d45b657d`](https://gitlab.com/HITS_Supernova/0506_habitablezones/-/commit/3aed8971007b690c80cbfc097c85dff3d45b657d), resolved from `master`
- Source: [`WebGL/webgl_HabitableZones.html`, star shaders](https://gitlab.com/HITS_Supernova/0506_habitablezones/-/blob/3aed8971007b690c80cbfc097c85dff3d45b657d/WebGL/webgl_HabitableZones.html#L142-186)
- License: [MIT](https://gitlab.com/HITS_Supernova/0506_habitablezones/-/blob/3aed8971007b690c80cbfc097c85dff3d45b657d/LICENSE), copyright 2018 ESO Supernova Team at HITS gGmbH
- Provenance: the [README](https://gitlab.com/HITS_Supernova/0506_habitablezones/-/blob/3aed8971007b690c80cbfc097c85dff3d45b657d/README.md) identifies Dorotea Dudas's stellar shader and the MIT Three.js lava-shader example on which it builds

The useful technique is animated noise distortion of emissive surface coordinates: continuous flow reads more convincingly than independent brightness flicker. It is an older, texture-based example rather than a physical stellar simulation. Its image assets have several separate licenses and are not imported.

## Supporting references and exclusions

- [Stefan Gustavson's cellular3D.glsl](https://github.com/stegu/webgl-noise/blob/master/src/cellular3D.glsl) explicitly identifies its [MIT license](https://github.com/stegu/webgl-noise/blob/master/LICENSE). Its F1/F2 distances explain how cellular boundaries can drive dark lanes between brighter granules. This is a supporting algorithm reference, not an added dependency
- [ESO's observations of giant-star granulation](https://www.eso.org/public/unitedkingdom/news/eso1741/) support much larger and fewer surface cells on giants than on Sun-like stars. [NASA's stellar-type overview](https://science.nasa.gov/universe/stars/types/) distinguishes main-sequence stars, compact white dwarfs, and neutron stars/pulsars. The map exaggerates size, brightness, and selected pulsar cues for readability; these are illustrative renderings
- CosmosMuseum's Sun is an explicit Shadertoy port whose upstream permissive rights were not verified; it is excluded as a code source
- Eluvade/cosmos and Deep-Fold/PixelPlanets publish MIT licenses, but the latter's cellular function explicitly traces to a Dave_Hoskins Shadertoy shader whose original license was not verified. Their declarations alone were not treated as sufficient provenance for copying that function
- No Shadertoy code, downloaded stellar textures, or third-party reference screenshots are bundled by this work

If third-party code is adopted later, recheck the precise source and license, retain required notices, and document the change separately.

## Visual verification limit

Source and license inspection does not validate the final appearance. The available cloud browser has WebGL disabled; its flags were not changed to bypass that restriction. Static reference images were inspected during research, but the new renderer could not receive live GPU visual approval there. Build checks, mocked renderer tests, and fallback checks cannot establish shader compilation on a real driver, bloom/exposure balance, animation quality, or GPU performance. A WebGL-enabled browser still needs to verify ordinary stars, giants, white dwarfs, neutron stars, and black holes at map and close-up scales, including pause, reduced motion, selection alignment, and the SVG fallback.
