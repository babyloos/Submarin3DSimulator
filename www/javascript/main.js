import { GameDifficulty } from "./constants.js";
import { PageController } from "./controller/pageController.js";
import { Game } from "./game.js";
import { Util } from "./util.js";

export class Main {

    // entry point
    main() {
        let game;   // ゲームインスタンス

        // スクロール禁止
        Util.no_scroll();

        // トップページの画面遷移
        // タイトル画面
        const newGameButton = $('#newGameButton');
        const continueButton = $('#continueButton');
        const manualButton = $('#manualButton');

        // 難易度選択画面
        var selectedDiff = GameDifficulty.easy;
        const diffSelectBackbutton = $('#diffSelectBackbutton');
        const startButton = $('#startButton');
        const diffSelector = $('#diffSelectPage input:radio[name="diffSelect"]');

        // マニュアル画面
        const manualBackButton = $('#manualBackButton');

        // ゲームオーバーダイアログ
        const backTitleButton = $('.backTitleButton');

        // セーブデータが無い場合はコンティニューボタンを非活性化する
        const initTimeData = JSON.parse(window.localStorage.getItem('initTime'));
        const continueButtonEnable = initTimeData !== null
        if (continueButtonEnable) {
            continueButton.attr('disabled', false);
        } else {
            continueButton.attr('disabled', true);
        }

        // ニューゲーム
        newGameButton.on('click', function () {
            PageController.pageTransition('diffSelectPage');
        });

        // 難易度選択画面
        diffSelectBackbutton.on('click', function () {
            PageController.pageTransition('titlePage');
        });
        startButton.on('click', function () {
            transitionThreePage(true, selectedDiff);
        });
        diffSelector.on('change', function () {
            let val = $(this).attr('id');
            switch (val) {
                case "diffEasy":
                    selectedDiff = GameDifficulty.easy;
                    break;
                case "diffNormal":
                    selectedDiff = GameDifficulty.normal;
                    break;
                case "diffHard":
                    selectedDiff = GameDifficulty.hard;
                    break;
                default:
                    throw "selected undefined game difficulty.";
            }
            startButton.attr('disabled', false);
        })

        // コンティニュー
        continueButton.on('click', function () {
            transitionThreePage(false, selectedDiff);
        });

        // マニュアル
        manualButton.on('click', function () {
            PageController.pageTransition('manualPage');
        });
        manualBackButton.on('click', function () {
            PageController.pageTransition('titlePage');
        });

        // ゲームオーバー/ゲームクリアダイアログ
        backTitleButton.on('click', function () {
            exitGame();
        });

        // ゲーム開始画面遷移処理
        const transitionThreePage = function (isNewGame, selectedDiff) {
            // ロード画面表示
            PageController.pageTransition('loadPage');
            const maxCount = 0;
            const progressBar = $('#loadProgressBar');
            progressBar.css('width', 0 + '%');
            const loadProgress = new LoadProgress(function (progress) {
                if (progress != maxCount) {
                    // 進捗更新
                    var progressVal = progress / maxCount * 100;
                    progressBar.css('width', progressVal + '%');
                }
                if (progress >= maxCount) {
                    // 3D画面表示
                    PageController.pageTransition('threePage');
                    $('.absolutePanel').removeClass('hiddenPage');
                }
            });
            this.game = new Game(isNewGame, selectedDiff, loadProgress, exitGame, gameOver, gameClear);
        }.bind(this);
    }
}

/**
 * ゲーム終了時処理
 */
function exitGame() {
    // 全てのイベントを削除
    $('*').off();
    main.game.dispose();
    main.game = null;
    PageController.pageTransition('titlePage');
    main.main();
}

/**
 * ゲームクリア時処理
 */
function gameClear() {
    // パネルを全て消す
    $('.absolutePanel').addClass('hiddenPage');
    // ゲームクリア画面表示
    var modal = new bootstrap.Modal(document.getElementById('gameClearDialog'), {
        keyboard: false
    });
    modal.show();
}

/**
 * ゲームオーバー時処理
 */
function gameOver() {
    // パネルを全て消す
    $('.absolutePanel').addClass('hiddenPage');
    // ゲームオーバー画面表示
    var modal = new bootstrap.Modal(document.getElementById('gameOverDialog'), {
        keyboard: false
    });
    modal.show();
}

export class LoadProgress {
    progress = 0;
    onUpdateProgress;   // 進捗更新時処理

    constructor(onUpdateProgress) {
        this.onUpdateProgress = onUpdateProgress;
    }

    updateProgress(nowProgress) {
        this.progress;
        this.onUpdateProgress(nowProgress);
    }
}

const main = new Main();
main.main();
