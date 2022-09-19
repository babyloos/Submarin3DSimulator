import { GRAV_ACCE, KILO_PER_KNOT, ObjectType } from "../constants.js";
import { Util } from "../util.js";
import { GameObject } from "./gameObject.js";
import { Point } from "./point.js";

/**
 * 爆雷用クラス
 */
export class DepthCharge extends GameObject {

    // 深度(高度)
    depth = 0;

    // 発射角(0~90°)
    angleOfAtack;

    // 起爆深度
    fireDepth;

    // 発射後経過時間(ms)
    elapsedFiredTime = 0;

    // X軸回転角度(rad)
    rotateX = 0;

    // Y軸回転角度(rad);
    rotateY = 0;

    // Z軸回転角度(rad)
    rotateZ = 0;

    // 回転速度(rad/s)
    rotateSpeed = 0;

    // 参照先のプレイヤボート
    playerBoat;

    /**
     * コンストラクタ
     * @param {number} pointX X座標
     * @param {number} pointY Y座標
     * @param {number} course 投擲方向
     * @param {number} fireDepth 起爆深度
     * @param {number} playerBoat 参照先のプレイヤボート
     */
    constructor(pointX, pointY, course, fireDepth, playerBoat) {
        super(ObjectType.depthCharge, pointX, pointY, course, 0, 0);

        this.course = course;
        this.distCourse = this.course;
        this.speed = this.maxSpeed;
        this.distSpeed = this.maxSpeed;
        this.fireDepth = fireDepth;
        this.angleOfAtack = 1;

        this.playerBoat = playerBoat;

        this.rotateX = Util.getRandomArbitrary(0, 2 * Math.PI);
        this.rotateY = Util.getRandomArbitrary(0, 2 * Math.PI);
        this.rotateZ = Util.getRandomArbitrary(0, 2 * Math.PI);
        this.rotateSpeed = Util.getRandomArbitrary(0, 2 * Math.PI / 5);
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
        var dropDownSpeed = (speed * Math.sin(angleOfAtackRad) * (this.elapsedFiredTime / 1000)) + (0.5 * GRAV_ACCE * Math.pow(this.elapsedFiredTime / 1000, 2));
        // 水中では落下速度を1/10にする
        if (this.depth > 0) {
            dropDownSpeed /= 10;
        }
        this.depth = dropDownSpeed;
        this.elapsedFiredTime += elapsedTime;

        // 回転
        this.rotateX += this.rotateSpeed * (elapsedTime / 1000);
        this.rotateY += this.rotateSpeed * (elapsedTime / 1000);
        this.rotateZ += this.rotateSpeed * (elapsedTime / 1000);
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
     * オブジェクトをシリアル化する
     * @return {string} シリアル化したstring
     */
    serialize() {
        const json = JSON.parse(super.serialize());

        json.depth = this.depth;
        json.angleOfAtack = this.angleOfAtack;
        json.fireDepth = this.fireDepth;
        json.elapsedFiredTime = this.elapsedFiredTime;
        json.rotateX = this.rotateX;
        json.rotateY = this.rotateY;
        json.rotateZ = this.rotateZ;
        json.rotateSpeed = this.rotateSpeed;

        return JSON.stringify(json);
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {Uboat} 生成したオブジェクト
     */
    static deserialize(json) {
        const gameObj = super.deserialize(json);

        const obj = new DepthCharge(gameObj.pointX, gameObj.pointY, gameObj.course, json.fireDepth);
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

        obj.depth = json.depth;
        obj.angleOfAtack = json.angleOfAtack;
        // obj.fireDepth = json.fireDepth;
        obj.elapsedFiredTime = json.elapsedFiredTime;
        obj.rotateX = json.rotateX;
        obj.rotateY = json.rotateY;
        obj.rotateZ = json.rotateZ;
        obj.rotateSpeed = json.rotateSpeed;
        return obj;
    }
}