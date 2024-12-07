import { KILO_PER_KNOT, ObjectType } from "../constants.js";
import { GameObject } from "./gameObject.js";

/**
 * 魚雷クラス
 */
export class Torpedo extends GameObject {

    // 合計航走距離(m)
    cruissingDistance = 0;

    // 航走可能距離(m)
    navigableDistance = 8000;

    depth = 0;

    /**
     * コンストラクタ
     * @param {double} pointX X座標
     * @param {double} pointY Y座標
     * @param {double} depth 深度
     */
    constructor(pointX, pointY, depth) {
        super(ObjectType.torpedo, pointX, pointY, 0, 0, 3, 10);
        this.depth = depth;
    }

    /**
     * 初期設定を行う
     * @param {number} uboatCourse 魚雷発射を行うuboatの針路
     * @param {number} uboatSpeed 魚雷発射を行うuboatの速度
     * @param {number} gyroAngle ジャイロアングル
     * @param {number} speed 魚雷速度
     * @param {number} distDepth 設定深度
     */
    initialize(uboatCourse, uboatSpeed, gyroAngle, distDepth) {
        this.course = uboatCourse;
        const course = (uboatCourse + gyroAngle);
        this.distCourse = course >= 360 ? course - 360 : course;
        this.speed = uboatSpeed;
        this.distSpeed = this.maxSpeed;
        this.distDepth = distDepth;
    }

    /**
     * 状態の更新
     * 1フレームごとに呼ばれる
     * @param {double} elapsedTime 経過時間(ms)
     */
    update(elapsedTime) {
        super.update(elapsedTime);

        // 合計航走距離(m)の更新
        const elapsedHourTime = elapsedTime / 1000 / 60 / 60;                             // elapsedTimeの単位を(h)に変換
        const distancePerTime = elapsedHourTime * (this.speed * KILO_PER_KNOT) * 1000;    // 現在の速度で経過時間分移動した際の距離(m)
        this.cruissingDistance += distancePerTime;

        // 合計航走距離が航走可能距離を超えた場合魚雷を無効化する
        if (this.cruissingDistance > this.navigableDistance) {
            this.isEnabled = false;
        }
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

        if (Math.round(this.depth * 10) / 10 === Math.round(this.distDepth * 10) / 10) {
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
     * 魚雷衝突時の動作
     */
    onHitTorpedo() {
        super.onHitTorpedo();
        this.isEnabled = false;
    }

    /**
     * オブジェクトをシリアル化する
     * @return {string} シリアル化したstring
     */
    serialize() {
        const json = JSON.parse(super.serialize());

        json.cruissingDistance = this.cruissingDistance;
        json.navigableDistance = this.navigableDistance;
        json.depth = this.depth;

        return JSON.stringify(json);
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {Uboat} 生成したオブジェクト
     */
    static deserialize(json) {
        const gameObj = super.deserialize(json);

        const obj = new Torpedo(gameObj.pointX, gameObj.pointY);
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

        obj.cruissingDistance = json.cruissingDistance;
        obj.navigableDistance = json.navigableDistance;
        obj.depth = json.depth;

        return obj;
    }
}