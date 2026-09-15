// utils/points.js
// Renderiza marcadores (POIs) com suporte a rótulos em texto (Sprites 2D)
import * as THREE from 'three';
import { getHeight } from './terrain.js';

// Geometrias compartilhadas para economizar alocação de memória na GPU
const sharedBoxGeo = new THREE.BoxGeometry(0.12, 0.25, 0.12);
const sharedShadowGeo = new THREE.CircleGeometry(0.15, 8);
const sharedShadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.25,
  side: THREE.DoubleSide,
  depthWrite: false
});

/**
 * Cria uma textura de texto dinâmica usando um Canvas 2D
 */function createLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Fundo com transparência e bordas arredondadas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  
  // Desenha retângulo arredondado
  const x = 4, y = 4, w = 248, h = 56, r = 10;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Texto
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false // Mantém o rótulo legível mesmo atrás de árvores
  });

  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.8, 0.2, 1);
  return sprite;
}

/**
 * Cria um marcador individual (POI)
 */
export function createPOI(x, y, z, colorHex, labelText = '') {
  const group = new THREE.Group();
  group.name = `poi_${labelText.replace(/\s+/g, '_').toLowerCase()}`;

  // Corpo do Marcador
  const bodyMat = new THREE.MeshLambertMaterial({
    color: colorHex,
    flatShading: true,
    emissive: colorHex,
    emissiveIntensity: 0.35
  });

  const body = new THREE.Mesh(sharedBoxGeo, bodyMat);
  body.position.y = 0.2;
  body.castShadow = true;
  group.add(body);

  // Sombra no Chão
  const shadow = new THREE.Mesh(sharedShadowGeo, sharedShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  group.add(shadow);

  // Rótulo Flutuante em 2D (Sprite)
  if (labelText) {
    const labelSprite = createLabelSprite(labelText);
    labelSprite.position.set(0, 0.45, 0);
    group.add(labelSprite);
  }

  group.position.set(x, y, z);

  // Método auxiliar para animar a flutuação do POI no loop principal
  group.userData = {
    initialY: y,
    update: (time) => {
      body.rotation.y = time * 1.2;
      body.position.y = 0.2 + Math.sin(time * 3) * 0.03;
    }
  };

  return group;
}

/**
 * Constrói e posiciona o conjunto de POIs no terreno
 */
export function createPOIs() {
  const poisData = [
    { x: -2.5, z: -1.8, color: 0xff4d4d, label: 'Nascente' },
    { x: 1.8,  z: 1.2,  color: 0x4dff4d, label: 'Área de Plantio' },
    { x: -0.8, z: 2.8,  color: 0xffaa00, label: 'Reservatório' },
    { x: 2.8,  z: -2.2, color: 0x00aaff, label: 'Ponto de Observação' },
    { x: 0.5,  z: -2.8, color: 0xff00ff, label: 'Área de Compostagem' }
  ];

  return poisData.map(poi => {
    let surfaceY = 0;
    try {
      surfaceY = getHeight(poi.x, poi.z) || 0;
    } catch (e) {
      surfaceY = 0;
    }
    return createPOI(poi.x, surfaceY, poi.z, poi.color, poi.label);
  });
}