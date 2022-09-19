/**
 * 3次元座標クラス
 */
export class Point3 {

    x;
    y;
    z;

    /**
     * コンストラクタ
     * @param {number} x x座標
     * @param {number} y y座標
     * @param {number} z z座標
     */
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    toString() {
        return "(" + this.x + ", " + this.y + ", " + this.z + ")";
    }
}