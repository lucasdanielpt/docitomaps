import maplibregl, {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethod,
  type LngLatLike,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';

/**
 * Camada custom do MapLibre que renderiza um "boneco" 3D usando Three.js.
 * Segue o pattern oficial do MapLibre (CustomLayerInterface + WebGLRenderer
 * criado com o mesmo `gl` context / canvas do mapa).
 *
 * O personagem é procedural (cápsula + esfera + braços/pernas) para o MVP.
 * A troca por um `.glb` do Mixamo é um upgrade futuro:
 *   1. Baixar `.glb` em `apps/web/public/models/character.glb`
 *   2. Trocar `buildProceduralCharacter()` por `GLTFLoader().load(...)`.
 */
export class CharacterLayer implements CustomLayerInterface {
  public readonly id = 'docito-character';
  public readonly type = 'custom' as const;
  public readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private root: THREE.Group | null = null;
  private character: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clock = new THREE.Clock();

  private currentLngLat: LngLatLike = [0, 0];
  private currentHeadingDeg = 0;
  private currentSpeedNormalized = 0; // 0..1 (usado p/ modular animação)

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

    const built = buildProceduralCharacter();
    this.character = built.object;
    this.mixer = built.mixer;
    this.root.add(this.character);

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
    this.character = null;
    this.mixer = null;
    this.map = null;
  };

  /**
   * Atualiza a posição/heading/velocidade do personagem.
   * Chame isso a cada frame do RAF loop (fora da render).
   */
  update(lng: number, lat: number, headingDeg: number, speedNormalized: number): void {
    this.currentLngLat = [lng, lat];
    this.currentHeadingDeg = headingDeg;
    this.currentSpeedNormalized = Math.max(0, Math.min(1, speedNormalized));
    this.map?.triggerRepaint();
  }

  render: CustomRenderMethod = (_gl, matrix) => {
    if (!this.renderer || !this.scene || !this.camera || !this.root) return;

    // 1. Colocar o modelo no ponto Mercator do lng/lat atual.
    const merc = MercatorCoordinate.fromLngLat(this.currentLngLat, 0);
    const scale = merc.meterInMercatorCoordinateUnits();

    this.root.position.set(merc.x, merc.y, merc.z);
    // 2. Escala: personagem tem ~1.7m de altura; ampliamos para ~30m para ser
    //    legível em zooms medianos (Cidade/Bairro). Ajustar em versões futuras
    //    conforme zoom atual do mapa (fica maior em zoom baixo).
    const zoom = this.map?.getZoom() ?? 12;
    const zoomBoost = Math.max(1, 20 - zoom); // menor zoom → maior boost
    this.root.scale.set(scale * zoomBoost, scale * zoomBoost, scale * zoomBoost);

    // 3. Orientar: MapLibre eixo Z aponta pra fora do plano; precisamos girar
    //    para o objeto ficar "em pé" e rotacionar em torno de Z pelo heading.
    const headingRad = THREE.MathUtils.degToRad(-this.currentHeadingDeg + 90); // heading N→E → rad
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(Math.PI / 2, headingRad, 0, 'ZYX'));
    this.root.quaternion.copy(q);

    // 4. Avançar animação
    const dt = this.clock.getDelta();
    if (this.mixer) {
      // A velocidade da animação escala com a velocidade do personagem
      const timeScale = 0.6 + this.currentSpeedNormalized * 2.4;
      this.mixer.timeScale = timeScale;
      this.mixer.update(dt);
    }

    // 5. Câmera do MapLibre → matriz de projeção do Three.js.
    //    `matrix` é do tipo mat4 (Float32Array); Matrix4.fromArray aceita
    //    qualquer ArrayLike<number>, mas convertemos para segurança.
    const projMatrix = new THREE.Matrix4().fromArray(Array.from(matrix as ArrayLike<number>));
    this.camera.projectionMatrix = projMatrix;

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  };
}

// ---------------------------------------------------------------------------
// Personagem procedural (avatar candy)
// ---------------------------------------------------------------------------

function buildProceduralCharacter(): { object: THREE.Group; mixer: THREE.AnimationMixer } {
  const g = new THREE.Group();

  // Materiais em tons candy
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd6df, roughness: 0.55 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xff5a8a, roughness: 0.55 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x7a3040, roughness: 0.6 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x2a1220, roughness: 0.7 });

  // Corpo (torso) — cápsula
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 6, 10), shirt);
  torso.position.y = 1.05;
  g.add(torso);

  // Cabeça — esfera
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), skin);
  head.position.y = 1.65;
  g.add(head);

  // Bochechas rosadas
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff8bb0, roughness: 0.7 });
  const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), cheekMat);
  const cheekR = cheekL.clone();
  cheekL.position.set(-0.14, 1.6, 0.18);
  cheekR.position.set(0.14, 1.6, 0.18);
  g.add(cheekL, cheekR);

  // Braços — pivots que oscilam
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

  // Pernas — pivots que oscilam
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

  // Sapatos
  const shoeGeom = new THREE.BoxGeometry(0.2, 0.1, 0.32);
  const shoeL = new THREE.Mesh(shoeGeom, shoe);
  const shoeR = new THREE.Mesh(shoeGeom, shoe);
  shoeL.position.set(-0.15, 0.05, 0.05);
  shoeR.position.set(0.15, 0.05, 0.05);
  g.add(shoeL, shoeR);

  // Animação "walk" — usando AnimationClip com KeyframeTracks
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
  const swing = 0.9; // radianos

  // Cria uma track que oscila rotação-x com fase
  const trackFor = (name: string, phase: number) => {
    const values: number[] = [];
    for (const t of times) {
      const angle = Math.sin((t + phase) * Math.PI * 2) * swing * 0.5;
      // Quaternion (x, y, z, w) equivalente a rotationX(angle)
      const half = angle / 2;
      values.push(Math.sin(half), 0, 0, Math.cos(half));
    }
    return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
  };

  const armLTrack = trackFor(armL.uuid, 0.5);
  armL.name = armL.uuid;
  const armRTrack = trackFor(armR.uuid, 0);
  armR.name = armR.uuid;
  const legLTrack = trackFor(legL.uuid, 0);
  legL.name = legL.uuid;
  const legRTrack = trackFor(legR.uuid, 0.5);
  legR.name = legR.uuid;

  return new THREE.AnimationClip('walk', 1, [armLTrack, armRTrack, legLTrack, legRTrack]);
}

// Necessário porque o MapLibre importa o tipo do maplibregl inteiro; sem esse
// alias o TS pode reclamar em alguns projetos.
export type CharacterCustomLayer = maplibregl.CustomLayerInterface;
