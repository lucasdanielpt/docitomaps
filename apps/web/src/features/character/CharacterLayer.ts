import maplibregl, {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethod,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * URLs candidatas do modelo, testadas em ordem. A primeira que responder 200
 * com Content-Type gltf/binary será carregada.
 */
export const CHARACTER_MODEL_URLS = [
  '/models/character.glb',
  '/models/Walking.glb',
  '/models/walking.glb',
];

const MIXAMO_UNIT_SCALE = 0.01;

/** Mixamo exporta em centímetros → escala para ~1.7m no espaço Three.js. */

/** Altura assumida do modelo em metros (Mixamo médio ≈ 1.7m). */
const CHARACTER_HEIGHT_METERS = 1.7;

/**
 * Rotação de correção para "levantar" o modelo Y-up (glTF/Three.js padrão)
 * para ficar em pé no plano do MapLibre (Z-up localmente).
 */
const AXIS_CORRECTION_X = Math.PI / 2;

/** Altitude acima do chão (m) — evita z-fighting com o plano do mapa. */
const CHARACTER_ALTITUDE_M = 0.8;

/** Escala inteligente: Mixamo cm (>10) ou GLB já em metros (~1,8 m). */
function computeModelScale(preHeight: number): number {
  if (preHeight <= 0) return MIXAMO_UNIT_SCALE;
  if (preHeight >= 0.8 && preHeight <= 3.5) {
    return CHARACTER_HEIGHT_METERS / preHeight;
  }
  if (preHeight > 10) return MIXAMO_UNIT_SCALE;
  return CHARACTER_HEIGHT_METERS / preHeight;
}

export type CharacterMotion = 'idle' | 'walk' | 'run';

export class CharacterLayer implements CustomLayerInterface {
  public readonly id = 'docito-character';
  public readonly type = 'custom' as const;
  public readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  /** Grupo do personagem (procedural ou GLB). Escondido em 1ª pessoa. */
  private modelGroup: THREE.Group | null = null;
  private debugBeacon: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private runAction: THREE.AnimationAction | null = null;
  private clock = new THREE.Clock();

  private currentLng = 0;
  private currentLat = 0;
  private currentHeadingDeg = 0;
  private currentSpeedNormalized = 0;
  private currentMotion: CharacterMotion = 'walk';

  public isUsingGltf = false;

  /** true após o primeiro frame renderizado (fallback marcador 2D). */
  get hasRenderedOnce(): boolean {
    return this.didLogFirstRender;
  }

  private readonly debug: boolean;
  private modelVisible = true;
  private hasPosition = false;
  private didLogFirstRender = false;

  constructor(options: { debug?: boolean } = {}) {
    this.debug = options.debug ?? false;
  }

  onAdd = (map: MapLibreMap, gl: WebGL2RenderingContext | WebGLRenderingContext): void => {
    this.map = map;

    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();

    const hemi = new THREE.HemisphereLight(0xffffff, 0xffd6df, 1.5);
    this.scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0, -70, 100).normalize();
    this.scene.add(sun);
    const sun2 = new THREE.DirectionalLight(0xffffff, 1.0);
    sun2.position.set(0, 70, 100).normalize();
    this.scene.add(sun2);

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    if (this.debug) {
      const anchorMat = new THREE.MeshBasicMaterial({
        color: 0xff2a68,
        side: THREE.DoubleSide,
      });
      const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), anchorMat);
      anchor.name = 'docito:anchor';
      anchor.position.set(1.2, 0, 0.5);
      this.scene.add(anchor);

      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a68 });
      const beacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(CHARACTER_HEIGHT_METERS * 0.7),
        beaconMat,
      );
      beacon.position.y = CHARACTER_HEIGHT_METERS * 2.2;
      this.debugBeacon = beacon;
      this.modelGroup.add(beacon);
    }

    const procedural = buildProceduralCharacter();
    this.modelGroup.add(procedural.object);
    this.mixer = procedural.mixer;
    this.walkAction = procedural.walkAction;
    this.runAction = procedural.runAction;

    void this.tryLoadFirstAvailable(CHARACTER_MODEL_URLS);

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl as WebGLRenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  };

  onRemove = (): void => {
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.modelGroup = null;
    this.debugBeacon = null;
    this.mixer = null;
    this.map = null;
  };

  update(
    lng: number,
    lat: number,
    headingDeg: number,
    speedNormalized: number,
    motion: CharacterMotion = 'walk',
  ): void {
    const moved =
      Math.abs(lng - this.currentLng) > 1e-9 ||
      Math.abs(lat - this.currentLat) > 1e-9 ||
      Math.abs(headingDeg - this.currentHeadingDeg) > 0.05;
    const motionChanged = motion !== this.currentMotion;

    this.currentLng = lng;
    this.currentLat = lat;
    this.currentHeadingDeg = headingDeg;
    this.currentSpeedNormalized = Math.max(0, Math.min(1, speedNormalized));
    if (motionChanged) {
      this.currentMotion = motion;
      this.applyMotion(motion);
    }
    this.hasPosition = true;

    // Repaint só se algo mudou ou a animação precisa de frames.
    if (moved || motionChanged || (this.mixer != null && this.currentMotion !== 'idle')) {
      this.map?.triggerRepaint();
    }
  }

  setModelVisible(visible: boolean): void {
    this.modelVisible = visible;
    if (this.modelGroup) this.modelGroup.visible = visible;
  }

  /**
   * Render segue o padrão oficial MapLibre + Three.js:
   * https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/
   *
   * A matriz do mapa (m) é multiplicada pela transformação local do modelo (l):
   * translate(merc) × scale(s, -s, s) × rotateX × rotateY × rotateZ
   */
  render: CustomRenderMethod = (gl, matrix) => {
    if (!this.renderer || !this.scene || !this.camera || !this.map) return;
    if (!this.hasPosition) return;

    const animating = this.mixer != null && this.currentMotion !== 'idle';
    const dt = this.clock.getDelta();
    if (animating) {
      const base =
        this.currentMotion === 'run'
          ? 1.4 + this.currentSpeedNormalized * 2.2
          : 0.6 + this.currentSpeedNormalized * 1.8;
      this.mixer!.timeScale = base;
      this.mixer!.update(dt);
    }

    const merc = MercatorCoordinate.fromLngLat(
      [this.currentLng, this.currentLat],
      CHARACTER_ALTITUDE_M,
    );
    const meterScale = merc.meterInMercatorCoordinateUnits();
    const headingRad = THREE.MathUtils.degToRad(-this.currentHeadingDeg);

    const rotationX = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(1, 0, 0),
      AXIS_CORRECTION_X,
    );
    const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), 0);
    const rotationZ = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(0, 0, 1),
      headingRad,
    );

    const m = new THREE.Matrix4().fromArray(matrix as unknown as number[]);
    const l = new THREE.Matrix4()
      .makeTranslation(merc.x, merc.y, merc.z)
      .scale(new THREE.Vector3(meterScale, -meterScale, meterScale))
      .multiply(rotationX)
      .multiply(rotationY)
      .multiply(rotationZ);

    this.camera.projectionMatrix = m.multiply(l);

    this.renderer.resetState();
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.renderer.render(this.scene, this.camera);

    if (!this.didLogFirstRender) {
      this.didLogFirstRender = true;
      // eslint-disable-next-line no-console
      console.info('[DocitoMapas][character] 1º render (matriz oficial MapLibre)', {
        lng: this.currentLng,
        lat: this.currentLat,
        meterScale,
        headingDeg: this.currentHeadingDeg,
        usingGltf: this.isUsingGltf,
      });
    }

    // Só pede novo frame enquanto a animação do personagem está ativa.
    // Antes: triggerRepaint() infinito → GPU quente mesmo pausado.
    if (animating) {
      this.map.triggerRepaint();
    }
  };

  private async tryLoadFirstAvailable(urls: string[]): Promise<void> {
    for (const url of urls) {
      try {
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok) continue;
        const contentType = head.headers.get('content-type') ?? '';
        if (
          !contentType.includes('gltf') &&
          !contentType.includes('octet-stream') &&
          !contentType.includes('binary')
        ) {
          continue;
        }
      } catch {
        continue;
      }

      const loader = new GLTFLoader();
      try {
        const gltf = await loader.loadAsync(url);
        this.installGltf(gltf);
        // eslint-disable-next-line no-console
        console.info(`[DocitoMapas] modelo 3D carregado: ${url}`);
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DocitoMapas] falha ao carregar ${url}, tentando próximo/fallback procedural:`,
          err,
        );
      }
    }
  }

  private installGltf(gltf: GLTF): void {
    if (!this.modelGroup) return;

    const model = gltf.scene;

    let hasSkinnedMesh = false;
    let meshCount = 0;
    model.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) hasSkinnedMesh = true;
      if ((obj as THREE.Mesh).isMesh) meshCount++;
    });

    // GLB sem skinning (Mixamo "Without Skin") substitui o procedural por mesh
    // estática/invisível — manter boneco candy até o usuário corrigir o arquivo.
    if (!hasSkinnedMesh) {
      // eslint-disable-next-line no-console
      console.warn(
        '[DocitoMapas][character] GLB ignorado: sem skinning (baixe Mixamo com "With Skin"). Mantendo boneco procedural.',
        { meshCount, animations: gltf.animations.length },
      );
      return;
    }

    const toRemove: THREE.Object3D[] = [];
    for (const child of this.modelGroup.children) {
      if (child === this.debugBeacon) continue;
      toRemove.push(child);
    }
    for (const c of toRemove) {
      this.modelGroup.remove(c);
      disposeObject(c);
    }

    const preBox = new THREE.Box3().setFromObject(model);
    const preSize = new THREE.Vector3();
    preBox.getSize(preSize);

    const materialsSummary: Array<{ name: string; type: string; opacity: number }> = [];

    model.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      const applyMatDefensive = (mat: THREE.Material | undefined): THREE.Material => {
        if (!mat) return new THREE.MeshStandardMaterial({ color: 0xff5a8a });
        const mm = mat.clone();
        mm.side = THREE.DoubleSide;
        if ('emissive' in mm) {
          (mm as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x2a0f18);
          (mm as THREE.MeshStandardMaterial).emissiveIntensity = 0.25;
        }
        return mm;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(applyMatDefensive);
        for (const mat of mesh.material) materialsSummary.push(matSummary(mat));
      } else {
        mesh.material = applyMatDefensive(mesh.material);
        materialsSummary.push(matSummary(mesh.material));
      }
    });

    model.scale.setScalar(computeModelScale(preSize.y));
    // Apoia os pés no chão local (Y-up antes da rotação global).
    const box = new THREE.Box3().setFromObject(model);
    model.position.set(0, -box.min.y, 0);
    this.modelGroup.add(model);

    const postBox = new THREE.Box3().setFromObject(model);
    const postSize = new THREE.Vector3();
    postBox.getSize(postSize);

    // eslint-disable-next-line no-console
    console.info('[DocitoMapas][character] GLB instalado', {
      preSize: preSize.toArray().map((v) => v.toFixed(2)),
      postSize: postSize.toArray().map((v) => v.toFixed(3)),
      animations: gltf.animations.map((a) => ({ name: a.name, tracks: a.tracks.length })),
      materials: materialsSummary,
      hasSkinning: (() => {
        let found = false;
        model.traverse((o) => {
          if (o instanceof THREE.SkinnedMesh) found = true;
        });
        return found;
      })(),
    });

    this.mixer?.stopAllAction();
    this.mixer = new THREE.AnimationMixer(model);
    this.walkAction = null;
    this.runAction = null;

    const walkClip = pickAnimationClip(gltf.animations, ['walk', 'walking']);
    const runClip =
      pickAnimationClip(gltf.animations, ['run', 'running']) ??
      pickAnimationClip(gltf.animations, ['walk', 'walking']);

    if (walkClip) {
      this.walkAction = this.mixer.clipAction(walkClip);
      this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (runClip && runClip !== walkClip) {
      this.runAction = this.mixer.clipAction(runClip);
      this.runAction.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      this.runAction = this.walkAction;
    }

    this.applyMotion(this.currentMotion);

    this.isUsingGltf = true;
    this.setModelVisible(this.modelVisible);
    this.map?.triggerRepaint();
  }

  private applyMotion(motion: CharacterMotion): void {
    if (!this.mixer) return;

    const walk = this.walkAction;
    const run = this.runAction ?? walk;

    if (motion === 'idle') {
      walk?.stop();
      run?.stop();
      return;
    }

    if (motion === 'run' && run) {
      walk?.fadeOut(0.15);
      run.reset().fadeIn(0.15).play();
      return;
    }

    if (walk) {
      run?.fadeOut(0.15);
      walk.reset().fadeIn(0.15).play();
    }
  }
}

function matSummary(m: THREE.Material): { name: string; type: string; opacity: number } {
  return {
    name: m.name || '(sem nome)',
    type: m.type,
    opacity: (m as THREE.Material & { opacity?: number }).opacity ?? 1,
  };
}

function pickAnimationClip(
  clips: THREE.AnimationClip[],
  keywords: string[],
): THREE.AnimationClip | null {
  if (clips.length === 0) return null;
  for (const kw of keywords) {
    const match = clips.find((c) => c.name.toLowerCase().includes(kw));
    if (match) return match;
  }
  return clips[0] ?? null;
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        for (const m of mat) m.dispose();
      } else if (mat) {
        mat.dispose();
      }
    }
  });
}

function buildProceduralCharacter(): {
  object: THREE.Group;
  mixer: THREE.AnimationMixer;
  walkAction: THREE.AnimationAction;
  runAction: THREE.AnimationAction;
} {
  const g = new THREE.Group();

  // Materiais com emissive leve — visíveis mesmo com iluminação do mapa atrás.
  const mk = (color: number) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.15,
    });

  const skin = mk(0xffd6df);
  const shirt = mk(0xff5a8a);
  const pants = mk(0x7a3040);
  const shoe = mk(0x2a1220);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 6, 10), shirt);
  torso.position.y = 1.05;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), skin);
  head.position.y = 1.65;
  g.add(head);

  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff8bb0, roughness: 0.7 });
  const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), cheekMat);
  const cheekR = cheekL.clone();
  cheekL.position.set(-0.14, 1.6, 0.18);
  cheekR.position.set(0.14, 1.6, 0.18);
  g.add(cheekL, cheekR);

  const armPivotL = new THREE.Group();
  const armPivotR = new THREE.Group();
  armPivotL.position.set(-0.32, 1.35, 0);
  armPivotR.position.set(0.32, 1.35, 0);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), shirt);
  const armR = armL.clone();
  armL.position.y = -0.35;
  armR.position.y = -0.35;
  armPivotL.add(armL);
  armPivotR.add(armR);
  g.add(armPivotL, armPivotR);

  const legPivotL = new THREE.Group();
  const legPivotR = new THREE.Group();
  legPivotL.position.set(-0.15, 0.7, 0);
  legPivotR.position.set(0.15, 0.7, 0);
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), pants);
  const legR = legL.clone();
  legL.position.y = -0.35;
  legR.position.y = -0.35;
  legPivotL.add(legL);
  legPivotR.add(legR);
  g.add(legPivotL, legPivotR);

  const shoeGeom = new THREE.BoxGeometry(0.2, 0.1, 0.32);
  const shoeL = new THREE.Mesh(shoeGeom, shoe);
  const shoeR = new THREE.Mesh(shoeGeom, shoe);
  shoeL.position.set(-0.15, 0.05, 0.05);
  shoeR.position.set(0.15, 0.05, 0.05);
  g.add(shoeL, shoeR);

  const walkClip = createWalkClip(armPivotL, armPivotR, legPivotL, legPivotR, 1);
  const runClip = createWalkClip(armPivotL, armPivotR, legPivotL, legPivotR, 0.55);
  runClip.name = 'run';

  const mixer = new THREE.AnimationMixer(g);
  const walkAction = mixer.clipAction(walkClip);
  walkAction.setLoop(THREE.LoopRepeat, Infinity);
  walkAction.play();

  const runAction = mixer.clipAction(runClip);
  runAction.setLoop(THREE.LoopRepeat, Infinity);

  // Guardar referências no grupo para applyMotion procedural via mixer clips.
  return { object: g, mixer, walkAction, runAction };
}

function createWalkClip(
  armL: THREE.Object3D,
  armR: THREE.Object3D,
  legL: THREE.Object3D,
  legR: THREE.Object3D,
  durationSec: number,
): THREE.AnimationClip {
  const times = [0, 0.25, 0.5, 0.75, 1].map((t) => t * durationSec);
  const swing = durationSec < 1 ? 1.15 : 0.9;

  const trackFor = (obj: THREE.Object3D, phase: number) => {
    obj.name = obj.name || obj.uuid;
    const values: number[] = [];
    for (const t of times) {
      const normalizedT = t / durationSec;
      const angle = Math.sin((normalizedT + phase) * Math.PI * 2) * swing * 0.5;
      const half = angle / 2;
      values.push(Math.sin(half), 0, 0, Math.cos(half));
    }
    return new THREE.QuaternionKeyframeTrack(`${obj.name}.quaternion`, times, values);
  };

  return new THREE.AnimationClip(durationSec < 1 ? 'run' : 'walk', durationSec, [
    trackFor(armL, 0.5),
    trackFor(armR, 0),
    trackFor(legL, 0),
    trackFor(legR, 0.5),
  ]);
}

export type CharacterCustomLayer = maplibregl.CustomLayerInterface;
