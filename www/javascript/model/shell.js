import { GRAV_ACCE, KILO_PER_KNOT, ObjectType } from "../constants.js";
import { Util } from "../util.js";
import { GameObject } from "./gameObject.js";
import { Point } from "./point.js";

/**
 * 砲弾クラス
 */
export class Shell extends GameObject {

    // 合計航走距離(m)
    cruissingDistance;

    // 航走可能距離(m)
    navigableDistance = 5000;

    // 発射後経過時間(ms)
    elapsedFiredTime = 0;

    // 深度(高度)
    depth = 0;

    // 発射角(0~90°)
    angleOfAtack;

    /**
     * コンストラクタ
     * @param {number} pointX X座標
     * @param {number} pointY Y座標
     * @param {number} course 針路(deg)
     * @param {number} angleOfAtack 発射迎角(deg)
     */
    constructor(pointX, pointY, course, angleOfAtack) {
        super(ObjectType.shell, pointX, pointY, course, 0, 0);

        this.course = course;
        this.distCourse = this.course;
        this.angleOfAtack = angleOfAtack;
        this.speed = this.maxSpeed;
        this.distSpeed = this.maxSpeed;
    }

    /**
     * 状態の更新
     * 1フレームごとに呼ばれる
     * @param {double} elapsedTime 経過時間(ms)
     */
    update(elapsedTime) {
        // 水平方向の移動
        // vx = v*CosΘ
        const speed = (this.speed / 1000 * KILO_PER_KNOT);                              // kt→m/sに変換
        const angleOfAtackRad = Util.degreeToRadian(this.angleOfAtack);
        const vector = this.calcVectorOneFrame(elapsedTime, speed, angleOfAtackRad);
        this.pointX += vector.x;
        this.pointY += vector.y;
        // 高さ方向の移動
        // vy = v*SinΘ-gt
        this.depth = -(speed * Math.sin(angleOfAtackRad) * (this.elapsedFiredTime / 1000)) + (0.5 * GRAV_ACCE * Math.pow(this.elapsedFiredTime / 1000, 2));
        this.elapsedFiredTime += elapsedTime;

        // 水面に落下したら砲弾を無効化する
        if (this.depth > 1) {
            this.isEnabled = false;
            return;
        }
    }

    /**
     * 1フレームでの移動量を計算する
     * @param {number} elapsedTime 経過時間
     * @return {Point} 移動量
     */
    calcVectorOneFrame(elapsedTime) {
        const speed = (this.speed / 1000 * KILO_PER_KNOT);                              // kt→m/sに変換
        const angleOfAtackRad = Util.degreeToRadian(this.angleOfAtack);
        const distancePerTime = (elapsedTime / 1000) * (speed);                         // 現在の速度で経過時間分移動した際の距離(m)
        const vHorizon = distancePerTime * Math.cos(angleOfAtackRad);                   // 1フレームでの水平方向移動量
        const courseRad = Util.degreeToRadian(Util.calcAngleForCalc(this.course));
        return new Point(Math.cos(courseRad) * vHorizon, -Math.sin(courseRad) * vHorizon);
    }

    /**
     * 深度(高度)の更新
     * @param {number} 経過時間
     */
    updateDepth(elapsedTime) {
        super.updateDepth(elapsedTime);
    }

    /**
     * 砲弾衝突時の動作
     */
    onHitShell() {
        super.onHitShell();
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
        json.elapsedFiredTime = this.elapsedFiredTime;
        json.depth = this.depth;
        json.angleOfAtack = this.angleOfAtack;

        return JSON.stringify(json);
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {Uboat} 生成したオブジェクト
     */
    static deserialize(json) {
        const gameObj = super.deserialize(json);

        const obj = new Shell(gameObj.pointX, gameObj.pointY, gameObj.course, json.angleOfAtack);
        obj.isEnabled = gameObj.isEnabled;
        // obj.objectType = gameObj.objectType;
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
        obj.elapsedFiredTime = json.elapsedFiredTime;
        obj.depth = json.degreeToRadian;
        // obj.angleOfAtack = json.angleOfAtack
        return obj;
    }
}