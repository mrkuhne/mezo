// ============================================================
// Mezo · TitanScene — az ÉLŐ titán társ (mezo-mhum, Task 7).
//
// A `docs/design_2.0/prototypes/companion-titanium/main.js` jelenet-gráfjának hűséges
// portja: három elvékonyodó titánszirom + arany mag + négy pálya + részecskemező,
// procedurális „stúdió" környezettel (softbox-síkok → PMREM), UnrealBloom composerrel
// és a prototípus tétlen (idle) animációs hurkával. A kamera az EMBED állását veszi fel
// (z = 7.8) — a prototípusban a Nap-oldal iframe-je is ezt látja.
//
// A prototípus INTERAKTÍV rétege (szünet/reset gomb, energia-csúszka, mód-váltó,
// postMessage híd, pointer-drag) NEM kerül át: itt a társ egy koppintható jelenlét-jel a
// Nap nyitóoldalán, a húzás elnyelné a saját koppintását. Ami átjön: a mód-táblázat
// (a jelenet alapállapota `listen`), a mozgás-skála, és a teljes rajzolási hurok.
//
// FONTOS — ez a modul CSAK lusta (React.lazy + dynamic import) úton kerülhet be, hogy a
// three.js a saját chunkjában maradjon és a fő bundle-t ne hízlalja. A hívó a
// `TitanCompanion`, ami WebGL nélkül vagy csökkentett mozgás mellett el sem jut idáig.
// WebGL a jsdomban nem fut, ezért ennek a fájlnak SZÁNDÉKOSAN nincs unit tesztje — a
// határt (mikor NEM töltődik be) a TitanCompanion.test.tsx őrzi.
// ============================================================
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

/** A prototípus mód-táblázata. A produkcióban a `listen` alapállapot fut; a másik kettő
 *  azért marad itt, mert a hurok interpolációja rájuk hivatkozik (és a következő szelet
 *  köti majd a társ hangulatához). */
const MODES = {
  listen: { spread: 0, speed: 0.12, glow: 1, color: '#b2a0ff' },
  connect: { spread: 0.15, speed: 0.3, glow: 1.4, color: '#80dbe4' },
  celebrate: { spread: 0.48, speed: 0.48, glow: 2.1, color: '#f0cc85' },
} as const
export type TitanMode = keyof typeof MODES

/** A felhasználó kérésére 60%-kal nyugodtabb, mint a kiinduló tanulmány (prototípus). */
const MOTION_SCALE = 0.4
/** A prototípus pixelarány-plafonja. Szigorúbb, mint a Task 7 által kért ≤2 — a bloom
 *  composer két teljes képernyős puffere retina alatt enélkül tényleg megfekszi a GPU-t. */
const MAX_PIXEL_RATIO = 1.75
/** Embed-kamera: a Nap-oldalon a prototípus iframe-je is ezt az állást mutatja. */
const EMBED_CAMERA_Z = 7.8

export function TitanScene({ mode = 'listen' }: { mode?: TitanMode }) {
  // `<span>`, nem `<div>`: a jelenet a TitanCompanion `<button>`-jén BELÜL él, oda pedig
  // blokk-szintű elem nem kerülhet (érvénytelen HTML, a React is figyelmeztetne rá).
  const hostRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      // WebGL-t a hívó már ellenőrizte; ha mégis elszáll, a társ egyszerűen üres marad
      // (a TitanCompanion aurája és gombja változatlanul ott van körülötte).
      return
    }

    // Minden eldobandó erőforrás EGY listán: a route-váltás a klasszikus szivárgáspont.
    const disposables: { dispose(): void }[] = []
    const track = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // A prototípus ide `#0b0d12`-t fest; a produkcióban a jelenet ÁTLÁTSZÓ marad, mert
    // pontosan ez a szín a `.titan-dark` vászna — ÉS mert így a mögötte ülő `.titan-aura`
    // (a szükségletek színe, a társ „életjel-mérője", C4) nem tűnik el a jelenet alatt.
    scene.background = null
    renderer.setClearColor(0x000000, 0)
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60)
    camera.position.set(0, 0.2, EMBED_CAMERA_Z)
    camera.lookAt(0, 0.18, 0)
    const group = new THREE.Group()
    group.position.y = -0.18
    scene.add(group)

    // ── Procedurális stúdió: nagy softboxok adják a mozgó tükröződéseket HDR letöltés nélkül.
    const studio = new THREE.Scene()
    studio.background = new THREE.Color('#171923')
    const softbox = (color: string, strength: number, position: [number, number, number], scale: [number, number]) => {
      const geo = track(new THREE.PlaneGeometry(...scale))
      const mat = track(new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide,
      }))
      const box = new THREE.Mesh(geo, mat)
      box.position.set(...position)
      box.lookAt(0, 0, 0)
      studio.add(box)
    }
    softbox('#e5e9ff', 5, [-3, 3, 4], [2, 7])
    softbox('#ffffff', 4, [3, 1, 3], [0.7, 6])
    softbox('#b79aff', 4, [-4, -1, 1], [2, 5])
    softbox('#71d7ec', 3, [3, -2, 0], [2, 4])
    softbox('#f4c67f', 3, [0, -4, 2], [4, 1])
    softbox('#ffffff', 3, [0, 5, -1], [5, 3])
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = pmrem.fromScene(studio, 0.07)
    scene.environment = env.texture
    track(env.texture)
    pmrem.dispose()

    scene.add(new THREE.AmbientLight('#b6c3ff', 0.35))
    const light = (color: string, power: number, x: number, y: number, z: number) => {
      const p = new THREE.PointLight(color, power, 12, 2)
      p.position.set(x, y, z)
      scene.add(p)
      return p
    }
    light('#dedfff', 32, -3, 4, 4)
    light('#9ad9ff', 17, 3, -1, 2)
    light('#aa72ff', 19, -3, -1, 1)
    const coreLight = light('#ffd298', 9, 0, -0.18, 0.45)

    // ── Elvékonyodó, hajlított héjak: három lekerekített, aszimmetrikus titánszirom.
    function petalGeometry() {
      const positions: number[] = [], uv: number[] = [], indices: number[] = [], N = 100, M = 36
      for (let i = 0; i <= N; i++) {
        const t = i / N, a = -0.75 + t * 1.95
        const r = 0.72 + 0.32 * t
        const cx = Math.cos(a) * r, cy = Math.sin(a) * r
        const thickness = Math.max(0.006, Math.pow(Math.sin(Math.PI * t), 0.64) * (0.34 + 0.1 * t))
        for (let j = 0; j <= M; j++) {
          const v = j / M * Math.PI * 2
          positions.push(
            cx + Math.cos(a) * Math.cos(v) * thickness,
            cy + Math.sin(a) * Math.cos(v) * thickness,
            Math.sin(v) * thickness * 0.7 + Math.sin(t * Math.PI) * 0.07,
          )
          uv.push(t, j / M)
          if (i < N && j < M) {
            const k = i * (M + 1) + j
            indices.push(k, k + M + 1, k + 1, k + 1, k + M + 1, k + M + 2)
          }
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      g.setIndex(indices)
      g.computeVertexNormals()
      return g
    }
    const metal = track(new THREE.MeshPhysicalMaterial({
      color: '#8a8d9c', metalness: 1, roughness: 0.19, clearcoat: 1, clearcoatRoughness: 0.13,
      envMapIntensity: 1.4, iridescence: 0.3, iridescenceIOR: 1.3, iridescenceThicknessRange: [160, 390],
    }))
    const petalGeo = track(petalGeometry())
    const petals: THREE.Group[] = []
    const sparks: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = []
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group()
      pivot.rotation.z = i * Math.PI * 2 / 3 + 0.18
      pivot.add(new THREE.Mesh(petalGeo, metal))
      group.add(pivot)
      petals.push(pivot)
      const points: THREE.Vector3[] = []
      for (let j = 0; j <= 90; j++) {
        const t = 0.08 + j / 90 * 0.84, a = -0.75 + t * 1.95, r = 0.72 + 0.32 * t
        const thick = Math.pow(Math.sin(Math.PI * t), 0.64) * (0.34 + 0.1 * t)
        points.push(new THREE.Vector3(
          Math.cos(a) * (r - thick * 0.77),
          Math.sin(a) * (r - thick * 0.77),
          thick * 0.46 + Math.sin(t * Math.PI) * 0.07,
        ))
      }
      const seam = new THREE.Mesh(
        track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, 0.009, 6, false)),
        track(new THREE.MeshBasicMaterial({ color: ['#c49aff', '#91e5ef', '#ffd191'][i] })),
      )
      pivot.add(seam)
      // Rövid, világító varrat-töredékek: alkalmi helyi aktivitás, sosem teljes felvillanás.
      for (let j = 0; j < 2; j++) {
        const start = 15 + j * 38
        const spark = new THREE.Mesh(
          track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.slice(start, start + 9)), 16, 0.015, 6, false)),
          track(new THREE.MeshBasicMaterial({
            color: new THREE.Color(['#dcc5ff', '#b6f2f7', '#ffe4b8'][i]).multiplyScalar(1.7),
            transparent: true, opacity: 0, depthWrite: false,
          })),
        )
        pivot.add(spark)
        sparks.push(spark)
      }
    }

    const coreMat = track(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGlow: { value: 1 } },
      vertexShader: `varying vec3 vNormal; varying vec3 vView; varying vec3 vPosition; void main(){vPosition=position;vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;uniform float uTime;uniform float uGlow;void main(){float f=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.);float flow=sin(vPosition.x*18.+sin(vPosition.y*21.+uTime)*2.+uTime)*.5+.5;vec3 c=mix(vec3(.9,.36,.07),vec3(1.,.86,.5),flow*.35+.45);c+=f*vec3(1.,.78,.48)*1.8;gl_FragColor=vec4(c*uGlow,1.);}`,
    }))
    const core = new THREE.Mesh(track(new THREE.SphereGeometry(0.245, 48, 32)), coreMat)
    group.add(core)
    const coreRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.3, 0.009, 10, 100)),
      track(new THREE.MeshBasicMaterial({ color: '#e8ba7b' })),
    )
    coreRing.rotation.set(0.2, 0.35, 0.2)
    group.add(coreRing)

    // ── A pálya-síkok a forgó titán testtől FÜGGETLENÜL mozognak.
    const orbits: THREE.Group[] = []
    const dots: { mesh: THREE.Mesh; orbit: number; phase: number }[] = []
    const orbitSystem = new THREE.Group()
    scene.add(orbitSystem)
    const orbitColors = ['#c8a571', '#b6a0e4', '#91cbd8', '#c4b4cd']
    for (let i = 0; i < 4; i++) {
      const orbit = new THREE.Group()
      orbit.rotation.set(0.9 + i * 0.65, 0.3 + i * 0.7, 0.3 - i * 0.8)
      orbit.add(new THREE.Mesh(
        track(new THREE.TorusGeometry(1.65 + i * 0.14, 0.003, 5, 160)),
        track(new THREE.MeshBasicMaterial({ color: orbitColors[i], transparent: true, opacity: 0.42 })),
      ))
      orbitSystem.add(orbit)
      orbits.push(orbit)
      for (let j = 0; j < 3; j++) {
        const bead = new THREE.Mesh(
          track(new THREE.SphereGeometry(j ? 0.027 : 0.06, 20, 16)),
          track(new THREE.MeshPhysicalMaterial({
            color: orbitColors[i], emissive: orbitColors[i], emissiveIntensity: 0.3,
            metalness: 0.7, roughness: 0.15,
          })),
        )
        orbit.add(bead)
        dots.push({ mesh: bead, orbit: i, phase: j * 2.094 + i })
      }
    }

    const particleCount = 110
    const particles = track(new THREE.BufferGeometry())
    const particlePositions = new Float32Array(particleCount * 3)
    const seeds: { angle: number; radius: number; z: number; speed: number }[] = []
    for (let i = 0; i < particleCount; i++) {
      seeds.push({ angle: i * 2.39996, radius: 0.8 + (i % 17) / 17 * 1.7, z: Math.sin(i * 9.1) * 0.7, speed: 0.2 + (i % 7) / 10 })
    }
    particles.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const pointsMat = track(new THREE.PointsMaterial({
      color: '#d7bbf9', size: 0.016, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    group.add(new THREE.Points(particles, pointsMat))
    const pulse = new THREE.Mesh(
      track(new THREE.RingGeometry(0.99, 1.005, 160)),
      track(new THREE.MeshBasicMaterial({ color: '#f0c988', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })),
    )
    pulse.position.z = -0.35
    group.add(pulse)

    // ── Sötét, tükröződőnek látszó tócsa: horgonyt ad a lebegő formának talapzat nélkül.
    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = glowCanvas.height = 128
    const ctx = glowCanvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      gradient.addColorStop(0, 'rgba(176,133,236,.22)')
      gradient.addColorStop(0.4, 'rgba(137,106,204,.08)')
      gradient.addColorStop(1, 'rgba(80,60,110,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 128, 128)
    }
    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(4.7, 1.15)),
      track(new THREE.MeshBasicMaterial({ map: track(new THREE.CanvasTexture(glowCanvas)), transparent: true, depthWrite: false })),
    )
    ground.position.set(0, -2.06, -0.4)
    scene.add(ground)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 0.82)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height)
      composer.setSize(width, height)
      camera.aspect = width / height
      camera.position.z = EMBED_CAMERA_Z
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    // ── A tétlen hurok (a prototípus `animate`-je) ────────────────────────────
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const smooth = { spread: 0, speed: 0.12, glow: 1 }
    const target = MODES[mode]
    let paused = reduced?.matches ?? false
    let lost = false
    let raf = 0
    let last = performance.now()
    let time = 0, orbitTime = 0, burst = 0
    const energy = 0.55

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const moving = !paused && energy > 0
      const lerp = 1 - Math.exp(-dt * 3)
      if (moving) {
        orbitTime += dt
        time += dt * (0.2 + energy * 1.45) * MOTION_SCALE
        smooth.spread += (target.spread - smooth.spread) * lerp
        smooth.speed += (target.speed - smooth.speed) * lerp
        smooth.glow += (target.glow - smooth.glow) * lerp
        burst = Math.max(0, burst - dt * 0.4)
      } else {
        smooth.spread = target.spread; smooth.speed = target.speed; smooth.glow = target.glow
      }
      group.rotation.x = 0.1 + Math.sin(time * 0.3) * 0.07 * MOTION_SCALE
      group.rotation.y = -orbitTime * Math.PI / 36
      group.rotation.z = Math.sin(time * 0.17) * 0.12 * MOTION_SCALE
      group.position.y = -0.2 + Math.sin(time * 0.75) * 0.055 * MOTION_SCALE
      for (let i = 0; i < petals.length; i++) {
        const a = i * Math.PI * 2 / 3 + 0.18
        petals[i].rotation.z = a + Math.sin(time * smooth.speed + i * 0.2) * 0.14 * MOTION_SCALE + smooth.spread * 0.35
        petals[i].position.set(
          Math.cos(a + 0.2) * smooth.spread * 0.6,
          Math.sin(a + 0.2) * smooth.spread * 0.6,
          Math.sin(time * 0.55 + i * 2.09) * 0.065 * MOTION_SCALE,
        )
        petals[i].rotation.x = Math.sin(time * 0.4 + i * 2.09) * 0.09 * MOTION_SCALE
      }
      coreMat.uniforms.uTime.value = time * 0.65
      coreMat.uniforms.uGlow.value = smooth.glow * (0.94 + Math.sin(time * 1.2) * 0.06 * MOTION_SCALE)
      core.scale.setScalar(1 + Math.sin(time * 1.2) * 0.035 * MOTION_SCALE + smooth.spread * 0.12)
      coreLight.intensity = 8 * smooth.glow
      bloom.strength = 0.32 + smooth.glow * 0.11
      orbitSystem.position.copy(group.position)
      const firingCycle = orbitTime / 5.4
      const firingAge = (firingCycle % 1) * 5.4
      const firingIndex = (Math.floor(firingCycle) * 5 + 2) % sparks.length
      sparks.forEach((spark, i) => {
        spark.material.opacity = moving && i === firingIndex && firingAge < 1.1
          ? Math.pow(Math.sin(firingAge / 1.1 * Math.PI), 2) * 0.85 : 0
      })
      for (let i = 0; i < orbits.length; i++) {
        orbits[i].rotation.x = 0.9 + i * 0.65 + orbitTime * Math.PI / (26 + i * 8)
        orbits[i].rotation.z = 0.3 - i * 0.8 + time * 0.025 * (i ? -1 : 1)
      }
      dots.forEach((dot) => {
        const a = dot.phase + orbitTime * (0.22 + dot.orbit * 0.035) * (dot.orbit % 2 ? -1 : 1)
        const r = 1.65 + dot.orbit * 0.14
        dot.mesh.position.set(Math.cos(a) * r, Math.sin(a) * r, 0)
      })
      for (let i = 0; i < particleCount; i++) {
        const p = seeds[i], a = p.angle + time * 0.025 * p.speed, r = p.radius + (1 - burst) * burst * 3
        particlePositions[i * 3] = Math.cos(a) * r
        particlePositions[i * 3 + 1] = Math.sin(a) * r * 0.8
        particlePositions[i * 3 + 2] = p.z + Math.sin(time * 0.2 + i) * 0.08 * MOTION_SCALE
      }
      particles.attributes.position.needsUpdate = true
      pointsMat.opacity = 0.2 + smooth.spread * 0.4 + (moving ? burst * 0.5 : 0)
      pointsMat.color.set(target.color)
      pulse.scale.setScalar(1 + (1 - burst) * 2.2)
      pulse.material.opacity = 0
      composer.render()
    }

    // A hurok TÉNYLEG áll, amíg a lap háttérben van — a prototípus csak a rajzolást hagyta
    // ki, de tovább kért képkockákat. Egy telefonon ez mérhető akkumulátor.
    const start = () => { if (!raf && !lost) { last = performance.now(); raf = requestAnimationFrame(frame) } }
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0 } }
    const onVisibility = () => { if (document.hidden) stop(); else start() }
    const onReduced = (e: MediaQueryListEvent) => { paused = e.matches }
    const onContextLost = (e: Event) => { e.preventDefault(); lost = true; stop() }

    document.addEventListener('visibilitychange', onVisibility)
    reduced?.addEventListener('change', onReduced)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    if (!document.hidden) start()

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      reduced?.removeEventListener('change', onReduced)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      observer.disconnect()
      composer.dispose()
      disposables.forEach((d) => d.dispose())
      renderer.domElement.remove()
      renderer.dispose()
      renderer.forceContextLoss()
    }
  }, [mode])

  return <span className="titan-scene" ref={hostRef} aria-hidden="true" />
}
