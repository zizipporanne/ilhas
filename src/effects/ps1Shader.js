import * as THREE from 'three';

export function createPS1Material(options = {}) {
    const { jitterLevel = 120.0, ...meshOptions } = options;

    const defaults = {
        color: 0x44aa88,
        flatShading: true,
        vertexColors: false,
        side: THREE.DoubleSide,
        ...meshOptions
    };

    const material = new THREE.MeshLambertMaterial(defaults);

    material.userData = {
        uJitterLevel: { value: jitterLevel }
    };

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uJitterLevel = material.userData.uJitterLevel;

        shader.vertexShader = `
            uniform float uJitterLevel;
            ${shader.vertexShader}
        `;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `
            #include <project_vertex>

            vec4 snappedPosition = gl_Position;
            snappedPosition.xyz /= snappedPosition.w;
            snappedPosition.xy = floor(snappedPosition.xy * uJitterLevel) / uJitterLevel;
            snappedPosition.xyz *= snappedPosition.w;

            gl_Position = snappedPosition;
            `
        );
    };

    material.setJitter = (value) => {
        material.userData.uJitterLevel.value = value;
    };

    return material;
}