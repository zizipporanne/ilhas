import { SporeCreature } from './SporeCreature.js';

export class SporeEvolution {
  // Gera uma nova população cruzando os melhores sobreviventes da geração passada
  static evoluirPopulacao(populacaoAntiga, tamanhoPopulacao, width, height) {
    // Ordena por quem conseguiu mais pontos/comida (Fitness)
    const sobreviventes = populacaoAntiga.sort((a, b) => b.score - a.score);
    
    // Seleciona o top 25% melhor da geração antiga para serem os "pais"
    const elitePool = sobreviventes.slice(0, Math.max(2, Math.floor(tamanhoPopulacao * 0.25)));

    const novaPopulacao = [];

    for (let i = 0; i < tamanhoPopulacao; i++) {
      // Escolhe dois pais aleatórios da elite
      const pai = elitePool[Math.floor(Math.random() * elitePool.length)];
      const mae = elitePool[Math.floor(Math.random() * elitePool.length)];

      // Crossover (Mistura de DNA dos pais)
      const filhoDNA = {
        velocidade: Math.random() > 0.5 ? pai.dna.velocidade : mae.dna.velocidade,
        raioVisao: Math.random() > 0.5 ? pai.dna.raioVisao : mae.dna.raioVisao,
        tamanho: Math.random() > 0.5 ? pai.dna.tamanho : mae.dna.tamanho,
        tipoBoca: Math.random() > 0.5 ? pai.dna.tipoBoca : mae.dna.tipoBoca,
        cor: Math.random() > 0.5 ? pai.dna.cor : mae.dna.cor
      };

      // Mutação (15% de chance de mudar um atributo aleatoriamente)
      if (Math.random() < 0.15) {
        filhoDNA.velocidade += (Math.random() - 0.5) * 1.5;
        filhoDNA.raioVisao += (Math.random() - 0.5) * 30;
        filhoDNA.tamanho = Math.max(3, filhoDNA.tamanho + (Math.random() - 0.5) * 4);
      }

      // Garante limites seguros para os atributos mutados
      filhoDNA.velocidade = Math.max(0.5, Math.min(8, filhoDNA.velocidade));
      filhoDNA.raioVisao = Math.max(20, Math.min(250, filhoDNA.raioVisao));

      // Spawna o filho em uma posição aleatória do mapa
      novaPopulacao.push(new SporeCreature(Math.random() * width, Math.random() * height, filhoDNA));
    }

    return novaPopulacao;
  }
}