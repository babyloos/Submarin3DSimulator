import { KILO_PER_KNOT } from "../constants.js";
import { Util } from "../util.js";
import { Serializable } from "./Serializable.js";

/**
 * T.D.C(Torpedo Data Computer)
 */
export class TDC extends Serializable {

    bearing = 0;
    range = 1000;
    angleOnBow = 0;
    targetSpeed = 0;
    torpedoSpeed = 0;
    gyroAngle = 0;
    hitTime = 0;

    onUpdateTdcAction;  // TDCの設定値更新時に行う処理

    /**
     * コンストラクタ
     */
    constructor() {
        super();
    }

    /**
     * 諸元を入力する
     * @param {number} bearing 自艦から見た目標の角度(degree)
     * @param {number} range 自艦と目標の距離(m)
     * @param {number} angleOnBow 目標から見た自艦の角度(degree)
     * @param {number} targetSpeed 目標の速度(kt)
     * @param {number} torpedoSpeed 魚雷速度(kt)
     * @return {array} [gyroAngle, hitTime]
     */
    setSpec(bearing, range, angleOnBow, targetSpeed, torpedoSpeed = 40) {
        this.bearing = bearing;
        this.range = range;
        this.angleOnBow = angleOnBow;
        this.targetSpeed = targetSpeed;
        this.torpedoSpeed = torpedoSpeed;
        const result = this.#calcAngle(this.bearing, this.range, this.angleOnBow, this.targetSpeed, this.torpedoSpeed);
        this.gyroAngle = result[0];
        this.hitTime = result[1];

        this.onUpdateTdc(result);
        return result;
    }

    /**
     * 魚雷の射角を計算する
     */
    #calcAngle(bearing, range, angleOfBow, targetSpeed, torpedoSpeed) {
        // 目標の針路を計算する
        let relativeCourse;
        let angle1 = Math.abs(bearing);
        let angle2 = Math.abs(angleOfBow);

        angle1 = angle1 > 90 ? 180 - angle1 : angle1;
        angle2 = angle2 > 90 ? 180 - angle2 : angle2;

        relativeCourse = angle1 + angle2;
        relativeCourse = angleOfBow < 0 ? -relativeCourse : relativeCourse;
        relativeCourse = Math.abs(bearing) > 90 ? -relativeCourse : relativeCourse;

        // 魚雷の到達時間(秒)を計算する
        const torSpeedSecMater = (torpedoSpeed * KILO_PER_KNOT) * 1000 / 3600 // 魚雷速度をktから秒/mに変換
        const hitTime = range / torSpeedSecMater;

        // 魚雷到達時刻の目標位置(魚雷衝突位置)を計算する
        const targetSpeedSecMeter = (targetSpeed * KILO_PER_KNOT) * 1000 / 3600 // 目標速度をktから秒/mに変換
        const enemyShipMoveRange = hitTime * targetSpeedSecMeter;
        const angleForCalcEnemyPos = bearing;
        const angleForCalcEnemyHitPoint = relativeCourse;
        const enemyShipPosX = range * Util.sin(angleForCalcEnemyPos);
        const enemyShipPosY = range * Util.cos(angleForCalcEnemyPos);
        const hitPointX = enemyShipPosX + enemyShipMoveRange * (Util.sin(angleForCalcEnemyHitPoint));
        const hitPointY = enemyShipPosY + enemyShipMoveRange * (Util.cos(angleForCalcEnemyHitPoint));

        // 魚雷衝突位置の方向を計算する
        var gyroAngle = Math.atan2(hitPointY, hitPointX);
        var gyroAngleDeg = gyroAngle * (180 / Math.PI);
        var gyroAngleDegFix = (gyroAngleDeg - 90.0) * -1.0;
        return [parseFloat(gyroAngleDegFix.toFixed(2)), parseInt(Math.round(hitTime))]
    }

    /**
     * TDCの値更新時の処理
     */
    onUpdateTdc(result) {
        this.onUpdateTdcAction(result);
    }

    /**
     * 回転度数を上始始まり右周りから右始まり左周りに変換する
     * @param {number} angle ワールド回転系(上始まり0~359右回り)
     * @param {number} 三角関数での回転系(右始まり0~359左回り)
     */
    #calcAngleForCalc(angle) {
        // 左回転に直す
        const result = 360 - angle;
        return result;
    }

    /**
     * オブジェクトをシリアル化する
     * @return {string} シリアル化したstring
     */
    serialize() {
        const json = JSON.parse(super.serialize());

        json.bearing = this.bearing;
        json.range = this.range;
        json.angleOfBow = this.angleOnBow;
        json.torpedoSpeed = this.torpedoSpeed;
        json.targetSpeed = this.targetSpeed;
        json.gyroAngle = this.gyroAngle;
        json.hitTime = this.hitTime;

        return JSON.stringify(json);
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {Uboat} 生成したオブジェクト
     */
    static deserialize(json) {
        const obj = new TDC();
        obj.bearing = json.bearing;
        obj.range = json.range;
        obj.angleOnBow = json.angleOfBow;
        obj.torpedoSpeed = json.torpedoSpeed;
        obj.targetSpeed = json.targetSpeed;
        obj.gyroAngle = json.gyroAngle;
        obj.hitTime = json.hitTime;

        return obj;
    }
}