import proj4 from 'proj4';

const WGS84 = 'EPSG:4326';
const UTM_23S = '+proj=utm +zone=23 +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs';

let _bboxUTM = null;
let _spanX = 1;
let _spanY = 1;

/**
 * Inicializa a projeção com base nos limites geográficos (BBOX) do GeoTIFF/Terreno.
 * @param {Array} bbox - [minLng, minLat, maxLng, maxLat] em WGS84
 */
export function initProjection(bbox) {
  if (!bbox || bbox.length < 4) {
    console.warn('BBOX inválido fornecido para a projeção.');
    return;
  }

  const [minLng, minLat, maxLng, maxLat] = bbox;

  // Converte as extremidades para coordenadas UTM (metros)
  const [minX, minY] = proj4(WGS84, UTM_23S, [minLng, minLat]);
  const [maxX, maxY] = proj4(WGS84, UTM_23S, [maxLng, maxLat]);

  _bboxUTM = [
    Math.min(minX, maxX),
    Math.min(minY, maxY),
    Math.max(minX, maxX),
    Math.max(minY, maxY)
  ];

  _spanX = _bboxUTM[2] - _bboxUTM[0];
  _spanY = _bboxUTM[3] - _bboxUTM[1];
}

/**
 * Converte Latitude e Longitude para a célula correspondente na grelha 2D.
 */
export function latLngToGrid(lat, lng, cols, rows) {
  if (!_bboxUTM || _spanX === 0 || _spanY === 0) return null;

  // Converte ponto WGS84 para UTM
  const [utmX, utmY] = proj4(WGS84, UTM_23S, [lng, lat]);

  // Normaliza de 0 a 1 em relação ao BBOX
  const normX = (utmX - _bboxUTM[0]) / _spanX;
  const normY = (utmY - _bboxUTM[1]) / _spanY;

  // Verifica se está fora da área coberta
  if (normX < 0 || normX > 1 || normY < 0 || normY > 1) {
    return null;
  }

  // Coluna (X: Este/Oeste)
  const c = Math.floor(normX * cols);
  // Linha (Y: Norte no topo = linha 0, Sul em baixo = linha `rows - 1`)
  const r = Math.floor((1 - normY) * rows);

  return {
    r: Math.min(Math.max(r, 0), rows - 1),
    c: Math.min(Math.max(c, 0), cols - 1)
  };
}