export class SimplexNoise {
    constructor() {
        this.grad3 = [
            [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
            [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
            [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
        ];
        this.p = Array.from({ length: 256 }, (_, i) => i);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }
        this.perm = [];
        for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
    }
    dot(g, x, y) { return g[0] * x + g[1] * y; }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    noise2D(x, y) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const u = this.fade(xf), v = this.fade(yf);
        const aa = this.perm[this.perm[X] + Y], ab = this.perm[this.perm[X] + Y + 1];
        const ba = this.perm[this.perm[X + 1] + Y], bb = this.perm[this.perm[X + 1] + Y + 1];
        const g1 = this.grad3[aa % 12], g2 = this.grad3[ba % 12];
        const g3 = this.grad3[ab % 12], g4 = this.grad3[bb % 12];
        const l1 = this.lerp(this.dot(g1, xf, yf), this.dot(g2, xf - 1, yf), u);
        const l2 = this.lerp(this.dot(g3, xf, yf - 1), this.dot(g4, xf - 1, yf - 1), u);
        return this.lerp(l1, l2, v);
    }
}