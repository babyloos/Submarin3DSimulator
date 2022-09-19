import { EnemyShipStatus, KILO_PER_KNOT, ObjectType } from "../constants.js";
import { Util } from "../util.js";
import { EnemyShip } from "./enemyShip.js";
import { Point } from "./point.js";

/**
 * 商船クラス
 */
export class Marchant extends EnemyShip {

    // 対潜航行中の同コース進行距離
    cautionCourseDist = 0;

    // 対潜航行中の同コース進行済の距離
    cautionCourseTraveledDist = 0;

    // 対潜航行中の変針路量
    cautionCourseAngle = 90;

    /**
     * コンストラクタ
     * @param {number} convoyId 船団ID
     * @param {Point} pointX X座標
     * @param {Point} pointY Y座標
     * @param {double} course 針路(deg)
     * @param {double} bassSpeed 基本スピード(kt)
     */
    constructor(convoyId, pointX, pointY, course, bassSpeed) {
        super(convoyId, ObjectType.marchant1, pointX, pointY, course, bassSpeed);

        this.cautionCourseDist = Util.getRandomArbitrary(this.length, this.length * 5);
    }

    /**
     * 現在のステータスによる行動
     * @param {double} elapsedTime 経過時間(ms) 
     */
    actionByCurrentStatus(elapsedTime) {
        super.actionByCurrentStatus();

        const status = this.enemyShipStatus;
        switch (status) {
            case EnemyShipStatus.usually:
                // baseSpeedで目標針路に向かう
                this.distCourse = this.bassCourse;
                this.distSpeed = this.bassSpeed;
                break;
            case EnemyShipStatus.alarm:
            case EnemyShipStatus.caution:
                // 対潜航行を行う
                this.distSpeed = this.maxSpeed;
                if (this.cautionCourseDist <= this.cautionCourseTraveledDist) {
                    // 針路を変更する
                    this.cautionCourseTraveledDist = 0;
                    if (this.distCourse >= this.bassCourse) {
                        this.distCourse = Util.arrangeCourseDig(this.bassCourse - (this.cautionCourseAngle * Math.random()));
                    } else {
                        this.distCourse = Util.arrangeCourseDig(this.bassCourse + (this.cautionCourseAngle * Math.random()));
                    }
                }
                const speedSecMeter = (this.speed * KILO_PER_KNOT) * 1000 / 3600;
                const shipMoveRange = speedSecMeter * elapsedTime / 1000;
                this.cautionCourseTraveledDist += shipMoveRange;
                break;
        }
    }

    /**
     * オブジェクトをシリアル化する
     * @return {string} シリアル化したstring
     */
    serialize() {
        const json = JSON.parse(super.serialize());

        json.cautionCourseDist = this.cautionCourseDist;
        json.cautionCourseTraveledDist = this.cautionCourseTraveledDist;
        json.cautionCourseAngle = this.cautionCourseAngle;

        return JSON.stringify(json);
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {Uboat} 生成したオブジェクト
     */
    static deserialize(json) {
        const gameObj = super.deserialize(json);

        const obj = new Marchant(json.convoyId, gameObj.pointX, gameObj.pointY, gameObj.bassCourse, gameObj.bassSpeed);
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

        obj.cautionCourseDist = json.cautionCourseDist;
        obj.cautionCourseTraveledDist = json.cautionCourseTraveledDist;
        obj.cautionCourseAngle = json.cautionCourseAngle;
        return obj;
    }
}