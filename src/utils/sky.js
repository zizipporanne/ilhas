import * as THREE from 'three';

export function createSky() {
  const group = new THREE.Group();
  group.name = 'sky';

  // ---------- Esfera do gradiente (bem menor, dentro do far) ----------
  const geo = new THREE.SphereGeometry(80, 24, 16);

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      topColor:    { value: new THREE.Color(0x1020a0) },
      bottomColor: { value: new THREE.Color(0x88bbee) },
      offset:      { value: 20 },
      exponent:    { value: 0.7 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float t = pow(max(h, 0.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `
  });

  group.add(new THREE.Mesh(geo, mat));

  // ---------- Nuvens — canvas pequeno, 3 octaves ----------
  const W = 256, H = 128;
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = W;
  cloudCanvas.height = H;
  const ctx = cloudCanvas.getContext('2d');

  function hash(x, y) {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
  }

  function smoothNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  function fbm(x, y) {
    let v = 0, amp = 1, freq = 1;
    for (let i = 0; i < 3; i++) {          // 3 octaves em vez de 5
      v += smoothNoise(x * freq, y * freq) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return v;
  }

  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gradient = Math.max(0, 1 - y / (H * 0.6));
      const n = fbm(x * 0.03, y * 0.06);
      const cloud = Math.max(0, (n - 0.45) * 2.5) * gradient;
      const a = Math.min(255, cloud * 255);
      const idx = (y * W + x) * 4;
      img.data[idx]     = 255;
      img.data[idx + 1] = 255;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);

  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  cloudTex.wrapS = THREE.RepeatWrapping;
  cloudTex.wrapT = THREE.ClampToEdgeWrapping;

  const cloudGeo = new THREE.SphereGeometry(78, 24, 16);
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.85,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false
  });

  group.add(new THREE.Mesh(cloudGeo, cloudMat));

  return group;
}