import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  HeadingPitchRoll,
  HeightReference,
  Math as CesiumMath,
  ModelGraphics,
  Quaternion,
  Transforms,
  Viewer,
  createGooglePhotorealistic3DTileset,
  GoogleMaps,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { LineStringGeometry, OptimizedRoute } from '@docitomapas/shared';
import { CHARACTER_MODEL_URLS, type CharacterMotion } from '@/features/character/CharacterLayer';
import {
  installProceduralCandyCharacter,
  removeProceduralCandyCharacter,
  setProceduralCandyVisible,
  updateCandyWalkAnimation,
} from '@/features/character/cesiumCandyCharacter';
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsKey } from '@/config/maps';
import { isGltfModelSkinned } from '@/lib/glbInspect';
import {
  CESIUM_EYE_HEIGHT_M,
  CESIUM_THIRD_PERSON_DISTANCE_M,
  computeCinemaCamera,
  mapPitchToCesiumRadians,
  zoomToCameraHeightMeters,
  type CinemaCameraState,
} from '@/lib/cesiumCamera';
import { getCachedGroundHeight, sampleGroundHeight } from '@/lib/cesiumTerrain';
import {
  CESIUM_CAMERA_MIN_INTERVAL_MS,
  CESIUM_TILESET_SSE,
  CESIUM_TILESET_SSE_DYNAMIC_DENSITY,
  verifyGooglePhotorealisticTilesKey,
} from '@/lib/googleTiles';
import type { CameraMode } from '@/stores/playerStore';
import type { InterpolatedPosition } from '@/lib/geometry';

export interface CesiumFrameUpdate {
  pos: InterpolatedPosition;
  cameraMode: CameraMode;
  realistic3D: boolean;
  currentMapZoom: number;
  motion: CharacterMotion;
  playing: boolean;
}

export interface CesiumPhotorealisticHandle {
  syncFrame: (update: CesiumFrameUpdate) => void;
  isViewerInitialized: () => boolean;
  isTilesReady: () => boolean;
}

export interface CesiumPhotorealisticViewProps {
  route: OptimizedRoute | null;
  active: boolean;
  onCharacterVisualChange?: (visual: 'procedural' | 'gltf') => void;
  onTilesReadyChange?: (ready: boolean) => void;
  onRefinementProgressChange?: (progress: number) => void;
}

const MIXAMO_SCALE = 1;
const GROUND_FEET_OFFSET_M = 0.05;

function routeToDegreesArray(geom: LineStringGeometry): number[] {
  const flat: number[] = [];
  for (const [lng, lat] of geom.coordinates) {
    flat.push(lng, lat);
  }
  return flat;
}

function isViewerAlive(viewer: Viewer | null): viewer is Viewer {
  if (!viewer) return false;
  try {
    return !(viewer as Viewer & { isDestroyed?: () => boolean }).isDestroyed?.();
  } catch {
    return false;
  }
}

function usesOrbitCamera(mode: CameraMode): boolean {
  return mode === 'follow';
}

function cameraChanged(a: CinemaCameraState, b: CinemaCameraState): boolean {
  return (
    Math.abs(a.centerLng - b.centerLng) > 1e-6 ||
    Math.abs(a.centerLat - b.centerLat) > 1e-6 ||
    Math.abs(a.bearing - b.bearing) > 0.25 ||
    Math.abs(a.pitch - b.pitch) > 0.25 ||
    Math.abs(a.zoom - b.zoom) > 0.05
  );
}

async function resolveCharacterModelUrl(): Promise<string | null> {
  for (const url of CHARACTER_MODEL_URLS) {
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (head.ok) return url;
    } catch {
      /* try next */
    }
  }
  return null;
}

function applyCesiumCameraMode(viewer: Viewer, character: Entity, mode: CameraMode): void {
  const ctrl = viewer.scene.screenSpaceCameraController;

  if (usesOrbitCamera(mode)) {
    viewer.trackedEntity = character;
    ctrl.enableInputs = true;
    ctrl.enableRotate = true;
    ctrl.enableZoom = true;
    ctrl.enableTranslate = false;
    ctrl.enableTilt = true;
    ctrl.enableLook = false;
    ctrl.minimumZoomDistance = 3;
    ctrl.maximumZoomDistance = 80;
    ctrl.minimumCollisionTerrainHeight = 0;
    return;
  }

  viewer.trackedEntity = undefined;
  character.viewFrom = undefined;

  if (mode === 'free') {
    ctrl.enableInputs = true;
    ctrl.enableRotate = true;
    ctrl.enableZoom = true;
    ctrl.enableTranslate = true;
    ctrl.enableTilt = true;
    return;
  }

  ctrl.enableInputs = false;
}

function updateCharacterTransform(
  viewer: Viewer,
  pos: InterpolatedPosition,
  groundHeight: number,
  modelVisible: boolean,
  charPosRef: ConstantPositionProperty,
  charOrientRef: ConstantProperty,
  visual: 'procedural' | 'gltf',
  motion: CharacterMotion,
  playing: boolean,
  dt: number,
): void {
  const altitude =
    groundHeight + (visual === 'procedural' ? GROUND_FEET_OFFSET_M : 0);
  const cartesian = Cartesian3.fromDegrees(pos.lng, pos.lat, altitude);
  charPosRef.setValue(cartesian);
  charOrientRef.setValue(
    Transforms.headingPitchRollQuaternion(
      cartesian,
      new HeadingPitchRoll(CesiumMath.toRadians(pos.heading), 0, 0),
    ),
  );

  const character = viewer.entities.getById('docito-character');
  if (character) {
    character.show = modelVisible;
    if (visual === 'procedural') {
      setProceduralCandyVisible(viewer, modelVisible);
      updateCandyWalkAnimation(viewer, dt, motion, playing);
    } else if (character.model) {
      character.model.runAnimations = new ConstantProperty(
        playing && motion !== 'idle',
      );
    }
  }
}

function applyCesiumThirdPersonCamera(
  viewer: Viewer,
  character: Entity,
  rangeMeters: number,
): void {
  character.viewFrom = new ConstantProperty(
    new Cartesian3(0, -rangeMeters, CESIUM_EYE_HEIGHT_M),
  );
  viewer.trackedEntity = character;
}

function applyCesiumFrame(
  viewer: Viewer,
  update: CesiumFrameUpdate,
  charPosRef: ConstantPositionProperty,
  charOrientRef: ConstantProperty,
  characterVisual: 'procedural' | 'gltf',
  groundHeight: number,
  dt: number,
  lastModeRef: MutableRefObject<CameraMode | null>,
  lastCameraRef: MutableRefObject<CinemaCameraState | null>,
  lastCameraTimeRef: MutableRefObject<number>,
): void {
  const cam = computeCinemaCamera(
    update.pos,
    update.cameraMode,
    update.currentMapZoom,
    update.realistic3D,
  );

  const character = viewer.entities.getById('docito-character');
  if (!character) return;

  if (update.cameraMode !== lastModeRef.current) {
    applyCesiumCameraMode(viewer, character, update.cameraMode);
    lastModeRef.current = update.cameraMode;
    lastCameraRef.current = null;
  }

  updateCharacterTransform(
    viewer,
    update.pos,
    groundHeight,
    cam.modelVisible,
    charPosRef,
    charOrientRef,
    characterVisual,
    update.motion,
    update.playing,
    dt,
  );

  if (update.cameraMode === 'follow') {
    applyCesiumThirdPersonCamera(
      viewer,
      character,
      cam.cesiumRangeMeters || CESIUM_THIRD_PERSON_DISTANCE_M,
    );
    viewer.scene.requestRender();
    return;
  }

  if (update.cameraMode === 'free') {
    // Em câmera livre só re-renderiza enquanto a rota anima (ou no 1º frame).
    if (update.playing) {
      viewer.scene.requestRender();
    }
    return;
  }

  const now = performance.now();
  if (now - lastCameraTimeRef.current < CESIUM_CAMERA_MIN_INTERVAL_MS) {
    viewer.scene.requestRender();
    return;
  }

  const prev = lastCameraRef.current;
  if (prev && !cameraChanged(prev, cam)) {
    return;
  }

  applyCesiumCamera(viewer, update.pos, cam, update.cameraMode, groundHeight);
  lastCameraRef.current = cam;
  lastCameraTimeRef.current = now;
  viewer.scene.requestRender();
}

export const CesiumPhotorealisticView = forwardRef<
  CesiumPhotorealisticHandle,
  CesiumPhotorealisticViewProps
>(function CesiumPhotorealisticView(
  { route, active, onCharacterVisualChange, onTilesReadyChange, onRefinementProgressChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const viewerInitializedRef = useRef(false);
  const tilesReadyRef = useRef(false);
  const activeRef = useRef(active);
  const charPosRef = useRef<ConstantPositionProperty | null>(null);
  const charOrientRef = useRef<ConstantProperty | null>(null);
  const lastCameraRef = useRef<CinemaCameraState | null>(null);
  const lastCameraTimeRef = useRef(0);
  const lastModeRef = useRef<CameraMode | null>(null);
  const lastFrameTimeRef = useRef(0);
  const characterVisualRef = useRef<'procedural' | 'gltf'>('procedural');
  const pendingFrameRef = useRef<CesiumFrameUpdate | null>(null);
  const groundHeightRef = useRef(0);
  const lastSampleKeyRef = useRef('');
  const [tilesError, setTilesError] = useState<string | null>(null);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [refinementPct, setRefinementPct] = useState(0);
  const [showOrbitHint, setShowOrbitHint] = useState(false);

  activeRef.current = active;

  const notifyTilesReady = (ready: boolean) => {
    tilesReadyRef.current = ready;
    onTilesReadyChange?.(ready);
  };

  const notifyRefinement = (progress: number) => {
    const p = Math.max(0, Math.min(1, progress));
    setRefinementPct(p);
    onRefinementProgressChange?.(p);
  };

  const notifyCharacterVisual = (visual: 'procedural' | 'gltf') => {
    characterVisualRef.current = visual;
    onCharacterVisualChange?.(visual);
  };

  const queueGroundSample = (viewer: Viewer, lng: number, lat: number) => {
    const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
    if (key === lastSampleKeyRef.current) return;
    lastSampleKeyRef.current = key;
    const cached = getCachedGroundHeight(lng, lat);
    if (cached !== undefined) {
      groundHeightRef.current = cached;
      return;
    }
    void sampleGroundHeight(viewer.scene, lng, lat).then((h) => {
      if (!isViewerAlive(viewerRef.current)) return;
      groundHeightRef.current = h;
      viewerRef.current?.scene.requestRender();
    });
  };

  useImperativeHandle(ref, () => ({
    syncFrame(update: CesiumFrameUpdate) {
      if (!activeRef.current) return;

      pendingFrameRef.current = update;
      const viewer = viewerRef.current;
      if (!viewerInitializedRef.current || !isViewerAlive(viewer)) return;

      const now = performance.now();
      const dt = lastFrameTimeRef.current ? (now - lastFrameTimeRef.current) / 1000 : 0;
      lastFrameTimeRef.current = now;

      queueGroundSample(viewer, update.pos.lng, update.pos.lat);

      try {
        if (!charPosRef.current || !charOrientRef.current) return;
        applyCesiumFrame(
          viewer,
          update,
          charPosRef.current,
          charOrientRef.current,
          characterVisualRef.current,
          groundHeightRef.current,
          dt,
          lastModeRef,
          lastCameraRef,
          lastCameraTimeRef,
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[DocitoMapas][cesium] syncFrame:', err);
      }
    },
    isViewerInitialized: () => viewerInitializedRef.current,
    isTilesReady: () => tilesReadyRef.current,
  }));

  useEffect(() => {
    if (!containerRef.current || !hasGoogleMapsKey) return;

    let cancelled = false;
    viewerInitializedRef.current = false;
    tilesReadyRef.current = false;
    notifyTilesReady(false);
    setTilesLoading(true);
    setTilesError(null);
    lastCameraRef.current = null;
    lastModeRef.current = null;
    lastFrameTimeRef.current = 0;
    pendingFrameRef.current = null;
    groundHeightRef.current = 0;
    lastSampleKeyRef.current = '';

    let viewer: Viewer | null = null;
    let loadSafetyTimeout: number | null = null;

    try {
      GoogleMaps.defaultApiKey = GOOGLE_MAPS_API_KEY;

      const creditHost = document.createElement('div');
      creditHost.className =
        'docito-cesium-credits pointer-events-none absolute bottom-1 left-1 z-10 max-w-[70%] text-[10px] opacity-80';

      viewer = new Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        creditContainer: creditHost,
        baseLayer: false,
        msaaSamples: 2,
        contextOptions: {
          webgl: {
            alpha: false,
            antialias: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true,
          },
        },
      });

      viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);
      viewer.useBrowserRecommendedResolution = false;
      if (viewer.scene.postProcessStages?.fxaa) {
        viewer.scene.postProcessStages.fxaa.enabled = true;
      }

      viewer.scene.globe.show = true;
      viewer.scene.globe.baseColor = Color.fromCssColorString('#1a3a5c');
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.0002;

      viewerRef.current = viewer;

      charPosRef.current = new ConstantPositionProperty(Cartesian3.fromDegrees(0, 0, 0));
      charOrientRef.current = new ConstantProperty(Quaternion.IDENTITY);

      const character = viewer.entities.add({
        id: 'docito-character',
        position: charPosRef.current,
        orientation: charOrientRef.current,
        show: true,
      });

      installProceduralCandyCharacter(viewer, character);
      notifyCharacterVisual('procedural');

      viewerInitializedRef.current = true;
      notifyRefinement(0.05);
      if (pendingFrameRef.current && charPosRef.current && charOrientRef.current) {
        applyCesiumFrame(
          viewer,
          pendingFrameRef.current,
          charPosRef.current,
          charOrientRef.current,
          characterVisualRef.current,
          groundHeightRef.current,
          0,
          lastModeRef,
          lastCameraRef,
          lastCameraTimeRef,
        );
      }

      void (async () => {
        const modelUrl = await resolveCharacterModelUrl();
        if (cancelled || !isViewerAlive(viewerRef.current)) return;

        const entity = viewerRef.current?.entities.getById('docito-character');
        if (!entity || !modelUrl) return;

        const skinned = await isGltfModelSkinned(modelUrl);
        if (cancelled || !isViewerAlive(viewerRef.current)) return;

        if (!skinned) {
          // eslint-disable-next-line no-console
          console.warn(
            '[DocitoMapas][cesium] GLB sem skinning — mantendo boneco candy procedural. Exporte Mixamo com "With Skin".',
            { url: modelUrl },
          );
          return;
        }

        setProceduralCandyVisible(viewerRef.current!, false);
        entity.model = new ModelGraphics({
          uri: modelUrl,
          scale: MIXAMO_SCALE,
          minimumPixelSize: 56,
          maximumScale: 80,
          heightReference: HeightReference.RELATIVE_TO_GROUND,
          runAnimations: new ConstantProperty(true),
          silhouetteColor: Color.fromCssColorString('#ff5a8a'),
          silhouetteSize: 1.5,
        });
        notifyCharacterVisual('gltf');
        // eslint-disable-next-line no-console
        console.info('[DocitoMapas][cesium] modelo Mixamo carregado:', modelUrl);
        viewerRef.current?.scene.requestRender();
      })();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar o visualizador 3D.';
      setTilesError(msg);
      setTilesLoading(false);
      // eslint-disable-next-line no-console
      console.error('[DocitoMapas][cesium] Viewer:', err);
      return;
    }

    void (async () => {
      const check = await verifyGooglePhotorealisticTilesKey();
      if (cancelled) return;

      if (!check.ok) {
        setTilesError(check.message);
        setTilesLoading(false);
        return;
      }

      const markTilesPlayable = () => {
        if (cancelled || tilesReadyRef.current) return;
        notifyTilesReady(true);
        setTilesLoading(false);
        setShowOrbitHint(true);
      };

      try {
        const tileset = await createGooglePhotorealistic3DTileset(
          { onlyUsingWithGoogleGeocoder: true, key: GOOGLE_MAPS_API_KEY },
          {
            maximumScreenSpaceError: CESIUM_TILESET_SSE,
            dynamicScreenSpaceError: true,
            dynamicScreenSpaceErrorDensity: CESIUM_TILESET_SSE_DYNAMIC_DENSITY,
            cacheBytes: 768 * 1024 * 1024,
            preferLeaves: true,
          },
        );
        if (cancelled || !isViewerAlive(viewerRef.current)) return;

        loadSafetyTimeout = window.setTimeout(() => {
          if (cancelled) return;
          notifyRefinement(0.88);
          markTilesPlayable();
        }, 35_000);

        let idleTicks = 0;
        tileset.loadProgress.addEventListener((pending: number, processing: number) => {
          const busy = pending + processing;
          if (busy === 0) {
            idleTicks += 1;
            notifyRefinement(Math.min(1, 0.78 + idleTicks * 0.06));
          } else {
            idleTicks = 0;
            const ratio = 1 - Math.min(busy, 80) / 80;
            notifyRefinement(Math.max(0.15, 0.3 + ratio * 0.5));
          }
          viewerRef.current?.scene.requestRender();
        });
        tileset.initialTilesLoaded.addEventListener(() => {
          notifyRefinement(0.75);
          markTilesPlayable();
          if (loadSafetyTimeout !== null) {
            clearTimeout(loadSafetyTimeout);
            loadSafetyTimeout = null;
          }
        });
        tileset.allTilesLoaded.addEventListener(() => {
          notifyRefinement(1);
        });

        tileset.showCreditsOnScreen = true;
        viewer!.scene.primitives.add(tileset);
        viewer!.scene.globe.show = false;

        await viewer!.scene.requestRender();

        const character = viewer!.entities.getById('docito-character');
        if (character) {
          applyCesiumCameraMode(viewer!, character, 'follow');
          applyCesiumThirdPersonCamera(
            viewer!,
            character,
            CESIUM_THIRD_PERSON_DISTANCE_M,
          );
          lastModeRef.current = 'follow';
        }

        viewer!.scene.requestRender();
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : 'Falha ao carregar Photorealistic 3D Tiles.';
        setTilesError(msg);
        setTilesLoading(false);
        // eslint-disable-next-line no-console
        console.error('[DocitoMapas][cesium] Falha ao carregar Google 3D Tiles:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (loadSafetyTimeout !== null) {
        clearTimeout(loadSafetyTimeout);
      }
      viewerInitializedRef.current = false;
      notifyTilesReady(false);
      notifyRefinement(0);
      charPosRef.current = null;
      charOrientRef.current = null;
      notifyCharacterVisual('procedural');
      if (viewer && isViewerAlive(viewer)) {
        removeProceduralCandyCharacter(viewer);
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, [onCharacterVisualChange, onTilesReadyChange, onRefinementProgressChange]);

  useEffect(() => {
    if (!active) return;
    const viewer = viewerRef.current;
    if (!viewer || !isViewerAlive(viewer) || !route) return;

    lastCameraRef.current = null;
    lastCameraTimeRef.current = 0;
    setShowOrbitHint(true);

    const cumulative = route.fullGeometry.coordinates.length;
    if (cumulative < 2) return;

    if (pendingFrameRef.current && charPosRef.current && charOrientRef.current) {
      const { pos } = pendingFrameRef.current;
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(pos.lng, pos.lat, 450),
        orientation: {
          heading: CesiumMath.toRadians(pos.heading),
          pitch: CesiumMath.toRadians(-35),
          roll: 0,
        },
      });
      applyCesiumFrame(
        viewer,
        pendingFrameRef.current,
        charPosRef.current,
        charOrientRef.current,
        characterVisualRef.current,
        groundHeightRef.current,
        0,
        lastModeRef,
        lastCameraRef,
        lastCameraTimeRef,
      );
    }

    const character = viewer.entities.getById('docito-character');
    const mode = pendingFrameRef.current?.cameraMode ?? 'free';
    if (character) {
      applyCesiumCameraMode(viewer, character, mode);
      if (mode === 'follow') {
        applyCesiumThirdPersonCamera(viewer, character, CESIUM_THIRD_PERSON_DISTANCE_M);
      }
      lastModeRef.current = mode;
    }

    viewer.scene.requestRender();
  }, [active, route]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !route || !isViewerAlive(viewer)) return;

    const degrees = routeToDegreesArray(route.fullGeometry);
    if (degrees.length < 4) return;

    let routeEntity = viewer.entities.getById('docito-route');
    if (!routeEntity) {
      routeEntity = viewer.entities.add({
        id: 'docito-route',
        polyline: {
          positions: new ConstantProperty(Cartesian3.fromDegreesArray(degrees)),
          width: 5,
          material: Color.fromCssColorString('#ff5a8a').withAlpha(0.75),
          clampToGround: true,
          zIndex: 0,
        },
        show: true,
      });
    } else if (routeEntity.polyline) {
      routeEntity.polyline.positions = new ConstantProperty(
        Cartesian3.fromDegreesArray(degrees),
      );
      routeEntity.show = true;
    }

    viewer.scene.requestRender();
  }, [route]);

  return (
    <div
      className={
        active
          ? 'pointer-events-auto absolute inset-0 z-[5] h-full w-full overflow-hidden'
          : 'pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0'
      }
      aria-hidden={!active}
    >
      <div ref={containerRef} className="h-full w-full" aria-label="Mapa fotorrealista 3D" role="region" />
      {active && !tilesLoading && !tilesError && refinementPct < 0.92 && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-center">
          <p className="rounded-full border border-border/50 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-soft backdrop-blur">
            Refinando detalhe… {Math.round(refinementPct * 100)}%
          </p>
        </div>
      )}
      {active && showOrbitHint && !tilesLoading && !tilesError && (
        <div className="pointer-events-none absolute inset-x-4 bottom-24 z-20 flex justify-center md:bottom-28">
          <p className="rounded-full border border-border/50 bg-card/85 px-4 py-2 text-xs text-muted-foreground shadow-soft backdrop-blur">
            <span className="font-semibold text-foreground">Câmera livre</span> — arraste para girar ·
            scroll para zoom · boneco segue a rota
          </p>
        </div>
      )}
      {active && (tilesLoading || tilesError) && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-center">
          <div
            className={
              'max-w-lg rounded-2xl border px-4 py-3 text-sm shadow-candy backdrop-blur ' +
              (tilesError
                ? 'border-amber-300/70 bg-amber-50/95 text-amber-950'
                : 'border-border/60 bg-card/90 text-foreground')
            }
          >
            {tilesLoading && !tilesError && (
              <>
                <p>
                  <span className="font-semibold">Carregando ambiente 3D…</span>{' '}
                  {Math.round(refinementPct * 100)}%
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round(refinementPct * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Os prédios aparecem primeiro; o detalhe continua refinando depois.
                </p>
              </>
            )}
            {tilesError && (
              <>
                <p className="font-semibold">Modo Foto (3D) indisponível</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">{tilesError}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

function applyCesiumCamera(
  viewer: Viewer,
  target: InterpolatedPosition,
  cam: CinemaCameraState,
  cameraMode: CameraMode,
  groundHeight: number,
): void {
  if (cameraMode === 'free' || cameraMode === 'follow') return;
}
