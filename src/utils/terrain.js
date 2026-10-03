import * as THREE from 'three';
import { SimplexNoise } from './noise.js';

let cachedElevationData = null;
const SCALE_FACTOR = 0.0007;

export function setElevationData(data) { 
  cachedElevationData = data; 
}

const PALETTE = {
  oceanDeep:    [0.15, 0.25, 0.35], 
  oceanMid:     [0.22, 0.35, 0.45], 
  oceanShallow: [0.35, 0.50, 0.58], 
  turquoise:    [0.45, 0.62, 0.60], 
  sand:         [0.68, 0.68, 0.58], 
  coastGreen:   [0.52, 0.65, 0.45], 
  grassLow:     [0.45, 0.60, 0.40], 
  grassMid:     [0.38, 0.52, 0.34], 
  forestDeep:   [0.30, 0.42, 0.28], 
  rock:         [0.25, 0.35, 0.25], 
  peak:         [0.20, 0.30, 0.20]  
};

function lerp(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

function colorForElevation(elev) {
  if (elev < -9999 || Number.isNaN(elev)) return PALETTE.oceanDeep;
  if (elev < -10) return PALETTE.oceanDeep;
  if (elev < -2) return lerp(PALETTE.oceanDeep, PALETTE.oceanMid, (elev + 10) / 8);
  if (elev < 0) return lerp(PALETTE.oceanMid, PALETTE.oceanShallow, (elev + 2) / 2);
  if (elev < 1) return lerp(PALETTE.oceanShallow, PALETTE.turquoise, elev);
  if (elev < 4) return lerp(PALETTE.turquoise, PALETTE.sand, (elev - 1) / 3);
  if (elev < 10) return lerp(PALETTE.sand, PALETTE.coastGreen, (elev - 4) / 6);
  if (elev < 30) return lerp(PALETTE.coastGreen, PALETTE.grassLow, (elev - 10) / 20);
  if (elev < 80) return lerp(PALETTE.grassLow, PALETTE.grassMid, (elev - 30) / 50);
  if (elev < 150) return lerp(PALETTE.grassMid, PALETTE.forestDeep, (elev - 80) / 70);
  if (elev < 230) return lerp(PALETTE.forestDeep, PALETTE.rock, (elev - 150) / 80);
  if (elev < 300) return lerp(PALETTE.rock, PALETTE.peak, (elev - 230) / 70);
  return PALETTE.peak;
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
}

function smoothNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function generatePaintedTexture(elevationData) {
  const w = elevationData.width, h = elevationData.height;
  const data = elevationData.data;
  
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : document.createElement('canvas');
  
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const buf = img.data;

  const BRUSH_SCALE = 0.20;
  const WASH_SCALE = 0.04;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const idx = row * w + col;
      const elev = data[idx];
      let [r, g, b] = colorForElevation(elev);

      const brush = smoothNoise(col * BRUSH_SCALE, row * BRUSH_SCALE) * 0.025;
      const wash  = smoothNoise(col * WASH_SCALE,  row * WASH_SCALE)  * 0.04;

      const v = brush + wash;
      r = Math.max(0, Math.min(1, r + v));
      g = Math.max(0, Math.min(1, g + v));
      b = Math.max(0, Math.min(1, b + v));

      const px = idx * 4;
      buf[px]     = (r * 255) | 0;
      buf[px + 1] = (g * 255) | 0;
      buf[px + 2] = (b * 255) | 0;
      buf[px + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function createTerrain(elevationData = null) {
  if (elevationData) {
    setElevationData(elevationData);
  }

  const noise = new SimplexNoise();

  const sizeX = 10;
  const bbox = elevationData ? elevationData.bbox : null;
  const propX = bbox ? bbox[2] - bbox[0] : 1;
  const propZ = bbox ? bbox[3] - bbox[1] : 1;
  const sizeZ = bbox ? (sizeX * (propZ / propX)) : 10;

  const segments = 180;
  const geometry = new THREE.BufferGeometry();
  
  const vertexCount = (segments + 1) * (segments + 1);
  const vertices = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(segments * segments * 6);

  let vIdx = 0, uIdx = 0;

  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= segments; j++) {
      const x = sizeX / 2 - (i / segments) * sizeX;
      const z = -sizeZ / 2 + (j / segments) * sizeZ;

      let height;
      if (elevationData && typeof elevationData.getHeight === 'function') {
        height = elevationData.getHeight(x, z, sizeX, sizeZ) * SCALE_FACTOR;
      } else {
        height = noise.noise2D(x * 0.3, z * 0.3) * 1.2;
        height += noise.noise2D(x * 0.6 + 10, z * 0.6 + 10) * 0.48;
      }

      vertices[vIdx++] = x;
      vertices[vIdx++] = height;
      vertices[vIdx++] = z;

      uvs[uIdx++] = 1 - (x + sizeX / 2) / sizeX;
      uvs[uIdx++] = (z + sizeZ / 2) / sizeZ;
    }
  }

  let iIdx = 0;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (segments + 1) + j;
      const d = c + 1;

      indices[iIdx++] = a; indices[iIdx++] = b; indices[iIdx++] = c;
      indices[iIdx++] = b; indices[iIdx++] = d; indices[iIdx++] = c;
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const group = new THREE.Group();
  group.name = 'terrain';

  let topMaterial;
  if (elevationData) {
    const canvas = generatePaintedTexture(elevationData);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    texture.needsUpdate = true;

    topMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      flatShading: false,
      side: THREE.DoubleSide
    });
  } else {
    topMaterial = new THREE.MeshLambertMaterial({
      color: 0x3a6039,
      flatShading: false,
      side: THREE.DoubleSide
    });
  }

  const topMesh = new THREE.Mesh(geometry, topMaterial);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);

  return group;
}

export function getHeight(x, z) {
  if (cachedElevationData && typeof cachedElevationData.getHeight === 'function') {
    const bbox = cachedElevationData.bbox;
    const sizeX = 10;
    const sizeZ = sizeX * ((bbox[3] - bbox[1]) / (bbox[2] - bbox[0]));
    return cachedElevationData.getHeight(x, z, sizeX, sizeZ) * SCALE_FACTOR;
  }
  const noise = new SimplexNoise();
  let h = noise.noise2D(x * 0.3, z * 0.3) * 1.2;
  h += noise.noise2D(x * 0.6 + 10, z * 0.6 + 10) * 0.48;
  return h;
}

export function getTerrainNormal(x, z, eps = 0.05) {
  const hL = getHeight(x - eps, z);
  const hR = getHeight(x + eps, z);
  const hD = getHeight(x, z - eps);
  const hU = getHeight(x, z + eps);

  const normal = new THREE.Vector3(hL - hR, 2 * eps, hD - hU);
  return normal.normalize();
}