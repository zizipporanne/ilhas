// utils/hydrography.js
// Converte lon/lat (GeoJSON) -> UTM 23S (bbox do TIFF)
// X espelhado para orientação correta com a câmera no sul
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { getHeight } from './terrain.js';
import proj4 from 'proj4';

const UTM_23S = '+proj=utm +zone=23 +south +datum=WGS84 +units=m +no_defs';
const WGS84   = 'EPSG:4326';

const SIZE_X = 10;
const DEFAULT_Y_OFFSET = 0.005;
const INVERT_Z = false;

const VALID_WATERWAY = /^(river|stream|canal|drain|ditch|creek|tidal_channel|rapids|waterfall|weir|dam)$/;
const MIN_HEIGHT_TO_DRAW = -0.005;

let _bboxUTM = null;
let _sizeZ = SIZE_X;
let _centerX = 0, _centerY = 0;
let _spanX = 1, _spanY = 1;

// Gerenciamento centralizado de materiais para redimensionamento e dispose
const activeLineMaterials = new Set();

export function initProjection(bbox) {
  if (!bbox || bbox.length < 4) {
    console.warn('⚠️ hydrography: bbox inválido');
    return;
  }
  _bboxUTM = bbox;
  _spanX = bbox[2] - bbox[0];
  _spanY = bbox[3] - bbox[1];
  _centerX = (bbox[0] + bbox[2]) / 2;
  _centerY = (bbox[1] + bbox[3]) / 2;
  _sizeZ = SIZE_X * (_spanY / _spanX);

  console.log('🌊 Hydrography projeção inicializada:', {
    bboxUTM: bbox,
    sizeZ: _sizeZ
  });
}

export function projectToWorld(lon, lat) {
  if (!_bboxUTM) return { x: 0, z: 0, utmX: 0, utmY: 0 };
  
  const [utmX, utmY] = proj4(WGS84, UTM_23S, [lon, lat]);
  const x = -((utmX - _centerX) / _spanX) * SIZE_X;
  const dY = (utmY - _centerY) / _spanY;
  const z = INVERT_Z ? -dY * _sizeZ : dY * _sizeZ;
  return { x, z, utmX, utmY };
}

function isInsideDEM(lon, lat) {
  if (!_bboxUTM) return true;
  const [utmX, utmY] = proj4(WGS84, UTM_23S, [lon, lat]);
  return utmX >= _bboxUTM[0] && utmX <= _bboxUTM[2] &&
         utmY >= _bboxUTM[1] && utmY <= _bboxUTM[3];
}

// -------------------------------------------------------------
export async function loadHydrography(url, opts = {}) {
  const {
    colorRio      = 0x2a7fff,
    colorCanal    = 0x9d4edd,
    colorVarzea   = 0x4a90d9,
    widthRio      = 1.5,
    widthCanal    = 1.0,
    yOffset       = DEFAULT_Y_OFFSET,
    varzeaOpacity = 0.35
  } = opts;

  let geojson;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    geojson = await res.json();
  } catch (err) {
    console.error('❌ Falha ao carregar hidrografia:', err);
    return new THREE.Group();
  }

  const group = new THREE.Group();
  group.name = 'hydrography';

  // Buffers para agrupamento de segmentos de linha (Batching de Draw Calls)
  const segmentsRio = [];
  const segmentsCanal = [];

  let nLines = 0, nPolys = 0, nSkipped = 0, nRejected = 0;

  for (const feature of geojson.features || []) {
    const geom = feature.geometry;
    if (!geom) continue;

    const p = feature.properties || {};
    const tipo = String(p.waterway || p.type || '').toLowerCase();
    const nat  = String(p.natural || '').toLowerCase();

    if (tipo && !VALID_WATERWAY.test(tipo)) {
      nRejected++;
      continue;
    }

    const isCanal  = /canal|drain|ditch/.test(tipo);
    const isVarzea = /varzea|flood|wetland/.test(nat);
    const targetSegments = isCanal ? segmentsCanal : segmentsRio;

    if (geom.type === 'LineString') {
      if (extractSegments(geom.coordinates, targetSegments, yOffset)) nLines++;
      else nSkipped++;
    } else if (geom.type === 'MultiLineString') {
      for (const coords of geom.coordinates) {
        if (extractSegments(coords, targetSegments, yOffset)) nLines++;
        else nSkipped++;
      }
    } else if (geom.type === 'Polygon' && isVarzea) {
      if (addPolygon(group, geom.coordinates, colorVarzea, varzeaOpacity, yOffset)) nPolys++;
      else nSkipped++;
    } else if (geom.type === 'MultiPolygon' && isVarzea) {
      for (const poly of geom.coordinates) {
        if (addPolygon(group, poly, colorVarzea, varzeaOpacity, yOffset)) nPolys++;
        else nSkipped++;
      }
    }
  }

  // Constrói redes consolidadas de linhas (1 único DrawCall por categoria)
  if (segmentsRio.length > 0) {
    buildLineBatch(group, segmentsRio, colorRio, widthRio);
  }
  if (segmentsCanal.length > 0) {
    buildLineBatch(group, segmentsCanal, colorCanal, widthCanal);
  }

  console.log(`🌊 Hidrografia carregada: ${nLines} linhas batcheadas, ${nPolys} polígonos` +
              ` (${nSkipped} fora do DEM/mar, ${nRejected} tipos rejeitados)`);
  return group;
}

// -------------------------------------------------------------
// Extrai pares de pontos seguidos para criação de LineSegments
function extractSegments(coords, outSegments, yOffset) {
  if (!coords || coords.length < 2) return false;

  const insideCoords = coords.filter(pt => isInsideDEM(pt[0], pt[1]));
  if (insideCoords.length < 2) return false;

  const pts3D = [];
  let pontosNoMar = 0;

  for (const pt of insideCoords) {
    const { x, z } = projectToWorld(pt[0], pt[1]);
    let y = 0;
    try { y = getHeight(x, z) || 0; } catch (e) { y = 0; }

    if (y < MIN_HEIGHT_TO_DRAW) {
      pontosNoMar++;
    }
    pts3D.push({ x, y: y + yOffset, z, isSea: y < MIN_HEIGHT_TO_DRAW });
  }

  if (pontosNoMar > insideCoords.length * 0.95) return false;

  let added = false;
  for (let i = 0; i < pts3D.length - 1; i++) {
    const p1 = pts3D[i];
    const p2 = pts3D[i + 1];

    if (p1.isSea && p2.isSea) continue;

    outSegments.push(
      p1.x, p1.y, p1.z,
      p2.x, p2.y, p2.z
    );
    added = true;
  }

  return added;
}

// Constrói uma malha composta de linhas de alta performance
function buildLineBatch(group, positions, color, width) {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);

  const material = new LineMaterial({
    color,
    linewidth: width,
    worldUnits: false,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });

  material.resolution.set(window.innerWidth, window.innerHeight);
  activeLineMaterials.add(material);

  const lineMesh = new LineSegments2(geometry, material);
  lineMesh.computeLineDistances();
  lineMesh.renderOrder = 2;
  group.add(lineMesh);
}

// -------------------------------------------------------------
function addPolygon(group, rings, color, opacity, yOffset) {
  const outer = rings[0];
  if (!outer || outer.length < 3) return false;

  const insideCoords = outer.filter(pt => isInsideDEM(pt[0], pt[1]));
  if (insideCoords.length < 3) return false;

  let pontosEmTerra = 0;
  for (const pt of insideCoords) {
    const { x, z } = projectToWorld(pt[0], pt[1]);
    let y = 0;
    try { y = getHeight(x, z) || 0; } catch (e) { y = 0; }
    if (y >= MIN_HEIGHT_TO_DRAW) pontosEmTerra++;
  }
  if (pontosEmTerra < insideCoords.length * 0.3) return false;

  const shape = new THREE.Shape();
  insideCoords.forEach((pt, i) => {
    const { x, z } = projectToWorld(pt[0], pt[1]);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });

  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = 0;
    try { y = getHeight(x, z) || 0; } catch (e) { y = 0; }
    pos.setY(i, Math.max(y, 0) + yOffset);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  group.add(mesh);
  return true;
}

// -------------------------------------------------------------
export function onHydrographyResize() {
  const w = window.innerWidth, h = window.innerHeight;
  activeLineMaterials.forEach(mat => mat.resolution.set(w, h));
}

export function disposeHydrography(group) {
  if (!group) return;

  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => {
          activeLineMaterials.delete(m);
          m.dispose();
        });
      } else {
        activeLineMaterials.delete(obj.material);
        obj.material.dispose();
      }
    }
  });

  activeLineMaterials.clear();
}