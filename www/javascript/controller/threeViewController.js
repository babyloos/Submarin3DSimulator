import * as THREE from '../lib/three.module.js';
import * as SkeletonUtils from '../../javascript/lib/SkeletonUtils.js';
import { Water } from '../../javascript/lib/Water.js';
import { Sky } from '../../javascript/lib/Sky.js';
import { GLTFLoader } from '../../javascript/lib/GLTFLoader.js';
import { Util } from '../util.js';
import { EngineOut, ObjectType } from '../constants.js';
import { LoadProgress } from '../main.js';
import { EnemyShip } from '../model/enemyShip.js';
import { TorpedoHitParticle } from '../model/torpedoHitParticle.js';
import { ShellHitUboatParticle } from '../model/shellHitUboatParticle.js';
import { ShellHitWaterParticle } from '../model/shellHitWaterParticle.js';
import { DepthChageParticle } from '../model/depthChargeParticle.js';

/**
 * 3D表示用コントローラ
 */
export class ThreeViewController {

    timeManager;

    // 表示するゲームオブジェクトのモデル
    gameObjects;

    // 環境
    water;
    underwater;
    sky;
    fog;

    isUnderwaterCamera = false;
    fogFar = 300;
    waterColor = 0x3e89ce
    fogColor = 0xadd8e6;

    // 水中壁
    wallRange = 1000;
    wallN;
    wallE;
    wallW;
    wallS;

    // 基本オブジェクト
    scene;
    camera;
    renderer;

    // コントローラ
    controls;

    animateHandle;

    // 描画するGameObject
    playerBoat;
    playerBoatMixer;
    otherShips;
    otherShipMixers;

    // エフェクト
    explosionParticles;

    clock = new THREE.Clock();
    elapsedTime = 0;

    // 魚雷モデル追加数
    torpedoAddedCount = 0;

    // 砲弾モデルの追加数
    shellAddedCount = 0;

    // ロード済モデル数
    loadCount = 0;

    // ロード進捗更新用オブジェクト
    loadProgress;

    // カメラ座標 Vector3
    cameraPos;
    // カメラ注視点 Vector3
    cameraLookAt;
    // カメラとの距離
    cameraRange = 100;
    // カメラとの距離最小値
    cameraRangeMin = 50;
    // カメラとの距離最大値
    cameraRangeMax = 300;
    // カメラの回転角度(rad)
    cameraRad = -90 * (Math.PI / 180);
    // カメラのX軸角度(rad)
    cameraXRad = 30 * (Math.PI / 180);

    // カメラ移動速度(水平)
    cameraMoveSpeedHorizon = 500;
    cameraMoveSpeedVertical = 300;
    // 前回フレーム回転角度(rad)
    beforeRad = 0;
    // 前回フレームX軸回転角度(rad)
    beforeXRad = 0;
    // 目標回転角度(rad)
    targetRad = this.cameraRad;
    // 目標X軸回転角度(rad)
    targetXRad = this.cameraXRad;
    // 目標X軸回転角度最小値(rad)
    targetXRadMin = -90 * (Math.PI / 180);
    // 目標X軸回転角度最大値(rad)
    targetXRadMax = 90 * (Math.PI / 180);

    // 前回フレーム目標カメラ距離
    beforeTargetCameraRange = this.cameraRange;
    // 目標カメラ距離
    targetCameraRange = this.cameraRange;

    // ピンチ中か
    isPinch = false;

    // 潜望鏡画面用カメラか
    isPeriscopeCamera = false;

    // 潜望鏡回転角度(rad)
    periscopeRad = 0;
    // 潜望鏡X軸回転角度(rad)
    periscopeXRad = 0;
    // 潜望鏡の倍率状態(false: 1.6x, true: 6x)
    periscopeZoom = false;


    /**
     * コンストラクタ
     * @param {LoadProgress} loadProgress ロード進捗更新用オブジェクト
     */
    constructor(loadProgress) {
        this.gameObjects = new Array();
        this.loadProgress = loadProgress;
        this.explosionParticles = new Array();
        // シーン
        this.scene = new THREE.Scene();
    }

    /**
     * 3D表示初期設定
     */
    initialize(playerBoat, otherShips, timeManager) {

        this.timeManager = timeManager;

        this.beforeWidth = window.innerWidth;
        this.beforeHeight = window.innerHeight;

        this.playerBoat = playerBoat;
        this.otherShips = otherShips;
        this.otherShipMixers = new Array(this.otherShips.length);

        // debug
        // this.stats = this.#createStats();

        // リサイズ
        // ユーザーエージェントの判別
        const userAgent = navigator.userAgent;
        let resizeEventName = "resize";
        if (userAgent.indexOf("iPhone") >= 0 || userAgent.indexOf("iPad") >= 0 || userAgent.indexOf("Android") >= 0) {
            resizeEventName = "orientationchange";
        }
        window.addEventListener(resizeEventName, this.#onWindowResize.bind(this));

        // レンダラー
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.querySelector('#threePageCanvas')
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // ゲームオブジェクト
        this.#loadGameObjectModels();

        // カメラ
        this.cameraPos = new THREE.Vector3(0, 0, 0);
        this.cameraLookAt = new THREE.Vector3(this.playerBoat.pointX, -this.playerBoat.depth + 10, this.playerBoat.pointY);
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 20000);
        this.camera.position.set(this.cameraPos.x, this.cameraPos.y, this.cameraPos.z);
        this.camera.lookAt(this.cameraLookAt);
        this.scene.add(this.camera);

        // ライト
        const pointLight = new THREE.PointLight(0xffffff, 3.0);
        this.camera.add(pointLight);
        const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
        this.scene.add(ambientLight);

        // 海面
        this.water = this.#createWater();
        this.scene.add(this.water);

        // 水中からみた海面
        this.underwater = this.#createUnderwater();
        this.scene.add(this.underwater);

        // 水中の壁
        this.#createUnderwaterWall();

        // 空
        this.#createSky();
        this.scene.add(this.sky);

        // 水中の霧
        this.scene.fog = new THREE.Fog(this.fogColor, 1, 1000000);

        // コントローラ
        this.#cameraControllInitialize();
    }

    getRenderer() {
        return this.renderer;
    }

    /**
     * enemyship hit torpedo callback
     */
    onHitTorpedo(torpedo) {
        const explosionParticle = new TorpedoHitParticle(this.scene, torpedo.pointX, torpedo.pointY);
        explosionParticle.createParticles();
        this.explosionParticles.push(explosionParticle);
    }

    /**
     * uboat hit shell callback
     */
    onHitShellUboat(shell) {
        const explosionParticle = new ShellHitUboatParticle(this.scene, shell.pointX, shell.pointY);
        explosionParticle.createParticles();
        this.explosionParticles.push(explosionParticle);
    }

    /**
     * shell hit water line callback
     */
    onHitShellWater(shell) {
        const explosionParticle = new ShellHitWaterParticle(this.scene, shell.pointX, shell.pointY);
        explosionParticle.createParticles();
        this.explosionParticles.push(explosionParticle);
    }

    /**
     * depth charge explosion callback
     */
    onExplosionDepthCharge(depthCharge) {
        const explosionParticle = new DepthChageParticle(this.scene, depthCharge.pointX, depthCharge.pointY, -depthCharge.depth);
        explosionParticle.createParticles();
        this.explosionParticles.push(explosionParticle);
    }

    /**
     * FPSの表示
     */
    #createStats() {
        // stats
        var stats = new Stats();
        stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        Object.assign(stats.dom.style, {
            'position': 'fixed',
            'height': 'max-content',
            'left': '30px',
            'top': '0',
            'bottom': '0'
        });
        const threePage = $('#threePage');
        threePage.append(stats.dom);
        return stats;
    }

    /**
     * カメラ更新用のイベント設定
     */
    #cameraControllInitialize() {
        $('#threePageCanvas').on('touchstart', function (event) {
            if (event.touches.length === 1) {
                this.isPinch = false;
                const touchObject = event.changedTouches[0];
                const clickX = touchObject.pageX * -1;
                const clickY = touchObject.pageY * -1;
                const newRot = (clickX / window.innerWidth) * this.cameraMoveSpeedHorizon;
                const newXRot = (clickY / window.innerHeight) * this.cameraMoveSpeedVertical;
                const radian = Util.degreeToRadian(newRot);
                const radianX = Util.degreeToRadian(newXRot);
                this.beforeRad = radian;
                this.beforeXRad = radianX;
            } else if (event.touches.length === 2 && !this.isPeriscopeCamera) {
                this.isPinch = true;
                const w_abs = Math.abs(event.touches[1].pageX - event.touches[0].pageX);
                const h_abs = Math.abs(event.touches[1].pageY - event.touches[0].pageY);
                this.beforeTargetCameraRange = w_abs * h_abs;
            }
        }.bind(this));

        $('#threePageCanvas').on('touchmove', function (event) {
            if (event.touches.length === 1 && !this.isPinch) {
                const touchObject = event.changedTouches[0];
                const clickX = touchObject.pageX * -1;
                const clickY = touchObject.pageY * -1;
                const targetRot = (clickX / window.innerWidth) * this.cameraMoveSpeedHorizon;
                const targetXRot = (clickY / window.innerHeight) * this.cameraMoveSpeedVertical;
                const radian = Util.degreeToRadian(targetRot);
                const radianX = Util.degreeToRadian(targetXRot);
                var radDiff = (radian - this.beforeRad);
                const radXDiff = (radianX - this.beforeXRad);
                this.beforeRad = radian;
                this.beforeXRad = radianX;
                if (this.isPeriscopeCamera) {
                    if (this.periscopeZoom) {
                        radDiff /= 6;
                    }
                    this.periscopeRad += radDiff;
                    // bearingへの反映
                    const bearingDeg = Util.radianToDegree(-this.periscopeRad);
                    const tdc = this.playerBoat.tdc;
                    this.playerBoat.tdc.setSpec(bearingDeg, tdc.range, tdc.angleOnBow, tdc.targetSpeed);
                    this.periscopeXRad += radXDiff;
                } else {
                    this.targetRad += radDiff;
                    this.targetXRad += radXDiff;
                }
                if (this.targetXRad <= this.targetXRadMin) {
                    this.targetXRad = this.targetXRadMin;
                } else if (this.targetXRad >= this.targetXRadMax) {
                    this.targetXRad = this.targetXRadMax;
                }
            } else if (event.touches.length === 2 && this.isPinch && !this.isPeriscopeCamera) {
                const w_abs = Math.abs(event.touches[1].pageX - event.touches[0].pageX);
                const h_abs = Math.abs(event.touches[1].pageY - event.touches[0].pageY);
                const areaSize = w_abs * h_abs;
                const diff = areaSize - this.beforeTargetCameraRange;
                this.beforeTargetCameraRange = areaSize;
                this.targetCameraRange -= diff * 0.025;
                if (this.targetCameraRange <= this.cameraRangeMin) {
                    this.targetCameraRange = this.cameraRangeMin;
                } else if (this.targetCameraRange >= this.cameraRangeMax) {
                    this.targetCameraRange = this.cameraRangeMax;
                }
            }
        }.bind(this));
    }

    /**
     * 海面の作成
     */
    #createWater() {
        const waterGeometry = new THREE.PlaneGeometry(100000, 100000);
        var water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load('resources/texture/Water_1_M_Normal.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                alpha: 1.0,
                waterColor: this.waterColor,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );
        water.rotation.x = - Math.PI / 2;
        return water;
    }

    /**
     * 海中の作成
     */
    #createUnderwater() {
        const waterGeometry = new THREE.PlaneGeometry(100000, 100000);
        var water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load('resources/texture/Water_1_M_Normal.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                alpha: 1.0,
                waterColor: this.waterColor,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );
        water.rotation.x = Math.PI / 2;
        water.position.y = -0.1;
        return water;
    }

    /**
     * 水中の壁作成
     */
    #createUnderwaterWall() {
        // ①ジオメトリを作成
        const width = 100000;
        const height = 100000
        const geometry = new THREE.PlaneGeometry(width, height);
        // マテリアルを作成
        const material = new THREE.MeshBasicMaterial({ color: 0xafeeee });
        // メッシュを作成
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = this.playerBoat.pointX;
        mesh.position.y = -(height / 2);
        mesh.position.z = this.playerBoat.pointY - this.wallRange;
        this.wallN = mesh;

        const mesh2 = new THREE.Mesh(geometry, material);
        mesh2.rotation.y = Math.PI / 2;
        mesh2.position.x = this.playerBoat.pointX - this.wallRange;
        mesh2.position.y = -(height / 2);
        mesh2.position.z = this.playerBoat.pointY;
        this.wallW = mesh2;

        const mesh3 = new THREE.Mesh(geometry, material);
        mesh3.rotation.y = Math.PI;
        mesh3.position.x = this.playerBoat.pointX;
        mesh3.position.y = -(height / 2);
        mesh3.position.z = this.playerBoat.pointY + this.wallRange;
        this.wallS = mesh3;

        const mesh4 = new THREE.Mesh(geometry, material);
        mesh4.rotation.y = -Math.PI / 2;
        mesh4.position.x = this.playerBoat.pointX + this.wallRange;
        mesh4.position.y = -(height / 2);
        mesh4.position.z = this.playerBoat.pointY;
        this.wallE = mesh4;

        this.scene.add(this.wallN);
        this.scene.add(this.wallE);
        this.scene.add(this.wallW);
        this.scene.add(this.wallS);
    }

    /**
     * 空の作成
     */
    #createSky() {
        const sky = new Sky();
        sky.scale.setScalar(450000);

        const effectController = {
            turbidity: 0,
            rayleigh: 0.5,
            mieCoefficient: 0.07,
            mieDirectionalG: 1,
            elevation: 10,
            azimuth: 90,
            exposure: this.renderer.toneMappingExposure
        };

        // Skyの設定
        const uniforms = sky.material.uniforms;
        uniforms['turbidity'].value = effectController.turbidity;
        uniforms['rayleigh'].value = effectController.rayleigh;
        uniforms['mieCoefficient'].value = effectController.mieCoefficient;
        uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

        // 太陽の設定
        const sun = new THREE.Vector3();
        const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
        const theta = THREE.MathUtils.degToRad(effectController.azimuth);
        sun.setFromSphericalCoords(1, phi, theta);
        uniforms['sunPosition'].value.copy(sun);

        this.renderer.toneMappingExposure = effectController.exposure;

        this.sky = sky;
    }

    /**
     * ゲームオブジェクト用モデルのロードと追加
     */
    #loadGameObjectModels() {

        /*
        this.loadProgress.updateProgress(100);
        this.loadProgress.updateProgress(100);
        this.loadProgress.updateProgress(100);
        this.loadProgress.updateProgress(100);
        this.loadProgress.updateProgress(100);
        */

        // モデルのロード
        
        /*
        THREE.DefaultLoadingManager.onLoad = function () {
            // ロード完了後にゲーム開始
            this.loadProgress.updateProgress(100);
        }.bind(this);

        THREE.DefaultLoadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
          this.loadProgress.updateProgress(itemsTotal);
          console.log(itemsTotal)
        }.bind(this);
        */
        this.loadProgress.updateProgress(0);

        const gltfLoader = new GLTFLoader();
        gltfLoader.load('resources/model/uboatType7C41.glb', function (obj) {
            // プレイヤボート
            obj.scene.name = "playerBoat";
            this.gameObjects.push(obj.scene);
            this.scene.add(obj.scene);
            const animations = obj.animations;
            if (animations && animations.length) {
                this.playerBoatMixer = new THREE.AnimationMixer(obj.scene);
                for (let i = 0; i < animations.length; i++) {
                    const animation = animations[i];
                    //Animation Actionを生成
                    let action = this.playerBoatMixer.clipAction(animation);
                    //ループ設定
                    action.setLoop(THREE.LoopRepeat);
                    action.play();
                }
            }
        }.bind(this), this.onProgress.bind(this), this.onError);
        gltfLoader.load('resources/model/torpedo.gltf', function (obj) {
            // 魚雷
            obj.scene.name = "torpedo";
            obj.scene.visible = false;
            this.gameObjects.push(obj.scene);
            this.scene.add(obj.scene);
        }.bind(this), this.onProgress.bind(this), this.onError);
        gltfLoader.load('resources/model/cargoShip.glb', function (obj) {
            // 商船
            for (var i = 0; i < this.otherShips.length; i++) {
                if (this.otherShips[i].objectType !== ObjectType.marchant1) {
                    continue;
                }
                const otherShipObj = SkeletonUtils.clone(obj.scene);
                otherShipObj.name = "otherShip" + i;
                otherShipObj.position.set(10000, 10000, 10000);
                this.gameObjects.push(otherShipObj);
                this.scene.add(otherShipObj);
                // const animations = obj.animations;
                // if (animations && animations.length) {
                //     this.otherShipMixers[i] = new THREE.AnimationMixer(obj.scene);
                //     for (let j = 0; j < animations.length; j++) {
                //         const animation = animations[j];
                //         //Animation Actionを生成
                //         let action = this.otherShipMixers[i].clipAction(animation);
                //         //ループ設定
                //         action.setLoop(THREE.LoopRepeat);
                //         action.play();
                //     }
                // }
            }
        }.bind(this), this.onProgress.bind(this), this.onError);
        gltfLoader.load('resources/model/destroyer.glb', function (obj) {
            // 駆逐艦
            for (var i = 0; i < this.otherShips.length; i++) {
                if (this.otherShips[i].objectType !== ObjectType.destoryer1) {
                    continue;
                }
                const otherShipObj = SkeletonUtils.clone(obj.scene);
                otherShipObj.name = "otherShip" + i;
                otherShipObj.position.set(10000, 10000, 10000);
                this.gameObjects.push(otherShipObj);
                this.scene.add(otherShipObj);
                const animations = obj.animations;
                if (animations && animations.length) {
                    this.otherShipMixers[i] = new THREE.AnimationMixer(otherShipObj);
                    for (let j = 0; j < animations.length; j++) {
                        const animation = animations[j];
                        //Animation Actionを生成
                        let action = this.otherShipMixers[i].clipAction(animation);
                        //ループ設定
                        action.setLoop(THREE.LoopRepeat);
                        action.play();
                    }
                }
            }
        }.bind(this), this.onProgress.bind(this), this.onError);
        // 砲弾
        const sphereGeometry = new THREE.SphereGeometry(0.5);
        const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0x050505 });
        const shellMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        shellMesh.position.set(0, 0, 0);
        shellMesh.name = "shell";
        shellMesh.visible = false;
        this.gameObjects.push(shellMesh);
        this.scene.add(shellMesh);
        // 爆雷
        const cylinderGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 50);
        const cylinderMaterial = new THREE.MeshPhongMaterial({ color: 0x303030 });
        const depthChargeMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        depthChargeMesh.position.set(0, 0, 0);
        depthChargeMesh.name = "depthCharge";
        depthChargeMesh.visible = false;
        this.gameObjects.push(depthChargeMesh);
        this.scene.add(depthChargeMesh);
    }

    onProgress(xhr) {
        if (xhr.lengthComputable) {
            const percentComplete = xhr.loaded / xhr.total * 100;
            this.loadProgress.updateProgress(percentComplete);
        }
    }

    onError() { console.log("model load faild."); }

    abandon() {
        // 全オブジェクト削除
        for (let i = this.scene.children.length - 1; i >= 0; i--) {
            this.scene.remove(this.scene.children[i]);
        }

        this.renderer = null;
        this.camera = null;
        this.controls = null;
    }

    /**
     * 毎フレーム実行される処理
     */
    animate() {
        // this.stats.begin();
        this.elapsedTime = this.clock.getDelta() * this.timeManager.gameSpeed;
        this.#updateCamera();
        this.water.material.uniforms['time'].value += 0.5 / 60.0;
        this.underwater.material.uniforms['time'].value += 0.5 / 60.0;
        this.#updateObjects();
        this.#updateEffects();
        this.#render();
        // this.stats.end();
    }

    /**
     * カメラモードを変更する
     * @param {boolean} isPeriscopeCamera 潜望鏡カメラにするか
     */
    changeCameraMode(isPeriscopeCamera) {
        this.isPeriscopeCamera = isPeriscopeCamera;

        if (this.isPeriscopeCamera) {
            // アスペクト比を更新する
            this.camera.aspect = 1;
            if (this.periscopeZoom) {
                this.camera.zoom = 6;
            } else {
                this.camera.zoom = 1.6;
            }
        } else {
            // アスペクト比を更新する
            this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            this.camera.aspect = innerWidth / innerHeight;
            this.camera.zoom = 1;
        }

        this.camera.updateProjectionMatrix();
    }

    /**
     * カメラの位置を更新する
     */
    #updateCamera() {
        /**
         * 緯度経度から位置を算出します。
         * @param {number} latitude 緯度です(単位は度数法)。
         * @param {number} longitude 経度です(単位は度数法)。
         * @param {number} radius 半径です。
         * @returns {THREE.Vector3} 3Dの座標です。
         */
        const translateGeoCoords = (latitude, longitude, radius) => {
            // 仰角
            const phi = latitude * Math.PI / 180;
            // 方位角
            const theta = (longitude - 180) * Math.PI / 180;

            const x = -1 * radius * Math.cos(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi);
            const z = radius * Math.cos(phi) * Math.sin(theta);

            return new THREE.Vector3(x, y, z);
        };

        if (!this.isPeriscopeCamera) {
            // 3人称カメラ
            this.cameraRad += (this.targetRad - this.cameraRad) * 0.15;
            this.cameraXRad += (this.targetXRad - this.cameraXRad) * 0.15;
            this.cameraRange += (this.targetCameraRange - this.cameraRange) * 0.15;
            const latitudeDeg = Util.radianToDegree(this.cameraXRad);
            const longtitude = Util.radianToDegree(this.cameraRad);
            const cameraCoord = translateGeoCoords(latitudeDeg, longtitude, this.cameraRange);
            this.camera.position.set(this.playerBoat.pointX + cameraCoord.x, -this.playerBoat.depth + cameraCoord.y, this.playerBoat.pointY + cameraCoord.z);
            this.camera.lookAt(new THREE.Vector3(this.playerBoat.pointX, -this.playerBoat.depth, this.playerBoat.pointY));
        } else {
            // 潜望鏡用カメラ
            const cameraRange = 0;
            const course = Util.degreeToRadian(this.playerBoat.course);
            const targetPosX = this.playerBoat.pointX + cameraRange * Math.cos(course);
            const targetPosY = this.playerBoat.pointY + cameraRange * Math.sin(course);
            this.camera.position.set(targetPosX, -this.playerBoat.depth + 13, targetPosY);
            this.camera.rotation.order = "YZX";
            this.camera.rotation.y = this.periscopeRad - course;
            this.camera.rotation.z = 0;
            this.camera.rotation.x = 0;
        }

        // update fog
        if (this.camera.position.y < 0) {
            if (!this.isUnderwaterCamera) {
                this.isUnderwaterCamera = true;
                this.scene.fog.far = this.fogFar;
            }
        } else {
            if (this.isUnderwaterCamera) {
                this.isUnderwaterCamera = false;
                this.scene.fog.far = 1000000;
            }
        }
    }

    /**
     * ゲームオブジェクトの位置等を更新する
     */
    #updateObjects() {
        // playerBoat
        const playerBoatObj = this.#getObjectByName("playerBoat");
        if (playerBoatObj === null) {
          return;
        }
        playerBoatObj.position.set(this.playerBoat.pointX, -this.playerBoat.depth, this.playerBoat.pointY);
        playerBoatObj.rotation.set(0, -Util.degreeToRadian(this.playerBoat.course), 0);
        //Animation Mixerを実行
        if (this.playerBoatMixer) {
            var timeMag = 1;
            switch (this.playerBoat.engineOut) {
                case EngineOut.aheadFull:
                    timeMag = 3;
                    break;
                case EngineOut.aheadHalf:
                    timeMag = 2;
                    break;
                case EngineOut.aheadSlow:
                    timeMag = 1;
                    break;
                case EngineOut.stop:
                    timeMag = 0;
                    break;
                case EngineOut.asternSlow:
                    timeMag = -1;
                    break;
                case EngineOut.asternHalf:
                    timeMag = -2;
                    break;
                case EngineOut.asternFull:
                    timeMag = -3;
                    break;
            }
            this.playerBoatMixer.update(this.elapsedTime * timeMag);
        }
        // waterWall
        this.wallN.position.z = this.playerBoat.pointY - this.wallRange;
        this.wallE.position.x = this.playerBoat.pointX + this.wallRange;
        this.wallW.position.x = this.playerBoat.pointX - this.wallRange;
        this.wallS.position.z = this.playerBoat.pointY + this.wallRange;

        // otherShips
        for (var i = 0; i < this.otherShips.length; i++) {
            const otherShipObj = this.#getObjectByName("otherShip" + i);
            if (otherShipObj === null) {
              break;
            }
            const otherShip = this.otherShips[i];
            otherShipObj.position.set(otherShip.pointX, -otherShip.depth, otherShip.pointY);
            otherShipObj.rotation.set(0, -Util.degreeToRadian(otherShip.course), 0);
            if (otherShip.isEnabled && this.otherShipMixers && this.otherShipMixers[i]) {
                this.otherShipMixers[i].update(this.elapsedTime * 3);
            }
        }

        // Torpedos
        this.#updateTorpedos();

        // Shells
        this.#updateShells();

        // depthCharges
        this.#updateDepthCharges();
    }

    /**
     * 魚雷の更新
     */
    #updateTorpedos() {
        // uboatが射出した魚雷と追加済魚雷モデルの差
        var needAddCount = this.playerBoat.torpedos.length - this.torpedoAddedCount;
        if (needAddCount > 0) {
            // 必要分モデルを追加する
            // モデル名は"torpedo" + 追加順
            const originTorpedo = this.#getObjectByName("torpedo");
            for (var i = 0; i < needAddCount; i++) {
                const obj = SkeletonUtils.clone(originTorpedo);
                obj.name = "torpedo" + (this.torpedoAddedCount);
                obj.visible = true;
                this.gameObjects.push(obj);
                this.scene.add(obj);
                this.torpedoAddedCount += 1;
            }
        }

        for (var i = 0; i < this.playerBoat.torpedos.length; i++) {
            if (!this.playerBoat.torpedos[i].isEnabled) {
                const objectName = "torpedo" + i;
                const deleteTorpedo = this.#getObjectByName(objectName);
                this.scene.remove(deleteTorpedo);
            }
        }

        // 位置、回転角度の更新
        var torpedoCounts = this.#getObjectCountContainName("torpedo") - 1;
        for (var i = 0; i < torpedoCounts; i++) {
            const torpedoObj = this.#getObjectByName("torpedo" + i);
            if (torpedoObj !== null) {
                const data = this.playerBoat.torpedos[i];
                torpedoObj.position.set(data.pointX, -data.depth, data.pointY);
                torpedoObj.rotation.set(0, -Util.degreeToRadian(data.course), 0);
            }
        }
    }

    /**
     * 砲弾の更新
     */
    #updateShells() {
        for (var i = 0; i < this.otherShips.length; i++) {
            const otherShip = this.otherShips[i];
            if (otherShip.objectType === ObjectType.destoryer1) {
                for (var j = 0; j < otherShip.shells.length; j++) {
                    const shell = otherShip.shells[j];
                    const objectName = "shell" + i + j;
                    const shellObject = this.#getObjectByName(objectName);
                    const data = otherShip.shells[j];
                    if (shell.isEnabled && shellObject === null) {
                        // 有効なオブジェクトが未追加なら追加する
                        const originShell = this.#getObjectByName("shell");
                        const obj = SkeletonUtils.clone(originShell);
                        obj.name = objectName;
                        obj.visible = true;
                        obj.position.set(data.pointX, -data.depth, data.pointY);
                        this.gameObjects.push(obj);
                        this.scene.add(obj);
                    } else if (!shell.isEnabled && shellObject !== null) {
                        // 無効かつ追加済なら削除する
                        this.scene.remove(shellObject);
                    } else if (shell.isEnabled && shellObject !== null) {
                        // 有効かつ追加済なら更新する
                        shellObject.position.set(data.pointX, -data.depth, data.pointY);
                    }
                }
            }
        }
    }

    /**
     * 砲弾の更新
     */
    #updateDepthCharges() {
        for (var i = 0; i < this.otherShips.length; i++) {
            const otherShip = this.otherShips[i];
            if (otherShip.objectType === ObjectType.destoryer1) {
                for (var j = 0; j < otherShip.depthCharges.length; j++) {
                    const depthCharge = otherShip.depthCharges[j];
                    const objectName = "depthCharge" + i + j;
                    const depthChargeObject = this.#getObjectByName(objectName);
                    if (depthCharge.isEnabled && depthChargeObject === null) {
                        // 有効なオブジェクトが未追加なら追加する
                        const originDepthCharge = this.#getObjectByName("depthCharge");
                        const obj = SkeletonUtils.clone(originDepthCharge);
                        obj.name = objectName;
                        obj.visible = true;
                        obj.position.set(depthCharge.pointX, -depthCharge.depth, depthCharge.pointY);
                        this.gameObjects.push(obj);
                        this.scene.add(obj);
                    } else if (!depthCharge.isEnabled && depthChargeObject !== null) {
                        // 無効かつ追加済なら削除する
                        this.scene.remove(depthChargeObject);
                    } else if (depthCharge.isEnabled && depthChargeObject !== null) {
                        // 有効かつ追加済なら更新する
                        depthChargeObject.position.set(depthCharge.pointX, -depthCharge.depth, depthCharge.pointY);
                        depthChargeObject.rotation.set(depthCharge.rotateX, depthCharge.rotateY, depthCharge.rotateZ);
                    }
                }
            }
        }
    }

    #updateEffects() {
        for (var i = 0; i < this.explosionParticles.length; i++) {
            if (this.explosionParticles[i] == null) {
                continue;
            }
            if (!this.explosionParticles[i].enable) {
                // remove
                this.explosionParticles[i] = null;
            }
            else {
                this.explosionParticles[i].update(this.elapsedTime);
            }
        }

    }

    /**
     * アニメーションを停止する
     */
    stopAnimate() {
        cancelAnimationFrame(this.animateHandle);
        this.animateHandle = null;
    }

    #render() {
        // this.controls.target = this.#getObjectByName("playerBoat").position;
        this.renderer.render(this.scene, this.camera);
    }

    #onWindowResize() {
        var innerWidth = window.innerWidth;
        var innerHeight = window.innerHeight;
        this.camera.aspect = innerWidth / innerHeight;
        this.renderer.setSize(innerWidth, innerHeight);
        this.camera.updateProjectionMatrix();
    }

    #getObjectByName(name) {
        for (var i = 0; i < this.gameObjects.length; i++) {
            if (this.gameObjects[i].name === name) {
                return this.gameObjects[i];
            }
        }

        return null;
    }

    #deleteObjectByName(name) {
        for (var i = 0; i < this.gameObjects.length; i++) {
            if (this.gameObjects[i].name === name) {
                this.gameObjects.splice(i, 1);
                return;
            }
        }
    }

    /**
     * 名前に指定の文字列を含むオブジェクトの数を取得する
     */
    #getObjectCountContainName(name) {
        let count = 0;
        this.gameObjects.forEach(function (obj) {
            if (obj.name.indexOf(name) != -1) {
                count++;
            }
        });
        return count;
    }
}
