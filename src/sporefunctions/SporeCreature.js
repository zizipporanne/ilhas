export class SporeCreature {
  constructor(x, y, scene = null, dna = null) {
    this.x = x;
    this.y = y;
    this.energy = 100;
    this.age = 0;
    this.isDead = false;
    this.score = 0; // Fitness (comidas coletadas)

    // Definição genética simplificada e autônoma do Spore
    this.dna = dna || {
      velocidade: Math.random() * 2.5 + 1.5,     // Velocidade de deslocamento na tela (1.5 a 4)
      raioVisao: Math.random() * 80 + 50,       // Distância em pixels que ela enxerga o alvo
      tamanho: Math.random() * 6 + 4,           // Tamanho visual do círculo do corpo
      cor: `hsl(${Math.random() * 360}, 85%, 55%)`,
      tipoBoca: Math.random() > 0.4 ? 'herbivoro' : 'carnivoro'
    };

    // Ajustes estéticos no DNA baseados na dieta
    if (this.dna.tipoBoca === 'carnivoro') {
      this.dna.cor = `hsl(${Math.random() * 15 + 355}, 90%, 50%)`; // Tons agressivos de vermelho
    }
  }

  update(comidas, outrasCriaturas, width, height) {
    if (this.isDead) return;

    this.age += 1;
    // Custo de energia dinâmico: criaturas rápidas e grandes gastam energia mais depressa
    this.energy -= 0.08 + (this.dna.velocidade * 0.04) + (this.dna.tamanho * 0.01); 

    if (this.energy <= 0) {
      this.isDead = true;
      return;
    }

    let alvo = null;
    if (this.dna.tipoBoca === 'herbivoro') {
      alvo = this.encontrarMaisProximo(this.x, this.y, comidas, this.dna.raioVisao);
    } else {
      // Carnívoros caçam herbívoros vivos que sejam menores do que eles
      const presas = outrasCriaturas.filter(c => 
        !c.isDead && 
        c.dna.tipoBoca === 'herbivoro' && 
        c.dna.tamanho < this.dna.tamanho
      );
      alvo = this.encontrarMaisProximo(this.x, this.y, presas, this.dna.raioVisao);
    }

    // Movimentação em direção ao alvo (Perseguição) ou nado aleatório
    if (alvo) {
      let dx = alvo.x - this.x;
      let dy = alvo.y - this.y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      // Distância de toque físico baseada no tamanho do indivíduo
      if (dist < this.dna.tamanho + 4) {
        this.comer(alvo);
      } else {
        this.x += (dx / dist) * this.dna.velocidade;
        this.y += (dy / dist) * this.dna.velocidade;
      }
    } else {
      // Movimento errático exploratório
      this.x += (Math.random() - 0.5) * this.dna.velocidade * 1.2;
      this.y += (Math.random() - 0.5) * this.dna.velocidade * 1.2;
    }

    // Prende o movimento nos limites físicos da tela do Canvas
    this.x = Math.max(0, Math.min(width, this.x));
    this.y = Math.max(0, Math.min(height, this.y));
  }

  encontrarMaisProximo(x, y, lista, raioVisao) {
    let maisProximo = null;
    let menorDist = raioVisao;

    for (let item of lista) {
      if (item.isDead) continue;
      let dx = item.x - x;
      let dy = item.y - y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < menorDist) {
        menorDist = dist;
        maisProximo = item;
      }
    }
    return maisProximo;
  }

  comer(alvo) {
    // Alvo pode ser uma fruta vegetal ou outra criatura presa
    let ganhoEnergia = alvo.dna ? 50 : 35;

    this.energy = Math.min(100, this.energy + ganhoEnergia);
    this.score += 1; // Incrementa o score de seleção natural (fitness)
    alvo.isDead = true; 
  }

  // Renderizador nativo 2D direto no contexto do Canvas
  draw(ctx) {
    if (this.isDead) return;

    ctx.save();
    
    // 1. Corpo principal
    ctx.fillStyle = this.dna.cor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.dna.tamanho, 0, Math.PI * 2);
    ctx.fill();

    // Contorno cartoon preto estilo Spore
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Detalhes Visuais na Boca dependendo da dieta
    if (this.dna.tipoBoca === 'carnivoro') {
      ctx.fillStyle = '#ffffff'; // Desenha uma pequena garra/presa branca
      ctx.beginPath();
      ctx.moveTo(this.x - 2, this.y);
      ctx.lineTo(this.x, this.y + (this.dna.tamanho * 0.8));
      ctx.lineTo(this.x + 2, this.y);
      ctx.fill();
    } else {
      ctx.fillStyle = '#1e293b'; // Pequeno cíclio/antena de herbívoro
      ctx.beginPath();
      ctx.arc(this.x, this.y - (this.dna.tamanho * 0.5), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Olhos expressivos
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x - 2, this.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(this.x + 2, this.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
