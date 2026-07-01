import maplibregl, {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethod,
  type LngLatLike,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Caminho relativo do arquivo `.glb` do personagem principal.
 * Se o arquivo existir em `apps/web/public/models/character.glb` ele é
 * carregado; caso contrário, cai no personagem procedural.
 *
 * Como obter (Mixamo):
 *   1. Ir em https://www.mixamo.com (login gratuito com conta Adobe).
 *   2. Escolher um personagem (Ch14, Y-Bot, X-Bot etc.) → botão "Download":
 *        Format: FBX / With Skin (para ter o mesh).
 *   3. Clicar em "Animations" no topo, escolher "Walking":
 *        marcar "In Place" → Download com Format FBX.
 *      Baixar também "Running" e "Idle" se quiser trocar animação por
 *      velocidade (opcional — para MVP só precisamos de "Walking").
 *   4. Converter FBX → glTF/GLB:
 *      Opção fácil: subir o(s) FBX em https://products.aspose.app/3d/conversion/fbx-to-glb
 *      Ou via CLI:  npx -y fbx2gltf character.fbx --binary
 *   5. Colocar o arquivo final em `apps/web/public/models/character.glb`.
 *      A app detecta automaticamente e substitui o boneco procedural.
 *
 * Se a animação "walk" estiver com nome diferente, a heurística
 * `pickAnimationClip()` procura por 'walk' > 'run' > primeira disponível.
 */
/**
 * URLs candidatas do modelo, testadas em ordem. A primeira que responder 200
 * será carregada. Aceita tanto o nome padronizado (`character.glb`) quanto o
 * nome que sai por padrão do Mixamo (`Walking.glb` / `walking.glb`).
 */
export const CHARACTER_MODEL_URLS = [
  '/models/character.glb',
  '/models/Walking.glb',
  '/models/walking.glb',
];

/**
 * Escala aproximada esperada para modelos Mixamo (que exportam em cm).
 * Multiplicamos por este fator para o modelo ter ~1.7m no mundo Three.js.
 * Se o `.glb` já vier em metros, ajuste isso para 1.
 */
const MIXAMO_UNIT_SCALE = 0.01;

export class CharacterLayer implements CustomLayerInterface {
  public readonly id = 'docito-character';
  public readonly type = 'custom' as const;
  public readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  /** Root controlado pelo layer (posição/orientação global). */
  private root: THREE.Group | null = null;
  /** Filho de `root` que contém o modelo em si — usado para trocar em runtime. */
  private modelHolder: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clock = new THREE.Clock();

  private currentLngLat: LngLatLike = [0, 0];
  private currentHeadingDeg = 0;
  private currentSpeedNormalized = 0;

  /**
   * Indica que o modelo glTF assumiu o lugar do procedural.
   * Enquanto for `false`, o layer usa o boneco cápsula candy.
   */
  public isUsingGltf = false;

  onAdd = (map: MapLibreMap, gl: WebGL2RenderingContext | WebGLRenderingContext): void => {
    this.map = map;

    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffe5f0, 1.1);
    sun.position.set(-70, -100, 200).normalize();
    this.scene.add(sun);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.modelHolder = new THREE.Group();
    this.root.add(this.modelHolder);

    // Começa com o procedural (aparece instantaneamente).
    const procedural = buildProceduralCharacter();
    this.modelHolder.add(procedural.object);
    this.mixer = procedural.mixer;

    // Tenta trocar por .glb em segundo plano; se falhar (404, erro), fica com
    // o procedural silenciosamente.
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
    this.root = null;
    this.modelHolder = null;
    this.mixer = null;
    this.map = null;
  };

  update(lng: number, lat: number, headingDeg: number, speedNormalized: number): void {
    this.currentLngLat = [lng, lat];
    this.currentHeadingDeg = headingDeg;
    this.currentSpeedNormalized = Math.max(0, Math.min(1, speedNormalized));
    this.map?.triggerRepaint();
  }

  render: CustomRenderMethod = (_gl, matrix) => {
    if (!this.renderer || !this.scene || !this.camera || !this.root) return;

    const merc = MercatorCoordinate.fromLngLat(this.currentLngLat, 0);
    const scale = merc.meterInMercatorCoordinateUnits();

    this.root.position.set(merc.x, merc.y, merc.z);

    const zoom = this.map?.getZoom() ?? 12;
    const zoomBoost = Math.max(1, 20 - zoom);
    this.root.scale.set(scale * zoomBoost, scale * zoomBoost, scale * zoomBoost);

    const headingRad = THREE.MathUtils.degToRad(-this.currentHeadingDeg + 90);
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(Math.PI / 2, headingRad, 0, 'ZYX'));
    this.root.quaternion.copy(q);

    const dt = this.clock.getDelta();
    if (this.mixer) {
      const timeScale = 0.6 + this.currentSpeedNormalized * 2.4;
      this.mixer.timeScale = timeScale;
      this.mixer.update(dt);
    }

    const projMatrix = new THREE.Matrix4().fromArray(Array.from(matrix as ArrayLike<number>));
    this.camera.projectionMatrix = projMatrix;

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  };

  // -------------------------------------------------------------------------
  // Carregamento assíncrono do .glb (Mixamo)
  // -------------------------------------------------------------------------

  private async tryLoadFirstAvailable(urls: string[]): Promise<void> {
    for (const url of urls) {
      try {
        // HEAD antes para evitar poluir o console com 404 em dev.
        // Cuidado: em dev, o Vite retorna 200 + text/html (index.html) como
        // fallback SPA para caminhos inexistentes. Precisamos checar o
        // Content-Type explicitamente para não gerar falsos positivos.
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok) continue;
        const contentType = head.headers.get('content-type') ?? '';
        if (
          !contentType.includes('gltf') &&
          !contentType.includes('octet-stream') &&
          !contentType.includes('binary')
        ) {
          // Ex.: text/html => fallback SPA; ignorar.
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
    if (!this.modelHolder) return;

    // Remove o procedural
    while (this.modelHolder.children.length > 0) {
      const child = this.modelHolder.children[0];
      if (!child) break;
      this.modelHolder.remove(child);
      disposeObject(child);
    }

    const model = gltf.scene;
    model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).castShadow = false;
        (obj as THREE.Mesh).receiveShadow = false;
      }
    });

    // Modelos Mixamo vêm em cm → escalamos para metros (aprox).
    model.scale.setScalar(MIXAMO_UNIT_SCALE);
    // Alguns modelos vêm com o pivô no topo; posicionamos no chão.
    model.position.set(0, 0, 0);
    this.modelHolder.add(model);

    // Reset mixer para o novo modelo
    this.mixer?.stopAllAction();
    this.mixer = new THREE.AnimationMixer(model);

    const walkClip = pickAnimationClip(gltf.animations, ['walk', 'walking', 'run', 'running']);
    if (walkClip) {
      const action = this.mixer.clipAction(walkClip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }

    this.isUsingGltf = true;
    this.map?.triggerRepaint();
  }
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

// ---------------------------------------------------------------------------
// Personagem procedural (avatar candy) — fallback padrão
// ---------------------------------------------------------------------------

function buildProceduralCharacter(): { object: THREE.Group; mixer: THREE.AnimationMixer } {
  const g = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: 0xffd6df, roughness: 0.55 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xff5a8a, roughness: 0.55 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x7a3040, roughness: 0.6 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x2a1220, roughness: 0.7 });

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

  const walkClip = createWalkClip(armPivotL, armPivotR, legPivotL, legPivotR);
  const mixer = new THREE.AnimationMixer(g);
  const action = mixer.clipAction(walkClip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();

  return { object: g, mixer };
}

function createWalkClip(
  armL: THREE.Object3D,
  armR: THREE.Object3D,
  legL: THREE.Object3D,
  legR: THREE.Object3D,
): THREE.AnimationClip {
  const times = [0, 0.25, 0.5, 0.75, 1];
  const swing = 0.9;

  const trackFor = (obj: THREE.Object3D, phase: number) => {
    obj.name = obj.name || obj.uuid;
    const values: number[] = [];
    for (const t of times) {
      const angle = Math.sin((t + phase) * Math.PI * 2) * swing * 0.5;
      const half = angle / 2;
      values.push(Math.sin(half), 0, 0, Math.cos(half));
    }
    return new THREE.QuaternionKeyframeTrack(`${obj.name}.quaternion`, times, values);
  };

  return new THREE.AnimationClip('walk', 1, [
    trackFor(armL, 0.5),
    trackFor(armR, 0),
    trackFor(legL, 0),
    trackFor(legR, 0.5),
  ]);
}

export type CharacterCustomLayer = maplibregl.CustomLayerInterface;
