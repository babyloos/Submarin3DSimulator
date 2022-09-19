import { EnemyShipStatus, EngineOut, ObjectType, SurfaceStatus } from "../constants.js";
import { Util } from "../util.js";
import { GameObject } from "./gameObject.js";
import { Point } from "./point.js";
import { Uboat } from "./uBoat.js";

/**
 * 敵船(商船、駆逐艦)クラス
 */
export class EnemyShip extends GameObject {

    // 船団ID
    convoyId;

    // 基本スピード(kt)
    bassSpeed;

    // 基本針路(deg)
    bassCourse;

    // 敵船ステータス
    enemyShipStatus;

    // 浮上中のuBoatを発見できる距離
    visibilityRangeSurface;

    // 潜望鏡深度のuBoatを発見できる距離
    visibilityRangePeriscopeDepth;

    // 参照先のuBoat
    playerBoat;

    // 発見時のuBoatの座標
    foundUboatPosition = new Point(0, 0);

    // uBoat発見からの経過時間(ms)
    foundUboatElapsedTime = 0;

    // 撃沈された際の処理
    onSunk;

    /**
     * コンストラクタ
     * @param {number} convoyId 船団ID
     * @param {ObjectType} objectType 船の種類
     * @param {number} pointX X座標
     * @param {number} pointY Y座標
     * @param {number} bassCourse 針路(deg)
     * @param {number} bassSpeed 基本スピード(kt)
     */
    constructor(convoyId, objectType, pointX, pointY, bassCourse, bassSpeed) {
        super(objectType, pointX, pointY, bassCourse, 0, 50, 10);

        this.convoyId = convoyId;

        this.bassSpeed = bassSpeed;
        this.distSpeed = this.bassSpeed;
        this.bassCourse = bassCourse;
        this.distCourse = this.bassCourse;

        this.enemyShipStatus = EnemyShipStatus.usually;

        this.#setVisibilityRange(objectType);
    }

    /**
     * 初期設定を行う
     * @param {Uboat} playerBoat プレイヤボートへの参照
     * @param {Function} onSunk 撃沈された際の処理
     */
    initialize(playerBoat, onSunk) {
        this.playerBoat = playerBoat;
        this.onSunk = onSunk;
    }

    /**
     * AI行動の更新(毎フレーム呼ばれる)
     * @param {double} elapsedTime 経過時間(ms)
     */
    updateAI(elapsedTime) {
        super.updateAI(elapsedTime);
        if (this.isEnabled) {
            this.#updateEnemyShipStatus(elapsedTime);
            this.actionByCurrentStatus(elapsedTime);
        } else {
            this.enemyShipStatus = EnemyShipStatus.usually;
            this.updateEngineOut(EngineOut.stop);
            this.distSpeed = 0;
        }
    }

    /**
     * 現在のステータスによる行動
     * @param {double} elapsedTime 経過時間(ms)
     */
    actionByCurrentStatus(elapsedTime) {
    }

    /**
     * 発見状態の更新
     * @param {number} elapsedTime 経過時間(ms)
     */
    #updateEnemyShipStatus(elapsedTime) {
        const range = Util.calcDist2ObjectThree(this, this.playerBoat);
        let isFoundUboat = false;
        if (this.playerBoat.depthState() === SurfaceStatus.surface) {
            if (range <= this.visibilityRangeSurface) {
                isFoundUboat = true;
            }
        } else if (this.playerBoat.depthState() === SurfaceStatus.periscope) {
            if (range <= this.visibilityRangePeriscopeDepth) {
                isFoundUboat = true;
            }
        } else if (this.playerBoat.depthState() === SurfaceStatus.submerged) {
            if (this.objectType === ObjectType.destoryer1) {
                if (range <= this.#getVisibilityRangeSubmerged()) {
                    isFoundUboat = true;
                }
            }
        }

        if (isFoundUboat) {
            // 発見時
            this.enemyShipStatus = EnemyShipStatus.alarm;
            this.foundUboatPosition = new Point(this.playerBoat.pointX, this.playerBoat.pointY);
            this.foundUboatElapsedTime = 0;
        } else {
            // 未発見 or 見失った
            if (this.enemyShipStatus === EnemyShipStatus.alarm) {
                // alarmから見失った場合
                this.foundUboatElapsedTime += elapsedTime;
                this.enemyShipStatus = EnemyShipStatus.caution;
            } else if (this.enemyShipStatus === EnemyShipStatus.caution) {
                // caution中
                this.foundUboatElapsedTime += elapsedTime;
                if (this.foundUboatElapsedTime >= 30 * 60 * 1000) {
                    // 再発見できずに30分経過した場合
                    this.enemyShipStatus = EnemyShipStatus.usually;
                }
            }
        }
    }

    /**
     * 潜行中のuBoatを探知できる距離を取得する
     * @return {number} 探知可能距離
     */
    #getVisibilityRangeSubmerged() {
        const uBoat = this.playerBoat;
        let range = 0;
        switch (uBoat.engineOut) {
            case EngineOut.aheadFull || EngineOut.asternFull:
                range = 1600;
                break;
            case EngineOut.aheadHalf || EngineOut.asternHalf:
                range = 700;
                break;
            case EngineOut.aheadSlow || EngineOut.asternSlow:
                range = 50;
                break;
        }

        return range;
    }

    /**
     * 魚雷衝突時の動作
     */
    onHitTorpedo() {
        super.onHitTorpedo();
        this.damage += 100;
        if (this.damage >= 50) {
            this.maxSpeed = 1;
            this.distSpeed = 1;
        }
        if (this.damage >= 100) {
            this.distSpeed = 0;
            this.isEnabled = false;
            // 敵船撃沈時処理
            this.onSunk(this.tonnage);
        }
    }

    /**
     * 深度の更新
     */
    updateDepth(elapsedTime) {
        super.updateDepth(elapsedTime);
    }

    /**
     * 船の種類によるuBoat発見条件を設定する
     * @param {ObjectType} objType 船の種類
     */
    #setVisibilityRange(objType) {
        switch (objType) {
            case ObjectType.marchant1:
                this.visibilityRangeSurface = 4440;
                break;
            case ObjectType.destoryer1:
                this.visibilityRangeSurface = 4810;
                break;
        }
        this.visibilityRangePeriscopeDepth = 920;
    }

    /**
     * オブジェクトをシリアル化する
     * @return {string} シリアル化したstring
     */
    serialize() {
        const json = JSON.parse(super.serialize());

        json.convoyId = this.convoyId;
        json.bassSpeed = this.bassSpeed;
        json.bassCourse = this.bassCourse;
        json.enemyShipStatus = this.enemyShipStatus;
        json.visibilityRangeSurface = this.visibilityRangeSurface;
        json.visibilityRangePeriscopeDepth = this.visibilityRangePeriscopeDepth;
        json.visibilityRangeSubmerged = this.visibilityRangeSubmerged;
        json.foundUboatPosition = JSON.parse(this.foundUboatPosition.serialize());
        json.foundUboatElapsedTime = this.foundUboatElapsedTime;

        return JSON.stringify(json);
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {Uboat} 生成したオブジェクト
     */
    static deserialize(json) {
        const gameObj = super.deserialize(json);

        const obj = new EnemyShip(json.convoyId, json.objectType, json.pointX, json.pointY, json.bassCourse, json.bassSpeed);
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

        obj.enemyShipStatus = json.enemyShipStatus;
        obj.visibilityRangeSurface = json.visibilityRangeSurface;
        obj.visibilityRangePeriscopeDepth = json.visibilityRangePeriscopeDepth
        obj.foundUboatPosition = Point.deserialize(json.foundUboatPosition);
        obj.foundUboatElapsedTime = json.foundUboatElapsedTime;

        return obj;
    }
}