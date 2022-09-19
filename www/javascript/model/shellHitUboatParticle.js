import * as THREE from '../lib/three.module.js';

export class ShellHitUboatParticle {
    scene;
    enable = false;
    particlesLengh = 5000;
    particle;
    vectors;
    lifeTime = 0;
    disappearSpeed = 0.1;

    // bass position
    bassPosX;
    bassPosY;

    constructor(scene, posX, posY) {
        this.enable = true;
        this.scene = scene;
        this.particles = new Array();
        this.bassPosX = posX;
        this.bassPosY = posY;
    }

    /**
     * マテリアルの作成
     */
    createParticles() {
        // initial partcle area size
        const AREA = 3;
        const posX = this.bassPosX;
        const posY = this.bassPosY;
        const posZ = 0;
        // 頂点情報を格納する配列
        const vertices = [];
        this.vectors = new Array(this.particlesLengh);
        for (let i = 0; i < this.particlesLengh; i++) {
            const x = posX + (Math.random() - 0.5) * AREA;
            const y = posZ + (Math.random() - 0.5) * AREA;
            const z = posY + (Math.random() - 0.5) * AREA;
            vertices.push(x, y, z);
            let vx = 0;
            let vy = 0;
            let vz = 0;
            const deg = this.#getRandomArbitrary(0, 2 * Math.PI);
            const roundX = Math.cos(deg);
            const roundY = Math.sin(deg);
            vx = this.#getRandomArbitrary(-0.005, 0.005) * roundX;
            vy = this.#getRandomArbitrary(0.01, 0.8);
            vz = this.#getRandomArbitrary(-0.005, 0.005) * roundY;
            this.vectors[i] = new THREE.Vector3(vx, vy, vz);
        }

        // 形状データを作成
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        // マテリアルを作成
        const texture = new THREE.TextureLoader().load('resources/texture/smoke.png');
        const material = new THREE.PointsMaterial({
            map: texture,
            // 一つ一つのサイズ
            size: 5,
            // 色
            color: 0xffffff,
            opacity: 0.95,
            alphaTest: 0.1,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            depthTest: true,
        });

        // create mesh
        const mesh = new THREE.Points(geometry, material);
        this.particle = mesh;
        this.scene.add(mesh); // シーンは任意の THREE.Scene インスタンス
    }

    /**
     * update particles
     * @param {number} delta elapsed time(s)
     */
    update(delta) {
        if (!this.enable)
            return;
        for (var i = 0; i < this.particlesLengh; i++) {
            this.vectors[i].y *= (0.8 - delta);
            // available update position
            this.particle.geometry.attributes.position.needsUpdate = true;
            const nowX = this.particle.geometry.attributes.position.getX(i);
            const nowY = this.particle.geometry.attributes.position.getY(i);
            const nowZ = this.particle.geometry.attributes.position.getZ(i);
            const newPosX = nowX + this.vectors[i].x * (delta * 100);
            const newPosY = nowY + this.vectors[i].y * (delta * 100);
            const newPosZ = nowZ + this.vectors[i].z * (delta * 100);
            this.particle.geometry.attributes.position.setX(i, newPosX);
            this.particle.geometry.attributes.position.setY(i, newPosY);
            this.particle.geometry.attributes.position.setZ(i, newPosZ);
            if (newPosY < 0) {
                // hidden geometry if under water
                this.particle.geometry.attributes.position.setY(i, 100000000);
            }
        }
        // opacity
        this.particle.material.opacity -= this.disappearSpeed * delta;
        if (this.lifeTime > 10) {
            this.scene.remove(this.particle);
            this.enable = false;
        }
        this.lifeTime += delta;
    }

    #getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }
}
