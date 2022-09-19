import { Serializable } from "./Serializable.js";

/**
 * 2次元座標クラス
 */
export class Point extends Serializable {
    x;
    y;

    /**
     * コンストラクタ
     * @param {number} x x座標
     * @param {number} y y座標
     */
    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;
    }

    toString() {
        return "(" + this.x + ", " + this.y + ")";
    }

    /**
     * オブジェクトをシリアル化する
     * @return {JSON} シリアル化したJSONオブジェクト
     */
    serialize() {
        super.serialize();

        return JSON.stringify({
            x: this.x,
            y: this.y,
        });
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {GameObject} 生成したオブジェクト
     */
    static deserialize(json) {
        const obj = new Point(json.x, json.y);
        return obj;
    }
}