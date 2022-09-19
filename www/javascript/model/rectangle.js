import { Point } from "./point.js";

/**
 * 回転矩形を表すクラス
 */
export class Rectangle {

    rightTop;
    leftTop;
    leftBottom;
    rightBottom;

    /**
     * コンストラクタ
     * @param {Point} rightTop 右上座標
     * @param {Point} leftTop 左上座標
     * @param {Point} leftBottom 左下座標
     * @param {Point} rightBottom 右下座標
     */
    constructor(rightTop, leftTop, leftBottom, rightBottom) {
        this.rightTop = rightTop;
        this.leftTop = leftTop;
        this.leftBottom = leftBottom;
        this.rightBottom = rightBottom;
    }

    toString() {
        return "rightTop: " + this.rightTop + "\r\nleftTop: " + this.leftTop + "\r\nleftBottom: " + this.leftBottom + "\r\nrightBottom: " + this.rightBottom + "\r\n";
    }
}