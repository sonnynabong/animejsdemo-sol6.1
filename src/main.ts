import './style.css';
import { createTimeline, onScroll } from 'animejs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHAPTERS, DURATION, PARTS, chapterAt, clampProgress } from './sequence.mjs';

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Required element is missing: ${selector}`);
  return result;
}

const section = element('#scroll-study');
const panel = element('.scene-panel');
const canvas = element<HTMLCanvasElement>('#watch-canvas');
const loading = element('.loading');
const loadingText = element('#loading-text');
const retry = element<HTMLButtonElement>('#retry');
const fallback = element<HTMLImageElement>('.fallback-image');
const progressFill = element('#progress-fill');
const progressValue = element('#progress-value');
const chapterNumber = element('#chapter-number');
const chapterCategory = element('#chapter-category');
const chapterTitle = element('#chapter-title');
const chapterDescription = element('#chapter-description');
const scrollHint = element('#scroll-hint');
const intro = element('.intro');
const sequenceHeading = element('.sequence-heading');
const sequenceTitle = element('#sequence-title');
const dots = [...document.querySelectorAll<HTMLButtonElement>('.chapter-dot')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const narrowScreen = window.matchMedia('(max-width: 640px)');
const motion = { progress: 0, turn: 0, intro: 1 };
let activeChapter = -1;
let lastCopyProgress = -1;
let renderer: THREE.WebGLRenderer | undefined;
let environment: THREE.WebGLRenderTarget | undefined;
let timeline: ReturnType<typeof createTimeline> | undefined;
let observer: ReturnType<typeof onScroll> | undefined;
let frameId = 0;
let disposed = false;
let ready = false;
let hasWebGL = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
const rig = new THREE.Group();
scene.add(rig);
const keyLight = new THREE.DirectionalLight(0xffeed0, 3.5);
keyLight.position.set(3, 5, 7);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xd5f87f, 2.4);
rimLight.position.set(-4, 2, -4);
scene.add(rimLight, new THREE.HemisphereLight(0xe8eee1, 0x252c1f, 1.5));

interface MovingPart {
  id: string;
  wrapper: THREE.Group;
  home: THREE.Vector3;
  destination: THREE.Vector3;
  amount: number;
}
const movingParts: MovingPart[] = [];
const assembledBounds = new THREE.Box3();
const explodedBounds = new THREE.Box3();
const cameraTarget = new THREE.Vector3();
const cameraDirection = new THREE.Vector3(0.38, 0.21, 1).normalize();
let assembledDistance = 8;
let explodedDistance = 11;

function updateCopy(progress: number) {
  const p = clampProgress(progress);
  if (p === lastCopyProgress) return;
  lastCopyProgress = p;
  progressFill.style.width = `${p * 100}%`;
  progressValue.innerHTML = `${Math.round(p * 100).toString().padStart(3, '0')}<span>%</span>`;
  const chapter = chapterAt(p);
  if (chapter !== activeChapter) {
    const content = CHAPTERS[chapter];
    chapterNumber.textContent = (chapter + 1).toString().padStart(2, '0');
    chapterCategory.textContent = content.category;
    chapterTitle.textContent = content.title;
    chapterDescription.textContent = content.description;
    sequenceTitle.innerHTML = ['', 'Layer by<br /><em>layer.</em>', 'Time, made<br /><em>visible.</em>', 'Every part.<br /><em>One purpose.</em>'][chapter];
    dots.forEach((dot, index) => {
      dot.classList.toggle('is-active', index === chapter);
      if (index === chapter) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
    activeChapter = chapter;
  }
  scrollHint.textContent = reducedMotion.matches ? 'SCROLL TO THE CREDITS' : p > 0.92 ? 'SCROLL UP TO REASSEMBLE' : 'SCROLL TO DISASSEMBLE';
  // Semantic state is also useful when inspecting the running demo.
  section.dataset.progress = p.toFixed(4);
  section.dataset.chapter = String(chapter + 1);
}

function applyPose() {
  for (const part of movingParts) {
    part.wrapper.position.lerpVectors(part.home, part.destination, part.amount);
  }
  rig.rotation.set(0.05 + motion.turn * 0.08, -0.28 - motion.turn * 0.35, -0.14 + motion.turn * 0.06);
  const distance = THREE.MathUtils.lerp(assembledDistance, explodedDistance, motion.progress);
  // Shift slightly towards the exploded layers while keeping a stable viewing angle.
  cameraTarget.set(0, 0, THREE.MathUtils.lerp(0, 0.1, motion.progress));
  camera.position.copy(cameraDirection).multiplyScalar(distance).add(cameraTarget);
  camera.lookAt(cameraTarget);
  intro.style.opacity = String(motion.intro);
  intro.style.transform = `translateY(${-25 * (1 - motion.intro)}px)`;
  sequenceHeading.style.opacity = String(1 - motion.intro);
  sequenceHeading.style.transform = `translateY(${20 * motion.intro}px)`;
  // The initial mobile title occupies the top third. Give later layers more room.
  panel.style.transform = narrowScreen.matches ? `translateY(${-35 * (1 - motion.intro)}px)` : '';
  updateCopy(motion.progress);
}

function fitDistance(bounds: THREE.Box3, padding: number) {
  // Project all eight corners into the camera's fixed coordinate basis.
  const right = new THREE.Vector3().crossVectors(camera.up, cameraDirection).normalize();
  const up = new THREE.Vector3().crossVectors(cameraDirection, right).normalize();
  const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanHorizontal = tanVertical * camera.aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new THREE.Vector3(x, y, z);
        const depth = corner.dot(cameraDirection);
        distance = Math.max(distance, Math.abs(corner.dot(right)) * padding / tanHorizontal + depth,
          Math.abs(corner.dot(up)) * padding / tanVertical + depth);
      }
    }
  }
  return Math.max(distance, 4);
}

function measureBounds() {
  // Include the full rotation path and every explosion stage, rather than just the endpoints.
  assembledBounds.makeEmpty();
  explodedBounds.makeEmpty();
  for (let step = 0; step <= 10; step++) {
    const p = step / 10;
    rig.rotation.set(0.05 + p * 0.08, -0.28 - p * 0.35, -0.14 + p * 0.06);
    for (const part of movingParts) part.wrapper.position.copy(part.home);
    rig.updateMatrixWorld(true);
    const intact = new THREE.Box3().setFromObject(rig);
    assembledBounds.union(intact);
    for (const part of movingParts) part.wrapper.position.copy(part.destination);
    rig.updateMatrixWorld(true);
    explodedBounds.union(new THREE.Box3().setFromObject(rig));
  }
  applyPose();
}

function resize() {
  if (!renderer) return;
  const width = panel.clientWidth;
  const height = panel.clientHeight;
  if (!width || !height) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (ready) {
    assembledDistance = fitDistance(assembledBounds, narrowScreen.matches ? 1.08 : 1.03);
    explodedDistance = fitDistance(explodedBounds, narrowScreen.matches ? 1.14 : 1.1);
    applyPose();
    renderOnce();
  }
}

function renderOnce() {
  if (renderer && ready && !document.hidden && hasWebGL) renderer.render(scene, camera);
}

function tick() {
  frameId = 0;
  if (disposed || document.hidden || !ready || !hasWebGL) return;
  applyPose();
  renderOnce();
  if (!reducedMotion.matches) frameId = requestAnimationFrame(tick);
}

function requestRender() {
  if (!frameId && !disposed && ready && !document.hidden) frameId = requestAnimationFrame(tick);
}

function scrollProgress() {
  const range = Math.max(1, section.offsetHeight - element('.stage').offsetHeight);
  return clampProgress((window.scrollY - section.offsetTop) / range);
}

function configureMotion() {
  if (!ready) return;
  observer?.revert();
  timeline?.revert();
  observer = undefined;
  document.body.dataset.motion = reducedMotion.matches ? 'reduced' : 'full';
  lastCopyProgress = -1;
  for (const part of movingParts) part.amount = 0;
  Object.assign(motion, { progress: 0, turn: 0, intro: 1 });
  timeline = createTimeline({ autoplay: false, defaults: { ease: 'inOut(3)' } });
  timeline.add(motion, { progress: [0, 1], duration: DURATION, ease: 'linear' }, 0);
  timeline.add(motion, { turn: [0, 1], duration: 9000, ease: 'inOut(2)' }, 0);
  timeline.add(motion, { intro: [1, 0], duration: 1000, ease: 'out(2)' }, 1000);
  PARTS.forEach((spec, index) => {
    timeline!.add(movingParts[index], { amount: [0, 1], duration: spec.duration }, spec.start);
  });
  if (reducedMotion.matches) {
    timeline.seek(DURATION);
    scrollHint.textContent = 'SCROLL TO THE CREDITS';
    panel.setAttribute('aria-label', 'Static exploded view of a chronograph watch, showing its glass, bezel, hands, dial, band, controls, clasp, and backplate');
  } else {
    timeline.seek(scrollProgress() * DURATION);
    observer = onScroll({ target: section, enter: { target: 'top', container: 'top' },
      leave: { target: 'bottom', container: 'bottom' }, sync: 0.22 });
    observer.link(timeline);
    panel.setAttribute('aria-label', 'A gold and carbon fiber chronograph watch that separates into layers as you scroll');
  }
  resize();
  applyPose();
  if (reducedMotion.matches) scrollHint.textContent = 'SCROLL TO THE CREDITS';
  requestRender();
}

async function loadWatch() {
  if (!renderer || disposed) return;
  retry.hidden = true;
  loading.hidden = false;
  loading.classList.remove('is-error');
  fallback.hidden = true;
  loadingText.textContent = 'Preparing the object · 0%';
  try {
    const gltf = await new GLTFLoader().loadAsync('/models/chronograph.glb', (event) => {
      if (event.lengthComputable) loadingText.textContent = `Preparing the object · ${Math.round(event.loaded / event.total * 100)}%`;
    });
    if (disposed) return;
    const model = gltf.scene;
    const nodeMap = new Map<number, THREE.Object3D>();
    model.traverse((object) => {
      const association = gltf.parser.associations.get(object);
      if (association?.nodes !== undefined) nodeMap.set(association.nodes, object);
    });
    // Resolve the full configuration before changing the scene, so a missing node can be retried safely.
    for (const spec of PARTS) for (const node of spec.nodes) {
      if (!nodeMap.has(node)) throw new Error(`Asset component missing: ${spec.id} / node ${node}`);
    }
    const initialBounds = new THREE.Box3().setFromObject(model);
    const size = initialBounds.getSize(new THREE.Vector3());
    const center = initialBounds.getCenter(new THREE.Vector3());
    const scale = 4 / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(scale);
    model.position.copy(center).multiplyScalar(-scale);
    rig.add(model);
    scene.updateMatrixWorld(true);
    for (const spec of PARTS) {
      const wrapper = new THREE.Group();
      wrapper.name = `part-${spec.id}`;
      model.add(wrapper);
      for (const node of spec.nodes) wrapper.attach(nodeMap.get(node)!);
      const home = wrapper.position.clone();
      const destination = home.clone().add(new THREE.Vector3(...spec.offset).divideScalar(scale));
      movingParts.push({ id: spec.id, wrapper, home, destination, amount: 0 });
    }
    ready = true;
    section.dataset.asset = 'ready';
    measureBounds();
    loading.hidden = true;
    configureMotion();
  } catch (error) {
    console.error('Unable to load the chronograph:', error);
    section.dataset.asset = 'error';
    fallback.hidden = false;
    loading.classList.add('is-error');
    loadingText.textContent = 'The 3D object could not load.';
    retry.hidden = false;
  }
}

function showWebGLFallback(message: string) {
  hasWebGL = false;
  canvas.hidden = true;
  fallback.hidden = false;
  loading.hidden = true;
  section.dataset.asset = 'fallback';
  document.body.dataset.motion = 'reduced';
  chapterCategory.textContent = 'THE COMPLETE OBJECT';
  chapterTitle.textContent = 'A closer look at the chronograph.';
  chapterDescription.textContent = message;
  scrollHint.textContent = 'SCROLL TO THE CREDITS';
  panel.setAttribute('aria-label', `Chronograph watch preview. ${message}`);
}

function onVisibilityChange() {
  if (document.hidden) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  } else requestRender();
}

retry.addEventListener('click', () => void loadWatch());
for (const dot of dots) {
  dot.addEventListener('click', () => {
    const range = section.offsetHeight - element('.stage').offsetHeight;
    window.scrollTo({ top: section.offsetTop + Number(dot.dataset.stop) * range, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
}
document.addEventListener('visibilitychange', onVisibilityChange);
reducedMotion.addEventListener('change', configureMotion);
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(panel);
window.addEventListener('resize', () => observer?.refresh());
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  showWebGLFallback('The 3D view was interrupted. Reload the page to explore the components.');
});

function dispose() {
  disposed = true;
  cancelAnimationFrame(frameId);
  observer?.revert();
  timeline?.revert();
  resizeObserver.disconnect();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  reducedMotion.removeEventListener('change', configureMotion);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  environment?.dispose();
  renderer?.dispose();
}
if (import.meta.hot) import.meta.hot.dispose(dispose);

try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  // An opaque dark clear color keeps transmissive glass from sampling Three.js's
  // white alpha-pass fallback. CSS feathers the canvas edges into the page.
  renderer.setClearColor(0x191d19, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  resize();
  void loadWatch();
} catch {
  showWebGLFallback('Interactive 3D needs WebGL. You can still view the watch and explore its source below.');
}
