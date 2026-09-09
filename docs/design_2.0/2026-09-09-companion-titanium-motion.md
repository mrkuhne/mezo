# Mezo — liquid titanium companion motion study

Driver: `mezo-zm9m`. Approved scope: a standalone motion prototype of the B image concept,
not a production redesign. The user explicitly preferred B (dark liquid metal with an
illuminated core) over A (translucent glass). This is a visual direction under evaluation,
not a replacement of the current [design system](../features/_platform-design-system.md).

## Intent

The companion should feel like a strange intelligent presence that knows the user.
Keep the richness the user enjoyed in the Neon Forge Train prototype: custom dimensional
objects, colorful light, motion and enjoyable reactions. Emotional intensity varies with
context; the same material language should fit exercise and personal reflection.

## Prototype

Source: [companion-titanium](prototypes/companion-titanium/index.html).
From that directory: `npm ci`, then `npm run dev`; open `http://127.0.0.1:5189/`.
The server binds only to loopback. `npm run build` produces the standalone `dist/` bundle.

Three.js renders three tapered rounded titanium petals, a warm shader-driven core,
emissive inner seams, orbital beads and sparse particles. Procedural studio softboxes
supply reflections without remote HDR textures. Bloom supports the light treatment.
The generated B image is an art-direction reference, not a mesh or a promise of pixel parity.

Controls:
- **Figyel:** close, slow breathing form with lavender/cyan reflections.
- **Kapcsolódik:** slightly opens the form and shifts the interface accent to cyan.
- **Ünnepel:** opens wider, warms the core, adds a transient particle/ring pulse.
- **Energy:** controls motion speed; zero stops time progression. Autonomous speed and
  oscillation amplitudes use a 0.4 multiplier (60% reduction from the initial study);
  manual rotation and the distinct state poses retain their original range.
- **Pause:** freezes autonomous motion. Reduced-motion preference starts paused; explicit
  play can opt back into motion. State selection still displays a static version of its pose.
- **Drag / reset:** inspect the object and restore its orientation.
- **Journal reaction:** demonstrates a quiet acknowledgment through the connection pose,
  core light and message-card sheen. No outward ring or particle burst; those are reserved
  for celebration. No text is submitted, no data
  is saved and no real AI is connected; every sentence is illustrative mock copy.

The desktop study places the object beside its controls; mobile stacks them. It has no
production app imports, API calls, storage or account integration. Google Fonts provides
Manrope when available, with a system-font fallback. Three.js and Vite are pinned in an
isolated package with a committed npm lockfile. Production dependency files are untouched.

## Evaluation

Review silhouette, sense of intelligence, metal quality, listening/connecting/celebrating
motion and readability on mobile. The next design decision should come from trying this
study; the later three-context app prototype (Train / journal / Fuel) is outside this slice.

Verification: isolated Vite production build and browser inspection of WebGL rendering,
state switching, journal response, motion pause, energy control and narrow-screen layout.
The 3D bundle is intentionally isolated and currently exceeds Vite's 500 kB warning limit;
production adoption requires a separate mobile GPU/performance evaluation and lazy loading.
