import * as THREE from 'three';

export class PopulationSystem {
    constructor(scene, count = 1000, width = 10, depth = 24) {
        this.count = count;
        this.scene = scene;
        this.width = width;
        this.depth = depth;

        this.positions = new Float32Array(count * 3); // X, Y, Z
        this.velocities = new Float32Array(count * 2); // Velocidade X, Z
        
        this.initMesh();
    }

    initMesh() {
        const geometry = new THREE.SphereGeometry(0.0015, 8, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x44aa88,
            roughness: 0.4,
            metalness: 0.2
        });

        this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.scene.add(this.instancedMesh);

        this.dummy = new THREE.Object3D();

        for (let i = 0; i < this.count; i++) {
            let idx3 = i * 3;
            let idx2 = i * 2;

            this.positions[idx3] = (Math.random() - 0.5) * this.width * 0.9;     
            this.positions[idx3 + 1] = 0;                                         
            this.positions[idx3 + 2] = (Math.random() - 0.5) * this.depth * 0.9; 

            this.velocities[idx2] = (Math.random() - 0.5) * 0.005;    
            this.velocities[idx2 + 1] = (Math.random() - 0.5) * 0.005; 
        }
    }

    update(getTerrainHeight) {
        for (let i = 0; i < this.count; i++) {
            let idx3 = i * 3;
            let idx2 = i * 2;

            this.positions[idx3] += this.velocities[idx2];
            this.positions[idx3 + 2] += this.velocities[idx2 + 1];

            const halfW = this.width * 0.45;
            const halfD = this.depth * 0.45;

            if (this.positions[idx3] < -halfW || this.positions[idx3] > halfW) {
                this.velocities[idx2] *= -1;
            }
            if (this.positions[idx3 + 2] < -halfD || this.positions[idx3 + 2] > halfD) {
                this.velocities[idx2 + 1] *= -1;
            }

            let x = this.positions[idx3];
            let z = this.positions[idx3 + 2];
            
            let y = getTerrainHeight ? getTerrainHeight(x, z) : 0;
            this.positions[idx3 + 1] = y;

            this.dummy.position.set(x, y + 0.0015, z);
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    getStats() {
        let totalHeight = 0;
        let minH = Infinity;
        let maxH = -Infinity;
        for (let i = 0; i < this.count; i++) {
            let h = this.positions[i * 3 + 1];
            totalHeight += h;
            if (h < minH) minH = h;
            if (h > maxH) maxH = h;
        }
        return {
            count: this.count,
            avgHeight: (totalHeight / this.count).toFixed(2),
            minHeight: minH.toFixed(2),
            maxHeight: maxH.toFixed(2)
        };
    }
}
