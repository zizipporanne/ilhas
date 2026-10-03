import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getHeight, getTerrainNormal } from './terrain.js';
import { projectToWorld } from './hydrography.js';

/**
 * Carrega a lista de modelos 3D (.glb / .gltf) do seu pacote
 */
async function loadPackModels(modelPaths) {
  const loader = new GLTFLoader();
  const loadedModels = [];

  for (const path of modelPaths) {
    try {
      const gltf = await loader.loadAsync(path);
      
      // Extrai meshes do modelo para permitir InstancedMesh
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          loadedModels.push({
            geometry: child.geometry,
            material: child.material
          });
        }
      });
    } catch (err) {
      console.error(`[Vegetação] Erro ao carregar o modelo 3D: ${path}`, err);
    }
  }

  return loadedModels;
}

/**
 * Carrega a vegetação nos pontos reais da sua mancha usando seu pack 3D
 */
export async function createVegetation(vegetationDataPath, modelPaths = []) {
  const containerGroup = new THREE.Group();
  containerGroup.name = 'vegetation_container';

  // 1. Carrega os arquivos .glb/.gltf do seu pacote
  const models = await loadPackModels(modelPaths);
  if (models.length === 0) {
    console.warn('[Vegetação] Nenhum modelo 3D foi carregado do seu pack.');
    return containerGroup;
  }

  // 2. Obtém as posições reais da vegetação (lidas do seu GeoTIFF / JSON)
  const vegetationPoints = await parseVegetationData(vegetationDataPath);
  if (vegetationPoints.length === 0) {
    console.warn('[Vegetação] Nenhum ponto de vegetação extraído dos dados.');
    return containerGroup;
  }

  // 3. Distribui os modelos do pack entre os pontos extraídos
  const dummy = new THREE.Object3D();
  const upVector = new THREE.Vector3(0, 1, 0);
  const itemsPerModel = Math.ceil(vegetationPoints.length / models.length);

  models.forEach((model, modelIdx) => {
    const start = modelIdx * itemsPerModel;
    const end = Math.min(start + itemsPerModel, vegetationPoints.length);
    const chunk = vegetationPoints.slice(start, end);

    if (chunk.length === 0) return;

    const instancedMesh = new THREE.InstancedMesh(
      model.geometry,
      model.material,
      chunk.length
    );

    let validCount = 0;
    chunk.forEach((pt, i) => {
      // Vegetação realista: o terreno em questão tem picos de ~200 m e não sustenta
      // árvores ou mato em cotas muito elevadas. Evita instanciar em terrenos altos.
      const y = getHeight(pt.x, pt.z);
      if (y > 160) return;

      const normal = getTerrainNormal(pt.x, pt.z);

      dummy.position.set(pt.x, y, pt.z);

      // Usa a mesma escala do mundo do terreno/prédios para manter a vegetação
      // proporcional à cena. O fator 0.0007 é o mesmo usado para extrusão dos prédios.
      const elevationFactor = 1.0 - Math.min(1, Math.max(0, (y - 10) / 150));
      const scale = (pt.density || 1.0) * (0.8 + Math.random() * 0.5) * 7.0 * 0.0007 * (0.55 + elevationFactor * 0.8);
      dummy.scale.set(scale, scale, scale);

      const q = new THREE.Quaternion().setFromUnitVectors(upVector, normal);
      dummy.quaternion.slerp(q, 0.2);
      dummy.rotateY(Math.random() * Math.PI * 2);

      dummy.updateMatrix();
      instancedMesh.setMatrixAt(validCount, dummy.matrix);
      validCount += 1;
    });

    if (validCount === 0) {
      instancedMesh.dispose();
      containerGroup.remove(instancedMesh);
      return;
    }

    instancedMesh.count = validCount;

    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    containerGroup.add(instancedMesh);
  });

  return containerGroup;
}

/**
 * Mapeador de Dados: lê GeoJSON de vegetação e converte polígonos em pontos
 * para instanciar os modelos em locais reais do terreno.
 */
function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function samplePolygonPoints(rings) {
  const outerRing = rings[0] || [];
  if (outerRing.length < 3) return [];

  const lons = outerRing.map(([lon]) => lon);
  const lats = outerRing.map(([, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const holes = rings.slice(1);
  const results = [];
  const sampleCount = 6;

  for (let i = 0; i < sampleCount; i++) {
    const lon = minLon + Math.random() * (maxLon - minLon);
    const lat = minLat + Math.random() * (maxLat - minLat);
    const point = { x: lon, y: lat };

    if (!pointInRing(point, outerRing)) continue;
    if (holes.some(hole => hole.length > 2 && pointInRing(point, hole))) continue;

    const projected = projectToWorld(lon, lat);
    results.push({
      x: projected.x,
      z: projected.z,
      density: 0.9 + Math.random() * 0.6
    });
  }

  return results;
}

async function parseVegetationData(dataPath) {
  const points = [];

  try {
    const response = await fetch(dataPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (dataPath.endsWith('.json') || dataPath.endsWith('.geojson')) {
      const geojson = await response.json();
      geojson.features?.forEach((feat) => {
        const props = feat.properties || {};
        const geometry = feat.geometry;

        if (!geometry) return;

        if (geometry.type === 'Point') {
          const [lon, lat] = geometry.coordinates;
          const projected = projectToWorld(lon, lat);
          points.push({ x: projected.x, z: projected.z, density: props.density || 1 });
          return;
        }

        if (geometry.type === 'Polygon') {
          points.push(...samplePolygonPoints(geometry.coordinates));
          return;
        }

        if (geometry.type === 'MultiPolygon') {
          geometry.coordinates.forEach((polygon) => {
            points.push(...samplePolygonPoints(polygon));
          });
        }
      });
    }
  } catch (err) {
    console.error('[Vegetação] Erro ao ler os dados de vegetação:', err);
  }

  return points;
}