// utils/buildings.js
// Carrega prédios do OSM (GeoJSON) e extruda em 3D
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { projectToWorld } from './hydrography.js';
import { getHeight } from './terrain.js';

const SCALE_FACTOR = 0.0007;

const DEFAULT_HEIGHT_M = 7;
const HEIGHT_PER_LEVEL_M = 3;
const MIN_FOOTPRINT_M2 = 40;

// Altura mínima do terreno (em unidades do mundo) para desenhar prédio.
// 0.01 ≈ 14m reais. Sobe se ainda passar prédio no mar.
const MIN_TERRAIN_Y = 0.01;

const LIMIT_X = 5.5;
const LIMIT_Z = 13;

export async function loadBuildings(url, opts = {}) {
  const {
    color = 0xc8c8c8,
    yOffset = 0.002
  } = opts;

  let geojson;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith('<')) {
      throw new Error('Servidor devolveu HTML em vez de JSON');
    }
    geojson = JSON.parse(text);
  } catch (err) {
    console.error('❌ Falha ao carregar edificações:', err.message);
    return new THREE.Group();
  }

  const geometries = [];
  let aceitos = 0, descartados = 0, foraDoDEM = 0, noMar = 0;

  for (const feature of geojson.features || []) {
    const geom = feature.geometry;
    if (!geom) continue;

    const polys = geom.type === 'Polygon' ? [geom.coordinates]
                : geom.type === 'MultiPolygon' ? geom.coordinates
                : null;
    if (!polys) continue;

    const props = feature.properties || {};

    let heightM = parseFloat(props.height);
    if (isNaN(heightM)) {
      const levels = parseFloat(props['building:levels']);
      heightM = !isNaN(levels) ? levels * HEIGHT_PER_LEVEL_M : DEFAULT_HEIGHT_M;
    }
    heightM = Math.min(heightM, 250);
    const heightWorld = heightM * SCALE_FACTOR;

    for (const poly of polys) {
      const outer = poly[0];
      if (!outer || outer.length < 4) continue;

      const pts = [];
      let cx = 0, cz = 0;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

      for (const [lon, lat] of outer) {
        const { x, z } = projectToWorld(lon, lat);
        pts.push({ x, z });
        cx += x; cz += z;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      cx /= pts.length;
      cz /= pts.length;

      // Fora do DEM
      if (Math.abs(cx) > LIMIT_X || Math.abs(cz) > LIMIT_Z) {
        foraDoDEM++;
        continue;
      }

      // Em cima do mar? Descarta
      const terrenoY = getHeight(cx, cz) || 0;
      if (terrenoY < MIN_TERRAIN_Y) {
        noMar++;
        continue;
      }

      // Área real em m² (converte mundo → metros)
      const widthM = (maxX - minX) / SCALE_FACTOR;
      const depthM = (maxZ - minZ) / SCALE_FACTOR;
      if (widthM * depthM < MIN_FOOTPRINT_M2) {
        descartados++;
        continue;
      }

      // Shape
      const shape = new THREE.Shape();
      pts.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x, -p.z);
        else shape.lineTo(p.x, -p.z);
      });

      // Extruda
      let geo;
      try {
        geo = new THREE.ExtrudeGeometry(shape, {
          depth: heightWorld,
          bevelEnabled: false,
          curveSegments: 1
        });
      } catch (e) {
        continue;
      }

      // Rotaciona: extrusão vai pra +Y
      geo.rotateX(-Math.PI / 2);

      // Assenta na cota do terreno
      const yBase = terrenoY + yOffset;
      geo.translate(0, yBase, 0);

      geometries.push(geo);
      aceitos++;
    }
  }

  console.log(`🏢 Edificações: ${aceitos} extrudadas` +
              ` (${foraDoDEM} fora do DEM, ${noMar} no mar, ${descartados} pequenas demais)`);

  if (geometries.length === 0) {
    return new THREE.Group();
  }

  let merged;
  try {
    merged = mergeGeometries(geometries, false);
  } catch (e) {
    console.warn('mergeGeometries falhou, retornando individual');
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
      color, flatShading: true, side: THREE.DoubleSide
    });
    geometries.forEach(geo => g.add(new THREE.Mesh(geo, mat)));
    return g;
  }

  const mat = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'buildings';
  return mesh;
}