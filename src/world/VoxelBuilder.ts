import * as THREE from 'three';

export interface VoxelBoxSpec {
  pos: [number, number, number];
  size: [number, number, number];
  color?: THREE.ColorRepresentation;
  rot?: [number, number, number];
}

/**
 * Merges an array of box primitives into a single indexed BufferGeometry with vertex colors,
 * keeping GPU draw calls minimal while delivering crisp 3D beveled/voxel silhouettes.
 */
export function buildVoxelGeometry(
  boxes: readonly VoxelBoxSpec[],
  defaultColor: THREE.ColorRepresentation = 0xffffff
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tempColor = new THREE.Color();
  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scaleVec = new THREE.Vector3();
  const posVec = new THREE.Vector3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  let vertexOffset = 0;

  for (let i = 0; i < boxes.length; i++) {
    const spec = boxes[i];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    posVec.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    if (spec.rot) {
      euler.set(spec.rot[0], spec.rot[1], spec.rot[2]);
      quat.setFromEuler(euler);
    } else {
      quat.identity();
    }
    scaleVec.set(spec.size[0], spec.size[1], spec.size[2]);
    matrix.compose(posVec, quat, scaleVec);
    normalMatrix.getNormalMatrix(matrix);

    tempColor.set(spec.color ?? defaultColor);

    const posAttr = boxGeo.getAttribute('position');
    const normAttr = boxGeo.getAttribute('normal');
    const idxAttr = boxGeo.getIndex();

    for (let k = 0; k < posAttr.count; k++) {
      v.fromBufferAttribute(posAttr, k).applyMatrix4(matrix);
      n.fromBufferAttribute(normAttr, k).applyMatrix3(normalMatrix).normalize();

      positions.push(v.x, v.y, v.z);
      normals.push(n.x, n.y, n.z);
      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }

    if (idxAttr) {
      for (let k = 0; k < idxAttr.count; k++) {
        indices.push(idxAttr.getX(k) + vertexOffset);
      }
    }

    vertexOffset += posAttr.count;
    boxGeo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}
