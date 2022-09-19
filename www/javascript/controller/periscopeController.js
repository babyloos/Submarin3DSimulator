import { InstructionController } from "./instructionController.js";

/**
 * 潜望鏡画面用コントローラ
 */
export class PeriscopeController extends InstructionController {

    // 潜望鏡画面表示中か
    isActivePeriscopeView = false;

    threeViewController;

    beforeObserveButtonDisabled;
    beforeHydrophoneButtonDisabled;

    /**
     * コンストラクタ
     */
    constructor() {
        super();
    }

    /**
     * 各ボタンの初期設firePlate.png
     */
    buttonInitialize() {
        this.#periscopeButtonInitialize();
        this.#resetPeriscopeView();
        this.#periscopeZoomButtonInitialize();
    }

    /**
     * 潜望鏡ボタンの初期設定
     */
    #periscopeButtonInitialize() {
        $('#periscopeButton').on("click", function () {
            // ボタンの活性状態切り替え
            if (this.isActivePeriscopeView) {
                // 潜望鏡画面非表示
                this.#deactivePeriscopeView();
            } else {
                // 潜望鏡画面表示
                this.#activatePeriscopeView();
            }
        }.bind(this));
    }

    /**
     * 拡大ボタンの初期設定
     */
    #periscopeZoomButtonInitialize() {
        const threeViewController = this.threeViewController;
        $('#zoomButton').on('click', function () {
            if (threeViewController.periscopeZoom) {
                $(this).text('1.6x');
                threeViewController.periscopeZoom = false;
                threeViewController.changeCameraMode(true);
            } else {
                $(this).text('6x');
                threeViewController.periscopeZoom = true;
                threeViewController.changeCameraMode(true);
            }
        });
    }

    /**
     * 画面をリセットする
     * ゲーム開始時は必ず潜望鏡画面を非表示にする
     */
    #resetPeriscopeView() {
        this.isActivePeriscopeView = false;
        this.threeViewController.changeCameraMode(false);
        this.#updateCanvas(false);
        this.#switchPeriscopeArea(false);
        this.#switchInstruction(false);
    }

    /**
     * 潜望鏡画面表示処理を行う
     */
    #activatePeriscopeView() {
        this.isActivePeriscopeView = true;

        // カメラのモードを切り替える
        this.threeViewController.changeCameraMode(true);
        // キャンバスのスタイルを設定する
        this.#updateCanvas(true);
        // パネルを非表示にする
        this.#switchAbsolutePanels(false);
        // 潜望鏡画面を表示する
        this.#switchPeriscopeArea(true);
        // 指示パネルの活性状態切り替え
        this.#switchInstruction(true);
    }

    /**
     * 潜望鏡画面非表示処理を行う
     */
    #deactivePeriscopeView() {
        this.isActivePeriscopeView = false;

        // カメラのモードを切り替える
        this.threeViewController.changeCameraMode(false);
        // キャンバスのスタイルを設定する
        this.#updateCanvas(false);
        // パネルを表示する
        this.#switchAbsolutePanels(true);
        // 潜望鏡画面を非表示にする
        this.#switchPeriscopeArea(false);
        // 指示パネルの活性状態切り替え
        this.#switchInstruction(false);
    }

    /**
     * 指示パネルの活性状態切り替え
     */
    #switchInstruction(isPeriscope) {
        const observeButton = $('#observeButton');
        const hydrophoneButton = $('#hydrophoneButton');

        if (isPeriscope) {
            this.beforeObserveButtonDisabled = observeButton.prop('disabled');
            this.beforeHydrophoneButtonDisabled = hydrophoneButton.prop('disabled');
            // 監視、聴音ボタン非活性
            observeButton.prop('disabled', true);
            hydrophoneButton.prop('disabled', true);
        } else {
            // 監視、聴音ボタン活性
            observeButton.prop('disabled', this.beforeObserveButtonDisabled);
            hydrophoneButton.prop('disabled', this.beforeHydrophoneButtonDisabled);
        }
    }

    /**
     * キャンバスのスタイルを設定する
     * @param {boolean} isPeriscope 潜望鏡画面用に設定するか
     */
    #updateCanvas(isPeriscope) {
        var canvas = $('#threePageCanvas');
        var container = $('#canvasContainer');

        const height = container.css('height');
        if (isPeriscope) {
            const width = height;
            container.css('width', width);
            canvas.css('width', '100%');
            canvas.css('height', '100%');
            container.css('height', '100%');
            container.css('border', '3px solid gray');
            canvas.css('border-radius', '50%');
            container.css('border-radius', '50%');
            container.css('position', 'absolute');
            container.css('left', '30px');
        } else {
            container.css('width', window.innerWidth + 'px');
            container.css('border-radius', '');
            container.css('position', '');
            container.css('left', '');
            container.css('border', '');
            canvas.css('border-radius', '');
        }
    }

    /**
     * パネルの表示切り替え
     * @param {boolean} isShow 表示するか
     */
    #switchAbsolutePanels(isShow) {
        if (isShow) {
            $('.absolutePanel').not('#instructionArea').removeClass('hiddenPage');
        } else {
            $('.absolutePanel').not('#instructionArea').addClass('hiddenPage');
        }
    }

    /**
     * 潜望鏡画面の表示切り替え
     * @param {boolean} isShow 表示するか
     */
    #switchPeriscopeArea(isShow) {
        const raiseDownArea = $('#zoomButtonArea');
        const aimLine = $('.aimLine');
        const compass = $('#compass');
        const inputBoad = $('#inputBoad');
        if (isShow) {
            // 潜望鏡上昇下降ボタン
            raiseDownArea.css('display', 'block');
            // 照準線
            aimLine.css('display', 'block');
            // コンパス
            compass.css('display', 'block');
            // 諸元入力盤
            inputBoad.css('display', 'block');
        } else {
            raiseDownArea.css('display', 'none');
            aimLine.css('display', 'none');
            compass.css('display', 'none');
            inputBoad.css('display', 'none');
        }
    }
}
