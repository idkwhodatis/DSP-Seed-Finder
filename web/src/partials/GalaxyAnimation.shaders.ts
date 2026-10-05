/**
 * Original, texture-free stellar impostors. No third-party shader code or assets.
 * The model is deliberately illustrative: the map isn't a physical ray tracer.
 */
export const stellarVertex = `
    attribute vec3 center;
    attribute vec3 tint;
    attribute vec4 profile;
    attribute vec4 detail;
    varying vec2 vPoint;
    varying vec3 vTint;
    varying vec4 vProfile;
    varying vec4 vDetail;
    void main() {
        vPoint = position.xy * profile.y;
        vTint = tint;
        vProfile = profile;
        vDetail = detail;
        vec3 billboard = center + vec3(position.xy * profile.x * profile.y, 0.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(billboard, 1.0);
    }
`

export const stellarFragment = `
    uniform float time;
    varying vec2 vPoint;
    varying vec3 vTint;
    // profile: disk radius, effect extent, object kind, deterministic phase
    varying vec4 vProfile;
    // detail: convection scale, activity, photosphere whiteness, orientation
    varying vec4 vDetail;

    vec3 cellHash(vec3 p) {
        vec3 wave = vec3(
            dot(p, vec3(113.0, 173.0, 197.0)),
            dot(p, vec3(199.0, 137.0, 109.0)),
            dot(p, vec3(157.0, 193.0, 151.0))
        );
        return fract(sin(wave) * vec3(43713.31, 39117.43, 47213.73));
    }

    float noise3(vec3 p) {
        vec3 cell = floor(p);
        vec3 t = fract(p);
        t = t * t * (3.0 - 2.0 * t);
        float a = mix(cellHash(cell).x, cellHash(cell + vec3(1,0,0)).x, t.x);
        float b = mix(cellHash(cell + vec3(0,1,0)).x, cellHash(cell + vec3(1,1,0)).x, t.x);
        float c = mix(cellHash(cell + vec3(0,0,1)).x, cellHash(cell + vec3(1,0,1)).x, t.x);
        float d = mix(cellHash(cell + vec3(0,1,1)).x, cellHash(cell + vec3(1,1,1)).x, t.x);
        return mix(mix(a, b, t.y), mix(c, d, t.y), t.z);
    }

    // Hot cell interiors, separated by cooler intergranular lanes on a sphere.
    float convection(vec3 p) {
        vec3 cell = floor(p);
        vec3 local = fract(p);
        float first = 8.0;
        float second = 8.0;
        for (int z = -1; z <= 1; z++) {
            for (int y = -1; y <= 1; y++) {
                for (int x = -1; x <= 1; x++) {
                    vec3 offset = vec3(float(x), float(y), float(z));
                    vec3 delta = offset + cellHash(cell + offset) - local;
                    float distanceSquared = dot(delta, delta);
                    if (distanceSquared < first) {
                        second = first;
                        first = distanceSquared;
                    } else {
                        second = min(second, distanceSquared);
                    }
                }
            }
        }
        return smoothstep(0.018, 0.26, second - first);
    }

    // GLSL pow(x, 2.0) is undefined for x < 0, even with an integer exponent.
    float gaussian(float offset) {
        return exp(-(offset * offset));
    }

    float safeAngle(vec2 p) {
        // atan(0, 0) is undefined; a NaN can survive an otherwise opaque mix.
        if (dot(p, p) < 0.00000001) return 0.0;
        return atan(p.y, p.x);
    }

    mat2 rotate(float angle) {
        float c = cos(angle), s = sin(angle);
        return mat2(c, -s, s, c);
    }

    void main() {
        vec2 p = vPoint;
        float r = length(p);
        float extent = vProfile.y;
        if (r > extent) discard;
        float kind = vProfile.z;
        float phase = vProfile.w;
        float activity = vDetail.y;
        float angle = safeAngle(p);
        // Analytic AA, in the disk's local units, follows resize and DPR exactly.
        float edge = max(fwidth(r), 0.002);
        float disk = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
        float outerFade = 1.0 - smoothstep(extent * 0.78, extent, r);
        vec3 rgb;
        float alpha;

        if (kind > 3.5) {
            // Inclined accretion flow plus the far-side gravitationally lensed arc.
            // The approaching side is brighter; the event-horizon silhouette stays opaque.
            vec2 q = rotate(vDetail.w) * p;
            float ellipse = length(vec2(q.x, q.y * 3.1));
            float diskBand = gaussian((ellipse - 2.05) / 0.57);
            float swirlAngle = safeAngle(vec2(q.x, q.y * 3.1));
            float filaments = 0.72 + 0.18 * sin(ellipse * 30.0 - swirlAngle * 3.0 - time * 0.7 + phase)
                + 0.10 * sin(ellipse * 53.0 + swirlAngle * 5.0 + time * 0.4);
            float approaching = 0.52 + 0.48 * smoothstep(-2.2, 1.6, q.x);
            float ring = gaussian((r - 1.07) / max(0.075, edge * 0.7));
            float upper = smoothstep(-0.20, 0.48, q.y);
            float lens = gaussian((length(vec2(q.x * 0.91, q.y)) - 1.48) / 0.15) * upper;
            float glow = exp(-max(r - 1.0, 0.0) * 1.8) * 0.09;
            float radiance = diskBand * filaments * approaching + lens * 0.48 + ring * 0.7;
            vec3 ember = mix(vec3(1.0, 0.26, 0.055), vec3(1.0, 0.82, 0.44),
                clamp(radiance * 0.9, 0.0, 1.0));
            rgb = ember * (0.65 + radiance * 0.55);
            alpha = clamp(radiance * 0.90 + glow, 0.0, 0.96) * outerFade;
            // Not additive: the center really occludes the nebula and far-side disk.
            rgb = mix(rgb, vec3(0.0015, 0.002, 0.005), disk);
            alpha = mix(alpha, 1.0, disk);
        } else if (kind > 2.5) {
            // A compact magnetic remnant: oblique polar beams, not a larger solar halo.
            vec2 q = rotate(vDetail.w + 0.07 * sin(time * 0.45 + phase)) * p;
            float axial = abs(q.y);
            float beamWidth = 0.09 + axial * 0.052;
            float beam = gaussian(q.x / beamWidth)
                * smoothstep(0.65, 1.25, axial) * exp(-axial * 0.37);
            float pulse = 0.72 + 0.28 * pow(max(0.0, 0.5 + 0.5 * sin(time * 1.7 + phase)), 3.0);
            float fieldRadius = length(vec2(q.x * 1.3, q.y * 0.78));
            float field = gaussian((fieldRadius - 1.55) / 0.10) * 0.14;
            float halo = exp(-max(r - 1.0, 0.0) * 3.4) * 0.22;
            rgb = mix(vec3(0.31, 0.55, 1.0), vTint, 0.23);
            alpha = (beam * pulse * 0.8 + field + halo) * outerFade;
            float mu = sqrt(max(0.0, 1.0 - r * r));
            vec3 core = mix(vec3(0.45, 0.70, 1.0), vec3(0.96, 0.98, 1.0), pow(mu, 0.38));
            rgb = mix(rgb, core, disk);
            alpha = mix(clamp(alpha, 0.0, 0.85), 1.0, disk);
        } else {
            float dwarf = step(1.5, kind);
            float giant = step(0.5, kind) * (1.0 - dwarf);
            float outside = max(r - 1.0, 0.0);
            // Thin chromosphere, asymmetric coronal streamers and anchored magnetic loops.
            float plume = 0.5 + 0.5 * sin(angle * 5.0 + phase + sin(angle * 3.0 - time * 0.055));
            float threads = pow(max(0.0, 0.5 + 0.5 * sin(angle * 31.0 + sin(angle * 9.0 + phase) * 2.0
                - outside * 2.1 - time * 0.10)), 6.0);
            float angularDetail = 1.0 - smoothstep(1.0, 3.0, edge * 31.0 / max(r, 1.0));
            threads = mix(0.18, threads, angularDetail);
            float corona = exp(-outside * 4.6) * 0.38
                + exp(-outside * (1.9 - plume * 0.65)) * (0.06 + threads * 0.085) * activity;
            float loopAngle = angle * 3.0 + phase;
            float loopHeight = 0.17 + 0.30 * pow(max(0.0, sin(loopAngle)), 1.4);
            float loops = gaussian((outside - loopHeight) / max(0.028, edge * 0.6))
                * pow(max(0.0, sin(loopAngle)), 1.8) * 0.22 * activity;
            corona = mix(corona + loops, exp(-outside * 5.5) * 0.34, dwarf);
            rgb = mix(vTint, vec3(0.68, 0.82, 1.0), dwarf * 0.75);
            alpha = corona * outerFade;

            if (r <= 1.0 + edge) {
                vec2 sphereXY = p / max(1.0, r);
                float mu = sqrt(max(0.0, 1.0 - dot(sphereXY, sphereXY)));
                vec3 sphere = vec3(sphereXY, mu);
                sphere.xz = rotate(time * mix(0.024, 0.012, giant) + phase) * sphere.xz;
                vec3 surfacePoint = sphere * vDetail.x + vec3(phase * 3.1);
                // Fade unresolved cellular lanes rather than shimmering at small map scales.
                float pixelFootprint = edge * vDetail.x / max(mu, 0.3);
                float resolved = 1.0 - smoothstep(0.55, 1.8, pixelFootprint);
                float granules = mix(0.60, convection(surfacePoint), resolved);
                float broad = noise3(sphere * 3.8 + vec3(phase));
                float fine = noise3(surfacePoint * 2.8 + vec3(0.0, time * 0.022, 0.0));
                float surfaceTexture = 0.65 + 0.40 * granules + (fine - 0.5) * 0.10 * resolved;
                // Infrequent cooler active regions; giants show broader convection instead.
                float spots = smoothstep(0.76, 0.89, broad) * (1.0 - dwarf) * (1.0 - giant * 0.5);
                surfaceTexture *= 1.0 - spots * 0.55;
                surfaceTexture = mix(surfaceTexture, 0.98 + (broad - 0.5) * 0.035, dwarf);
                float limb = 0.38 + 0.62 * pow(mu, mix(0.58, 0.30, dwarf));
                vec3 hot = mix(vTint, vec3(1.0, 0.96, 0.85), vDetail.z);
                hot = mix(hot, vec3(0.87, 0.94, 1.0), dwarf * 0.85);
                vec3 surface = hot * limb * surfaceTexture * 1.14;
                // A hot narrow rim resolves independently of the much dimmer outer corona.
                surface += vTint * gaussian((r - 0.99) / 0.035) * 0.15 * (1.0 - dwarf);
                rgb = mix(rgb, surface, disk);
                alpha = mix(alpha, 1.0, disk);
            }
        }

        if (alpha < 0.002) discard;
        gl_FragColor = vec4(rgb, clamp(alpha, 0.0, 1.0));
        #include <colorspace_fragment>
    }
`
