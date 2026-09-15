// utils/retroShader.js
import * as THREE from 'three';

export const RetroShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'pixelSize': { value: 2.0 },      // Tamanho dos pixels
    'colorDepth': { value: 22.0 },    // Aumentado para preservar tons de verde
    'brightness': { value: 5 },     // Aumenta o brilho geral da cena
    'contrast': { value: 1.1 },       // Ajusta o contraste estilo anime
    'resolution': { value: new THREE.Vector2() }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float pixelSize;
    uniform float colorDepth;
    uniform float brightness;
    uniform float contrast;
    uniform vec2 resolution;
    varying vec2 vUv;

    // Matriz 4x4 Dither suave (Bayer Matrix)
    float dither4x4(vec2 position, float brightnessVal) {
      int x = int(mod(position.x, 4.0));
      int y = int(mod(position.y, 4.0));
      int index = x + y * 4;
      float limit = 0.0;

      if (index == 0) limit = 0.0625;
      if (index == 1) limit = 0.5625;
      if (index == 2) limit = 0.1875;
      if (index == 3) limit = 0.6875;
      if (index == 4) limit = 0.8125;
      if (index == 5) limit = 0.3125;
      if (index == 6) limit = 0.9375;
      if (index == 7) limit = 0.4375;
      if (index == 8) limit = 0.25;
      if (index == 9) limit = 0.75;
      if (index == 10) limit = 0.125;
      if (index == 11) limit = 0.625;
      if (index == 12) limit = 1.0;
      if (index == 13) limit = 0.5;
      if (index == 14) limit = 0.875;
      if (index == 15) limit = 0.375;

      return brightnessVal < limit ? 0.0 : 1.0;
    }

    void main() {
      // 1. Pixelização UV
      vec2 dxy = pixelSize / resolution;
      vec2 coord = dxy * floor(vUv / dxy);

      vec4 texel = texture2D(tDiffuse, coord);
      vec3 color = texel.rgb;

      // 2. Correção de Brilho e Contraste (Estilo Anime 90s)
      color = (color - 0.5) * contrast + 0.5;
      color *= brightness;

      // Realce específico para a vegetação (tons de verde)
      if (color.g > color.r && color.g > color.b) {
        color.g *= 1.15; // Deixa os verdes mais vivos
      }

      // 3. Redução de Cores Quantizada
      color = floor(color * colorDepth) / colorDepth;

      // 4. Dithering Sutil
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      float dither = dither4x4(gl_FragCoord.xy / pixelSize, lum);
      color += (dither - 0.5) * 0.04; // Dithering muito suave para não escurecer

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
    }
  `
};