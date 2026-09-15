import { fromArrayBuffer } from 'geotiff';

export async function loadElevationData(filePath) {
    try {
        console.log('📥 Carregando:', filePath);
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const bbox = image.getBoundingBox();
        const width = image.getWidth();
        const height = image.getHeight();

        const values = await image.readRasters();
        const elevationData = values[0];

        let minHeight = Infinity, maxHeight = -Infinity;
        for (let i = 0; i < elevationData.length; i++) {
            if (elevationData[i] > -9999 && !isNaN(elevationData[i])) {
                minHeight = Math.min(minHeight, elevationData[i]);
                maxHeight = Math.max(maxHeight, elevationData[i]);
            }
        }

        console.log('📊 Dimensões:', width, 'x', height);
        console.log('📈 Altitudes:', minHeight.toFixed(2), 'm a', maxHeight.toFixed(2), 'm');

        return {
            data: elevationData, width, height, bbox, minHeight, maxHeight,
            getHeight: (x, z, terrainWidth = 10, terrainDepth = 10) => {
                // X espelhado (utmX desce enquanto x sobe)
                const utmX = bbox[2] - ((x + terrainWidth / 2) / terrainWidth) * (bbox[2] - bbox[0]);
                const utmY = bbox[1] + ((z + terrainDepth / 2) / terrainDepth) * (bbox[3] - bbox[1]);

                const colF = (utmX - bbox[0]) / (bbox[2] - bbox[0]) * (width - 1);
                // Row 0 é norte (Y alto)
                const rowF = (bbox[3] - utmY) / (bbox[3] - bbox[1]) * (height - 1);

                if (colF < 0 || colF >= width || rowF < 0 || rowF >= height) return minHeight;

                const col0 = Math.floor(colF);
                const row0 = Math.floor(rowF);
                const col1 = Math.min(col0 + 1, width - 1);
                const row1 = Math.min(row0 + 1, height - 1);

                const dx = colF - col0;
                const dy = rowF - row0;

                const h00 = elevationData[row0 * width + col0];
                const h10 = elevationData[row0 * width + col1];
                const h01 = elevationData[row1 * width + col0];
                const h11 = elevationData[row1 * width + col1];

                const safeH = (v) => (v > -9999 && !isNaN(v)) ? v : minHeight;
                const h0 = safeH(h00) * (1 - dx) + safeH(h10) * dx;
                const h1 = safeH(h01) * (1 - dx) + safeH(h11) * dx;

                return h0 * (1 - dy) + h1 * dy;
            }
        };
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        return null;
    }
}