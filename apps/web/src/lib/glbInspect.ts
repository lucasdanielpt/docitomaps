import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** GLB Mixamo válido precisa de pelo menos um SkinnedMesh animável. */
export async function isGltfModelSkinned(url: string): Promise<boolean> {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    let found = false;
    gltf.scene.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) found = true;
    });
    return found;
  } catch {
    return false;
  }
}
