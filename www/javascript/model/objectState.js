/**
 * ゲームオブジェクトの状態(方位、位置)用のデータクラス
 */
export class ObjectState {

    pointX;     // 位置X座標
    pointY;     // 位置Y座標
    course;     // 方位(deg)
    speed;      // 速度(kt)

    /**
     * コンストラクタ
     * @param {number} pointX 位置X座標
     * @param {number} pointY 位置Y座標
     * @param {number} course 方位(deg)
     * @param {number} speed 速度(kt)
     */
    constructor(pointX, pointY, course, speed) {
        this.set(pointX, pointY, course, speed);
    }

    /**
     * 状態の更新
     * @param {number} pointX 位置X座標
     * @param {number} pointY 位置Y座標
     * @param {number} course 方位(deg)
     * @param {number} speed 速度(kt)
     */
    set(pointX, pointY, course, speed) {
        this.pointX = pointX;
        this.pointY = pointY;
        this.course = course;
        this.speed = speed;
    }
}