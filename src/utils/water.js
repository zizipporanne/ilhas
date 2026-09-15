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

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uSizeX;
      uniform float uSizeZ;
      varying vec3 vWorldPos;
      varying vec2 vDemUV;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        
        vDemUV = vec2(
          0.5 - worldPos.x / uSizeX,
          worldPos.z / uSizeZ + 0.5
        );
        
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uDemTex;
      uniform float uWaterLevel;
      uniform vec3 uWaterDeep;
      uniform vec3 uWaterMid;
      uniform vec3 uWaterShallow;
      uniform vec3 uWaterVeryShallow;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;

      varying vec3 vWorldPos;
      varying vec2 vDemUV;

      void main() {
        float inside = step(0.0, vDemUV.x) * step(vDemUV.x, 1.0) *
                       step(0.0, vDemUV.y) * step(vDemUV.y, 1.0);

        float terrainH = texture2D(uDemTex, vDemUV).r;
        float depth = mix(100.0, uWaterLevel - terrainH, inside);

        float t1 = step(2.0, depth);
        float t2 = step(8.0, depth);
        float t3 = step(30.0, depth);

        vec3 col = mix(uWaterVeryShallow, uWaterShallow, t1);
        col = mix(col, uWaterMid, t2);
        col = mix(col, uWaterDeep, t3);

        vec2 tileUV = vWorldPos.xz * 0.6;
        float wave = sin(tileUV.x + uTime * 0.4)
                   + sin(tileUV.y + uTime * 0.3)
                   + sin((tileUV.x + tileUV.y) * 0.5 + uTime * 0.5);
        wave = floor((wave / 3.0) * 4.0 + 0.5) * 0.25;

        col += wave * 0.015;

        float dist = distance(cameraPosition, vWorldPos);
        float fogFactor = smoothstep(uFogNear, uFogFar, dist);
        
gl\_FragColor = vec4(mix(col, uFogColor, fogFactor), 1.0); gl\_FragColor = vec4(col, 1.0)      }
    `,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false
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