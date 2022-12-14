import { SurfaceStatus } from "../constants.js";
import { Util } from "../util.js";
import { InstructionController } from "./instructionController.js";

/**
 * 監視員コントローラ
 */
export class ObserverController extends InstructionController {

    /**
     * コンストラクタ
     */
    constructor() {
        super();
    }

    /**
     * 各ボタンの初期設定
     */
    buttonInitialize() {
        this.#observeButtonInitialize();
    }

    /**
     * 監視ボタンの初期設定
     */
    #observeButtonInitialize() {
        $('#observeButton').on("click", function () {
            // 監視員の報告を行う
            const results = this.#observation();
            this.#showResultMessage(results);
            this.closeMenu();
        }.bind(this));

        // ボタンの活性状態切り替え
        const activityChange = function () {
            if (this.uboat.depthState() === SurfaceStatus.surface) {
                $('#observeButton').prop("disabled", false);
            } else {
                $('#observeButton').prop("disabled", true);
            }
        }.bind(this);
        activityChange();
        this.uboat.watchValue("depth", activityChange);
    }

    /**
     * 監視の結果を画面に表示する
     * @param {Array} foundShips 監視の結果見つけた船
     */
    #showResultMessage(foundShips) {
        const sender = $('#RES_Observer').html()
        if (foundShips.length != 0) {
            var foundShipsMessage = $('#RES_ObserverDiscover').html().replace('xxx', foundShips.length)
            this.messageController.showMessage(sender, foundShipsMessage);
            foundShips.forEach(function (foundShip, index) {
                const enemyShipText = $('#RES_EnemyShip').html()
                var message = enemyShipText + (index + 1) + " ";
                const directionText = $('#RES_Direction').html()
                const rangeText = $('#RES_Range').html()
                const courseText = $('#RES_Course').html()
                const speedText = $('#RES_ShipSpeed').html()
                message += directionText + ' ' + Util.numbToNDigitsStr(foundShip.direction, 3) + ", ";
                message += rangeText + ' ' + foundShip.range + "m, ";
                message += courseText + ' ' + Util.numbToNDigitsStr(foundShip.course, 3) + ", ";
                message += speedText + ' ' + foundShip.speed + "!";
                this.messageController.showMessage(sender, message);
            }.bind(this));
        }
        else {
            // 見つからなかった
            const noShipsText = $('#RES_NoShips').html()
            this.messageController.showMessage(sender, noShipsText);
        }
    }

    /**
     * 監視を行う
     * @returns {Array} 見つけた船
     */
    #observation() {
        // 潜水中は監視できない
        // ※潜水中はボタン押下できず呼ばれないはず
        if (!this.uboat.depthState() === SurfaceStatus.surface) {
            return null;
        }

        var foundShips = new Array();

        // 目視可能範囲は半径7マイル(12.964KM)
        const searchRange = 12.964 * 1000;
        this.enemies.forEach(function (element) {
            if (!element.isEnabled) {
                return;
            }
            // 観測員は厳密な距離、針路等はわからないため値を丸める
            const range = Math.round(this.uboat.calcRangeOtherObject(element) / 100) * 100;
            if (range <= searchRange) {
                const direction = this.uboat.calcDirectionOtherObject(element);
                const course = Math.round(element.course / 10) * 10;
                const speed = Math.round(element.speed);
                foundShips.push({ "ship": element, "direction": direction, "course": course, "speed": speed, "range": range });
            }
        }.bind(this));

        return foundShips;
    }
}
