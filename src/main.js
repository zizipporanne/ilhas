import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadElevationData } from './utils/elevationLoader.js';
import { createTerrain, getHeight } from './utils/terrain.js';
import { PopulationSystem } from './utils/population.js';

// 1. Cena, Câmera e Renderizador para Terreno Aberto
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 15, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.domElement.style.position = 'fixed';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';
renderer.domElement.style.zIndex = '1';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderer.domElement);

// 2. Painel UI HUD (Informações da População)
const hud = document.createElement('div');
hud.id = 'population-hud';
hud.style.position = 'fixed';
hud.style.top = '20px';
hud.style.left = '20px';
hud.style.padding = '15px 20px';
hud.style.background = 'rgba(15, 23, 42, 0.8)';
hud.style.color = '#e2e8f0';
hud.style.fontFamily = 'system-ui, -apple-system, sans-serif';
hud.style.fontSize = '13px';
hud.style.borderRadius = '10px';
hud.style.backdropFilter = 'blur(8px)';
hud.style.border = '1px solid rgba(255, 255, 255, 0.1)';
hud.style.zIndex = '10';
hud.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.4)';
hud.innerHTML = `<div style="font-weight: 600; color: #38bdf8; font-size: 14px;">📊 Carregando População...</div>`;
document.body.appendChild(hud);

// 3. Controles Livres de Câmera
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 4. Luzes do Ambiente Externo
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

let population = null;
let frameCount = 0;

// 5. Carrega o Terreno Real e inicializa a simulação
async function init() {
    try {
        console.log('🌍 Carregando dados de elevação reais...');
        const elevationData = await loadElevationData('./V4_1_-48.48_-27.59.tif');
        
        if (elevationData) {
            const terrainMesh = createTerrain(elevationData);
            scene.add(terrainMesh);
            console.log('✅ Terreno real carregado com sucesso!');
        } else {
            console.warn('⚠️ Usando terreno padrão (fallback)');
            const terrainMesh = createTerrain();
            scene.add(terrainMesh);
        }

        population = new PopulationSystem(scene, 1000, 8, 20);

    } catch (e) {
        console.error('Erro ao inicializar terreno:', e);
    }
}

init();

// 6. Loop de Animação
function animate() {
    requestAnimationFrame(animate);

    if (population) {
        population.update((x, z) => getHeight(x, z));

        // Atualiza a UI a cada 15 quadros para evitar gargalo de DOM
        frameCount++;
        if (frameCount % 15 === 0) {
            const stats = population.getStats();
            hud.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px; color: #38bdf8; font-size: 14px; letter-spacing: 0.5px;">📊 PAINEL DA POPULAÇÃO</div>
                <div style="margin-bottom: 4px;">👥 Total de Agentes: <b style="color: #fff;">${stats.count}</b></div>
                <div style="margin-bottom: 4px;">⛰️ Elevação Média: <b style="color: #fff;">${stats.avgHeight}m</b></div>
                <div style="margin-bottom: 4px;">📈 Ponto Mais Alto: <b style="color: #fff;">${stats.maxHeight}m</b></div>
                <div>📉 Ponto Mais Baixo: <b style="color: #fff;">${stats.minHeight}m</b></div>
            `;
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();

// Ajuste de Janela Responsivo
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
