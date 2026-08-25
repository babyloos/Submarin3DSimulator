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

        // ゲーム画面からトップ画面に戻った際にすべてのイベントをリセットするため毎回ここで設定する
        // 言語切り替え時動作設定
        initUpdateLanguage();

        const audioManager = new AudioManager();
        audioManager.load('resources/audio/enter.mp3');

        // スクロール禁止
        Util.no_scroll();

        // トップページの画面遷移
        // タイトル画面
        const newGameButton = $('#newGameButton');
        const continueButton = $('#continueButton');
        const manualButton = $('#manualButton');

        // ゲームモード選択画面
        var selectGameMode = GameMode.mission;
        const selectDiffButton = $('#selectDiffButton');
        selectDiffButton.on('click', () => {
            audioManager.play();
            diffSelector.prop('checked', false);
            startButton.attr('disabled', true);
            PageController.pageTransition('diffSelectPage');
        });
        const gameModeSelectBackButton = $('#gameModeSelectBackbutton');
        gameModeSelectBackButton.on('click', () => {
            audioManager.play();
            PageController.pageTransition('titlePage');
        });
        const gameModeSelector = $('#gameModeSelectPage input:radio[name="gameModeSelect"]');
        gameModeSelector.on('change', function () {
            audioManager.play();
            let val = $(this).attr('id');
            switch (val) {
                case "gameModeSquamish":
                    selectGameMode = GameMode.skirmish;
                    break;
                case "gameModeMission":
                    selectGameMode = GameMode.mission;
                    break;
                default:
                    throw "selected undefined game mode.";
            }
            selectDiffButton.attr('disabled', false);
        })

        // 難易度選択画面
        var selectedDiff = GameDifficulty.easy;
        const diffSelectBackbutton = $('#diffSelectBackbutton');
        const startButton = $('#startButton');
        const diffSelector = $('#diffSelectPage input:radio[name="diffSelect"]');

        diffSelectBackbutton.on('click', function () {
            audioManager.play();
            PageController.pageTransition('gameModeSelectPage');
        });
        startButton.on('click', () => {
            audioManager.play();
            showAd();
            transitionThreePage(true, selectedDiff);
        });
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
            audioManager.play();
            gameModeSelector.prop('checked', false);
            selectDiffButton.attr('disabled', true);
            PageController.pageTransition('gameModeSelectPage');
        });

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
            this.game = new Game(isNewGame, selectGameMode, selectedDiff, loadProgress, exitGame, gameOver, gameClear);
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

var glot;

window.addEventListener('DOMContentLoaded', function () {
    glot = new Glottologist();
    glot.import("resources/words.json").then(() => {
        glot.render();
    });

    const language = navigator.language;
    ImgTranslator.translate(language);

    // 言語切り替え時動作設定
    // initUpdateLanguage();
});

// 言語切り替え時動作
const initUpdateLanguage = () => {
  $('#languageSelect').on('change', function() {
    glot.import("resources/words.json").then(() => {
        console.log("change language " + $(this).val());
        glot.render($(this).val());
        ImgTranslator.translate($(this).val());
    });
  });
}

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

    // アプリ課金確認
    // ローカル状態の反映（起動直後）
    setRemoved(getRemoved());

    initIAP();

    // 潜水艦3Dシミュレータ2への誘導ボタン
    initPromoSubmarine2(platform);
}, false);

// 潜水艦3Dシミュレータ2（Unity版）のストアURL
const PROMO_SUBMARINE2_URL = {
    android: 'https://play.google.com/store/apps/details?id=com.babyloos.submarine3dsimulator2',
    // TODO: iOS版のApp Store公開後、App Store URLを設定する
    ios: null,
};

function initPromoSubmarine2(platform) {
    const url = PROMO_SUBMARINE2_URL[platform];
    if (!url) {
        return;
    }
    $('.promoSubmarine2Button, .promoSubmarine2Row').removeClass('hiddenPage');
    $('.promoSubmarine2Button').on('click', () => {
        window.open(url, '_system');
    });
}

const showAd = async () => {
    if (getRemoved()) {
        // 広告削除課金を行っている場合は表示しない
        return;
    }

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
});

const SKU = 'com.babyloos.submarine3d.remove_ads1';
// const isiOS = /(iPad|iPhone|iPod)/i.test(navigator.userAgent);

// 状態
const getRemoved = () => localStorage.getItem('adsRemoved') === '1';
const setRemoved = (v) => {
    console.log("課金状態取得: " + v);
    localStorage.setItem('adsRemoved', v ? '1' : '0');
};

// IAP初期化
function initIAP() {
    console.log('onDeviceReady');

    const store = CdvPurchase.store;
    const purchasePlatform = cordova.platformId === 'android'
        ? CdvPurchase.Platform.GOOGLE_PLAY
        : CdvPurchase.Platform.APPLE_APPSTORE;

    const updateOwnedState = () => {
        if (!store.owned({ id: SKU, platform: purchasePlatform })) return;

        setRemoved(true);
        $('#removeAdsButton').removeClass('btn-danger').addClass('btn-secondary');
        $('#removeAdsButton').prop('disabled', true);
    };

    store.register({
        id: SKU,
        type: CdvPurchase.ProductType.NON_CONSUMABLE,
        platform: purchasePlatform,
    });

    store.when()
        .productUpdated(function (product) {
            if (product.id !== SKU || !product.pricing) return;
            $('#iapPrice').text(product.pricing.price);
            initRemoveAdsBuyButton(store, purchasePlatform);
        })
        .receiptUpdated(updateOwnedState)
        .receiptsReady(updateOwnedState)
        .approved(async function (transaction) {
            const removesAds = transaction.products.some(product => product.id === SKU);
            if (!removesAds) return;

            setRemoved(true);
            updateOwnedState();
            await transaction.finish();
        });

    store.initialize([purchasePlatform]).then(function (errors) {
        errors.forEach(error => console.error('IAP initialization failed:', error));
        return store.restorePurchases();
    }).then(function (error) {
        if (error) console.error('IAP restore failed:', error);
        updateOwnedState();
    }).catch(function (error) {
        console.error('IAP failed:', error);
    });
}

// 購入ボタン押下時処理
const initRemoveAdsBuyButton = (store, purchasePlatform) => {
    console.log('initAdRemoveButton');
    $('#removeAdsBuyButton').off('click').on('click', async function () {
        const product = store.get(SKU, purchasePlatform);
        const offer = product && product.getOffer();
        if (!offer) {
            console.error('IAP offer is not available:', SKU);
            return;
        }

        const error = await offer.order();
        if (error) console.error('IAP purchase failed:', error);
    });
};

// 購入ダイアログを開いた際のイベント
document.getElementById('removeAdsBuyModal')
  .addEventListener('shown.bs.modal', function () {
    console.log("show_purchase_dialog")
    FirebasePlugin.logEvent("show_purchase_dialog", {});
});

const main = new Main();
main.main();

