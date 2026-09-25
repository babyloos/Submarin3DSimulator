import { GameDifficulty, GameMode } from "./constants.js";
import { PageController } from "./controller/pageController.js";
import { Game } from "./game.js";
import { Util } from "./util.js";
import { AudioManager } from "./controller/audioManager.js";
import ImgTranslator from "./controller/imgTranslator.js";
import { STORAGE_KEYS, getGameProgress, trackEvent, trackOnceEvent } from "./analytics.js";
import { renderAll as renderDailyMission, showTitleCard as showDailyMissionTitleCard } from "./dailyMission.js";

export class Main {

    // entry point
    main() {
        let game;   // ゲームインスタンス

        // ゲーム画面からトップ画面に戻った際にすべてのイベントをリセットするため毎回ここで設定する
        // 言語切り替え時動作設定
        initUpdateLanguage();

        // B群のみ: 今日の任務カードを表示(タイトル画面表示のたびに更新する)
        showDailyMissionTitleCard();

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

        // ゲームオーバー時: 広告視聴で同条件のミッションに再挑戦
        const retryWithAdButton = $('#retryWithAdButton');
        retryWithAdButton.on('click', async function () {
            audioManager.play();
            retryWithAdButton.prop('disabled', true);
            const earned = await showRewardedAd();
            retryWithAdButton.prop('disabled', false);
            if (!earned) {
                return;
            }
            trackEvent('rewarded_ad_retry', {}, false);
            const modalEl = document.getElementById('gameOverDialog');
            bootstrap.Modal.getOrCreateInstance(modalEl).hide();
            this.game.threePageViewControllerAbandon();
            this.game.dispose();
            this.game = null;
            transitionThreePage(true, selectedDiff);
        }.bind(this));

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
    showAd();
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
    showAd();
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
        // 翻訳済みの文言でデイリーミッション表示を更新する
        renderDailyMission();
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
        renderDailyMission();
    });
  });
}

let interstitial;
let rewarded;

document.addEventListener('deviceready', async () => {
    console.log('device ready');
    const isDebug = BuildInfo.debug;
    console.log(isDebug ? 'Debug build' : 'Release build');

    let unitId;
    let rewardedUnitId;
    let platform = cordova.platformId;
    if (platform === 'android') {
        unitId = isDebug ? 'ca-app-pub-3940256099942544/1033173712' : 'ca-app-pub-1479927029413242/6298498855';
        // TODO: AdMobコンソールでAndroid用リワード広告ユニットを作成し、本番IDに差し替える
        rewardedUnitId = isDebug ? 'ca-app-pub-3940256099942544/5224354917' : 'ca-app-pub-1479927029413242/0000000000';
    } else if (platform === 'ios') {
        unitId = isDebug ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-1479927029413242/1802112503';
        // TODO: AdMobコンソールでiOS用リワード広告ユニットを作成し、本番IDに差し替える
        rewardedUnitId = isDebug ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-1479927029413242/0000000000';
    }

    interstitial = new admob.InterstitialAd({
        adUnitId: unitId,
    })

    interstitial.on('load', (evt) => {
        // evt.ad
    })

    rewarded = new admob.RewardedAd({
        adUnitId: rewardedUnitId,
    })

    // 表示時に待たずに済むよう、起動時に1本先読みしておく
    if (!getRemoved()) {
        preloadAd();
    }

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

// 広告の状態(load/showの多重呼び出しを防ぐ)
let adLoaded = false;   // 表示可能な広告を読み込み済みか
let adLoading = null;   // 読み込み中のPromise(読み込み中でなければnull)
let adShowing = false;  // 広告を表示中か
let adPendingShow = false; // 表示タイミングでは間に合わなかったが、読み込み完了次第表示したい状態か

/**
 * 次に表示する広告を読み込む。読み込み済み/読み込み中なら何もせず、その完了を待つ
 */
const loadAd = () => {
    if (adLoaded) {
        return Promise.resolve();
    }
    if (!adLoading) {
        adLoading = interstitial.load()
            .then(() => {
                adLoaded = true;
                // 表示待ちだった場合、プレイの状況によらず読み込み完了次第すぐ表示する(広告表示を優先する方針のため)
                if (adPendingShow) {
                    adPendingShow = false;
                    displayLoadedAd();
                }
            })
            .finally(() => { adLoading = null; });
    }
    return adLoading;
}

/**
 * 広告をバックグラウンドで先読みする(失敗しても次回表示時に再読み込みする)
 */
const preloadAd = () => {
    loadAd().catch((error) => {
        console.error('Ad preload failed:', error);
        trackAdShowFailed('load', error);
    });
}

const trackAdShowFailed = (stage, error) => {
    trackEvent('ad_show_failed', {
        stage: stage,
        error_message: formatAdError(error).slice(0, 100),
    });
}

const formatAdError = (error) => {
    if (error && error.message) {
        return String(error.message);
    }
    if (error && typeof error === 'object') {
        try {
            return JSON.stringify(error);
        } catch (e) {
            // 循環参照などで文字列化できない場合は下のString()に任せる
        }
    }
    return String(error);
}

// 先読みが間に合っていない場合に待つ上限時間(ms)。全画面広告の表示自体が既に大きな中断なので、この程度の遅延は体感に影響しにくい
const AD_READY_WAIT_MS = 1500;

export const showAd = async () => {
    if (getRemoved()) {
        // 広告削除課金を行っている場合は表示しない
        return;
    }
    if (!interstitial || adShowing) {
        // 初期化前、または別の広告を表示中(ゲームオーバーとプレイ中広告の同時発生など)は表示しない
        return;
    }

    console.log("showAd");
    if (!adLoaded) {
        // 先読みが間に合っていない場合、短時間だけ読み込み完了を待ってから判断する
        // (プレイ中広告の追加でリクエスト間隔が短くなり、先読みが追いつかず不要にスキップされるケースが増えたため)
        await Promise.race([
            loadAd().catch(() => { }),
            new Promise((resolve) => setTimeout(resolve, AD_READY_WAIT_MS)),
        ]);
    }
    if (!adLoaded) {
        // それでも間に合わなかった場合は、広告表示を優先する方針のため諦めずに読み込み完了を待つ。
        // プレイが先に進んでいても、読み込みが終わり次第そのタイミングで表示する
        trackEvent('ad_show_failed', { stage: 'not_ready', error_message: adLoading ? 'loading' : 'not_loaded' });
        adPendingShow = true;
        preloadAd();
        return;
    }

    await displayLoadedAd();
}

/**
 * 読み込み済みの広告を表示する
 */
const displayLoadedAd = async () => {
    if (adShowing) {
        // 別の広告を表示中なら重複表示しない(次の読み込み完了時に改めて表示を試みる)
        adPendingShow = true;
        return;
    }
    adShowing = true;
    // 一度表示した広告は再表示できないため、表示前に読み込み済みフラグを落とす
    adLoaded = false;
    try {
        await interstitial.show();
    } catch (error) {
        console.error('Ad failed to show:', error);
        trackAdShowFailed('show', error);
        adShowing = false;
        preloadAd();
    }
}

/**
 * リワード広告を表示し、視聴完了(報酬獲得)まで完了したかを返す
 * @return {Promise<boolean>} 報酬を獲得できた場合true
 */
const showRewardedAd = () => {
    return new Promise((resolve) => {
        if (getRemoved() || !rewarded) {
            resolve(false);
            return;
        }
        let earned = false;
        const offReward = rewarded.on('reward', () => {
            earned = true;
        });
        const offDismiss = rewarded.on('dismiss', () => {
            offReward();
            offDismiss();
            resolve(earned);
        });
        rewarded.load()
            .then(() => rewarded.show())
            .catch((error) => {
                console.error('Rewarded ad failed:', error);
                trackEvent('rewarded_ad_show_failed', {
                    error_message: formatAdError(error).slice(0, 100),
                });
                offReward();
                offDismiss();
                resolve(false);
            });
    });
}

// admob-plusのイベントはdocumentに非バブリングで発火されるため、windowではなくdocumentで受け取る
document.addEventListener('admob.ad.dismiss', () => {
    // Once a interstitial ad is shown, it cannot be shown again.
    // Starts loading the next interstitial ad as soon as it is dismissed.
    adShowing = false;
    preloadAd();
});

// show()が成功扱いでも表示に失敗した場合は、表示中のまま固まらないよう状態を戻す
document.addEventListener('admob.ad.showfail', (evt) => {
    trackAdShowFailed('showfail', evt && evt.error ? evt.error : evt);
    adShowing = false;
    preloadAd();
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
        adPendingShow = false;
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
    trackEvent("show_purchase_dialog", {}, false);
    // 購入ダイアログは現状タイトル画面のボタンからのみ開く。将来automatic/after_mission/after_adを追加する場合はここでtriggerを切り替える
    trackEvent("purchase_dialog_shown", { trigger: "button", game_progress: getGameProgress() });
});

// 広告が実際に表示された(インプレッションが記録された)タイミングで初回のみ送信
const onAdImpression = () => {
    trackOnceEvent("ad_first_impression", STORAGE_KEYS.adFirstImpression, { ad_type: "interstitial" });
};
document.addEventListener('admob.ad.impression', onAdImpression);
document.addEventListener('admob.ad.show', onAdImpression);

const main = new Main();
main.main();

