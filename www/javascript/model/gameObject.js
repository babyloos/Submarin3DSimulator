import { EngineOut, KILO_PER_KNOT, ObjectType, SurfaceStatus } from "../constants.js";
import { ControllController } from "../controller/controllController.js";
import { MessageController } from "../controller/messageController.js";
import { StatusController } from "../controller/statusController.js";
import { Util } from "../util.js";
import { ObjectState } from "./objectState.js";
import { Point } from "./point.js";
import { Serializable } from "./Serializable.js";

/**
 * ゲーム内の全オブジェクトの親クラス
 * U-boat, EnemyShipが継承する
 */
export class GameObject extends Serializable {

    isEnabled = true;

    objectType;

    pointX = 0.0;           // x座標
    pointY = 0.0;           // y座標
    depth = 0;              // 深度
    speed = 0.0;            // 速度(kt)
    maxSpeed = 0.0;         // 最高速度(kt)
    course = 0.0;           // 進行方向(0 ~ 359)
    damage = 0.0;           // ダメージ(%)
    acceleration = 0.0;     // 全速力の時に何秒で最高速に達するか
    rotationSpeed = 0.0;    // 回転速度

    isCollision = false;    // 衝突フラグ 衝突中はtrueとなる
    isCollided = false;     // 衝突フラグ 衝突したフレームのみtrueとなる
    collidedObject = null;  // 衝突対象のオブジェクト

    /* 船舶サイズ */
    length;                 // 全長
    height;                 // 全高
    width;                  // 全幅
    draft;                  // 喫水
    tonnage;                // 排水量(t)

    engineOut = EngineOut.stop;
    distSpeed = 0.0;

    distCourse = 0.0   // 目標進行方向(0 ~ 359)

    // 各コントローラへの参照
    messageController;  // メッセージコントローラの参照先
    controllController; // コントロールコントローラの参照先
    statusController;   // ステータスコントローラの参照先

    // #region プロパティごとの値変更時実行メソッド

    propertyCallbacks;

    // #endregion

    /**
     * コンストラクタ
     * @param {number} objectType 船の種類
     * @param {number} pointX X座標
     * @param {number} pointY Y座標
     * @param {number} course 針路(deg)
     * @param {number} damage ダメージ(%)
     * @param {number} acceleration 加速度
     * @param {number} rotationSpeed 回転速度
     */
    constructor(objectType, pointX, pointY, course, damage, acceleration, rotationSpeed) {
        super();

        this.pointX = pointX;
        this.pointY = pointY;
        this.course = course;
        this.damage = damage;
        this.acceleration = acceleration;
        this.rotationSpeed = rotationSpeed;

        this.propertyCallbacks = {};

        // オブジェクト種類による設定
        this.#setParamByObjectType(objectType);
        this.objectType = objectType;

        this.nextObjectState = new ObjectState(this.pointX, this.pointY, this.course, this.speed);
    }

    /**
     * 初期設定を行う
     * 各コントローラへの参照もここで行う
     * @param {MessageController} messageController
     * @param {ControllController} controllController
     * @param {StatusController} statusController
     */
    initialize(messageController, controllController, statusController) {
        this.messageController = messageController;
        this.controllController = controllController;
        this.statusController = statusController;
    }

    /**
     * 状態の更新
     * 1フレームごとに呼ばれる
     * @param {double} elapsedTime 経過時間(ms)
     */
    update(elapsedTime) {
        this.#updateCoord(elapsedTime);
        this.#updateOperation(elapsedTime);
        this.updateAI(elapsedTime);
        this.#updateIsEnabled();
        this.updateView();
    }

    /**
     * 現在のダメージによってオブジェクトの有効無効状態を更新する
     */
    #updateIsEnabled() {
        this.isEnabled = (this.damage < 100);
    }

    /**
     * AI行動の更新
     * @param {double} elapsedTime 経過時間(ms)
     */
    updateAI(elapsedTime) {
    }

    /**
     * 目標速度、目標針路へ向ける
     * @param {double} elapsedTime 経過時間(ms)
     */
    #updateOperation(elapsedTime) {
        this.updateSpeed(elapsedTime);
        this.updateCourse(elapsedTime);
        this.updateDepth(elapsedTime);
    }

    /**
     * 速度の更新
     * @param {number} elapsedTime 経過秒数(ms)
     */
    updateSpeed(elapsedTime) {
        var distSpeed = this.distSpeed;

        if (this.depthState() == SurfaceStatus.periscope || this.depthState() == SurfaceStatus.submerged) {
            // 潜行時は最大速を下げる
            distSpeed *= 0.5
        }

        if (Math.round(this.speed * 10) / 10 === Math.round(this.distSpeed * 10) / 10) {
            this.speed = this.distSpeed;
            return;
        }

        if (!this.isEnabled) {
            this.engineOut = EngineOut.stop;
            distSpeed = 0;
        }

        // 加速量
        // 全速力のときにthis.acceleration秒で目標速度に達する
        var accelerationAmout = (distSpeed - this.speed) / this.acceleration * (elapsedTime / 1000);

        // 速度の更新
        // 速度を上げる
        this.maxSpeed - this.speed
        switch (this.engineOut) {
            case EngineOut.aheadFull:
            case EngineOut.asternFull:
                break;
            case EngineOut.aheadHalf:
            case EngineOut.asternHalf:
                accelerationAmout *= 0.5;
                break;
            case EngineOut.aheadSlow:
            case EngineOut.asternSlow:
                accelerationAmout *= 0.3;
                break;
        }

        this.speed += accelerationAmout;
        // 抵抗による減速(1秒で1kt)
        const decAmount = elapsedTime / 1000;
        if (this.speed > this.distSpeed && this.speed > 0) {
            this.speed -= decAmount;
        }
        else if (this.speed < this.distSpeed && this.speed < 0) {
            this.speed += decAmount;
        }
    }

    /**
     * 針路の更新
     * @param {number} elapsedTime 経過時間
     */
    updateCourse(elapsedTime) {
        if (Math.round(this.course) === Math.round(this.distCourse)) {
            return;
        }

        if (!this.isEnabled) {
            return;
        }

        // 1秒間にspeed * this.rotateSpeed * 0.02°回る
        var rotateSpeed = this.speed * this.rotationSpeed * 0.02 * elapsedTime / 1000;
        rotateSpeed *= rotateSpeed < 0 ? -1 : 1;

        var rotateDiff = this.distCourse - this.course;         // 2つの角度の差を求める
        rotateDiff -= Math.floor(rotateDiff / 360.0) * 360.0;   // 角度差を 0～360に丸める
        if (rotateDiff > 180.0) rotateDiff -= 360.0;            // 角度差を-180~180に丸める

        this.course = rotateDiff < 0 ? this.course - rotateSpeed : this.course + rotateSpeed;
        this.course = this.course < 0 ? this.course + 360 : this.course % 360;
    }

    /**
     * 深度の更新
     */
    updateDepth(elapsedTime) {
        if (!this.isEnabled) {
            // 秒間0.1m沈む
            const speed = elapsedTime / 1000 / 10;
            this.depth += speed;
        }
    }

    /**
     * 魚雷衝突時の動作
     */
    onHitTorpedo() {
    }

    /**
     * 砲弾衝突時の動作
     */
    onHitShell() {
    }

    /**
     * 浮上状態を返す
     * @return {SurfaceStatus} 浮上状態
     */
    depthState() {
        var status;
        if (this.depth <= 5) {
            status = SurfaceStatus.surface;
        } else if (this.depth <= 14) {
            status = SurfaceStatus.periscope;
        } else {
            status = SurfaceStatus.submerged;
        }
        return status;
    }

    /**
     * 座標の更新
     * @param {double} elapsedTime 経過時間(ms)
     */
    #updateCoord(elapsedTime) {
        // 経過時間分移動した座標を設定する
        let radian = Util.degreeToRadian(this.course);
        let elapsedHourTime = elapsedTime / 1000 / 60 / 60;                             // elapsedTimeの単位を(h)に変換
        let distancePerTime = elapsedHourTime * (this.speed * KILO_PER_KNOT) * 1000;    // 現在の速度で経過時間分移動した際の距離(m)

        this.pointX += Math.sin(radian) * distancePerTime;
        this.pointY -= Math.cos(radian) * distancePerTime;
    }

    /**
     * 他オブジェクトとの距離を計測する
     * @param {GameObject} otherObj 計測対象のオブジェクト
     * @return {number} 求める距離
     */
    calcRangeOtherObject(otherObj) {
        return Util.calcDist2Point(new Point(this.pointX, this.pointY), new Point(otherObj.pointX, otherObj.pointY));
    }

    /**
     * 他オブジェクトとの角度を計測する
     * @param {GameObject} otherObj
     * @return {number} 角度(degree)
     */
    calcDirectionOtherObject(otherObj) {
        // 原点(0, 0)を北極とするため座標を反転させる
        var direction = Util.radianToDegree(Math.atan2((otherObj.pointY - this.pointY), otherObj.pointX - this.pointX));
        direction += 90;    // 真東が0となっているので真北を0とする
        direction = direction < 0 ? direction + 360 : direction;
        return direction;
    }

    /**
     * エンジン出力の更新
     * @param {EngineOut} engineOut 目標速度
     */
    updateEngineOut(engineOut) {
        this.engineOut = engineOut;
        // エンジン出力に対する目標速度を設定
        this.distSpeed = this.#enginoutToSpeed(this.engineOut);
    }

    /**
     * 目標針路の更新
     * @param {double} distCourse 目標針路
     */
    updateDistCourse(distCourse) {
        this.distCourse = distCourse;
    }

    /**
     * エンジン出力を速度に変換する
     */
    #enginoutToSpeed() {
        let speed = 0.0;
        switch (this.engineOut) {
            case EngineOut.aheadFull:
                speed = 18.0;
                break;
            case EngineOut.aheadHalf:
                speed = 8.0;
                break;
            case EngineOut.aheadSlow:
                speed = 4.0;
                break;
            case EngineOut.stop:
                speed = 0.0;
                break;
            case EngineOut.asternSlow:
                speed = -4.0;
                break;
            case EngineOut.asternHalf:
                speed = -8.0;
                break;
            case EngineOut.asternFull:
                speed = -12.0;
                break;
        }

        return speed;
    }

    /**
     * ステータスの更新を画面に反映する
     */
    updateView() {
    }

    /**
     * 特定のプロパティ変更時に実行するコールバック関数を追加する
     * @param {string} propName 変更を監視するプロパティ
     * @param {func} func 値変更時に動作するコールバック関数
     */
    watchValue(propName, func) {
        if (!Array.isArray(this.propertyCallbacks.propName)) {
            this.propertyCallbacks.propName = [];
        }
        this.propertyCallbacks.propName.push(func);
        let value = this[propName];
        Object.defineProperty(this, propName, {
            get: () => value,
            set: newValue => {
                const oldValue = value;
                value = newValue;
                this.propertyCallbacks.propName.forEach(function (elem) { elem(oldValue, newValue); });
            },
            configurable: true
        });
    }

    /**
     * オブジェクト種類による設定
     * @param {number} objectType
     */
    #setParamByObjectType(objectType) {
        switch (objectType) {
            case ObjectType.torpedo:
                this.length = 7;
                this.height = 0.533;
                this.width = 0.533;
                this.draft = 0;
                this.maxSpeed = 40;
                this.tonnage = 2;
                break;
            case ObjectType.shell:
                this.length = 0.2;
                this.height = 0.2;
                this.width = 0.2;
                this.draft = 0;
                this.maxSpeed = 1000000 / KILO_PER_KNOT;
                this.tonnage = 0.1;
                break;
            case ObjectType.depthCharge:
                this.length = 0.6;
                this.height = 0.9;
                this.width = 0.6;
                this.draft = 0;
                this.maxSpeed = 1 / KILO_PER_KNOT;
                this.tonnage = 0.5;
                break;
            case ObjectType.uBoatType7C:
                this.length = 66.5;
                this.height = 9.6;
                this.width = 6.2;
                this.draft = 4.7;
                this.maxSpeed = 17.7;
                this.tonnage = 769;
                break;
            case ObjectType.marchant1:
                this.length = 206;
                this.height = 62;
                this.width = 28;
                this.draft = 12;
                this.maxSpeed = 12;
                this.tonnage = 4000;
                break;
            case ObjectType.destoryer1:
                this.length = 139.00;
                this.height = 25;
                this.width = 15;
                this.draft = 4.7;
                this.maxSpeed = 32;
                this.tonnage = 1200;
                break;
        }
    }

    /**
     * オブジェクトをシリアル化する
     * @return {JSON} シリアル化したJSONオブジェクト
     */
    serialize() {
        super.serialize();

        return JSON.stringify({
            isEnabled: this.isEnabled,
            objectType: this.objectType,
            pointX: this.pointX,
            pointY: this.pointY,
            depth: this.depth,
            speed: this.speed,
            maxSpeed: this.maxSpeed,
            course: this.course,
            damage: this.damage,
            acceleration: this.acceleration,
            rotationSpeed: this.rotationSpeed,
            engineOut: this.engineOut,
            distSpeed: this.distSpeed,
            distCourse: this.distCourse,
        });
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {GameObject} 生成したオブジェクト
     */
    static deserialize(json) {
        const obj = new GameObject();
        obj.isEnabled = json.isEnabled;
        obj.objectType = json.objectType;
        obj.pointX = json.pointX;
        obj.pointY = json.pointY;
        obj.depth = json.depth;
        obj.speed = json.speed;
        obj.maxSpeed = json.maxSpeed;
        obj.course = json.course;
        obj.damage = json.damage;
        obj.acceleration = json.acceleration;
        obj.rotationSpeed = json.rotationSpeed;
        obj.engineOut = json.engineOut;
        obj.distSpeed = json.distSpeed;
        obj.distCourse = json.distCourse;
        return obj;
    }
}
