import * as THREE from 'three';

export const PixelShader = {
    uniforms: {
        tDiffuse: { value: null },
        pixelSize: { value: 2.0 },
        colorDepth: { value: 22.0 },
        brightness: { value: 5.0 },
        contrast: { value: 1.15 },
        outlineStrength: { value: 0.45 },
        resolution: { value: new THREE.Vector2() }
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
        uniform vec2 resolution;
        uniform float pixelSize;
        uniform float colorDepth;
        uniform float brightness;
        uniform float contrast;
        uniform float outlineStrength;
        varying vec2 vUv;

        float luminance(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
        }

        float edgeMask(vec2 uv) {
            vec2 texel = 1.0 / resolution;
            vec3 center = texture2D(tDiffuse, uv).rgb;
            vec3 left = texture2D(tDiffuse, uv - vec2(texel.x, 0.0)).rgb;
            vec3 right = texture2D(tDiffuse, uv + vec2(texel.x, 0.0)).rgb;
            vec3 up = texture2D(tDiffuse, uv - vec2(0.0, texel.y)).rgb;
            vec3 down = texture2D(tDiffuse, uv + vec2(0.0, texel.y)).rgb;

            float diff = abs(luminance(center) - luminance(left));
            diff += abs(luminance(center) - luminance(right));
            diff += abs(luminance(center) - luminance(up));
            diff += abs(luminance(center) - luminance(down));

            return clamp(diff * 2.5, 0.0, 1.0);
        }

        void main() {
            vec2 dxy = max(pixelSize, 1.0) / resolution;
            vec2 coord = dxy * floor(vUv / dxy);

            vec4 texel = texture2D(tDiffuse, coord);
            vec3 color = texel.rgb;

            color = (color - 0.5) * contrast + 0.5;
            color *= brightness;
            color = floor(color * colorDepth) / colorDepth;

            float outline = edgeMask(coord);
            vec3 outlineColor = vec3(0.08, 0.10, 0.09);
            color = mix(color, outlineColor, outline * outlineStrength);

            gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
        }
    `
};
