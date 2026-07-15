// Inspeciona um .glb: cenas, meshes, animações, bounding box.
// Uso:  node scripts/inspect-glb.mjs apps/web/public/models/Walking.glb
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('uso: node scripts/inspect-glb.mjs <arquivo.glb>');
  process.exit(1);
}
const buf = fs.readFileSync(path.resolve(file));

// GLB header:
// 0-3   magic 'glTF'
// 4-7   version u32
// 8-11  length u32
// 12-15 chunk0 length u32
// 16-19 chunk0 type u32 (JSON = 0x4E4F534A)
// 20+   chunk0 data
const magic = buf.slice(0, 4).toString('ascii');
const version = buf.readUInt32LE(4);
const totalLen = buf.readUInt32LE(8);
const chunk0Len = buf.readUInt32LE(12);
const chunk0Type = buf.readUInt32LE(16);

console.log(`arquivo: ${file}`);
console.log(`magic:   ${magic}`);
console.log(`versão:  ${version}`);
console.log(`bytes:   ${totalLen}`);
console.log(`chunk0:  ${chunk0Type.toString(16)} (${chunk0Len}b) — JSON=0x4e4f534a`);

if (chunk0Type !== 0x4e4f534a) {
  console.error('primeiro chunk não é JSON, glb inválido');
  process.exit(2);
}

const jsonBytes = buf.slice(20, 20 + chunk0Len);
const json = JSON.parse(jsonBytes.toString('utf8'));

console.log('\n== estrutura ==');
console.log('scenes:      ', json.scenes?.length ?? 0);
console.log('nodes:       ', json.nodes?.length ?? 0);
console.log('meshes:      ', json.meshes?.length ?? 0);
console.log('materials:   ', json.materials?.length ?? 0);
console.log('textures:    ', json.textures?.length ?? 0);
console.log('images:      ', json.images?.length ?? 0);
console.log('skins:       ', json.skins?.length ?? 0);
console.log('animations:  ', json.animations?.length ?? 0);
console.log('accessors:   ', json.accessors?.length ?? 0);
console.log('bufferViews: ', json.bufferViews?.length ?? 0);

if (json.animations?.length) {
  console.log('\n== animations ==');
  json.animations.forEach((a, i) => {
    console.log(
      ` [${i}] name="${a.name || '(sem nome)'}" channels=${a.channels?.length || 0} samplers=${a.samplers?.length || 0}`,
    );
  });
}

if (json.nodes?.length) {
  console.log('\n== top-level nodes (scene 0) ==');
  const sceneNodes = json.scenes?.[0]?.nodes || [];
  for (const idx of sceneNodes) {
    const n = json.nodes[idx];
    console.log(
      ` [${idx}] name="${n?.name || ''}" mesh=${n?.mesh} skin=${n?.skin} scale=${JSON.stringify(n?.scale)} translation=${JSON.stringify(n?.translation)}`,
    );
  }
}

// Verificar se as meshes têm skinning (JOINTS_0/WEIGHTS_0) e se algum nó
// consumidor tem skin apontado.
console.log('\n== meshes ==');
for (const [i, m] of (json.meshes || []).entries()) {
  const nodeConsumers = (json.nodes || [])
    .map((n, k) => (n.mesh === i ? { k, name: n.name, skin: n.skin } : null))
    .filter(Boolean);
  for (const [j, p] of (m.primitives || []).entries()) {
    const hasJoints = 'JOINTS_0' in (p.attributes || {});
    const hasWeights = 'WEIGHTS_0' in (p.attributes || {});
    console.log(
      ` mesh[${i}]="${m.name || ''}" prim[${j}] mode=${p.mode ?? 4} material=${p.material} JOINTS_0=${hasJoints} WEIGHTS_0=${hasWeights} consumers=${JSON.stringify(nodeConsumers)}`,
    );
  }
}

console.log('\n== materials ==');
for (const [i, mat] of (json.materials || []).entries()) {
  const bcf = mat.pbrMetallicRoughness?.baseColorFactor;
  console.log(
    ` [${i}] name="${mat.name || ''}" alphaMode=${mat.alphaMode || 'OPAQUE'} doubleSided=${mat.doubleSided} baseColor=${JSON.stringify(bcf)}`,
  );
}

// bounding box aproximada via accessors dos POSITION
const positions = [];
for (const m of json.meshes ?? []) {
  for (const p of m.primitives ?? []) {
    if (p.attributes?.POSITION != null) positions.push(p.attributes.POSITION);
  }
}
console.log('\n== positions (accessors) ==');
let minX = Infinity, minY = Infinity, minZ = Infinity;
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
for (const idx of positions) {
  const acc = json.accessors[idx];
  if (acc.min && acc.max) {
    minX = Math.min(minX, acc.min[0]);
    minY = Math.min(minY, acc.min[1]);
    minZ = Math.min(minZ, acc.min[2]);
    maxX = Math.max(maxX, acc.max[0]);
    maxY = Math.max(maxY, acc.max[1]);
    maxZ = Math.max(maxZ, acc.max[2]);
  }
}
if (isFinite(minX)) {
  console.log(
    ` min=(${minX.toFixed(2)}, ${minY.toFixed(2)}, ${minZ.toFixed(2)})`,
  );
  console.log(
    ` max=(${maxX.toFixed(2)}, ${maxY.toFixed(2)}, ${maxZ.toFixed(2)})`,
  );
  console.log(
    ` size=(${(maxX-minX).toFixed(2)}, ${(maxY-minY).toFixed(2)}, ${(maxZ-minZ).toFixed(2)}) unidades do modelo`,
  );
} else {
  console.log(' (sem min/max nos accessors)');
}
