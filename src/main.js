import { SocialSimulation2D } from './SocialSimulation2D.js';
import { SporeCreature } from './sporefunctions/SporeCreature.js';

let canvas, simulation;
let criaturas = [];
let comidas = [];
let geracao = 1;
let tempoGeracaoCounter = 0;

const TAMANHO_POPULACAO = 25;
const DURACAO_GERACAO = 600; 
const MAP_COLS = 120;
const MAP_ROWS = 260;

async function startApp() {
  canvas = document.querySelector('#simulationCanvas');
  if (!canvas) return console.error('Canvas não encontrado.');

  simulation = new SocialSimulation2D(canvas, MAP_COLS, MAP_ROWS);
  simulation.isReady = true;
  simulation.populateProportional();

  const width = canvas.width || 800;
  const height = canvas.height || 600;

  // Inicializa as criaturas espalhadas no Canvas
  for (let i = 0; i < TAMANHO_POPULACAO; i++) {
    criaturas.push(new SporeCreature(Math.random() * width, Math.random() * height));
  }
  
  // CORREÇÃO: Nome unificado da função de comida
  gerarComidaPlana(width, height, 50);

  function loop() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return requestAnimationFrame(loop);

    // Limpa a tela a cada quadro para sumir com os rastros de cobrinha
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Roda e renderiza o mapa isométrico nativo de Florianópolis no fundo
    try { 
      simulation.update(); 
      simulation.render(); 
    } catch(e) {}

    // 2. Repõe alimentos dinamicamente se estiver acabando
    if (comidas.filter(c => !c.isDead).length < 15) {
      gerarComidaPlana(canvas.width, canvas.height, 20);
    }
    comidas = comidas.filter(c => !c.isDead);
    
    // 3. Atualiza e desenha as criaturas individuais deslizando por cima do mapa
    criaturas.forEach(criatura => {
      criatura.update(comidas, criaturas, canvas.width, canvas.height);
      criatura.draw(ctx);
    });

    comidas.forEach(comida => {
      ctx.save();
      ctx.fillStyle = '#2ecc71'; 
      ctx.beginPath();
      ctx.arc(comida.x, comida.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Avanço do Relógio do Algoritmo Genético
    tempoGeracaoCounter++;
    if (tempoGeracaoCounter >= DURACAO_GERACAO) {
      tempoGeracaoCounter = 0;
      geracao++;
      criaturas = evoluirPopulacaoPlana(criaturas, TAMANHO_POPULACAO, canvas.width, canvas.height);
      comidas = [];
      gerarComidaPlana(canvas.width, canvas.height, 50);
    }

    // Painel HUD Superior Integrado
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(20, 20, 260, 65);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.strokeRect(20, 20, 260, 65);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Mundo Evolutivo Spore`, 35, 40);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Geração: ${geracao} | Próxima era: ${Math.max(0, Math.ceil((DURACAO_GERACAO - tempoGeracaoCounter) / 60))}s`, 35, 58);
    ctx.restore();

    requestAnimationFrame(loop);
  }

  loop();
}

// CORREÇÃO: Nome grafado corretamente com "g" para bater com a chamada
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

window.addEventListener('DOMContentLoaded', startApp);
