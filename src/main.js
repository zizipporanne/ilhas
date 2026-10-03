import { loadElevationData } from './utils/elevationLoader.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// O protótipo continua lightweight, mas agora usa o DEM real como referência.
// A cena abre dentro da área do terreno real, ajustando player.x/player.y ao centro
// do bbox do TIFF e usando a elevação real para o nível do chão.
const map = [
  '1111111111111111',
  '1100000000000011',
  '1100110011000011',
  '1100100001000011',
  '1100100111000011',
  '1100000000000011',
  '1100011111000011',
  '1100010001000011',
  '1100010001000011',
  '1100011111000011',
  '1100000000000011',
  '1100110110000011',
  '1100100100000011',
  '1100000000000011',
  '1111111111111111'
];

const sprites = [
  { x: 4.8, y: 5.5, color: '#5fae5a' },
  { x: 6.5, y: 4.0, color: '#6fbf6b' },
  { x: 10.2, y: 5.4, color: '#5bbd62' },
  { x: 11.1, y: 10.8, color: '#78d57c' },
  { x: 8.5, y: 11.9, color: '#69c56f' },
  { x: 3.5, y: 10.4, color: '#5ead5e' }
];

const DEM_FILE = '/V4_1_-48.48_-27.59.tif';
const terrainWorld = {
  bbox: null,
  width: 15,
  depth: 15,
  sample: null,
  center: { x: 0, y: 0 }
};

const player = {
  x: 7.5,
  y: 7.5,
  angle: -0.7,
  speed: 1.7,
  turn: 1.5,
  groundHeight: 0
};

async function bindToTerrainData() {
  const sample = await loadElevationData(DEM_FILE);
  if (!sample || !sample.bbox) return;

  terrainWorld.bbox = sample.bbox;
  terrainWorld.sample = sample;

  const minX = sample.bbox[0];
  const maxX = sample.bbox[2];
  const minY = sample.bbox[1];
  const maxY = sample.bbox[3];

  const centerUtmX = (minX + maxX) / 2;
  const centerUtmY = (minY + maxY) / 2;

  terrainWorld.center = {
    x: (centerUtmX - minX) / (maxX - minX) * terrainWorld.width,
    y: (centerUtmY - minY) / (maxY - minY) * terrainWorld.depth
  };

  player.x = terrainWorld.center.x;
  player.y = terrainWorld.center.y;
  player.groundHeight = sample.getHeight(player.x, player.y, terrainWorld.width, terrainWorld.depth);
}

function currentGroundHeight() {
  if (!terrainWorld.sample) return 0;
  return terrainWorld.sample.getHeight(player.x, player.y, terrainWorld.width, terrainWorld.depth);
}

const keys = {};
const MAX_DEPTH = 18;

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(window.innerWidth * ratio);
  const height = Math.floor(window.innerHeight * ratio);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCell(x, y) {
  const mapWidth = map[0].length;
  const mapHeight = map.length;
  if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return 1;
  return map[Math.floor(y)][Math.floor(x)] === '1' ? 1 : 0;
}

function castRay(angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  let distance = 0;
  const step = 0.02;

  while (distance < MAX_DEPTH) {
    const x = player.x + cos * distance;
    const y = player.y + sin * distance;
    if (getCell(x, y) === 1) {
      return distance;
    }
    distance += step;
  }
  return MAX_DEPTH;
}

function drawBackground() {
  const { width, height } = canvas;
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.5);
  sky.addColorStop(0, '#2b3a52');
  sky.addColorStop(1, '#0d1724');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.5);

  const groundHeightValue = currentGroundHeight();
  const floorTint = clamp((groundHeightValue + 20) / 120, 0, 1);
  const floor = ctx.createLinearGradient(0, height * 0.5, 0, height);
  floor.addColorStop(0, `rgb(${Math.floor(45 + floorTint * 20)}, ${Math.floor(45 + floorTint * 70)}, ${Math.floor(35 + floorTint * 25)})`);
  floor.addColorStop(1, '#111111');
  ctx.fillStyle = floor;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);
}

function drawWallColumn(columnX, distance) {
  const { width, height } = canvas;
  const wallHeight = Math.min(height * 1.2, (height / Math.max(distance, 0.1)) * 0.9);
  const wallTop = (height - wallHeight) * 0.5;
  const brightness = clamp(1 - distance / MAX_DEPTH, 0.15, 1);
  const shade = Math.floor(200 * brightness);
  ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
  ctx.fillRect(columnX, wallTop, 1, wallHeight);
}

function drawSprites() {
  const { width, height } = canvas;
  for (const sprite of sprites) {
    const dx = sprite.x - player.x;
    const dy = sprite.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.1) continue;
    const spriteAngle = Math.atan2(dy, dx) - player.angle;
    const normalized = Math.atan2(Math.sin(spriteAngle), Math.cos(spriteAngle));
    if (Math.abs(normalized) > 0.9) continue;
    const screenX = (normalized + Math.PI / 6) / (Math.PI / 3) * width;
    const spriteSize = clamp((height / dist) * 0.7, 8, 80);
    const spriteY = height * 0.65;
    ctx.fillStyle = sprite.color;
    ctx.fillRect(screenX - spriteSize * 0.35, spriteY - spriteSize, spriteSize * 0.7, spriteSize);
  }
}

function render() {
  drawBackground();
  const { width, height } = canvas;
  const fov = Math.PI / 3;
  const rayStep = fov / width;

  // Fixa o nível do chão pelo DEM real para manter a cena "amarrada" ao terreno.
  const heightFromTerrain = currentGroundHeight();
  player.groundHeight = heightFromTerrain;

  for (let x = 0; x < width; x++) {
    const rayAngle = player.angle - fov / 2 + x * rayStep;
    const dist = castRay(rayAngle);
    drawWallColumn(x, dist);
  }
  drawSprites();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(width * 0.5 - 2, height * 0.5 - 10, 4, 20);
  ctx.fillRect(width * 0.5 - 10, height * 0.5 - 2, 20, 4);
}

function updatePlayer() {
  const forward = (keys.w || keys['arrowup'] ? 1 : 0) - (keys.s || keys['arrowdown'] ? 1 : 0);
  const strafe = (keys.d || keys['arrowright'] ? 1 : 0) - (keys.a || keys['arrowleft'] ? 1 : 0);
  const turn = (keys['arrowleft'] || keys.a ? -1 : 0) + (keys['arrowright'] || keys.d ? 1 : 0);

  player.angle += turn * 0.045;

  const forwardX = Math.cos(player.angle) * forward * player.speed * 0.035;
  const forwardY = Math.sin(player.angle) * forward * player.speed * 0.035;
  const sideX = Math.cos(player.angle + Math.PI / 2) * strafe * player.speed * 0.035;
  const sideY = Math.sin(player.angle + Math.PI / 2) * strafe * player.speed * 0.035;

  const nextX = player.x + forwardX + sideX;
  const nextY = player.y + forwardY + sideY;

  if (getCell(nextX, player.y) === 0) player.x = nextX;
  if (getCell(player.x, nextY) === 0) player.y = nextY;
}

function loop() {
  updatePlayer();
  render();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (event.key === ' ') event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
});

window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  const sensitivity = 0.0024;
  player.angle -= event.movementX * sensitivity;
});

canvas.addEventListener('click', () => {
  canvas.requestPointerLock?.();
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
bindToTerrainData();
requestAnimationFrame(loop);
