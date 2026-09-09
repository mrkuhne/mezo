import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const host = document.querySelector('#scene');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches, energy = .55, mode = 'listen', time = 0, burst = 0;
let last = performance.now(), drag = null, yaw = 0, pitch = 0, viewX = 0, viewY = 0;
const modes = {
  listen: { spread: 0, speed: .12, glow: 1, color: '#b2a0ff', label: 'MEZO FIGYEL', title: 'FIGYELEM', text: 'Nem kell összeszedetten mesélned.<br>Kezdd ott, ahol most vagy.' },
  connect: { spread: .15, speed: .3, glow: 1.4, color: '#80dbe4', label: 'MEZO KAPCSOLÓDIK', title: 'EGYÜTT GONDOLKODUNK', text: 'Néha két apró részlet között<br>kezd kirajzolódni valami.' },
  celebrate: { spread: .48, speed: .48, glow: 2.1, color: '#f0cc85', label: 'MEZO VELED ÜNNEPEL', title: 'EZ A TE PILLANATOD', text: 'Álljunk meg egy pillanatra.<br>Jó látni, hogy haladsz.' },
};
const smooth = { spread: 0, speed: .12, glow: 1 };
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch {
  document.querySelector('#loading').textContent = 'A 3D nézethez WebGL szükséges. Próbáld meg egy friss böngészőben.';
  document.querySelectorAll('button,input').forEach(el => { el.disabled = true; });
}
if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0d12');
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  camera.position.set(0, .2, 8.7);
  camera.lookAt(0, .18, 0);
  const group = new THREE.Group();
  group.position.y = -.18;
  scene.add(group);

  // Procedural studio: large softboxes give real moving reflections without HDR downloads.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#171923');
  function softbox(color, strength, position, scale) {
    const box = new THREE.Mesh(new THREE.PlaneGeometry(...scale), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    box.position.set(...position); box.lookAt(0, 0, 0); studio.add(box);
  }
  softbox('#e5e9ff', 5, [-3, 3, 4], [2, 7]);
  softbox('#ffffff', 4, [3, 1, 3], [.7, 6]);
  softbox('#b79aff', 4, [-4, -1, 1], [2, 5]);
  softbox('#71d7ec', 3, [3, -2, 0], [2, 4]);
  softbox('#f4c67f', 3, [0, -4, 2], [4, 1]);
  softbox('#ffffff', 3, [0, 5, -1], [5, 3]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(studio, .07);
  scene.environment = env.texture;
  pmrem.dispose();
  scene.add(new THREE.AmbientLight('#b6c3ff', .35));
  function light(color, power, x, y, z) {
    const p = new THREE.PointLight(color, power, 12, 2); p.position.set(x, y, z); scene.add(p); return p;
  }
  light('#dedfff', 32, -3, 4, 4);
  light('#9ad9ff', 17, 3, -1, 2);
  light('#aa72ff', 19, -3, -1, 1);
  const coreLight = light('#ffd298', 9, 0, -.18, .45);

  // Tapered, bent shells: three rounded asymmetric titanium petals, not a torus knot.
  function petalGeometry() {
    const positions = [], uv = [], indices = [], N = 100, M = 36;
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = -.75 + t * 1.95;
      const r = .72 + .32 * t;
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
      const thickness = Math.max(.006, Math.pow(Math.sin(Math.PI * t), .64) * (.34 + .1 * t));
      for (let j = 0; j <= M; j++) {
        const v = j / M * Math.PI * 2;
        positions.push(cx + Math.cos(a) * Math.cos(v) * thickness, cy + Math.sin(a) * Math.cos(v) * thickness, Math.sin(v) * thickness * .7 + Math.sin(t * Math.PI) * .07);
        uv.push(t, j / M);
        if (i < N && j < M) { const k = i * (M + 1) + j; indices.push(k, k + M + 1, k + 1, k + 1, k + M + 1, k + M + 2); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  const metal = new THREE.MeshPhysicalMaterial({ color: '#8a8d9c', metalness: 1, roughness: .19, clearcoat: 1, clearcoatRoughness: .13, envMapIntensity: 1.4, iridescence: .3, iridescenceIOR: 1.3, iridescenceThicknessRange: [160, 390] });
  const petalGeo = petalGeometry(), petals = [], seams = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group(); pivot.rotation.z = i * Math.PI * 2 / 3 + .18;
    const petal = new THREE.Mesh(petalGeo, metal); pivot.add(petal); group.add(pivot); petals.push(pivot);
    const points = [];
    for (let j = 0; j <= 90; j++) {
      const t = .08 + j / 90 * .84, a = -.75 + t * 1.95, r = .72 + .32 * t;
      const thick = Math.pow(Math.sin(Math.PI * t), .64) * (.34 + .1 * t);
      points.push(new THREE.Vector3(Math.cos(a) * (r - thick * .77), Math.sin(a) * (r - thick * .77), thick * .46 + Math.sin(t * Math.PI) * .07));
    }
    const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, .009, 6, false), new THREE.MeshBasicMaterial({ color: ['#c49aff', '#91e5ef', '#ffd191'][i] }));
    pivot.add(seam); seams.push(seam);
  }

  const coreMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: `varying vec3 vNormal; varying vec3 vView; varying vec3 vPosition; void main(){vPosition=position;vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;uniform float uTime;uniform float uGlow;void main(){float f=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.);float flow=sin(vPosition.x*18.+sin(vPosition.y*21.+uTime)*2.+uTime)*.5+.5;vec3 c=mix(vec3(.9,.36,.07),vec3(1.,.86,.5),flow*.35+.45);c+=f*vec3(1.,.78,.48)*1.8;gl_FragColor=vec4(c*uGlow,1.);}`,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(.245, 48, 32), coreMat); group.add(core);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(.3, .009, 10, 100), new THREE.MeshBasicMaterial({ color: '#e8ba7b' }));
  coreRing.rotation.set(.2, .35, .2); group.add(coreRing);

  const orbits = [], dots = [];
  for (let i = 0; i < 2; i++) {
    const orbit = new THREE.Group(); orbit.rotation.set(.9 + i * .65, .3 + i * .7, .3 - i * .8);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65 + i * .14, .003, 5, 160), new THREE.MeshBasicMaterial({ color: i ? '#b6a0e4' : '#c8a571', transparent: true, opacity: .28 }));
    orbit.add(ring); group.add(orbit); orbits.push(orbit);
    for (let j = 0; j < 3; j++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(j ? .027 : .06, 20, 16), new THREE.MeshPhysicalMaterial({ color: i ? '#aa99e0' : '#d7b582', emissive: i ? '#7e52c4' : '#a66930', emissiveIntensity: .3, metalness: .7, roughness: .15 }));
      orbit.add(bead); dots.push({ mesh: bead, orbit: i, phase: j * 2.094 + i });
    }
  }
  const particleCount = 110;
  const particles = new THREE.BufferGeometry(), particlePositions = new Float32Array(particleCount * 3), seeds = [];
  for (let i = 0; i < particleCount; i++) seeds.push({ angle: i * 2.39996, radius: .8 + (i % 17) / 17 * 1.7, z: Math.sin(i * 9.1) * .7, speed: .2 + (i % 7) / 10 });
  particles.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const pointsMat = new THREE.PointsMaterial({ color: '#d7bbf9', size: .016, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false });
  const field = new THREE.Points(particles, pointsMat); group.add(field);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(.99, 1.005, 160), new THREE.MeshBasicMaterial({ color: '#f0c988', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  pulse.position.z = -.35; group.add(pulse);

  // A dark reflective-looking pool anchors the floating form without a visible pedestal.
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
  const ctx = glowCanvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(176,133,236,.22)'); gradient.addColorStop(.4, 'rgba(137,106,204,.08)'); gradient.addColorStop(1, 'rgba(80,60,110,0)'); ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 1.15), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false }));
  ground.position.set(0, -2.06, -.4); scene.add(ground);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1,1), .45, .5, .82); composer.addPass(bloom); composer.addPass(new OutputPass());

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height); composer.setSize(width, height); camera.aspect = width / height;
    camera.position.z = width < 500 ? 10.7 : 8.7; camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  document.querySelector('#loading').remove();
  document.documentElement.dataset.ready = 'true';
  const pauseButton = document.querySelector('#pause');
  function syncPause() {
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? 'Mozgás folytatása' : 'Mozgás szüneteltetése');
    pauseButton.textContent = paused ? '▷' : 'Ⅱ';
  }
  syncPause();
  pauseButton.addEventListener('click', () => { paused = !paused; syncPause(); });
  reduced.addEventListener('change', e => { paused = e.matches; syncPause(); });
  document.querySelector('#reset').addEventListener('click', () => { yaw = pitch = 0; });
  document.querySelector('#intensity').addEventListener('input', e => { energy = Number(e.target.value) / 100; document.querySelector('#energy').value = `${e.target.value}%`; });
  function selectMode(next) {
    mode = next; const state = modes[mode];
    document.documentElement.style.setProperty('--accent', state.color);
    document.querySelectorAll('.mode').forEach(el => { const selected = el.dataset.mode === mode; el.classList.toggle('active', selected); el.setAttribute('aria-pressed', String(selected)); });
    document.querySelector('#scene-status').textContent = state.label;
    document.querySelector('#message-label').textContent = state.title;
    document.querySelector('#message-text').innerHTML = state.text;
    burst = mode === 'celebrate' ? 1 : .28;
    if (paused) Object.assign(smooth, { spread: state.spread, speed: state.speed, glow: state.glow });
  }
  document.querySelectorAll('.mode').forEach(el => el.addEventListener('click', () => selectMode(el.dataset.mode)));
  document.querySelector('#journal').addEventListener('click', () => {
    selectMode('connect');
    document.querySelector('#message-label').textContent = 'A GONDOLATOD MEGÉRKEZETT';
    document.querySelector('#message-text').innerHTML = 'Itt most helye van annak,<br>amit magaddal hoztál.';
    const message = document.querySelector('.message'); message.classList.remove('arrived'); void message.offsetWidth; message.classList.add('arrived');
    burst = .65;
  });
  host.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; host.setPointerCapture(e.pointerId); });
  host.addEventListener('pointermove', e => { if (drag) { yaw = drag.yaw + (e.clientX - drag.x) * .008; pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * .006, -.8, .8); } });
  host.addEventListener('pointerup', () => { drag = null; });
  host.addEventListener('pointercancel', () => { drag = null; });
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); paused = true; syncPause(); document.querySelector('#scene-status').textContent = 'A 3D NÉZET MEGSZAKADT · TÖLTSD ÚJRA'; });

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (document.hidden) return;
    const moving = !paused && energy > 0;
    const target = modes[mode], lerp = 1 - Math.exp(-dt * 3);
    if (moving) {
      time += dt * (.2 + energy * 1.45);
      smooth.spread += (target.spread - smooth.spread) * lerp;
      smooth.speed += (target.speed - smooth.speed) * lerp;
      smooth.glow += (target.glow - smooth.glow) * lerp;
      burst = Math.max(0, burst - dt * .4);
    } else Object.assign(smooth, { spread: target.spread, speed: target.speed, glow: target.glow });
    viewX += (pitch - viewX) * lerp; viewY += (yaw - viewY) * lerp;
    group.rotation.x = viewX + .1 + Math.sin(time * .3) * .07;
    group.rotation.y = viewY + Math.sin(time * .24) * .2;
    group.rotation.z = Math.sin(time * .17) * .12;
    group.position.y = -.2 + Math.sin(time * .75) * .055;
    for (let i = 0; i < petals.length; i++) {
      const a = i * Math.PI * 2 / 3 + .18;
      petals[i].rotation.z = a + Math.sin(time * smooth.speed + i * .2) * .14 + smooth.spread * .35;
      petals[i].position.set(Math.cos(a + .2) * smooth.spread * .6, Math.sin(a + .2) * smooth.spread * .6, Math.sin(time * .55 + i * 2.09) * .065);
      petals[i].rotation.x = Math.sin(time * .4 + i * 2.09) * .09;
    }
    coreMat.uniforms.uTime.value = time * .65;
    coreMat.uniforms.uGlow.value = smooth.glow * (.94 + Math.sin(time * 1.2) * .06);
    core.scale.setScalar(1 + Math.sin(time * 1.2) * .035 + smooth.spread * .12);
    coreLight.intensity = 8 * smooth.glow;
    bloom.strength = .32 + smooth.glow * .11;
    for (let i = 0; i < orbits.length; i++) orbits[i].rotation.z = .3 - i * .8 + time * .025 * (i ? -1 : 1);
    dots.forEach(dot => { const a = dot.phase + time * (.14 + smooth.speed * .2), r = 1.65 + dot.orbit * .14; dot.mesh.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); });
    for (let i = 0; i < particleCount; i++) {
      const p = seeds[i], a = p.angle + time * .025 * p.speed, r = p.radius + (1 - burst) * burst * 3;
      particlePositions[i*3] = Math.cos(a) * r;
      particlePositions[i*3+1] = Math.sin(a) * r * .8;
      particlePositions[i*3+2] = p.z + Math.sin(time * .2 + i) * .08;
    }
    particles.attributes.position.needsUpdate = true;
    pointsMat.opacity = .2 + smooth.spread * .4 + (moving ? burst * .5 : 0);
    pointsMat.color.set(target.color);
    pulse.scale.setScalar(1 + (1 - burst) * 2.2);
    pulse.material.opacity = moving ? Math.sin(burst * Math.PI) * .32 : 0;
    composer.render();
  }
  requestAnimationFrame(animate);
}
