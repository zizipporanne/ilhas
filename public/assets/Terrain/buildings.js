import { SocialSimulation2D } from './SocialSimulation2D.js';
import { SporeCreature } from './sporefunctions/SporeCreature.js';

let canvas;
let simulation;

// --- VARIÁVEIS DO ECOSSISTEMA SPORE ---
let criaturas = [];
let comidas = [];
const TAMANHO_POPULACAO = 30;
let geracao = 1;
let tempoGeracaoCounter = 0;
const DURACAO_GERACAO = 600; // Tempo de cada era (~10 segundos a 60fps)

// Dimensões lógicas exatas extraídas do construtor da sua simulação
const MAP_COLS = 120;
const MAP_ROWS = 260;

/**
 * Inicialização principal da aplicação com proteção contra falhas de arquivos geográficos
 */
async function startApp() {
  // 1. Procura o elemento Canvas no DOM
  canvas = document.querySelector('#simulationCanvas');

  if (!canvas) {
    console.error('Elemento <canvas id="simulationCanvas"> não foi encontrado no DOM.');
    return;
  }

  // 2. Instancia a simulação respeitando a proporção da matriz
  simulation = new SocialSimulation2D(canvas, MAP_COLS, MAP_ROWS);

  // 3. Ajusta o tamanho físico do Canvas
  resizeCanvas();

  // 4. Tenta carregar os ficheiros de mapa apontando para a pasta correta de assets
  try {
    await simulation.initEnvironment(
      '/assets/data/elevation.tif',
      '/assets/data/buildings.geojson',
      '/assets/data/hydrography.geojson',
      '/assets/data/vegetation.geojson'
    );
    console.log('✅ Ambiente geográfico carregado com sucesso!');
  } catch (erroAmbiente) {
    console.warn('⚠️ Falha ao carregar dados geográficos (Caminhos ou Git LFS pendentes). Rodando simulação em modo plano seguro.', erroAmbiente);
    
    // Força a inicialização manual das células vazias na grade para as criaturas não darem erro de "null"
    for (let r = 0; r < MAP_ROWS; r++) {
      if (!simulation.grid[r]) simulation.grid[r] = [];
      for (let c = 0; c < MAP_COLS; c++) {
        if (!simulation.grid[r][c]) {
          simulation.grid[r][c] = { elevation: 0, isWater: false, isVegetation: false };
        }
      }
    }
  }

  // Libera a renderização e o spawn de forma segura independentemente dos dados geográficos
  simulation.isReady = true;

  // 5. Popula os agentes nativos da sua simulação
  try {
    simulation.populateProportional();
  } catch (e) {
    console.warn('Não foi possível popular agentes proporcionais sem os dados completos do GeoJSON.');
  }

  // 6. Configura os atalhos de rotação (Q e E)
  setupControls();

  // --- INICIALIZAÇÃO INICIAL DO SPORE (Geração 1) ---
  for (let i = 0; i < TAMANHO_POPULACAO; i++) {
    criaturas.push(new SporeCreature(Math.random() * MAP_COLS, Math.random() * MAP_ROWS));
  }
  
  // Cria as comidas espalhadas inteligentemente no mapa
  gerarComida(MAP_COLS, MAP_ROWS, 60);

  // 7. Loop de renderização
  function loop() {
    // A. Atualiza e renderiza a lógica nativa do seu mapa/terreno
    try {
      simulation.update();
      simulation.render();
    } catch(e) {
      // Se o render nativo falhar temporariamente por falta do .tif, limpa o canvas para o Spore desenhar
      const ctxLimpa = canvas.getContext('2d');
      ctxLimpa.clearRect(0, 0, canvas.width, canvas.height);
    }

    // B. Contexto gráfico para desenhar as criaturas por cima do mapa projetado
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Repõe a comida dinamicamente se estiver escassa
    if (comidas.filter(c => !c.isDead).length < 20) {
      gerarComida(MAP_COLS, MAP_ROWS, 30);
    }

    // Limpa alimentos devorados
    comidas = comidas.filter(c => !c.isDead);
    
    // Atualiza a física e inteligência artificial na escala da grade lógica
    criaturas.forEach(criatura => {
      criatura.update(comidas, criaturas, MAP_COLS, MAP_ROWS);
      
      // Converte a posição lógica para a disposição Isométrica ativa com Rotação
      const coordsVisual = obterPosicaoProjetada(criatura.x, criatura.y, w, h);
      
      // Armazena a posição lógica original para não quebrar a física no próximo frame
      const originalX = criatura.x;
      const originalY = criatura.y;
      
      // Aloca as coordenadas de projeção para o método .draw() renderizar no lugar certo
      criatura.x = coordsVisual.x;
      criatura.y = coordsVisual.y;
      
      // Desenha o corpo da criatura (com as cores e tamanho do DNA)
      criatura.draw(ctx);
      
      // Restaura as coordenadas lógicas de grade para o processamento de movimento
      criatura.x = originalX;
      criatura.y = originalY;
    });

    // Desenha as bolinhas de comida na tela usando o mesmo motor de projeção isométrica
    comidas.forEach(comida => {
      const coordsVisual = obterPosicaoProjetada(comida.x, comida.y, w, h);
      
      ctx.save();
      ctx.fillStyle = '#2ecc71'; // Verde alga clássico do Spore
      ctx.beginPath();
      ctx.arc(coordsVisual.x, coordsVisual.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // C. Avanço do Relógio Evolutivo (Gerações do Algoritmo Genético)
    tempoGeracaoCounter++;
    if (tempoGeracaoCounter >= DURACAO_GERACAO) {
      tempoGeracaoCounter = 0;
      geracao++;
      console.log(`--- EVOLUINDO PARA A GERAÇÃO ${geracao} ---`);
      
      // Roda a recombinação genética e mutação
      criaturas = evoluirPopulacaoManual(criaturas, TAMANHO_POPULACAO, MAP_COLS, MAP_ROWS);
      
      // Reseta e distribui nova alimentação para a próxima era
      comidas = [];
      gerarComida(MAP_COLS, MAP_ROWS, 60);
    }

    // Interface HUD de acompanhamento da evolução (estilizada com transparência)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(15, 15, 250, 65);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.strokeRect(15, 15, 250, 65);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`Mundo Spore — Geração: ${geracao}`, 25, 36);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Evolução em: ${Math.max(0, Math.ceil((DURACAO_GERACAO - tempoGeracaoCounter) / 60))} segundos`, 25, 56);
    ctx.restore();

    requestAnimationFrame(loop);
  }

  loop();
}

/**
 * Pega as coordenadas lógicas de grade (coluna, linha) e projeta dinamicamente 
 * no Canvas aplicando o mesmo cálculo geométrico e offset central do motor principal.
 */
function obterPosicaoProjetada(gridX, gridY, screenWidth, screenHeight) {
  const c = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(gridX)));
  const r = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(gridY)));

  let rotC = c;
  let rotR = r;
  if (simulation) {
    switch (simulation.rotationAngle) {
      case 90:
        rotR = c;
        rotC = MAP_ROWS - 1 - r;
        break;
      case 180:
        rotR = MAP_ROWS - 1 - r;
        rotC = MAP_COLS - 1 - c;
        break;
      case 270:
        rotR = MAP_COLS - 1 - c;
        rotC = r;
        break;
    }
  }

  const tileWidth = 6 * (simulation?.zoom || 1.0); 
  const tileHeight = 3 * (simulation?.zoom || 1.0);

  const isoX = (rotC - rotR) * (tileWidth / 2);
  const isoY = (rotC + rotR) * (tileHeight / 2);

  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2.8;

  let elevationOffset = 0;
  if (simulation && simulation.grid && simulation.grid[r] && simulation.grid[r][c]) {
    elevationOffset = (simulation.grid[r][c].elevation || 0) * 12; 
  }

  return {
    x: centerX + isoX,
    y: centerY + isoY - elevationOffset
  };
}

/**
 * Alimenta o mundo Spore fazendo brotar comida de forma inteligente nas áreas geográficas reais!
 */
function generarComida(cols, rows, quantidade) {
  const nomesPlantas = ['Clover', 'Fern', 'Mushroom', 'Pine'];
  let comidasGeradas = 0;
  let tentativas = 0;

  while (comidasGeradas < quantidade && tentativas < quantidade * 25) {
    tentativas++;
    const randomC = Math.floor(Math.random() * cols);
    const randomR = Math.floor(Math.random() * rows);

    if (simulation && simulation.grid && simulation.grid[randomR] && simulation.grid[randomR][randomC]) {
      const cell = simulation.grid[randomR][randomC];

      // Se o mapa carregou com vegetação real, aproveita a amarra geográfica
      if (cell.isVegetation && !cell.isWater) {
        comidas.push({
          x: randomC,
          y: randomR,
          type: nomesPlantas[Math.floor(Math.random() * nomesPlantas.length)],
          isDead: false
        });
        comidasGeradas++;
      }
    }
  }

  // Backup seguro: se os mapas ainda estiverem falhando, gera aleatório para não travar o jogo sem comida
  if (comidasGeradas === 0) {
    for (let i = 0; i < quantidade; i++) {
      comidas.push({
        x: Math.random() * cols,
        y: Math.random() * rows,
        type: nomesPlantas[Math.floor(Math.random() * nomesPlantas.length)],
        isDead: false
      });
    }
  }
}

/**
 * Motor interno de evolução do Algoritmo Genético
 */
function evoluirPopulacaoManual(populacaoAntiga, tamanhoPopulacao, cols, rows) {
  const sobreviventes = populacaoAntiga.sort((a, b) => b.score - a.score);
  const elitePool = sobreviventes.slice(0, Math.max(2, Math.floor(tamanhoPopulacao * 0.25)));
  const novaPopulacao = [];

  for (let i = 0; i < tamanhoPopulacao; i++) {
    const pai = elitePool[Math.floor(Math.random() * elitePool.length)];
    const mae = elitePool[Math.floor(Math.random() * elitePool.length)];

    const filhoDNA = {
      velocidade: Math.random() > 0.5 ? pai.dna.velocidade : mae.dna.velocidade,
      raioVisao: Math.random() > 0.5 ? pai.dna.raioVisao : mae.dna.raioVisao,
      tamanho: Math.random() > 0.5 ? pai.dna.tamanho : mae.dna.tamanho,
      tipoBoca: Math.random() > 0.5 ? pai.dna.tipoBoca : mae.dna.tipoBoca,
      cor: Math.random() > 0.5 ? pai.dna.cor : mae.dna.cor
    };

    if (Math.random() < 0.15) {
      filhoDNA.velocidade += (Math.random() - 0.5) * 0.4;
      filhoDNA.raioVisao += (Math.random() - 0.5) * 10;
Use o código com cuidado.
filhoDNA.tamanho = Math.max(2.5, filhoDNA.tamanho + (Math.random() - 0.5) * 1.5);
}
filhoDNA.velocidade = Math.max(0.15, Math.min(1.8, filhoDNA.velocidade));
filhoDNA.raioVisao = Math.max(8, Math.min(45, filhoDNA.raioVisao));
novaPopulacao.push(new SporeCreature(Math.random() * cols, Math.random() * rows, filhoDNA));
}
return novaPopulacao;
}
/**
• Configura os atalhos de teclado (Q e E) para rotação da câmara isométrica
*/
function setupControls() {
window.addEventListener('keydown', (e) => {
if (!simulation) return;
if (e.key === 'q' || e.key === 'Q') {
simulation.rotate(-90);
} else if (e.key === 'e' || e.key === 'E') {
simulation.rotate(90);
}
});
const btnRotateLeft = document.querySelector('#btnRotateLeft');
const btnRotateRight = document.querySelector('#btnRotateRight');
if (btnRotateLeft) btnRotateLeft.addEventListener('click', () => simulation?.rotate(-90));
if (btnRotateRight) btnRotateRight.addEventListener('click', () => simulation?.rotate(90));
}
/**
• Redimensiona o canvas para acompanhar a janela
*/
function resizeCanvas() {
if (canvas && canvas.parentElement) {
canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;if (simulation && simulation.isReady) {
simulation.render();
}
}
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', startApp);