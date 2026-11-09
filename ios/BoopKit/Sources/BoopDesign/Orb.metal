#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// Value noise + fbm for the slow inner flow.
static float hash21(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
static float vnoise(float2 p) {
    float2 i = floor(p), f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + float2(1, 0)), u.x),
               mix(hash21(i + float2(0, 1)), hash21(i + float2(1, 1)), u.x), u.y);
}
static float fbm(float2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + float2(1.7, 9.2); a *= 0.5; }
    return v;
}

/// A glass sphere with flowing colour inside and a liquid that fills to `level` (0...1).
/// tilt: surface slope from phone tilt / drag. rippleX/rippleAge: a tap ripple. speak: 0...1 while Boop talks.
[[ stitchable ]] half4 orb(float2 pos, half4 color, float2 size, float t,
                           half4 c1, half4 c2, half4 c3, half4 c4, float level,
                           float tilt, float rippleX, float rippleAge, float speak) {
    float2 uv = (pos / size) * 2.0 - 1.0;          // -1...1, y grows downward
    float r = length(uv);
    float aa = 3.0 / size.x;
    float mask = 1.0 - smoothstep(1.0 - aa, 1.0, r);
    if (mask <= 0.0) return half4(0.0);

    float z = sqrt(max(0.0, 1.0 - r * r));
    float3 n = normalize(float3(uv.x, uv.y, z));

    // Refracted interior: things bend toward the rim like inside a marble,
    // and the whole interior slowly twists (more at the rim) so it never looks the same twice.
    float2 q = uv / (0.45 + z) * 1.1;
    float tw = t * 0.16 + r * 1.6 + 0.6 * sin(t * 0.21);
    float cs = cos(tw), sn = sin(tw);
    q = float2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);

    float2 w = float2(fbm(q * 1.3 + float2(t * 0.15, -t * 0.11)),
                      fbm(q * 1.3 + float2(-t * 0.12, t * 0.13) + 5.2));
    float2 w2 = float2(fbm(q * 2.1 + w * 1.5 + t * 0.09), fbm(q * 2.1 - w * 1.5 - t * 0.07 + 3.1));
    float f = fbm(q * 1.7 + w2 * 2.2 + t * 0.05);

    // Palette drifts: which colour leads keeps changing over ~half a minute.
    float d1 = 0.5 + 0.5 * sin(t * 0.23), d2 = 0.5 + 0.5 * sin(t * 0.17 + 2.0);
    float3 col = mix(float3(c1.rgb), float3(c2.rgb), smoothstep(0.2 + 0.15 * d1, 0.65, f));
    col = mix(col, float3(c3.rgb), smoothstep(0.40, 0.85, w2.x) * (0.6 + 0.4 * d2));
    col = mix(col, float3(c4.rgb), smoothstep(0.55, 0.95, w2.y) * (0.35 + 0.4 * d1));

    // Liquid surface: two travelling waves whose height swells and settles.
    float talk = speak * (0.55 + 0.45 * sin(t * 11.0) * sin(t * 4.3));
    float amp = (1.0 + 0.7 * sin(t * 0.37) * sin(t * 0.23)) * (1.0 + 2.2 * talk);
    float surf = 1.0 - 2.0 * level
               - tilt * uv.x
               + amp * (0.030 * sin(uv.x * 4.0 + t * 1.5)
                      + 0.016 * sin(uv.x * 9.0 - t * 2.4)
                      + 0.008 * sin(uv.x * 17.0 + t * 3.7));
    if (rippleAge < 3.0) {
        float dx = abs(uv.x - rippleX);
        surf += 0.07 * exp(-rippleAge * 1.5) * exp(-dx * 1.8) * sin(dx * 20.0 - rippleAge * 13.0);
    }
    float inLiquid = smoothstep(surf - 0.012, surf + 0.012, uv.y);

    // Caustics: light patterns dancing in the liquid.
    float ca = fbm(q * 4.0 + float2(t * 0.35, t * 0.22));
    float caustic = pow(smoothstep(0.45, 0.85, ca), 3.0) * 0.55;

    // Rising bubbles, only inside the liquid.
    float bub = 0.0;
    for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float h = hash21(float2(fi, 3.7));
        float speed = 0.05 + 0.05 * hash21(float2(fi, 8.1));
        float span = (1.0 - surf) + 0.1;
        float by = 1.0 - fract(t * speed + h) * span;
        float bx = (hash21(float2(fi, 1.3)) * 1.3 - 0.65) + 0.04 * sin(t * 1.7 + fi * 2.0);
        float br = 0.012 + 0.02 * hash21(float2(fi, 5.9));
        float dd = length(uv - float2(bx, by));
        float ring = smoothstep(br, br * 0.6, dd) - smoothstep(br * 0.6, br * 0.2, dd) * 0.6;
        bub += ring * smoothstep(surf + 0.02, surf + 0.10, by);
    }

    float3 glass = col * 0.22 + float3(0.05, 0.05, 0.11);   // empty part: dim, tinted glass
    float3 liquid = col * (1.08 + 0.12 * talk) + caustic * float3(1.0, 0.97, 1.0) + bub * 0.6;
    float3 base = mix(glass, liquid, inLiquid);
    base += float3(1.0) * 0.45 * exp(-abs(uv.y - surf) * 70.0) * step(r, 0.985);   // bright meniscus line

    // Lighting.
    float3 L = normalize(float3(-0.45, -0.75, 0.55));
    float diff = clamp(dot(n, L), 0.0, 1.0);
    base *= 0.62 + 0.55 * diff;

    float fres = pow(1.0 - z, 2.2);
    base += fres * (float3(c3.rgb) * 0.55 + 0.18);          // rim light

    float3 H = normalize(L + float3(0, 0, 1));
    base += pow(clamp(dot(n, H), 0.0, 1.0), 70.0) * 0.95;   // sharp specular
    base += exp(-pow(length(uv - float2(-0.32, -0.42)) / 0.38, 2.0)) * 0.22;  // broad soft highlight
    base += float3(c2.rgb) * 0.18 * smoothstep(0.35, 1.0, uv.y) * z;          // bounce light at the bottom

    base = base / (1.0 + base * 0.25);                      // soft tone map
    return half4(half3(base * mask), half(mask));
}
