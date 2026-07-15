import {
  Cartesian3,
  Color,
  ConstantPositionProperty,
  type Entity,
  type Viewer,
} from 'cesium';
import type { CharacterMotion } from '@/features/character/CharacterLayer';

/** IDs das partes do boneco procedural (filhas de docito-character). */
export const CANDY_PART_IDS = [
  'docito-candy-torso',
  'docito-candy-head',
  'docito-candy-cheek-l',
  'docito-candy-cheek-r',
  'docito-candy-leg-l',
  'docito-candy-leg-r',
  'docito-candy-shoe-l',
  'docito-candy-shoe-r',
  'docito-candy-arm-l',
  'docito-candy-arm-r',
] as const;

const PINK = '#ff5a8a';
const SKIN = '#ffd6df';
const CHEEK = '#ff8bb0';
const PANTS = '#7a3040';
const SHOE = '#2a1220';

/** Posições base das partes animáveis (ENU local). */
const LEG_L_BASE: [number, number, number] = [-0.15, 0, 0.42];
const LEG_R_BASE: [number, number, number] = [0.15, 0, 0.42];
const SHOE_L_BASE: [number, number, number] = [-0.15, 0.05, 0.08];
const SHOE_R_BASE: [number, number, number] = [0.15, 0.05, 0.08];
const ARM_L_BASE: [number, number, number] = [-0.32, 0, 1.2];
const ARM_R_BASE: [number, number, number] = [0.32, 0, 1.2];

let walkPhase = 0;

function mkColor(hex: string): Color {
  return Color.fromCssColorString(hex);
}

function setPartPosition(
  viewer: Viewer,
  id: string,
  position: [number, number, number],
): void {
  const part = viewer.entities.getById(id);
  if (!part?.position || !(part.position instanceof ConstantPositionProperty)) return;
  part.position.setValue(new Cartesian3(...position));
}

function resetWalkPose(viewer: Viewer): void {
  setPartPosition(viewer, 'docito-candy-leg-l', LEG_L_BASE);
  setPartPosition(viewer, 'docito-candy-leg-r', LEG_R_BASE);
  setPartPosition(viewer, 'docito-candy-shoe-l', SHOE_L_BASE);
  setPartPosition(viewer, 'docito-candy-shoe-r', SHOE_R_BASE);
  setPartPosition(viewer, 'docito-candy-arm-l', ARM_L_BASE);
  setPartPosition(viewer, 'docito-candy-arm-r', ARM_R_BASE);
}

/**
 * Oscila pernas/braços candy (fallback quando GLB não está disponível).
 */
export function updateCandyWalkAnimation(
  viewer: Viewer,
  dt: number,
  motion: CharacterMotion,
  playing: boolean,
): void {
  if (!playing || motion === 'idle') {
    walkPhase = 0;
    resetWalkPose(viewer);
    return;
  }

  const freq = motion === 'run' ? 9 : 5.5;
  const ampLeg = motion === 'run' ? 0.22 : 0.14;
  const ampArm = motion === 'run' ? 0.18 : 0.12;
  walkPhase += dt * freq;
  const s = Math.sin(walkPhase);
  const c = Math.cos(walkPhase);

  setPartPosition(viewer, 'docito-candy-leg-l', [
    LEG_L_BASE[0],
    LEG_L_BASE[1] + s * ampLeg,
    LEG_L_BASE[2] + Math.abs(s) * 0.04,
  ]);
  setPartPosition(viewer, 'docito-candy-leg-r', [
    LEG_R_BASE[0],
    LEG_R_BASE[1] - s * ampLeg,
    LEG_R_BASE[2] + Math.abs(c) * 0.04,
  ]);
  setPartPosition(viewer, 'docito-candy-shoe-l', [
    SHOE_L_BASE[0],
    SHOE_L_BASE[1] + s * ampLeg,
    SHOE_L_BASE[2],
  ]);
  setPartPosition(viewer, 'docito-candy-shoe-r', [
    SHOE_R_BASE[0],
    SHOE_R_BASE[1] - s * ampLeg,
    SHOE_R_BASE[2],
  ]);
  setPartPosition(viewer, 'docito-candy-arm-l', [
    ARM_L_BASE[0],
    ARM_L_BASE[1] - s * ampArm,
    ARM_L_BASE[2],
  ]);
  setPartPosition(viewer, 'docito-candy-arm-r', [
    ARM_R_BASE[0],
    ARM_R_BASE[1] + s * ampArm,
    ARM_R_BASE[2],
  ]);
}

/**
 * Boneco "candy" procedural — filhos do entity pai em coordenadas locais ENU (Z = cima).
 * Mesma silhueta aproximada do Three.js em CharacterLayer.
 */
export function installProceduralCandyCharacter(viewer: Viewer, parent: Entity): void {
  removeProceduralCandyCharacter(viewer);

  const add = (def: {
    id: (typeof CANDY_PART_IDS)[number];
    position: [number, number, number];
    ellipsoid?: { radii: [number, number, number]; color: string };
    box?: { dimensions: [number, number, number]; color: string };
    cylinder?: { length: number; radius: number; color: string };
  }) => {
    const pos = new ConstantPositionProperty(
      new Cartesian3(def.position[0], def.position[1], def.position[2]),
    );

    if (def.ellipsoid) {
      viewer.entities.add({
        id: def.id,
        parent,
        position: pos,
        ellipsoid: {
          radii: new Cartesian3(...def.ellipsoid.radii),
          material: mkColor(def.ellipsoid.color),
          outline: true,
          outlineColor: Color.WHITE.withAlpha(0.35),
        },
      });
      return;
    }

    if (def.box) {
      viewer.entities.add({
        id: def.id,
        parent,
        position: pos,
        box: {
          dimensions: new Cartesian3(...def.box.dimensions),
          material: mkColor(def.box.color),
          outline: true,
          outlineColor: Color.WHITE.withAlpha(0.25),
        },
      });
      return;
    }

    if (def.cylinder) {
      viewer.entities.add({
        id: def.id,
        parent,
        position: pos,
        cylinder: {
          length: def.cylinder.length,
          topRadius: def.cylinder.radius,
          bottomRadius: def.cylinder.radius,
          material: mkColor(def.cylinder.color),
          outline: true,
          outlineColor: Color.WHITE.withAlpha(0.2),
        },
      });
    }
  };

  add({ id: 'docito-candy-torso', position: [0, 0, 1.05], ellipsoid: { radii: [0.3, 0.22, 0.38], color: PINK } });
  add({ id: 'docito-candy-head', position: [0, 0, 1.68], ellipsoid: { radii: [0.24, 0.24, 0.26], color: SKIN } });
  add({ id: 'docito-candy-cheek-l', position: [-0.14, 0.06, 1.62], ellipsoid: { radii: [0.06, 0.05, 0.05], color: CHEEK } });
  add({ id: 'docito-candy-cheek-r', position: [0.14, 0.06, 1.62], ellipsoid: { radii: [0.06, 0.05, 0.05], color: CHEEK } });
  add({ id: 'docito-candy-arm-l', position: [-0.32, 0, 1.2], cylinder: { length: 0.55, radius: 0.09, color: PINK } });
  add({ id: 'docito-candy-arm-r', position: [0.32, 0, 1.2], cylinder: { length: 0.55, radius: 0.09, color: PINK } });
  add({ id: 'docito-candy-leg-l', position: [-0.15, 0, 0.42], cylinder: { length: 0.6, radius: 0.11, color: PANTS } });
  add({ id: 'docito-candy-leg-r', position: [0.15, 0, 0.42], cylinder: { length: 0.6, radius: 0.11, color: PANTS } });
  add({ id: 'docito-candy-shoe-l', position: [-0.15, 0.05, 0.08], box: { dimensions: [0.2, 0.32, 0.1], color: SHOE } });
  add({ id: 'docito-candy-shoe-r', position: [0.15, 0.05, 0.08], box: { dimensions: [0.2, 0.32, 0.1], color: SHOE } });
}

export function removeProceduralCandyCharacter(viewer: Viewer): void {
  walkPhase = 0;
  for (const id of CANDY_PART_IDS) {
    viewer.entities.removeById(id);
  }
}

export function setProceduralCandyVisible(viewer: Viewer, visible: boolean): void {
  for (const id of CANDY_PART_IDS) {
    const part = viewer.entities.getById(id);
    if (part) part.show = visible;
  }
}
