import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { PixelShader } from './utils/pixelShader.js';

import {
    createTerrain,
    setElevationData
} from './utils/terrain.js';

import { createPOIs } from './utils/points.js';
import { loadElevationData } from './utils/elevationLoader.js';

import {
    loadHydrography,
    initProjection,
    onHydrographyResize
} from './utils/hydrography.js';

import { loadBuildings } from './utils/buildings.js';
import { createSky } from './utils/sky.js';
import { createWater } from './utils/water.js';
import { createVegetation } from './utils/vegetation.js';


// =============================================
// CENA E RENDERIZADOR
// =============================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8c4d0);

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.5,
    2500
);
camera.position.set(8, 10, 12);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);


// =============================================
// PÓS-PROCESSAMENTO
// =============================================

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const retroPass = new ShaderPass(PixelShader);
retroPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
retroPass.uniforms.pixelSize.value = 2.0;
retroPass.uniforms.colorDepth.value = 22.0;
retroPass.uniforms.outlineStrength.value = 0.45;
retroPass.enabled = true;
composer.addPass(retroPass);


// =============================================
// ESTADO DA CENA
// =============================================

let sky = null;
let pois = [];
let water = null;
let hydrography = null;
let vegetation = null;
let elevationData = null;

const waterLevelInicial = 10;
const SCALE_FACTOR = 0.003;

let retroAtivo = true;
let hidrografiaAtiva = true;
let vegetacaoAtiva = true;


// =============================================
// BOTÕES DA INTERFACE
// =============================================

const toggleRetroButton = document.getElementById('toggle-retro-icon');
const toggleHydroButton = document.getElementById('toggle-hidrografia');
const toggleVegetationButton = document.getElementById('toggle-vegetacao');
const toggleUIButton = document.getElementById('toggle-ui');

function atualizarEstadoBotao(botao, ativo) {
    if (!botao) return;
    botao.classList.toggle('active', ativo);
    botao.classList.toggle('off', !ativo);
    botao.setAttribute('aria-pressed', String(ativo));
}

function alternarRetro() {
    retroAtivo = !retroAtivo;
    retroPass.enabled = retroAtivo;
    atualizarEstadoBotao(toggleRetroButton, retroAtivo);
}

function alternarHidrografia() {
    hidrografiaAtiva = !hidrografiaAtiva;
    if (hydrography) hydrography.visible = hidrografiaAtiva;
    atualizarEstadoBotao(toggleHydroButton, hidrografiaAtiva);
}

function alternarVegetacao() {
    vegetacaoAtiva = !vegetacaoAtiva;
    if (vegetation) vegetation.visible = vegetacaoAtiva;
    atualizarEstadoBotao(toggleVegetationButton, vegetacaoAtiva);
}

function alternarInterface() {
    document.body.classList.toggle('ui-hidden');
}

toggleRetroButton?.addEventListener('click', alternarRetro);
toggleHydroButton?.addEventListener('click', alternarHidrografia);
toggleVegetationButton?.addEventListener('click', alternarVegetacao);
toggleUIButton?.addEventListener('click', alternarInterface);

atualizarEstadoBotao(toggleRetroButton, retroAtivo);
atualizarEstadoBotao(toggleHydroButton, hidrografiaAtiva);
atualizarEstadoBotao(toggleVegetationButton, vegetacaoAtiva);


// =============================================
// CÉU, CONTROLES E LUZES
// =============================================

try {
    sky = createSky();
    if (sky) scene.add(sky);
} catch (error) {
    console.error('Erro ao criar céu:', error);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minPolarAngle = 0.05;
controls.minDistance = 1.5;
controls.maxDistance = 50.0;

const BOUNDS_X = 4.5;
const BOUNDS_Z = 4.5;

controls.addEventListener('change', () => {
    controls.target.x = Math.max(-BOUNDS_X, Math.min(BOUNDS_X, controls.target.x));
    controls.target.z = Math.max(-BOUNDS_Z, Math.min(BOUNDS_Z, controls.target.z));
    controls.target.y = Math.max(-0.5, Math.min(3.0, controls.target.y));
});

const ambientLight = new THREE.AmbientLight(0xd8dde2, 0.5);
scene.add(ambientLight);


// =============================================
// CONTROLES DO SLIDER DA ÁGUA
// =============================================

function setupWaterControls() {
    const slider = document.getElementById('nivel-slider');
    const fill = document.getElementById('slider-fill');
    const thumb = document.getElementById('slider-thumb');
    const tooltip = document.getElementById('slider-tooltip');

    if (!slider) return;

    function updateWaterUI() {
        const minVal = parseFloat(slider.min) || 0;
        const maxVal = parseFloat(slider.max) || 0.2;
        const rawVal = parseFloat(slider.value) || 0;

        const percent = Math.min(Math.max((rawVal - minVal) / (maxVal - minVal), 0), 1) * 100;
        const meters = Math.round(rawVal / SCALE_FACTOR);

        if (fill) fill.style.width = `${percent}%`;
        if (thumb) thumb.style.left = `${percent}%`;
        if (tooltip) {
            tooltip.style.left = `${percent}%`;
            tooltip.textContent = `${meters} m`;
        }

        if (water?.setWaterLevel) {
            water.setWaterLevel(meters);
        }
    }

    slider.addEventListener('input', updateWaterUI);
    slider.addEventListener('change', updateWaterUI);
    slider.value = waterLevelInicial * SCALE_FACTOR;
    updateWaterUI();
}


// =============================================
// ATALHOS DO TECLADO
// =============================================

function setupKeyboardControls() {
    window.addEventListener('keydown', event => {
        const tecla = event.key.toLowerCase();

        if (tecla === 'f') iniciarCameraEmPOIAleatorio();
        if (tecla === 'h') alternarInterface();
        if (tecla === 'r') alternarRetro();
        if (tecla === '1') alternarHidrografia();
        if (tecla === '5') alternarVegetacao();
        if (tecla === '0') {
            retroAtivo = true;
            hidrografiaAtiva = true;
            vegetacaoAtiva = true;

            retroPass.enabled = true;
            if (hydrography) hydrography.visible = true;
            if (vegetation) vegetation.visible = true;

            atualizarEstadoBotao(toggleRetroButton, true);
            atualizarEstadoBotao(toggleHydroButton, true);
            atualizarEstadoBotao(toggleVegetationButton, true);
        }
    });
}


// =============================================
// INICIALIZAÇÃO DA CENA
// =============================================

async function initScene() {
    try {
        elevationData = await loadElevationData('/V4_1_-48.48_-27.59.tif');

        if (elevationData) {
            setElevationData(elevationData);
            initProjection(elevationData.bbox);
        }
    } catch (error) {
        console.error('Erro ao carregar elevação:', error);
    }

    const loaders = [
        {
            fn: async () => createTerrain(elevationData),
            name: 'terreno'
        },
        {
            fn: async () => {
                hydrography = await loadHydrography('/assets/data/hidrografia.geojson', { yOffset: 0.01 });
                return hydrography;
            },
            name: 'hidrografia'
        },
        {
            fn: async () => loadBuildings('/assets/data/edificacoes.geojson', { color: 0xa8a090 }),
            name: 'edificações'
        },
        {
            fn: async () => {
                vegetation = await createVegetation(
                    '/assets/data/vegetacao_real.geojson',
                    [
                        '/assets/models/arvore1.glb',
                        '/assets/models/arvore2.glb',
                        '/assets/models/arbusto.glb'
                    ]
                );
                return vegetation;
            },
            name: 'vegetação'
        }
    ];

    for (const loader of loaders) {
        try {
            const object = await loader.fn();
            if (object) scene.add(object);
        } catch (error) {
            console.error(`Erro ao carregar ${loader.name}:`, error);
        }
    }

    try {
        pois = createPOIs() || [];
        pois.forEach(poi => scene.add(poi));
    } catch (error) {
        console.warn('Erro nos POIs:', error);
    }

    setupWater();
    setupWaterControls();
    setupKeyboardControls();

    iniciarCameraEmPOIAleatorio();
}


// =============================================
// ÁGUA
// =============================================

function setupWater() {
    const sizeX = 10;
    const bbox = elevationData?.bbox;

    const sizeZ = bbox
        ? sizeX * ((bbox[3] - bbox[1]) / (bbox[2] - bbox[0]))
        : 10;

    water = createWater(elevationData, {
        initialLevelMeters: waterLevelInicial,
        sizeX,
        sizeZ,
        fogColor: 0xb8c4d0,
        scaleFactor: SCALE_FACTOR
    });

    if (water?.mesh) scene.add(water.mesh);
}


// =============================================
// POSICIONAMENTO DA CÂMERA
// =============================================

function fitCameraToScene() {
    camera.position.set(16, 16, 16);
    controls.target.set(0, 0, 0);
    controls.update();
}

function obterPosicaoDoPOI(poi) {
    if (!poi) return null;

    if (poi.isObject3D && poi.position) {
        scene.updateMatrixWorld(true);
        return poi.getWorldPosition(new THREE.Vector3());
    }

    if (poi.position && typeof poi.position.x === 'number') {
        return new THREE.Vector3(poi.position.x, poi.position.y, poi.position.z);
    }

    if (poi.userData?.position && typeof poi.userData.position.x === 'number') {
        return new THREE.Vector3(
            poi.userData.position.x,
            poi.userData.position.y || 0,
            poi.userData.position.z
        );
    }

    if (typeof poi.x === 'number') {
        return new THREE.Vector3(poi.x, poi.y, poi.z);
    }

    return null;
}

function obterPOIsComPosicao() {
    return pois.filter(poi => obterPosicaoDoPOI(poi) !== null);
}

function iniciarCameraEmPOIAleatorio() {
    const poisValidos = obterPOIsComPosicao();

    if (poisValidos.length === 0) {
        fitCameraToScene();
        return;
    }

    const indiceAleatorio = Math.floor(Math.random() * poisValidos.length);
    const poi = poisValidos[indiceAleatorio];
    const posicaoPOI = obterPosicaoDoPOI(poi);

    if (!posicaoPOI) {
        fitCameraToScene();
        return;
    }

    const deslocamentoCamera = new THREE.Vector3(5, 4, 5);
    camera.position.copy(posicaoPOI).add(deslocamentoCamera);
    controls.target.copy(posicaoPOI);
    controls.update();
}

Object.assign(window, {
    scene,
    camera,
    controls,
    retroPass,
    ambientLight,
    renderer,
    get water() { return water; },
    get vegetation() { return vegetation; }
});


// =============================================
// LOOP DE ANIMAÇÃO
// =============================================

function animate(time) {
    requestAnimationFrame(animate);

    const seconds = time * 0.001;

    pois.forEach(poi => {
        if (poi.visible && poi.userData?.update) {
            poi.userData.update(seconds);
        }
    });

    if (sky) sky.position.copy(camera.position);
    if (water?.updateTime) water.updateTime(seconds);

    controls.update();
    composer.render();
}


// =============================================
// REDIMENSIONAMENTO
// =============================================

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    retroPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);

    if (typeof onHydrographyResize === 'function') {
        onHydrographyResize();
    }
});


// =============================================
// INICIAR
// =============================================

initScene()
    .then(() => {
        console.log('[OK] Cena inicializada com sucesso!');
        animate(0);
    })
    .catch(error => {
        console.error('Erro fatal ao inicializar a cena:', error);
    });