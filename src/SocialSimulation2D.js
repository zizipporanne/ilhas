/**
 * Simulação 2D sobre uma grade derivada do DEM real de Florianópolis.
 */
import { loadElevationData } from './utils/elevationLoader.js';

export class SocialSimulation2D {
  constructor(canvasElement, gridCols = 120, gridRows = 260) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.cols = gridCols;
    this.rows = gridRows;
    this.grid = [];
    this.agents = [];
    this.temples = [];
    this.sizeX = 10;
    this.sizeZ = 24;
    this.rotationAngle = 0;
    this.zoom = 1;
    this.isReady = false;
    this.elevationData = null;
    this.dataSources = {};
    this._inicializarGradeFallback();
  }

  rotate(degrees = 90) {
    this.rotationAngle = (this.rotationAngle + degrees) % 360;
  }

  _createCell(c, r, rawElevation, minElevation = 0, maxElevation = 1) {
    const range = Math.max(maxElevation - minElevation, 1);
    const normalized = Math.max(0, Math.min(1, (rawElevation - minElevation) / range));
    return {
      x: c,
      y: r,
      rawElevation,
      elevation: normalized * 2.2,
      isWater: rawElevation <= 0,
      isVegetation: rawElevation > 2 && normalized > 0.18 && ((c * 17 + r * 31) % 11 < 4),
      vegType: (c + r) % 2 === 0 ? 'Fern' : 'Mushroom',
      isTemple: false,
      religion: null,
      agent: null
    };
  }

  _inicializarGradeFallback() {
    this.grid = Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const dx = c / this.cols - 0.5;
        const dz = r / this.rows - 0.5;
        const hill = Math.max(0, 1 - Math.hypot(dx, dz) * 2.2);
        const raw = hill * 1.4 + Math.sin(c * 0.15) * Math.cos(r * 0.15) * 0.12;
        return this._createCell(c, r, raw, 0, 1.5);
      })
    );
  }

  _buildGridFromElevation() {
    const { minHeight, maxHeight, getHeight } = this.elevationData;
    this.grid = Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const x = (c / (this.cols - 1) - 0.5) * this.sizeX;
        const z = (r / (this.rows - 1) - 0.5) * this.sizeZ;
        const rawElevation = getHeight(x, z, this.sizeX, this.sizeZ);
        return this._createCell(c, r, rawElevation, minHeight, maxHeight);
      })
    );
  }

  async initEnvironment(
    tiffPath = '/V4_1_-48.48_-27.59.tif',
    buildingsGeoJsonPath = '/assets/data/edificacoes.geojson',
    hydroGeoJsonPath = '/assets/data/hidrografia.geojson',
    vegGeoJsonPath = '/assets/data/vegetacao.geojson'
  ) {
    console.log(`🌍 Carregando DEM real de Florianópolis: ${tiffPath}`);
    this.elevationData = await loadElevationData(tiffPath);

    if (!this.elevationData) {
      console.warn('⚠️ DEM indisponível; usando relevo procedural de fallback.');
      this.dataSources.elevation = { path: tiffPath, loaded: false };
    } else {
      this._buildGridFromElevation();
      this.dataSources.elevation = {
        path: tiffPath,
        loaded: true,
        width: this.elevationData.width,
        height: this.elevationData.height,
        min: this.elevationData.minHeight,
        max: this.elevationData.maxHeight
      };
      console.log('✅ DEM aplicado à grade da simulação:', this.dataSources.elevation);
    }

    // Os dados vetoriais são opcionais nesta visualização 2D, mas os caminhos
    // corretos ficam registrados para as camadas que forem ativadas depois.
    this.dataSources.buildings = buildingsGeoJsonPath;
    this.dataSources.hydrography = hydroGeoJsonPath;
    this.dataSources.vegetation = vegGeoJsonPath;
    this.isReady = true;
    return Boolean(this.elevationData);
  }

  populateProportional() {
    this.agents = [];
    let idGlobal = 0;
    for (let i = 0; i < 60; i++) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      if (this.grid[r]?.[c] && !this.grid[r][c].isWater) {
        const agent = { id: idGlobal++, gridX: c, gridY: r, isSatisfied: true };
        this.grid[r][c].agent = agent;
        this.agents.push(agent);
      }
    }
  }

  update() {
    this.agents.forEach((agent) => {
      if (Math.random() > 0.95) {
        const nextX = Math.max(0, Math.min(this.cols - 1, agent.gridX + (Math.random() > 0.5 ? 1 : -1)));
        if (!this.grid[agent.gridY][nextX].isWater) {
          this.grid[agent.gridY][agent.gridX].agent = null;
          agent.gridX = nextX;
          this.grid[agent.gridY][agent.gridX].agent = agent;
        }
      }
    });
  }

  render() {
    if (!this.isReady || !this.ctx) return;

    const tileWidth = 6 * this.zoom;
    const tileHeight = 3 * this.zoom;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 3;

    for (let r = 0; r < this.rows; r += 2) {
      for (let c = 0; c < this.cols; c += 2) {
        const cell = this.grid[r][c];
        let rotC = c;
        let rotR = r;
        switch (this.rotationAngle) {
          case 90: rotR = c; rotC = this.rows - 1 - r; break;
          case 180: rotR = this.rows - 1 - r; rotC = this.cols - 1 - c; break;
          case 270: rotR = this.cols - 1 - c; rotC = r; break;
        }

        const isoX = (rotC - rotR) * (tileWidth / 2);
        const isoY = (rotC + rotR) * (tileHeight / 2);
        const elevOffset = cell.elevation * 15 * this.zoom;
        this.ctx.fillStyle = cell.isWater ? '#1d4ed8' : cell.isVegetation ? '#15803d' : '#b45309';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + isoX, centerY + isoY - elevOffset);
        this.ctx.lineTo(centerX + isoX + tileWidth / 2, centerY + isoY + tileHeight / 2 - elevOffset);
        this.ctx.lineTo(centerX + isoX, centerY + isoY + tileHeight - elevOffset);
        this.ctx.lineTo(centerX + isoX - tileWidth / 2, centerY + isoY + tileHeight / 2 - elevOffset);
        this.ctx.fill();
      }
    }
  }
}
