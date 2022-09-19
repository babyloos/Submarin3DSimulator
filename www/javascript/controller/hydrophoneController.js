import { SurfaceStatus } from "../constants.js";
import { Util } from "../util.js";
import { InstructionController } from "./instructionController.js";

/**
 * 聴音手コントローラ
 */
export class HydrophoneController extends InstructionController {

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
        this.#hydrophoneButtonInitialize();
    }

    /**
     * 聴音ボタンの初期設定
     */
    #hydrophoneButtonInitialize() {
        $('#hydrophoneButton').on("click", function () {
            // 聴音員の報告を行う
            const results = this.#listen();
            this.#showResultMessage(results);
            this.closeMenu();
        }.bind(this));

        const activityChange = function () {
            if (this.uboat.depthState() !== SurfaceStatus.surface) {
                $('#hydrophoneButton').prop("disabled", false);
            } else {
                $('#hydrophoneButton').prop("disabled", true);
            }
        }.bind(this);
        activityChange();
        this.uboat.watchValue("depth", activityChange);
    }

    /**
     * 聴音の結果を画面に表示する
     * @param {Array} foundShips 監視の結果見つけた船
     */
    #showResultMessage(foundShips) {
        const sender = "聴音員";
        if (foundShips.length != 0) {
            this.messageController.showMessage(sender, "船音を" + foundShips.length + "隻確認！");
            foundShips.forEach(function (foundShip, index) {
                const soundVolume = this.#soundLoudness(foundShip.range);
                const volumeMessage = this.#soundVolumeMessage(soundVolume);
                var message = "敵船" + (index + 1) + " ";
                message += "方位" + Util.numbToNDigitsStr(foundShip.direction, 3) + "、";
                message += volumeMessage + "!";
                this.messageController.showMessage(sender, message);
            }.bind(this));
        }
        else {
            // 見つからなかった
            this.messageController.showMessage(sender, "船音無し！");
        }
    }

    /**
     * 聴音を行う
     * @returns {Array} 見つけた船
     */
    #listen() {
        // 浮上中は監視できない
        // ※浮上中はボタン押下できず呼ばれないはず
        if (this.uboat.depthState() === SurfaceStatus.surface) {
            return null;
        }

        var foundShips = new Array();

        // 目視可能範囲は半径54マイル(100KM)
        const searchRange = 100 * 1000;
        this.enemies.forEach(function (element) {
            if (!element.isEnabled) {
                return;
            }
            // 聴音では大体の音の大きさ、方角を報告する
            const range = this.uboat.calcRangeOtherObject(element);
            if (range <= searchRange) {
                const direction = this.uboat.calcDirectionOtherObject(element);
                foundShips.push({ "ship": element, "direction": direction, "range": range });
            }
        }.bind(this));

        return foundShips;
    }

    /**
     * 音の大きさから表示メッセージを作成する
     * @param {number} volume
     * @return {string} メッセージ
     */
    #soundVolumeMessage(volume) {
        var message = "";
        switch (volume) {
            case 0:
                message = "音量微小";
                break;
            case 1:
                message = "音量中";
                break;
            case 2:
                message = "音量やや大きい"
                break;
            case 3:
                message = "音量大";
                break;
            default:
                break;
        }
        return message;
    }

    /**
     * 距離から音の大きさを判断する
     * @param {number} range 距離(m)
     * @return {number} 音の大きさ {0: 長距離, 1: 中長距離, 2: 中距離, 3: 短距離}
     */
    #soundLoudness(range) {
        if (range >= 50000) {
            return 0;
        } else if (range >= 30000) {
            return 1;
        } else if (range >= 20000) {
            return 2;
        } else {
            return 3;
        }
    }
}