import * as THREE from 'three';

export function createWater(elevationData, opts = {}) {
  const {
    initialLevelMeters = 29,
    sizeX = 10,
    sizeZ = 24,
    fogColor = 0xb8c4d0,
    fogNear = 1500,
    fogFar = 4500,
    scaleFactor = 0.0007
  } = opts;

  let demTex = null;

  if (elevationData && elevationData.data) {
    const { width, height, data, minHeight } = elevationData;
    const heightArray = new Float32Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      let v = data[i];
      if (v < -9999 || isNaN(v)) v = minHeight;
      heightArray[i] = v;
    }

    demTex = new THREE.DataTexture(
      heightArray, width, height,
      THREE.RedFormat, THREE.FloatType
    );
    demTex.minFilter = THREE.LinearFilter;
    demTex.magFilter = THREE.LinearFilter;
    demTex.wrapS = THREE.ClampToEdgeWrapping;
    demTex.wrapT = THREE.ClampToEdgeWrapping;
    demTex.flipY = true;
    demTex.needsUpdate = true;
  } else {
    demTex = new THREE.DataTexture(new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType);
    demTex.needsUpdate = true;
  }

  const uniforms = {
    uTime:             { value: 0 },
    uDemTex:           { value: demTex },
    uWaterLevel:       { value: initialLevelMeters },
    uSizeX:            { value: sizeX },
    uSizeZ:            { value: sizeZ },
    uWaterDeep:        { value: new THREE.Color(0x0a1e36) },
    uWaterMid:         { value: new THREE.Color(0x15455f) },
    uWaterShallow:     { value: new THREE.Color(0x3a7a96) },
    uWaterVeryShallow: { value: new THREE.Color(0x7ac0cc) },
    uFogColor:         { value: new THREE.Color(fogColor) },
    uFogNear:          { value: fogNear },
    uFogFar:           { value: fogFar }
  };

  const material = new THREE.MeshStandardMaterial({
    color: 0x4aa7d8,
    transparent: true,
    opacity: 0.9,
    emissive: 0x123a57,
    roughness: 0.25,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  const planeW = sizeX * 3.0;
  const planeH = sizeZ * 3.0;
  const geo = new THREE.PlaneGeometry(planeW, planeH, 1, 1);
  
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = initialLevelMeters * scaleFactor;
  mesh.frustumCulled = true;
  mesh.renderOrder = 1;
  mesh.name = 'water';

  function setWaterLevel(meters) {
    uniforms.uWaterLevel.value = meters;
    mesh.position.y = meters * scaleFactor;
  }

  function updateTime(t) {
    uniforms.uTime.value = t;
  }

  function dispose() {
    if (demTex) demTex.dispose();
    if (geo) geo.dispose();
    if (material) material.dispose();
  }

  return { mesh, setWaterLevel, updateTime, uniforms, dispose };
}