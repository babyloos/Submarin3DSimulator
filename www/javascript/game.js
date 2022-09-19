import { FRAME_SPAN, GameDifficulty, ObjectType, TIME_SPAN } from "./constants.js";
import { ControllController } from "./controller/controllController.js";
import { HydrophoneController } from "./controller/hydrophoneController.js";
import { MessageController } from "./controller/messageController.js";
import { ObserverController } from "./controller/observerController.js";
import { PageController } from "./controller/pageController.js";
import { StatusController } from "./controller/statusController.js";
import { TimeManager } from "./controller/timeManger.js";
import { Debug } from "./debug.js";
import { Marchant } from "./model/marchant.js";
import { Point } from "./model/point.js";
import { Uboat } from "./model/uBoat.js";
import { Util } from "./util.js";
import { CollisionManager } from "./controller/collisionManager.js";
import { Destroyer } from "./model/destroyer.js";
import { EnemyShip } from "./model/enemyShip.js";
import { ThreeViewController } from "./controller/threeViewController.js";
import { PeriscopeController } from "./controller/periscopeController.js";

/**
 * ゲーム全体を管理するクラス
 */
export class Game {

    // #region 時間関係

    initTime;                 // ゲーム開始時時刻(ゲーム内時刻)
    time = 0.0;               // ゲーム経過秒数(ms)
    timeSpeed = 1;            // ゲーム進行時間倍率(1~1024)

    // #endregion

    // #region FPS計算用

    timeManager = 0;           // ゲーム時間管理用
    beforeRealTime = 0;        // 前フレーム更新時刻

    // #endregion

    // #region

    gameObjects;              // 全ゲームオブジェクト
    playerBoat;               // プレイヤーが乗ってるU-boat
    enemyShips;               // 敵船のコレクション

    // #endregion

    // #region コントローラ

    pageController;
    messageController;
    statusController;
    controllController;
    observerController;
    hydrophoneController;
    externalViewController;
    periscopeController;
    collisionManager;

    // #endregion

    // #region ローカルストレージ

    isNewgame = false;
    saveFile;
    quickSaveButton;

    // #endregion

    // #region デバッグ用

    debug;

    //#endregion

    intervalId;
    _exitGame;               // ゲーム終了時処理
    isGameOver = false;
    _gameOver;               // ゲームーバー時処理
    _gameClear;              // ゲームクリア時処理
    isGameClear = false;

    sunkEnemyTonnage = 0;    // 撃沈トン数
    clearTonnage = 0;     // クリアに必要な撃沈トン数

    destroyerCount = 0;
    merchantCount = 0;

    /**
     * コンストラクタ
     * @param {boolean} isNewgame ニューゲームか否か
     * @param {GameDifficulty} difficulty ゲーム難易度
     * @param {LoadProgress} loadProgress モデルロード進捗率更新用オブジェクト
     * @param {Function} exitGame ゲーム終了時処理
     * @param {Function} gameOver ゲームオーバー時処理
     * @param {Function} gameClear ゲームクリア時処理
     */
    constructor(isNewgame, difficulty, loadProgress, exitGame, gameOver, gameClear) {
        this.isNewgame = isNewgame;
        this._exitGame = exitGame;
        this._gameOver = gameOver;
        this._gameClear = gameClear;

        // 難易度によって必要撃墜トン数, 敵船の数を設定する
        switch (difficulty) {
            case GameDifficulty.easy:
                this.clearTonnage = 8000;
                this.destroyerCount = 1;
                this.merchantCount = 5;
                break;
            case GameDifficulty.normal:
                this.clearTonnage = 12000;
                this.destroyerCount = 2;
                this.merchantCount = 4;
                break;
            case GameDifficulty.hard:
                this.clearTonnage = 20000;
                this.destroyerCount = 4;
                this.merchantCount = 3;
                break;
        }

        // デバッグ用

        this.debug = new Debug();

        this.enemyShips = new Array();

        // ゲーム全体の初期設定
        this.#initialize(loadProgress);
    }

    dispose() {
        clearInterval(this.intervalId);
    }

    /**
     * ゲーム全体の初期設定を行う
     */
    #initialize(loadProgress) {
        this.timeManager = new TimeManager();

        // 各コントローラ準備
        this.pageController = new PageController();
        this.messageController = new MessageController();
        this.statusController = new StatusController();
        this.controllController = new ControllController(this.exitGame);
        this.observerController = new ObserverController();
        this.hydrophoneController = new HydrophoneController();
        this.periscopeController = new PeriscopeController();
        this.collisionManager = new CollisionManager();
        this.threePageViewController = new ThreeViewController(loadProgress);

        if (this.isNewgame) {
            // ゲーム開始時刻の設定(ゲーム内時刻)
            this.initTime = new Date(Date.UTC(1941, 8, 1, 12, 0, 0));
            // プレイヤボート
            this.playerBoat = new Uboat(0, 0, 0);
            // 船団の作成
            const xPoint = Util.getRandomArbitrary(-20000, 20000);
            const yPoint = Util.getRandomArbitrary(-20000, 20000);
            const speed = Util.getRandomArbitrary(1, 5);
            const course = Util.getRandomArbitrary(0, 359);
            const period = Util.getRandomArbitrary(500, 1000);
            this.#createConvoy(0, xPoint, yPoint, speed, course, period);
        } else {
            // ゲーム時間
            this.initTime = new Date(this.#loadFile('initTime'));
            this.time = this.#loadFile('time');
            // プレイヤボート
            const playerBoatJson = this.#loadFile('playerBoat');
            this.playerBoat = Uboat.deserialize(playerBoatJson);
            // 敵船
            const enemyShipsJson = this.#loadFile('enemyShips');
            enemyShipsJson.forEach(function (enemyShipJson) {
                let enemyShip;
                const onHitTorpedo = this.threePageViewController.onHitTorpedo;
                if (enemyShipJson.objectType === ObjectType.destoryer1) {
                    enemyShip = Destroyer.deserialize(enemyShipJson);
                    enemyShip.initialize(this.playerBoat, onHitTorpedo);
                    // depthChargeはplayerBoatの参照が必要なのでここで参照を渡す
                    enemyShip.depthCharges.forEach(function (depthCharge) {
                        if (depthCharge.isEnabled) {
                            depthCharge.playerBoat = this.playerBoat;
                        }
                    }.bind(this));
                    this.enemyShips.push(enemyShip);
                } else if (enemyShipJson.objectType === ObjectType.marchant1) {
                    enemyShip = Marchant.deserialize(enemyShipJson, onHitTorpedo);
                    enemyShip.initialize(this.playerBoat, this.threePageViewController.onHitTorpedo);
                    this.enemyShips.push(enemyShip);
                }
            }.bind(this));
        }

        // 各クラスのInitialize
        this.controllController.initialize(this.playerBoat, this.timeManager);
        this.playerBoat.initialize(this.messageController, this.controllController, this.statusController);
        this.observerController.initialize(this.playerBoat, this.enemyShips, this.messageController, this.pageController);
        this.hydrophoneController.initialize(this.playerBoat, this.enemyShips, this.messageController, this.pageController);
        this.threePageViewController.initialize(this.playerBoat, this.enemyShips, this.timeManager);
        this.collisionManager.initialize(this.playerBoat, this.enemyShips, this.threePageViewController);
        this.periscopeController.threeViewController = this.threePageViewController;
        this.periscopeController.initialize(this.playerBoat, this.enemyShips, this.messageController, this.pageController);

        // ゲーム更新処理設定
        this.#initializeUpdate();

        // 終了ボタン設定
        this.#exitButtonInitialize();
    }

    /**
     * 毎フレーム行うゲーム更新処理
     */
    #update() {
        // FPS計算
        let now = new Date();
        let elapsedTime = now.getTime() - this.beforeRealTime.getTime();
        let fps = 1000 / elapsedTime;
        this.beforeRealTime = now;
        this.debug.showFPS(Math.round(fps));

        elapsedTime *= this.timeManager.gameSpeed;

        // 時計更新
        this.#updateTimer(elapsedTime);

        // 各ゲームオブジェクトの状態更新
        this.playerBoat.update(elapsedTime);

        // 敵船の状態更新
        this.#updateEnemyShips(elapsedTime);

        // 当たり判定
        this.collisionManager.update(elapsedTime);

        // ゲームオーバー状態更新
        this.#updateIsGameOver();

        // 3D画面更新
        this.threePageViewController.animate();
    }

    /**
     * ゲームオーバー状態の更新
     */
    #updateIsGameOver() {
        if (!this.isGameOver && !this.isGameClear) {
            if (!this.playerBoat.isEnabled) {
                // ゲームオーバー時処理
                this.isGameOver = true;
                this._gameOver();
            }
        }
    }

    /**
     * 敵船の状態更新
     */
    #updateEnemyShips(elapsedTime) {
        if (this.enemyShips.length > 0) {
            this.enemyShips.forEach(function (ship) {
                ship.update(elapsedTime);
            });
        }
    }

    /**
     * 時計の更新
     * @param {number} elapsedTime 経過時間(ms)
     */
    #updateTimer(elapsedTime) {
        // 時刻の更新
        this.time += elapsedTime / 1000;
        this.statusController.updateTime(this.initTime, this.time);

        // ゲーム内時間の1分ごとにデータセーブを行う
        if (Math.round(this.time) % 60 == 0 && Math.round(this.time - elapsedTime / 1000) % 60 != 0 && !this.isGameOver) {
            this.saveDatas();
        }
    }

    /**
     * ゲーム更新処理の設定
     */
    #initializeUpdate() {
        // ゲーム開始時刻の設定(現実時刻)
        this.beforeRealTime = new Date();

        this.intervalId = setInterval(this.#update.bind(this), FRAME_SPAN);
    }

    /**
     * 敵船団の作成
     * @param {number} convoyId 船団ID
     * @param {number} pointX 基準X座標
     * @param {number} pointY 基準Y座標
     * @param {number} speed 速度
     * @param {number} course 針路
     * @param {number} period 船同士の間隔
     */
    #createConvoy(convoyId, pointX, pointY, speed, course, period) {
        this.enemyShips = new Array();
        const merchantCount = this.merchantCount;
        // merchant
        const mCount = Math.floor(Math.sqrt(merchantCount));
        const column = mCount;
        const row = mCount;
        const remain = merchantCount - (mCount ** 2);
        for (var i = 0; i < column; i++) {
            for (var j = 0; j < row; j++) {
                const merchant = new Marchant(convoyId, i * period + pointX, j * period + pointY, course, speed);
                merchant.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
                this.enemyShips.push(merchant);
            }
        }
        for (var i = 0; i < remain; i++) {
            const merchant = new Marchant(convoyId, row * period + pointX, i * period + pointY, course, speed);
            merchant.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
            this.enemyShips.push(merchant);
        }
        // destroyer
        // 駆逐艦は出来るだけ商船を囲うように配置する
        const destroyerCount = this.destroyerCount;
        const xCenter = (column * period) / 2;
        const yCenter = (row * period) / 2;
        switch (destroyerCount) {
            case 1:
                var destroyer1 = new Destroyer(convoyId, period * 2 + pointX, yCenter + pointY, course, speed);
                destroyer1.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
                this.enemyShips.push(destroyer1);
                break;
            case 2:
                // 左右に配置
                var destroyer1 = new Destroyer(convoyId, period * -1 + pointX, yCenter + pointY, course, speed);
                var destroyer2 = new Destroyer(convoyId, mCount * period + period + pointX, yCenter + pointY, course, speed);
                destroyer1.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
                destroyer2.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
                this.enemyShips.push(destroyer1);
                this.enemyShips.push(destroyer2);
                break;
            case 4:
                // 上下左右に配置
                var destroyer1 = new Destroyer(convoyId, period * -1 + pointX, yCenter + pointY, course, speed);
                var destroyer2 = new Destroyer(convoyId, mCount * period + period + pointX, yCenter + pointY, course, speed);
                var destroyer3 = new Destroyer(convoyId, xCenter + pointX, period * -1 + pointY, course, speed);
                var destroyer4 = new Destroyer(convoyId, xCenter + pointX, mCount * period + period + pointY, course, speed);
                destroyer1.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
                destroyer2.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
                destroyer3.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
                destroyer4.initialize(this.playerBoat, this.onSunkEnemy.bind(this));
                this.enemyShips.push(destroyer1);
                this.enemyShips.push(destroyer2);
                this.enemyShips.push(destroyer3);
                this.enemyShips.push(destroyer4);
                break;
        }
    }

    /**
     * ゲームデータ保存処理
     */
    saveDatas() {
        // uBoat
        window.localStorage.setItem('playerBoat', this.playerBoat.serialize());
        // 敵船オブジェクト
        let jsonEnemyShips = [];
        this.enemyShips.forEach(function (ship) {
            const jsonShip = JSON.parse(ship.serialize());
            jsonEnemyShips.push(jsonShip);
        });
        window.localStorage.setItem('enemyShips', JSON.stringify(jsonEnemyShips));
        // 現在時刻
        this.#saveFile(this.initTime, 'initTime');
        this.#saveFile(this.time, 'time');
    }

    /**
     * ローカルストレージにインスタンスの状態を保存する
     * @param {object} obj 保存対象のオブジェクト
     * @param {string} key 保存時のキー
     */
    #saveFile(obj, key) {
        window.localStorage.setItem(key, JSON.stringify(obj));
    }

    /**
     * ローカルストレージから指定したキーのJSON文字列を読みだす
     * @param {string} key 読み出し対象のキー
     * @return {string} 読みだしたインスタンス
     */
    #loadFile(key) {
        return JSON.parse(window.localStorage.getItem(key));
    }

    /**
     * 終了ボタンのイベント設定
     */
    #exitButtonInitialize() {
        const exitButton = $('#exitButton');

        exitButton.on('click', function () {
            this.#exitGame();
        }.bind(this));
    }

    /**
     * ゲーム終了時処理
     */
    #exitGame() {
        // ゲームの保存
        this.saveDatas();
        // threePage削除
        this.threePageViewController.stopAnimate();
        // 全オブジェクト削除
        this.threePageViewController.abandon();
        this.threePageViewController = null;
        // exitGame呼び出し
        this._exitGame();
    }

    /**
     * 敵船撃沈時処理
     * @param {number} tonnage 撃沈した船のトン数
     */
    onSunkEnemy(tonnage) {
        if (this.isGameClear) {
            return;
        }
        // 撃沈トン数を加算
        this.sunkEnemyTonnage += tonnage;
        // メッセージパネルへ通知
        this.messageController.showMessage("副長", tonnage + "トンの敵船を撃沈");
        const leftTonnage = this.clearTonnage - this.sunkEnemyTonnage;
        this.messageController.showMessage("副長", "残り" + leftTonnage + "トン");
        // ゲームクリア判定
        if (this.sunkEnemyTonnage >= this.clearTonnage) {
            this.isGameClear = true;
            this._gameClear();
        }
    }
}
