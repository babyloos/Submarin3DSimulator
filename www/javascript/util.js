import { GameObject } from "./model/gameObject.js";
import { Point } from "./model/point.js";
import { Point3 } from "./model/point3.js";

export class Util {

    // スクロールが端に行った際に全体がスクロールされないよう対策する
    static scroll_control(event) {
        // messageBox内はスクロール可能とする
        const messageBox = $('#messageBox2').get(0);
        const manualMessageBox = $('#manualMessageBox').get(0);
        if (messageBox.scrollTop === 0) {
            messageBox.scrollTop = 1;
        } else if (messageBox.scrollTop + messageBox.clientHeight === messageBox.scrollHeight) {
            messageBox.scrollTop = messageBox.scrollTop - 1;
        }

        if (manualMessageBox.scrollTop === 0) {
            manualMessageBox.scrollTop = 1;
        } else if (manualMessageBox.scrollTop + manualMessageBox.clientHeight === manualMessageBox.scrollHeight) {
            manualMessageBox.scrollTop = manualMessageBox.scrollTop - 1;
        }

        if ((event.target.id === 'messageBox2' || event.target.parentNode.id === 'messageBox2' &&
            messageBox.scrollTop !== 0 && messageBox.scrollTop + messageBox.clientHeight !== messageBox.scrollHeight)
            || (event.target.id === 'manualMessageBox' || event.target.parentNode.id === 'manualMessageBox' &&
                manualMessageBox.scrollTop !== 0 && manualMessageBox.scrollTop + manualMessageBox.clientHeight !== manualMessageBox.scrollHeight)) {
            event.stopPropagation();
        }
        else {
            event.preventDefault();
        }
    }

    static no_scroll() {
        document.addEventListener("mousewheel", Util.scroll_control, { passive: false });
        document.addEventListener("touchmove", Util.scroll_control, { passive: false });
    }

    /**
     * ディグリー(度数法)をラジアン(弧度法)に変換する
     * @param {number} degree ディグリーでの角度
     * @returns ラジアンでの角度
     */
    static degreeToRadian(degree) {
        return degree * (Math.PI / 180);
    }

    /**
     * ラジアン(弧度法)をディグリー(度数法)に変換する
     * @param {number} radian ラジアンでの角度
     * @returns ディグリーでの角度
     */
    static radianToDegree(radian) {
        return radian * (180 / Math.PI);
    }

    /**
     * 数値をn桁の文字列に変換する
     * @param {number} num 変換する数値
     * @param {number} digit 整数部分の桁数
     * @param {bool}  showSign +/-符号を付与するか 
     * @param {number} decimalDigit 小数部分の桁数
     * @returns n桁の文字列
     */
    static numbToNDigitsStr(num, digit, showSign = false, decimalDigit = 0) {
        const isMinus = num < 0;
        let resultStr = Math.abs(num).toString();

        if (decimalDigit != 0) {
            if (resultStr.indexOf('.') != -1) {
                const decimalStr = resultStr.substring(resultStr.indexOf('.') + 1);
                for (var i = 0; i < decimalDigit - decimalStr.length; i++) {
                    resultStr += "0";
                }
            } else {
                resultStr += ".00";
            }
        } else {
            resultStr = Math.round(Math.abs(num)).toString();
        }

        // 整数桁の0を付与
        var zeros = "";
        for (var i = 0; i < digit - resultStr.length; i++) {
            zeros += "0";
        }
        resultStr = zeros + resultStr;
        resultStr = isMinus ? "-" + resultStr : resultStr;
        resultStr = !isMinus && showSign && num != 0 ? "+" + resultStr : resultStr;

        return resultStr;
    }

    /**
     * 文字列をbooleanに変換する
     * @param {string} data
     * @returns true or false
     */
    static toBoolean(data) {
        return data.toLowerCase() === 'true';
    }

    /**
     * 余弦を計算する
     * Math.cosでは90度,270度のとき0とならないための対策
     * @param {number} degree 角度(deg)
     */
    static cos(degree) {
        return Math.round(Math.cos(Util.degreeToRadian(degree)) * Math.pow(10, 5)) / Math.pow(10, 5);
    }

    /**
     * 正弦を計算する
     * Math.sinでは180度のとき0とならないための対策
     * @param {number} degree 角度(deg)
     */
    static sin(degree) {
        return Math.round(Math.sin(Util.degreeToRadian(degree)) * Math.pow(10, 5)) / Math.pow(10, 5);
    }

    /**
     * オブジェクト同士の距離を計算する
     * @param {GameObject} obj1
     * @param {GameObject} obj2
     * @return {number} オブジェクト同士の距離
     */
    static calcDist2Object(obj1, obj2) {
        const point1 = new Point(obj1.pointX, obj1.pointY);
        const point2 = new Point(obj2.pointX, obj2.pointY);
        return Util.calcDist2Point(point1, point2);
    }

    /**
     * 2点間の距離を計算する
     * @param {Point} point1 座標1
     * @param {Point} point2 座標2
     * @return {number} 2点間の距離
     */
    static calcDist2Point(point1, point2) {
        return Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2);
    }

    /**
     * オブジェクト同士の距離を計算する
     * @param {GameObject} obj1
     * @param {GameObject} obj2
     * @return {number} オブジェクト同士の距離
     */
    static calcDist2ObjectThree(obj1, obj2) {
        const point1 = new Point3(obj1.pointX, obj1.pointY, obj1.depth);
        const point2 = new Point3(obj2.pointX, obj2.pointY, obj2.depth);
        return Util.calcDist2PointThree(point1, point2);
    }

    /**
     * 3次元上の2点間の距離を計算する
     * @param {Point3} point1 座標1
     * @param {Point3} point2 座標2
     */
    static calcDist2PointThree(point1, point2) {
        return Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2 + (point2.z - point1.z) ** 2);
    }

    /**
     * 2点間の角度を計測する
     * @param {Point} point1 座標1
     * @param {Point} point2 座標2
     * @return {number} 角度(rad)
     */
    static calcAngle2Point(point1, point2) {
        return Math.atan2(point2.y - point1.y, point2.x - point1.x);
    }

    /**
    * 回転度数を上始まり右周りから右始まり左周りに変換する
    * @param {number} angle ワールド回転系(上始まり0~359右回り)
    * @param {number} 三角関数での回転系(右始まり0~359左回り)
    */
    static calcAngleForCalc(angle) {
        // 左回転に直す
        var result = 360 - angle + 90;
        if (result >= 360) {
            result = result % 360;
        }
        return result;
    }

    /**
     * 針路(deg)を0~359°の間に収める
     * @param {number} course 針路(deg)
     * @return {number} 針路(0~359°)
     */
    static arrangeCourseDig(course) {
        let result;
        if (course >= 0 && course < 360) {
            result = course;
        } else if (course < 0) {
            result = 360 + course;
        } else if (course >= 360) {
            result = course % 360;
        } else {
            console.log(course);
            throw 'invalid args';
        }

        return result;
    }

    /**
     * 文字列中に特定の文字列が含まれるか
     */
    static isContain(str, keyword) {
        if (str.indexOf(keyword) != -1) {
            return true;
        }
        return false;
    }

    /**
     * 2つの間の乱数を取る
     * @param {number} min 最小値
     * @param {number} max 最大値
     * @return 2値の間の乱数値
     */
    static getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * 特定要素の回転角度(deg)を取得する
     * @param {JqueryObject} obj 
     * @return {number} 回転角度(deg) 
     */
    static getRotationDegrees(obj) {
        var matrix = obj.css("-webkit-transform") ||
            obj.css("-moz-transform") ||
            obj.css("-ms-transform") ||
            obj.css("-o-transform") ||
            obj.css("transform");
        if (matrix !== 'none') {
            var values = matrix.split('(')[1].split(')')[0].split(',');
            var a = values[0];
            var b = values[1];
            var angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
        } else { var angle = 0; }
        return (angle < 0) ? angle + 360 : angle;
    }
}