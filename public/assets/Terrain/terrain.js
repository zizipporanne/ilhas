import * as THREE from 'three';
import { SimplexNoise } from '../../../src/utils/noise.js';

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

function generatePaintedTextureFallback(segments) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(512, 512);
  const buf = img.data;

  const noise = new SimplexNoise();

  for (let row = 0; row < 512; row++) {
    for (let col = 0; col < 512; col++) {
      const x = (col / 512 - 0.5) * 10;
      const z = (row / 512 - 0.5) * 24;
      
      let h = noise.noise2D(x * 0.3, z * 0.3) * 100;
      let [r, g, b] = colorForElevation(h);

      const idx = (row * 512 + col) * 4;
      buf[idx]     = (r * 255) | 0;
      buf[idx + 1] = (g * 255) | 0;
      buf[idx + 2] = (b * 255) | 0;
      buf[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function createTerrain(elevationData = null) {
  if (elevationData && elevationData.data) {
    setElevationData(elevationData);
  }

  const sizeX = 10;
  const sizeZ = 24; 
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

      const height = getHeight(x, z);

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

  const canvas = generatePaintedTextureFallback(segments);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const topMaterial = new THREE.MeshLambertMaterial({
    map: texture,
    flatShading: false,
    side: THREE.DoubleSide
  });

  const topMesh = new THREE.Mesh(geometry, topMaterial);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);

  // VÍNCULO GLOBAL DO MAPA
  window.terreno3DInstanciado = group; 

  return group;
}

export function getHeight(x, z) {
  const noise = new SimplexNoise();
  let h = noise.noise2D(x * 0.2, z * 0.2) * 1.5;
  h += noise.noise2D(x * 0.5 + 5, z * 0.5 + 5) * 0.4;
  return Math.max(-0.5, h);
}

export function getTerrainNormal(x, z, eps = 0.05) {
  const hL = getHeight(x - eps, z);
  const hR = getHeight(x + eps, z);
  const hD = getHeight(x, z - eps);
  const hU = getHeight(x, z + eps);

  const normal = new THREE.Vector3(hL - hR, 2 * eps, hD - hU);
  return normal.normalize();
}
