import { GameObject } from "../model/gameObject.js";
import { Uboat } from "../model/uBoat.js";
import { MessageController } from "./messageController.js";

/**
 * 各員への指示を行うクラスのベースクラス
 * ObserverController等が継承する
 */
export class InstructionController {

    uboat;              // 参照先のプレイヤボート
    enemies;            // 参照先の敵船配列の参照

    messageController   // 参照先のmessageController

    /**
     * コンストラクタ
     */
    constructor() {
    }

    /**
     * 初期設定
     * @param {Uboat} uboat プレイヤボート
     * @param {GameObject} enemies 敵船
     * @param {MessageController} messageController メッセージコントローラ
     */
    initialize(uboat, enemies, messageController) {
        this.uboat = uboat;
        this.enemies = enemies;
        this.messageController = messageController;

        this.buttonInitialize();
    }

    /**
     * 各ボタンの初期設定
     */
    buttonInitialize() {
    }

    /**
     * 指示メニューを閉じる
     */
    closeMenu() {
        $('#instructionMenu').modal('hide');
    }
}