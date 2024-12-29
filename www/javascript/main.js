import { GameDifficulty, GameMode } from "./constants.js";
import { PageController } from "./controller/pageController.js";
import { Game } from "./game.js";
import { Util } from "./util.js";
import { AudioManager } from "./controller/audioManager.js";
import ImgTranslator from "./controller/imgTranslator.js";

export class Main {

    // entry point
    main() {
        let game;   // ゲームインスタンス

        const audioManager = new AudioManager();
        audioManager.load('resources/audio/enter.mp3');

        // スクロール禁止
        Util.no_scroll();

        let gameMode = GameMode.mission;

        // トップページの画面遷移
        // タイトル画面
        const squamishButton = $('#squamishButton');
        const newGameButton = $('#newGameButton');
        const continueButton = $('#continueButton');
        const manualButton = $('#manualButton');

        // ゲームモード選択画面
        var selectGameMode = GameMode.mission;

        // 難易度選択画面
        var selectedDiff = GameDifficulty.easy;
        const diffSelectBackbutton = $('#diffSelectBackbutton');
        const startButton = $('#startButton');
        const diffSelector = $('#diffSelectPage input:radio[name="diffSelect"]');
        const gameModeSelector = $('#gameModeSelectPage input:radio[name="gameModeSelect"]');

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
            gameMode = GameMode.mission;
            audioManager.play();
            PageController.pageTransition('gameModeSelectPage');
        });

        // ゲームモード選択
        gameModeSelector.on('change', function () {
            audioManager.play();
            let val = $(this).attr('id');
            switch (val) {
                case "gameModeSquamish":
                    selectGameMode = GameMode.squamish;
                    break;
                case "gameModeMission":
                    selectGameMode = GameMode.mission;
                    break;
                default:
                    throw "selected undefined game mode.";
            }
            startButton.attr('disabled', false);
        })

        // 難易度選択画面
        diffSelectBackbutton.on('click', function () {
            audioManager.play();
            PageController.pageTransition('titlePage');
        });
        startButton.on('click', () => {
            audioManager.play();
            showAd();
            transitionThreePage(true, selectedDiff);
        });

        // 難易度選択
        diffSelector.on('change', function () {
            audioManager.play();
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
            // TODO: ゲームモードを取得する
            audioManager.play();
            showAd();
            transitionThreePage(false, selectedDiff);
        });

        // マニュアル
        manualButton.on('click', function () {
            audioManager.play();
            showAd();
            PageController.pageTransition('manualPage');
        });
        manualBackButton.on('click', function () {
            audioManager.play();
            PageController.pageTransition('titlePage');
        });

        // ゲームオーバー/ゲームクリアダイアログ
        backTitleButton.on('click', function () {
            audioManager.play();
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
            this.game = new Game(isNewGame, gameMode, selectedDiff, loadProgress, exitGame, gameOver, gameClear);
        }.bind(this);
    }
}

/**
 * ゲーム終了時処理
 */
function exitGame() {
    // 全てのイベントを削除
    $('*').off();
    main.game.threePageViewControllerAbandon();
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

window.addEventListener('DOMContentLoaded', function () {
    var glot = new Glottologist();
    glot.import("resources/words.json").then(() => {
        glot.render()
    })

    ImgTranslator.translate();
})

let interstitial;

document.addEventListener('deviceready', async () => {
    console.log('device ready');
    const isDebug = BuildInfo.debug;
    console.log(isDebug ? 'Debug build' : 'Release build');

    let unitId;
    let platform = cordova.platformId;
    if (platform === 'android') {
        unitId = isDebug ? 'ca-app-pub-3940256099942544/1033173712' : 'ca-app-pub-1479927029413242/6298498855';
    } else if (platform === 'ios') {
        unitId = isDebug ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-1479927029413242/1802112503';
    }

    interstitial = new admob.InterstitialAd({
        adUnitId: unitId,
    })

    interstitial.on('load', (evt) => {
        // evt.ad
    })
}, false);

const showAd = async () => {
    console.log("showAd");
    try {
        await interstitial.load()
        await interstitial.show()
    } catch (error) {
        console.error('Ad failed to load:', error);
    }
}

window.addEventListener('admob.ad.dismiss', async () => {
    // Once a interstitial ad is shown, it cannot be shown again.
    // Starts loading the next interstitial ad as soon as it is dismissed.
    await interstitial.load()
})

const main = new Main();
main.main();
