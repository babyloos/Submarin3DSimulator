import { EngineOut, ObjectType, SurfaceStatus } from "../constants.js";
import { StatusController } from "../controller/statusController.js";
import { Util } from "../util.js";
import { GameObject } from "./gameObject.js";
import { TDC } from "./TDC.js";
import { Torpedo } from "./torpedo.js";

/**
 * U-boatクラス
 */
export class Uboat extends GameObject {

    battery = 100;              // バッテリー残量(%)
    o2 = 100;                   // 酸素残量(%)
    torpedoCount = 14;          // 魚雷残数

    distDepth = 0;              // 目標深度

    tdc                         // Torpedo Data Computer

    torpedos;                   // 射出した魚雷

    torpedoLoadingTime = 5000;                       // 魚雷の再発射に必要な時間(ms)
    torpedoElapsedTime = this.torpedoLoadingTime;    // 前回魚雷発射時からの経過時間(ms)

    beforeEngineOut;            // バッテリーが切れる以前のエンジン出力
    beforeDistSpeed;            // バッテリーが切れる以前の目標速度

    /**
     * コンストラクタ
     * @param {double} pointX X座標
     * @param {double} pointY Y座標
     * @param {double} course 針路(deg)
     */
    constructor(pointX, pointY, course) {
        super(ObjectType.uBoatType7C, pointX, pointY, course, 0, 20, 20);
        this.tdc = new TDC();
        this.torpedos = new Array();
    }

    /**
     * 初期設定を行う
     * 各コントローラへの参照もここで行う
     * @param {MessageController} messageController
     * @param {ControllController} controllController
     * @param {StatusController} statusController
     */
    initialize(messageController, controllController, statusController) {
        super.initialize(messageController, controllController, statusController);
    }

    /**
     * 状態の更新
     * 1フレームごとに呼ばれる
     * @param {double} elapsedTime 経過時間(ms)
     */
    update(elapsedTime) {
        super.update(elapsedTime);

        this.#updateTorpedos(elapsedTime);
        this.#updateDepthDamage(elapsedTime);
        this.#updateO2(elapsedTime);
        this.#updateBattery(elapsedTime);
    }

    /**
     * エンジン出力の更新
     * @param {EngineOut} engineOut 目標速度
     */
    updateEngineOut(engineOut) {
        super.updateEngineOut(engineOut);

        let engineOutStr = "";
        switch (engineOut) {
            case EngineOut.aheadFull:
                engineOutStr = $('#RES_AheadFull').html()
                break;
            case EngineOut.aheadHalf:
                engineOutStr = $('#RES_AheadHalf').html()
                break;
            case EngineOut.aheadSlow:
                engineOutStr = $('#RES_AheadSlow').html()
                break;
            case EngineOut.stop:
                engineOutStr = $('#RES_AllStop').html()
                break;
            case EngineOut.asternSlow:
                engineOutStr = $('#RES_AsternSlow').html()
                break;
            case EngineOut.asternHalf:
                engineOutStr = $('#RES_AsternHalf').html()
                break;
            case EngineOut.asternFull:
                engineOutStr = $('#RES_AsternFull').html()
                break;
        }

        const engineerText = $('#RES_ChiefEngineer').html()
        this.messageController.showMessage(engineerText, engineOutStr);
        this.beforeEngineOut = engineOut;
        this.beforeDistSpeed = this.distSpeed;
    }

    /**
     * 目標針路の更新
     * @param {number} distCourse 目標針路
     */
    updateDistCourse(distCourse) {
        super.updateDistCourse(distCourse);
        const navigatorText = $('#RES_Navigator').html()  
        let distCourseStr = Util.numbToNDigitsStr(distCourse, 3);
        const distCourseText = $('#RES_ChangeCourse').html().replace('xxx', distCourseStr)
        this.messageController.showMessage(navigatorText, distCourseText);
    }

    /**
     * 深度の更新
     * @param {number} distDepth 目標深度
     */
    updateDistDepth(distDepth) {
        this.distDepth = distDepth;
        let distDepthStr = Util.numbToNDigitsStr(distDepth, 3);
        const navigatorText = $('#RES_Navigator').html()
        const distDepthText = $('#RES_ChangeDepth').html().replace('xxx', distDepthStr)
        this.messageController.showMessage(navigatorText, distDepthText);
    }

    /**
     * 深度の更新
     * @param {number} 経過時間
     */
    updateDepth(elapsedTime) {
        super.updateDepth(elapsedTime);

        if (!this.isEnabled) {
            return;
        }

        if (Math.round(this.depth) === Math.round(this.distDepth)) {
            return;
        }

        // 浮沈速度は船速に比例する
        // 船速が0でも深度の変更は可能とする
        const speed = (elapsedTime / 5000) + Math.abs(this.speed) * 0.1 * elapsedTime / 1000;
        if (this.distDepth < this.depth) {
            // 浮上
            this.depth -= speed;
        }
        else {
            // 潜行
            this.depth += speed;
        }
    }

    /**
     * 深度によるダメージの更新
     * @param {number} elapsedTime 経過時間(ms)
     */
    #updateDepthDamage(elapsedTime) {
        // 深度200以上はダメージが入る
        if (this.depth >= 200) {
            const diffDepth = this.depth - 200;
            if (diffDepth != 0)
                this.damage += diffDepth / 1000 * (elapsedTime / 1000);
        }
    }

    /**
     * 酸素残量の更新
     * @param {number} elapsedTime 経過時間(ms)
     */
    #updateO2(elapsedTime) {
        switch (this.depthState()) {
            case SurfaceStatus.surface:
                // 酸素残量を回復する
                this.o2 += (elapsedTime / 1000);
                break;
            case SurfaceStatus.periscope:
            case SurfaceStatus.submerged:
                // 酸素残量を減らす
                this.o2 -= (elapsedTime / 1000) / 50;
                break;
        }
        if (this.o2 < 0) {
            this.o2 = 0;
            this.damage = 100; 
        }
        if (this.o2 > 100) {
            this.o2 = 100;
        }
    }

    /**
     * バッテリー残量の更新
     * @param {number} elapsedTime 経過時間(ms)
     */
    #updateBattery(elapseTime) {
        const beforeBattery = this.battery;
        switch (this.depthState()) {
            case SurfaceStatus.surface:
                // バッテリー残量を回復する
                this.battery += (elapseTime / 1000) / 10;
                break;
            case SurfaceStatus.periscope:
            case SurfaceStatus.submerged:
                // バッテリー残量を減らす
                const consumAmout = Math.abs(this.engineOut) * (elapseTime / 1000) / 100;
                this.battery -= consumAmout;
                break;
        }
        if (this.battery <= 0) {
            this.battery = 0;
            // エンジン出力を強制的に0にする
            this.engineOut = EngineOut.stop;
            this.distSpeed = 0;
        } else if (beforeBattery == 0 && this.battery > 0) {
            // バッテリーが回復した際の動き
            this.engineOut = this.beforeEngineOut;
            this.distSpeed = this.beforeDistSpeed;
        }
        if (this.battery > 100) {
            this.battery = 100;
        }
    }

    /**
     * 魚雷の更新
     * @param {number} 経過時間
     */
    #updateTorpedos(elapsedTime) {
        this.torpedoElapsedTime += elapsedTime;
        this.controllController.updateTorpedoStatus(this.torpedoCount, this.canFireTorpedo());
        this.torpedos.forEach(function (torpedo) {
            if (torpedo.isEnabled) {
                torpedo.update(elapsedTime);
            }
        });
    }

    /**
     * 有効な魚雷を取得
     */
    getEnableTorpedos() {
        var enableTorpedos = new Array();
        this.torpedos.forEach(function (torpedo) {
            if (torpedo.isEnabled) {
                enableTorpedos.push(torpedo);
            }
        });
        return enableTorpedos;
    }

    /**
     * ステータスの更新を画面に反映する
     */
    updateView() {
        super.updateView();
        // 速度表示の更新
        this.controllController.updateSpeed(Math.round(this.speed));
        // 針路表示の更新
        this.controllController.updateCourse(Math.round(this.course));
        // 深度表示の更新
        this.controllController.updateDepth(Math.round(this.depth));
        // ステータスパネル上の値更新
        this.#updateViewStatus();
    }

    /**
     * 魚雷の射出
     */
    fireTorpedo() {
        if (!this.canFireTorpedo()) {
            // 魚雷発射ボタンは非活性になっているはず
            throw new Error("invalid operation.");
        }

        const torpedo = new Torpedo(this.pointX, this.pointY, this.depth);
        torpedo.initialize(this.course, this.speed, this.tdc.gyroAngle, 0);
        this.torpedos.push(torpedo);
        this.torpedoCount--;
        this.torpedoElapsedTime = 0;
    }

    /**
     * 魚雷発射可能か
     */
    canFireTorpedo() {
        return (this.torpedoCount > 0) && (this.torpedoLoadingTime <= this.torpedoElapsedTime) && (this.depth <= 14);
    }

    /**
     * ステータスパネル状のプレイヤボートの値更新
     */
    #updateViewStatus() {
        // ダメージ率の更新
        this.statusController.updateDamage(this.damage);
        // バッテリー残量の更新
        this.statusController.updateBattery(this.battery);
        // 酸素残量の更新
        this.statusController.updateO2(this.o2);
    }

    /**
     * 砲弾衝突時の動作
     */
    onHitShell() {
        super.onHitShell();
        this.damage += Util.getRandomArbitrary(30, 50);
    }

    /**
     * オブジェクトをシリアル化する
     * @return {string} シリアル化したstring
     */
    serialize() {
        const json = JSON.parse(super.serialize());

        json.battery = this.battery;
        json.o2 = this.o2;
        json.torpedoCount = this.torpedoCount;
        json.distDepth = this.distDepth;
        json.tdc = JSON.parse(this.tdc.serialize());
        let jsonTorpedos = [];
        this.torpedos.forEach(function (torpedo) {
            const jsonTorpedo = JSON.parse(torpedo.serialize());
            jsonTorpedos.push(jsonTorpedo);
        });
        json.torpedos = jsonTorpedos;

        return JSON.stringify(json);
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {Uboat} 生成したオブジェクト
     */
    static deserialize(json) {
        const gameObj = super.deserialize(json);

        const obj = new Uboat(gameObj.pointX, gameObj.pointY, gameObj.course);
        obj.isEnabled = gameObj.isEnabled;
        obj.objectType = gameObj.objectType;
        obj.depth = gameObj.depth;
        obj.speed = gameObj.speed;
        obj.maxSpeed = gameObj.maxSpeed;
        obj.damage = gameObj.damage;
        obj.acceleration = gameObj.acceleration;
        obj.rotationSpeed = gameObj.rotationSpeed;
        obj.engineOut = gameObj.engineOut;
        obj.distSpeed = gameObj.distSpeed;
        obj.distCourse = gameObj.distCourse;

        obj.battery = json.battery;
        obj.o2 = json.o2;
        obj.torpedoCount = json.torpedoCount;
        obj.distDepth = json.distDepth;
        json.torpedos.forEach(function (jsonTorpedo) {
            const torpedo = Torpedo.deserialize(jsonTorpedo);
            obj.torpedos.push(torpedo);
        });

        obj.tdc = TDC.deserialize(json.tdc);

        return obj;
    }
}
