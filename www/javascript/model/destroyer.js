import { EnemyShipStatus, KILO_PER_KNOT, ObjectType, SurfaceStatus } from "../constants.js";
import { Util } from "../util.js";
import { DepthCharge } from "./depthCharge.js";
import { EnemyShip } from "./enemyShip.js";
import { Point } from "./point.js";
import { Shell } from "./shell.js";

/**
 * 駆逐艦クラス
 */
export class Destroyer extends EnemyShip {

    shells;                         // 射出した砲弾
    fireShellElapsedTime = 0;       // 前回砲弾射出からの経過時間(ms)
    shellfireRate = 5000;           // 砲弾射出必要待機時間(ms)

    depthCharges;                   // 投擲した爆雷
    fireDepthChargeElapsedTime = 0; // 前回投擲からの経過時間(ms)
    depthChargeFireRate = 1000;     // 爆雷投擲必要待機時間(ms)

    /**
     * コンストラクタ
     * @param {number} convoyId 船団ID
     * @param {number} pointX X座標
     * @param {number} pointY Y座標
     * @param {double} course 針路(deg)
     * @param {double} bassSpeed 基本スピード(kt)
     */
    constructor(convoyId, pointX, pointY, bassCourse, bassSpeed) {
        super(convoyId, ObjectType.destoryer1, pointX, pointY, bassCourse, bassSpeed);

        this.shells = new Array();
        this.depthCharges = new Array();
    }

    /**
     * 状態の更新
     * 1フレームごとに呼ばれる
     * @param {double} elapsedTime 経過時間(ms)
     */
    update(elapsedTime) {
        super.update(elapsedTime);
        this.#updateShells(elapsedTime);
        this.#updateDepthCharges(elapsedTime);
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
                // 最終発見地点に向かう
                this.distSpeed = this.maxSpeed;
                const newCourse = this.#calcDirectionToUboat();
                this.distCourse = newCourse;
                // uBoatに対する攻撃を行う
                this.#atack(newCourse, elapsedTime);
                break;
        }
    }

    /**
     * 砲弾の更新
     * @param {number} elapsedTime 経過時間
     */
    #updateShells(elapsedTime) {
        this.shells.forEach(function (shell) {
            if (shell.isEnabled) {
                shell.update(elapsedTime);
            }
        });
    }

    /**
     * 爆雷の更新
     * @param {number} elapsedTime 経過時間
     */
    #updateDepthCharges(elapsedTime) {
        this.depthCharges.forEach(function (depthCharge) {
            if (depthCharge.isEnabled) {
                depthCharge.update(elapsedTime);
            }
        });
    }

    /**
     * uBoatの最終発見地点までの針路を計算する
     */
    #calcDirectionToUboat() {
        const uBoatPoint = this.foundUboatPosition;
        const selfPoint = new Point(this.pointX, this.pointY);
        const bearingRad = Util.calcAngle2Point(selfPoint, uBoatPoint);
        const distCourseDeg = Util.arrangeCourseDig(Util.radianToDegree(bearingRad) + 90); // 針路の回転系に合わせるため+90°する
        return distCourseDeg;
    }

    /**
     * uBoatへの攻撃を行う
     * @param {number} course 砲撃方向
     * @param {number} elapsedTime 経過時間
     */
    #atack(course, elapsedTime) {
        const range = this.#calcRangeToUBoat();
        if (this.playerBoat.depthState() === SurfaceStatus.surface) {
            // uBoat浮上中は砲撃を行う
            // 距離2000m以内なら砲撃を行う
            if (range <= 2000) {
                this.#fireShell(course, elapsedTime);
            }
        } else {
            // uBoat潜水中は爆雷攻撃を行う
            // 距離300m以内なら爆雷攻撃を行う
            if (range <= 300) {
                this.#fireDepthCharge(elapsedTime, range);
            }
        }
    }

    /**
     * 砲弾の射出
     * @param {number} course 目標への針路
     * @param {number} elapsedTime 経過時間(ms)
     */
    #fireShell(course, elapsedTime) {
        if (!this.#canFireShell()) {
            this.fireShellElapsedTime += elapsedTime;
            return;
        }

        const targetPoint = new Point(this.playerBoat.pointX, this.playerBoat.pointY);
        const fireAngle = this.#calcFireAngle(targetPoint);
        const fireCourse = Util.arrangeCourseDig(Util.getRandomArbitrary(course - 5, course + 5));
        const shell = new Shell(this.pointX, this.pointY, fireCourse, fireAngle);
        this.shells.push(shell);
        this.fireShellElapsedTime = 0;
    }

    #canFireShell() {
        let canFire = false;
        if (this.fireShellElapsedTime >= this.shellfireRate) {
            canFire = true;
        }

        return canFire;
    }

    /**
     * 爆雷の投擲
     * @param {number} elapsedTime 経過時間(ms)
     * @param {number} range uBoatと駆逐艦との距離
     */
    #fireDepthCharge(elapsedTime, range) {
        if (!this.#canfireDepthCharge()) {
            this.fireDepthChargeElapsedTime += elapsedTime;
            return;
        }

        // 甲板最後端から投擲する
        const pointX = this.pointX + this.length / 2 * Math.cos(Util.degreeToRadian(this.course + 90));
        const pointY = this.pointY + this.length / 2 * Math.sin(Util.degreeToRadian(this.course + 90));
        const course = Util.arrangeCourseDig(this.course + 90);
        const fireDepth = this.#calcFireDepth(range, this.playerBoat.depth);
        const depthCharge = new DepthCharge(pointX, pointY, course, fireDepth, this.playerBoat);
        this.depthCharges.push(depthCharge);
        this.fireDepthChargeElapsedTime = 0;
        if (this.depthCharges.length % 20 === 0) {
            this.depthChargeFireRate = 30000;
        } else {
            this.depthChargeFireRate = 1000;
        }
    }

    /**
     * 爆雷の起爆深度を計算する
     * @param {number} range uBoatと駆逐艦との距離
     * @param {number} uBoatDepth uBoatの深度
     * @return 起爆深度
     */
    #calcFireDepth(range, uBoatDepth) {
        // uBoatとの距離に応じて誤差を計算する
        const fireRange = range / 2;
        let fireDepth = uBoatDepth + Util.getRandomArbitrary(-fireRange, fireRange);
        if (fireDepth <= 5) {
            fireDepth = 5;
        }
        return fireDepth;
    }

    #canfireDepthCharge() {
        let canFire = false;
        if (this.fireDepthChargeElapsedTime >= this.depthChargeFireRate) {
            canFire = true;
        }

        return canFire;
    }

    /**
     * 目標距離、初速から迎角を求める
     * @return {number} 発射角(deg)
     */
    #calcFireAngle() {
        const range = this.#calcRangeToUBoat();
        var angleMin = 0;
        var angleMax = 0;
        if (range <= 500) {
            angleMin = 0.0000;
            angleMax = 0.0001;
        } else if (range <= 1000) {
            angleMin = 0.05;
            angleMax = 0.07;
        } else if (range <= 2000) {
            angleMin = 0.3;
            angleMax = 0.35;
        }
        const angle = Util.getRandomArbitrary(angleMin, angleMax);
        return angle;
    }

    /**
     * uBoatとの距離を計算する
     * @return {number} uBoatとの距離
     */
    #calcRangeToUBoat() {
        const selfPoint = new Point(this.pointX, this.pointY);
        const uBoatPoint = new Point(this.playerBoat.pointX, this.playerBoat.pointY);
        const range = Util.calcDist2Point(selfPoint, uBoatPoint);
        return range;
    }

    /**
     * オブジェクトをシリアル化する
     * @return {string} シリアル化したstring
     */
    serialize() {
        const json = JSON.parse(super.serialize());

        let jsonShells = [];
        this.shells.forEach(function (shell) {
            const jsonShell = JSON.parse(shell.serialize());
            jsonShells.push(jsonShell);
        });
        json.shells = jsonShells;
        json.fireShellElapsedTime = this.fireShellElapsedTime;
        json.shellfireRate = this.shellfireRate;
        let jsonDepthCharges = [];
        this.depthCharges.forEach(function (depthCharge) {
            const jsonDepthCharge = JSON.parse(depthCharge.serialize());
            jsonDepthCharges.push(jsonDepthCharge);
        });
        json.depthCharges = jsonDepthCharges;
        json.fireDepthChargeElapsedTime = this.fireDepthChargeElapsedTime;
        json.depthChargeFireRate = this.depthChargeFireRate;

        return JSON.stringify(json);
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {Uboat} 生成したオブジェクト
     */
    static deserialize(json) {
        const gameObj = super.deserialize(json);

        const obj = new Destroyer(json.convoyId, gameObj.pointX, gameObj.pointY, gameObj.bassCourse, gameObj.bassSpeed);
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

        json.shells.forEach(function (jsonShell) {
            const shell = Shell.deserialize(jsonShell);
            obj.shells.push(shell);
        });
        obj.fireShellElapsedTime = json.fireShellElapsedTime;
        obj.shellfireRate = json.shellfireRate;
        json.depthCharges.forEach(function (jsonDepthCharge) {
            const depthCharge = DepthCharge.deserialize(jsonDepthCharge);
            obj.depthCharges.push(depthCharge);
        })
        obj.fireDepthChargeElapsedTime = json.fireDepthChargeElapsedTime;
        obj.depthChargeFireRate = json.depthChargeFireRate;
        return obj;
    }
}