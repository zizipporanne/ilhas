import { SocialSimulation2D } from './SocialSimulation2D.js';
import { SporeCreature } from './sporefunctions/SporeCreature.js';

let canvas;
let simulation;
let criaturas = [];
let comidas = [];
let geracao = 1;
let tempoGeracaoCounter = 0;

const TAMANHO_POPULACAO = 25;
const DURACAO_GERACAO = 600;
const MAP_COLS = 120;
const MAP_ROWS = 260;
const DEM_PATH = '/V4_1_-48.48_-27.59.tif';
const BUILDINGS_PATH = '/assets/data/edificacoes.geojson';
const HYDROGRAPHY_PATH = '/assets/data/hidrografia.geojson';
const VEGETATION_PATH = '/assets/data/vegetacao.geojson';

function resizeCanvas() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
  canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

async function startApp() {
  canvas = document.querySelector('#simulationCanvas');
  if (!canvas) {
    console.error('Canvas não encontrado.');
    return;
  }

  resizeCanvas();
  simulation = new SocialSimulation2D(canvas, MAP_COLS, MAP_ROWS);
  await simulation.initEnvironment(DEM_PATH, BUILDINGS_PATH, HYDROGRAPHY_PATH, VEGETATION_PATH);
  simulation.populateProportional();

  const width = canvas.width;
  const height = canvas.height;
  for (let i = 0; i < TAMANHO_POPULACAO; i++) {
    criaturas.push(new SporeCreature(Math.random() * width, Math.random() * height));
  }
  gerarComidaPlana(width, height, 50);

  function loop() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    simulation.update();
    simulation.render();

    if (comidas.filter((c) => !c.isDead).length < 15) {
      gerarComidaPlana(canvas.width, canvas.height, 20);
    }
    comidas = comidas.filter((c) => !c.isDead);

    criaturas.forEach((criatura) => {
      criatura.update(comidas, criaturas, canvas.width, canvas.height);
      criatura.draw(ctx);
    });

    comidas.forEach((comida) => {
      ctx.save();
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(comida.x, comida.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    tempoGeracaoCounter++;
    if (tempoGeracaoCounter >= DURACAO_GERACAO) {
      tempoGeracaoCounter = 0;
      geracao++;
      criaturas = evoluirPopulacaoPlana(criaturas, TAMANHO_POPULACAO, canvas.width, canvas.height);
      comidas = [];
      gerarComidaPlana(canvas.width, canvas.height, 50);
    }

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(20, 20, 320, 65);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.strokeRect(20, 20, 320, 65);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Mundo Evolutivo Spore', 35, 40);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`DEM: ${simulation.dataSources.elevation?.loaded ? 'Florianópolis carregado' : 'fallback'}`, 35, 58);
    ctx.fillText(`Geração: ${geracao} | Próxima era: ${Math.max(0, Math.ceil((DURACAO_GERACAO - tempoGeracaoCounter) / 60))}s`, 35, 76);
    ctx.restore();

    requestAnimationFrame(loop);
  }

  loop();
}

function gerarComidaPlana(w, h, quantidade) {
  for (let i = 0; i < quantidade; i++) {
    comidas.push({ x: Math.random() * w, y: Math.random() * h, isDead: false });
  }
}

function evoluirPopulacaoPlana(populacaoAntiga, tamanho, w, h) {
  const sobreviventes = populacaoAntiga.sort((a, b) => b.score - a.score);
  const elite = sobreviventes.slice(0, Math.max(2, Math.floor(tamanho * 0.25)));
  const novaPop = [];

  for (let i = 0; i < tamanho; i++) {
    const p = elite[Math.floor(Math.random() * elite.length)];
    const m = elite[Math.floor(Math.random() * elite.length)];
    const dna = {
      velocidade: Math.random() > 0.5 ? p.dna.velocidade : m.dna.velocidade,
      raioVisao: Math.random() > 0.5 ? p.dna.raioVisao : m.dna.raioVisao,
      tamanho: Math.random() > 0.5 ? p.dna.tamanho : m.dna.tamanho,
      tipoBoca: Math.random() > 0.4 ? p.dna.tipoBoca : m.dna.tipoBoca,
      cor: Math.random() > 0.5 ? p.dna.cor : m.dna.cor
    };
    if (Math.random() < 0.15) {
      dna.velocidade = Math.max(1.2, Math.min(3.8, dna.velocidade + (Math.random() - 0.5) * 0.8));
      dna.raioVisao = Math.max(40, Math.min(150, dna.raioVisao + (Math.random() - 0.5) * 20));
      dna.tamanho = Math.max(3, Math.min(9, dna.tamanho + (Math.random() - 0.5) * 2));
    }
    novaPop.push(new SporeCreature(Math.random() * w, Math.random() * h, null, dna));
  }
  return novaPop;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'q') simulation?.rotate(-90);
  if (event.key.toLowerCase() === 'e') simulation?.rotate(90);
});
document.querySelector('#btnRotateLeft')?.addEventListener('click', () => simulation?.rotate(-90));
document.querySelector('#btnRotateRight')?.addEventListener('click', () => simulation?.rotate(90));
window.addEventListener('DOMContentLoaded', startApp);
