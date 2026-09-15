import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getHeight, getTerrainNormal } from './terrain.js';

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

    chunk.forEach((pt, i) => {
      // Ajusta altura y e normal conforme a malha do terreno
      const y = getHeight(pt.x, pt.z);
      const normal = getTerrainNormal(pt.x, pt.z);

      dummy.position.set(pt.x, y, pt.z);

      // Aplica escala/variação leve para evitar padronização mecânica
      const scale = (pt.density || 1.0) * (0.8 + Math.random() * 0.4);
      dummy.scale.set(scale, scale, scale);

      const q = new THREE.Quaternion().setFromUnitVectors(upVector, normal);
      dummy.quaternion.slerp(q, 0.2);
      dummy.rotateY(Math.random() * Math.PI * 2);

      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    containerGroup.add(instancedMesh);
  });

  return containerGroup;
}

/**
 * Mapeador de Dados: Lê os dados de presença/densidade do seu arquivo
 */
async function parseVegetationData(dataPath) {
  const points = [];

  try {
    const response = await fetch(dataPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (dataPath.endsWith('.json') || dataPath.endsWith('.geojson')) {
      const geojson = await response.json();
      geojson.features?.forEach((feat) => {
        if (feat.geometry.type === 'Point') {
          const [x, z] = feat.geometry.coordinates;
          points.push({ x, z, density: feat.properties?.density || 1 });
        }
      });
    }
  } catch (err) {
    console.error('[Vegetação] Erro ao ler os dados de vegetação:', err);
  }

  return points;
}