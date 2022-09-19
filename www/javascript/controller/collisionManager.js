import { ObjectType } from "../constants.js";
import { GameObject } from "../model/gameObject.js";
import { Point } from "../model/point.js";
import { Rectangle } from "../model/rectangle.js";
import { Uboat } from "../model/uBoat.js";
import { Util } from "../util.js";
import { ThreeViewController } from "./threeViewController.js";

/**
 * 当たり判定計算クラス
 */
export class CollisionManager {

    uboat;
    enemyShips;
    threeViewController;

    /**
     * コンストラクタ
     */
    constructor() {
    }

    /**
     * 初期設定
     * @param {Uboat} uboat 参照するuBoat
     * @param {Array} enemyShips 追加するゲームオブジェクトの配列
     * @param {ThreeViewController} threeViewController エフェクト発生用に参照する3Dコントローラ
     */
    initialize(uboat, enemyShips, threeViewController) {
        this.uboat = uboat;
        this.enemyShips = enemyShips;
        this.threeViewController = threeViewController;
    }

    /**
     * uBoatの参照を設定
     * @param {Uboat} uboat 参照するuBoat
     */
    setUboat(uboat) {
        this.uboat = uboat;
    }

    /**
     * 各オブジェクトに対して衝突判定を行う
     * 毎フレーム呼ばれる
     * @param {number} elapsedTime 経過時間
     */
    update(elapsedTime) {
        // 魚雷と敵船の衝突判定
        for (var i = 0; i < this.uboat.torpedos.length; i++) {
            const torpedo = this.uboat.torpedos[i];
            if (!torpedo.isEnabled) {
                continue;
            }
            for (var j = 0; j < this.enemyShips.length; j++) {
                const enemyShip = this.enemyShips[j];
                if (!enemyShip.isEnabled)
                    continue;
                if (this.#checkCollTorpedo(torpedo, enemyShip)) {
                    // 衝突時
                    torpedo.onHitTorpedo();
                    enemyShip.onHitTorpedo();
                    this.threeViewController.onHitTorpedo(torpedo);
                }
            }
        }

        // 砲弾, 爆雷とuBoatの衝突判定
        for (var i = 0; i < this.enemyShips.length; i++) {
            const enemyShip = this.enemyShips[i];
            if (enemyShip.objectType !== ObjectType.destoryer1)
                continue;
            for (var j = 0; j < enemyShip.shells.length; j++) {
                const shell = enemyShip.shells[j];
                if (!shell.isEnabled) {
                    continue;
                }
                if (this.#checkCollShell(shell, this.uboat, elapsedTime)) {
                    // 衝突時
                    shell.onHitShell();
                    this.uboat.onHitShell();
                    this.threeViewController.onHitShellUboat(shell);
                } else if (shell.depth > 0) {
                    // 砲弾が水面に落下
                    this.threeViewController.onHitShellWater(shell);
                }
            }
            // 爆雷とuBoatの衝突判定
            // 既定の深度に到達したら起爆する
            for (var j = 0; j < enemyShip.depthCharges.length; j++) {
                const depthCharge = enemyShip.depthCharges[j];
                if (!depthCharge.isEnabled) {
                    continue;
                }
                if (depthCharge.depth >= depthCharge.fireDepth) {
                    this.threeViewController.onExplosionDepthCharge(depthCharge);
                    // 爆雷とuBoatの距離が300m以内の場合にダメージ
                    const rangeToUboat = Util.calcDist2ObjectThree(depthCharge, this.uboat);
                    if (rangeToUboat <= 100) {
                        const damage = 100 / (rangeToUboat / 10);
                        this.uboat.damage += damage;
                    }
                    depthCharge.isEnabled = false;
                }
            }
        }
    }

    /**
     * 魚雷と敵船との当たり判定
     * @param {GameObject} torpedo 魚雷
     * @param {GameObject} ship 敵船
     * @return {boolean} 当たっているか
     */
    #checkCollTorpedo(torpedo, ship) {
        // 200m以上距離が離れている場合は判定しない
        const point1 = new Point(torpedo.pointX, torpedo.pointY);
        const point2 = new Point(ship.pointX, ship.pointY);
        if (Util.calcDist2Point(point1, point2) > 200) {
            return false;
        }

        // 魚雷の先端座標を取得
        const tipPoint = this.#calcTipPoint(torpedo);
        return this.#checkCollitionRectPoint(ship, tipPoint);
    }

    /**
     * 砲弾とuBoatとの当たり判定
     * @param {GameObject} shell 砲弾
     * @param {GameObject} playerBoat プレイヤボート
     * @param {number} elapsedTime 経過時間(ms)
     */
    #checkCollShell(shell, playerBoat, elapsedTime) {
        // 50m以上は離れている場合は判定しない
        if (Util.calcDist2Object(shell, playerBoat) >= 50) {
            return false;
        }
        // 高さが10m以上離れている場合は判定しない
        if (Math.abs(shell.depth - playerBoat.depth) > 10) {
            return false;
        }

        const shellPoint = new Point(shell.pointX, shell.pointY);
        return this.#checkCollitionRectPoint(playerBoat, shellPoint);
    }

    /**
     * 前フレームと今回フレームの間で当たっているか計算する
     * @param {GameObject} shell 今回フレームの砲弾
     * @param {GameObject} playerBoat 今回フレームのプレイヤボート
     * @param {number} elapsedTime 経過時間(ms)
     * @return {boolean} 当たっているか
     */
    #calcCheckCollShell(shell, playerBoat, elapsedTime) {
        // 前回フレーム位置から分割した位置で当たり判定を行う
        // 砲弾の位置を
        // 1フレームで動く砲弾の移動量
        const shellPoint = new Point(shell.pointX, shell.pointY);
        const vector = shell.calcVectorOneFrame(elapsedTime);
        for (var i = 0; i <= 60; i++) {
            // 1フレームずつ位置を戻していく
            shellPoint.x += vector.x * -1;
            shellPoint.y += vector.y * -1;
            if (this.#checkCollitionRectPoint(playerBoat, shellPoint)) {
                return true;
            }
        }
        return false;
    }

    /**
     * オブジェクトと点の当たり判定を行う
     * @param {GameObject} obj 判定を行うオブジェクト
     * @param {Point} point 判定を行う点
     * @param {boolean} 当たっているか
     */
    #checkCollitionRectPoint(obj, point) {
        // obj1の上から見た4つそれぞれの座標を取得する
        // 矩形の中心を原点とした相対座標を作成する
        const relativePos = new Point(point.x - obj.pointX, point.y - obj.pointY);
        // 相対座標に対して矩形の回転を打ち消す逆行列を掛ける
        const rad = Util.degreeToRadian(obj.course);
        const transformPos = new Point(
            Math.cos(rad) * relativePos.x + Math.sin(rad) * relativePos.y,
            -Math.sin(rad) * relativePos.x + Math.cos(rad) * relativePos.y
        );
        // 矩形と点の当たり判定を行う
        if (-obj.width / 2 <= transformPos.x && obj.width / 2 >= transformPos.x &&
            -obj.length / 2 <= transformPos.y && obj.length / 2 >= transformPos.y) {
            return true;
        }

        return false;
    }

    /**
     * オブジェクトが回転した際の4隅の座標を取得する
     * @param {GameObject} obj 座標を取得するゲームオブジェクト
     * @param {Rectangle} 座標を設定した矩形
     */
    #calc4PointRotate(obj) {
        const objPoint = new Point(obj.pointX, obj.pointY);
        const objCorse = obj.course;
        const rightTop = new Point(obj.pointX + obj.width / 2, obj.pointY - obj.length / 2);
        const leftTop = new Point(obj.pointX - obj.width / 2, obj.pointY - obj.length / 2);
        const leftBottom = new Point(obj.pointX - obj.width / 2, obj.pointY + obj.length / 2);
        const rightBottom = new Point(obj.pointX + obj.width / 2, obj.pointY + obj.length / 2);

        return new Rectangle(
            this.#convertRotatePoint(objPoint, objCorse, rightTop),
            this.#convertRotatePoint(objPoint, objCorse, leftTop),
            this.#convertRotatePoint(objPoint, objCorse, leftBottom),
            this.#convertRotatePoint(objPoint, objCorse, rightBottom),
        );
    }

    /**
     * オブジェクトの先端座標を取得する
     * @param {GameObject} torpedo 魚雷
     * @return {Point} 魚雷の先端座標
     */
    #calcTipPoint(torpedo) {
        const torpedoPoint = new Point(torpedo.pointX, torpedo.pointY);
        const torpedoTipPoint = new Point(torpedoPoint.x, torpedoPoint.y - torpedo.length / 2);
        return this.#convertRotatePoint(torpedoPoint, torpedo.course, torpedoTipPoint);
    }

    /**
     * 回転後のコーナー座標を取得する
     * @param {Point} objPoint オブジェクトの座標
     * @param {Point} objCorse オブジェクトの方位
     * @param {Point} cornerPoint 回転前のコーナー座標
     * @return {Point} 回転後コーナー座標
     */
    #convertRotatePoint(objPoint, objCourse, cornerPoint) {
        const angleToPointRad = Util.calcAngle2Point(objPoint, cornerPoint);
        const angleToPointDist = Util.calcDist2Point(objPoint, cornerPoint);
        const addedAngleRad = angleToPointRad + Util.degreeToRadian(objCourse);
        return this.#calcRotatePoint(objPoint, angleToPointDist, addedAngleRad);
    }

    /**
     * 座標を回転した際の位置を取得する
     * @param {Point} point 中心座標
     * @param {number} dist 中心と4隅との距離
     * @param {number} rad 回転量(rad)
     * @return {Point} 回転後座標
     */
    #calcRotatePoint(point, dist, rad) {
        const x = point.x + dist * Math.cos(rad);
        const y = point.y + dist * Math.sin(rad);
        return new Point(x, y);
    }
}