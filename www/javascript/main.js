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
        // 選択したらその場で次の画面へ進む(確認ボタンは廃止)
        var selectGameMode = GameMode.mission;
        const gameModeSelectBackButton = $('#gameModeSelectBackbutton');
        gameModeSelectBackButton.on('click', () => {
            audioManager.play();
            goToTitlePage();
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
            diffSelector.prop('checked', false);
            PageController.pageTransition('diffSelectPage');
            preloadAd();
        })

        // 難易度選択画面
        // 選択したらその場でゲームを開始する(確認ボタンは廃止)
        var selectedDiff = GameDifficulty.easy;
        const diffSelectBackbutton = $('#diffSelectBackbutton');
        const diffSelector = $('#diffSelectPage input:radio[name="diffSelect"]');

        diffSelectBackbutton.on('click', function () {
            audioManager.play();
            PageController.pageTransition('gameModeSelectPage');
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
            // v1.1.39でSTARTボタンを廃止したため、難易度選択の確定操作をstart_button_tap相当として扱う
            trackEvent('start_button_tap');
            transitionThreePage(true, selectedDiff);
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
            PageController.pageTransition('gameModeSelectPage');
            preloadAd();
        });

        // コンティニュー
        continueButton.on('click', function () {
            // TODO: ゲームモードを取得する
            audioManager.play();
            transitionThreePage(false, selectedDiff);
        });

        // マニュアル
        manualButton.on('click', function () {
            audioManager.play();
            PageController.pageTransition('manualPage');
        });
        manualBackButton.on('click', function () {
            audioManager.play();
            goToTitlePage();
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
            if (!earned || !this.game) {
                // 広告視聴を待っている間にタイトルへ戻る等で既にゲームが破棄されている場合は何もしない
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
        // ロード画面の間に「3Dシーンの読み込み」と「開始時広告の準備」を並行して待ち、
        // 両方終わってから(広告が準備できていれば表示してから)threePageへ遷移する
        const transitionThreePage = async function (isNewGame, selectedDiff) {
            // ロード画面表示
            PageController.pageTransition('loadPage');
            setAdScene('transition');
            const progressBar = $('#loadProgressBar');
            progressBar.css('width', 0 + '%');
            const loadProgress = new LoadProgress(function (progress) {
                // 進捗バー表示のみ(ページ遷移はここでは行わない。読み込み完了はreadyPromiseで判定する)
                const progressVal = Math.max(0, Math.min(progress, 100));
                progressBar.css('width', progressVal + '%');
            });
            this.game = new Game(isNewGame, selectGameMode, selectedDiff, loadProgress, exitGame, gameOver, gameClear);

            // ゲーム開始時の広告表示判定処理へ入った時点(結果の内訳はad_request/ad_loaded/ad_show_attempt/
            // ad_impression_shown/ad_closed/ad_show_failed/ad_pending_droppedの組み合わせから追える)
            trackEvent('ad_start_gate', adCommonParams('game_start'));

            const removed = getRemoved();
            const adReadyPromise = removed
                ? Promise.resolve(false)
                : Promise.race([
                    startAdLoad().then(() => true).catch(() => false),
                    new Promise((resolve) => setTimeout(() => resolve(false), AD_START_WAIT_MS)),
                ]);

            await Promise.all([loadProgress.readyPromise, adReadyPromise]);

            if (!removed && isAdFresh() && !adShowing) {
                await new Promise((resolve) => {
                    let resolved = false;
                    const finish = () => {
                        if (resolved) return;
                        resolved = true;
                        document.removeEventListener('admob.ad.dismiss', finish);
                        document.removeEventListener('admob.ad.showfail', finish);
                        resolve();
                    };
                    document.addEventListener('admob.ad.dismiss', finish);
                    document.addEventListener('admob.ad.showfail', finish);
                    // 保険: show()呼び出し自体が失敗しネイティブイベントが来ないケースに備え、一定時間で強制的に進める
                    setTimeout(finish, 10000);
                    displayLoadedAd('start');
                });
            }

            // 3D画面表示
            PageController.pageTransition('threePage');
            $('.absolutePanel').removeClass('hiddenPage');
            setAdScene('ingame');
            this.game.start();
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
    setAdScene('title');
    goToTitlePage();
    main.main();
}

/**
 * タイトル画面へ遷移し、表示イベントを送信する
 */
function goToTitlePage() {
    PageController.pageTransition('titlePage');
    trackEvent('title_screen_view');
}

/**
 * ゲームクリア時処理
 */
function gameClear() {
    // パネルを全て消す
    $('.absolutePanel').addClass('hiddenPage');
    setAdScene('clear');
    // ゲームクリア画面表示
    var modal = new bootstrap.Modal(document.getElementById('gameClearDialog'), {
        keyboard: false
    });
    modal.show();
    showAd('clear');
}

/**
 * ゲームオーバー時処理
 */
function gameOver() {
    // パネルを全て消す
    $('.absolutePanel').addClass('hiddenPage');
    setAdScene('gameover');
    // ゲームオーバー画面表示
    var modal = new bootstrap.Modal(document.getElementById('gameOverDialog'), {
        keyboard: false
    });
    modal.show();
    showAd('gameover');
}

export class LoadProgress {
    progress = 0;
    onUpdateProgress;   // 進捗更新時処理
    modelsReady = false;
    readyPromise;
    #resolveReady;

    constructor(onUpdateProgress) {
        this.onUpdateProgress = onUpdateProgress;
        this.readyPromise = new Promise((resolve) => { this.#resolveReady = resolve; });
    }

    updateProgress(nowProgress) {
        this.progress = nowProgress;
        this.onUpdateProgress(nowProgress);
    }

    /**
     * 3Dシーン(モデル)の読み込みが完了(または失敗により打ち切り)したことを通知する
     */
    markModelsReady() {
        if (this.modelsReady) {
            return;
        }
        this.modelsReady = true;
        this.#resolveReady();
    }
}

var glot;
let glotReady = false;

// 対応言語(words.jsonの言語キー)
const SUPPORTED_LANGUAGES = ['en', 'ja', 'zh', 'zh-TW', 'ko', 'de', 'fr', 'es', 'pt', 'ru', 'id', 'th', 'vi'];
const LANGUAGE_STORAGE_KEY = 'language';

/**
 * 端末の言語コード(ja-JP, zh-Hant-TW等)や選択された言語をwords.jsonの言語キーに変換する。未対応の言語は英語にする
 */
const resolveLanguage = (rawLanguage) => {
    const lang = String(rawLanguage || '').toLowerCase();
    const base = lang.split('-')[0];
    if (base === 'zh') {
        // 繁体字(台湾・香港・マカオ/Hant)とそれ以外(簡体字)を分ける
        return /-(tw|hk|mo|hant)(-|$)/.test(lang) ? 'zh-TW' : 'zh';
    }
    if (base === 'in') {
        // 古いAndroidではインドネシア語が"in"になる
        return 'id';
    }
    return SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
};

const getStoredLanguage = () => {
    try {
        return localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch (e) {
        return null;
    }
};

let currentLanguage = resolveLanguage(getStoredLanguage() || navigator.language);

// 購入処理の案内文言をプラットフォームに合わせる(HTMLの初期値はApple向け)
const updatePurchaseProcessingInfoModel = () => {
    if (window.cordova && cordova.platformId === 'android') {
        $('[glot-model="RES_PurchaseProcessingInfo"]').attr('glot-model', 'RES_PurchaseProcessingInfoGoogle');
    }
};

// 現在の言語で文言・画像を描画する
const applyLanguage = () => {
    if (!glotReady) {
        return;
    }
    updatePurchaseProcessingInfoModel();
    glot.render(currentLanguage);
    ImgTranslator.translate(currentLanguage);
    document.documentElement.lang = currentLanguage;
    $('#languageSelect').val(currentLanguage);
    // 翻訳済みの文言でデイリーミッション表示を更新する
    renderDailyMission();
};

window.addEventListener('DOMContentLoaded', function () {
    glot = new Glottologist();
    glot.import("resources/words.json").then(() => {
        glotReady = true;
        applyLanguage();
    });
});

// Cordovaの準備完了後にプラットフォーム依存の文言を反映し直す
document.addEventListener('deviceready', () => applyLanguage());

// 言語切り替え時動作(タイトル画面表示のたびに呼ばれるため、既存のハンドラを外してから設定する)
const initUpdateLanguage = () => {
    $('#languageSelect').off('change').on('change', function () {
        currentLanguage = resolveLanguage($(this).val());
        console.log("change language " + currentLanguage);
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
        } catch (e) {
            // 保存できなくても今回の表示は切り替える
        }
        applyLanguage();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('selectLanguageModal')).hide();
    });
}

let interstitial;
let rewarded;
let adAppVersion = 'unknown'; // 広告イベント計測用のアプリバージョン(deviceready時にBuildInfoから取得)

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

    adAppVersion = (typeof BuildInfo !== 'undefined' && BuildInfo.version) || 'unknown';

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
let adLoadedAt = 0;     // 読み込みが完了した時刻(期限管理用)
let adLoading = null;   // 読み込み中のPromise(読み込み中でなければnull)
let adShowing = false;  // 広告を表示中か

// 読み込み済み広告の期限。AdMobの仕様上インタースティシャルは概ね1時間で失効するため、余裕を見て55分で読み直す
const AD_EXPIRY_MS = 55 * 60 * 1000;
const isAdFresh = () => adLoaded && (Date.now() - adLoadedAt) < AD_EXPIRY_MS;

// 読み込み失敗時の再読み込み間隔(No fill/Network errorとも共通)。成功したら最初の間隔に戻す
const RELOAD_BACKOFF_MS = [30000, 60000, 120000, 300000];
let backoffIndex = 0;
let retryCount = 0;         // 連続失敗回数(計測用。成功でリセット)
let reloadTimer = null;     // 次回再読み込みのタイマー
let onlineWaitHandler = null; // オフライン時、オンライン復帰を待つハンドラ
let reloadSuspended = false;   // バックグラウンド中は再読み込みタイマーを止める
let reloadPendingOnResume = false; // フォアグラウンド復帰時に再読み込みを再開すべきか

const isReloadWaiting = () => !!(reloadTimer || onlineWaitHandler);

const clearReloadWait = () => {
    if (reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
    }
    if (onlineWaitHandler) {
        window.removeEventListener('online', onlineWaitHandler);
        onlineWaitHandler = null;
    }
};

/**
 * 読み込み失敗後、間隔を空けて再読み込みを予約する。
 * オフライン中はタイマーではなくonlineイベントを待つ
 */
const scheduleReload = () => {
    clearReloadWait();
    if (getRemoved()) {
        return;
    }
    if (reloadSuspended) {
        reloadPendingOnResume = true;
        return;
    }
    if (navigator.onLine === false) {
        onlineWaitHandler = () => {
            window.removeEventListener('online', onlineWaitHandler);
            onlineWaitHandler = null;
            startAdLoad();
        };
        window.addEventListener('online', onlineWaitHandler);
        return;
    }
    const idx = Math.min(backoffIndex, RELOAD_BACKOFF_MS.length - 1);
    reloadTimer = setTimeout(() => {
        reloadTimer = null;
        startAdLoad();
    }, RELOAD_BACKOFF_MS[idx]);
};

/**
 * 実際に広告読み込みリクエストを行う。読み込み中/バックオフ待機中/読み込み済み(期限内)なら何もしない
 */
const startAdLoad = () => {
    if (getRemoved()) {
        return Promise.resolve();
    }
    if (adLoading) {
        return adLoading;
    }
    if (isReloadWaiting()) {
        // バックオフ/オンライン待ち中はここでは読み込み直さない。タイマー/onlineイベント任せにする
        return Promise.reject(new Error('ad_reload_waiting'));
    }
    if (isAdFresh()) {
        return Promise.resolve();
    }
    adLoaded = false;
    // 実際の読み込み要求元となった場面をplacementの代わりに使う(先読みは特定のplacementに紐付かないため)
    const requestPlacement = currentAdScene;
    trackEvent('ad_request', adCommonParams(requestPlacement));
    adLoading = interstitial.load()
        .then(() => {
            adLoaded = true;
            adLoadedAt = Date.now();
            backoffIndex = 0;
            retryCount = 0;
            clearReloadWait();
            trackEvent('ad_loaded', adCommonParams(requestPlacement));
            tryShowPending();
        })
        .catch((error) => {
            adLoaded = false;
            trackAdShowFailed('load', error, {
                retry_count: retryCount,
                is_ad_loaded: false,
                ...adCommonParams(requestPlacement),
            });
            retryCount++;
            scheduleReload();
            backoffIndex = Math.min(backoffIndex + 1, RELOAD_BACKOFF_MS.length - 1);
            throw error;
        })
        .finally(() => { adLoading = null; });
    return adLoading;
}

/**
 * 広告をバックグラウンドで先読みする(読み込み中/バックオフ待機中なら何もしない)
 */
const preloadAd = () => {
    if (getRemoved()) {
        return;
    }
    startAdLoad().catch(() => { });
}

/**
 * インタースティシャル広告イベント共通パラメータ
 */
const adCommonParams = (placement) => ({
    placement: placement || 'unknown',
    ad_format: 'interstitial',
    app_version: adAppVersion,
});

const adErrorCode = (error) => {
    if (error && typeof error === 'object' && error.code !== undefined && error.code !== null) {
        return error.code;
    }
    return null;
}

const trackAdShowFailed = (stage, error, extra = {}) => {
    trackEvent('ad_show_failed', Object.assign({
        stage: stage,
        error_message: formatAdError(error).slice(0, 100),
        error_code: adErrorCode(error),
    }, extra));
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
// ゲーム開始/コンティニュー時、ロード画面内で広告の準備を待つ上限時間(ms)
const AD_START_WAIT_MS = 3500;
// 表示チャンスを逃した広告を、読み込み完了後にどれだけの間なら表示していいか(ms)
const AD_PENDING_MAX_MS = 5000;
// pendingShowを表示してよい「区切り」の場面。それ以外(プレイ中/タイトル等)ならpendingは捨てる
const AD_PENDING_ALLOWED_SCENES = new Set(['gameover', 'clear', 'transition']);

let currentAdScene = 'title'; // 現在の場面(pending show判定に使う)
let pendingShow = null;       // { placement, requestedAt } | null
let lastAdPlacement = null;   // 直近表示した広告のplacement(impression計測用)

/**
 * 現在の場面を記録する。ページ遷移/ダイアログ表示のたびに呼び出す
 */
const setAdScene = (scene) => {
    currentAdScene = scene;
}

/**
 * 表示チャンスを逃した広告(pendingShow)の読み込みが完了したので、まだ表示してよいか判定する
 */
const tryShowPending = () => {
    if (!pendingShow) {
        return;
    }
    const { placement, requestedAt } = pendingShow;
    pendingShow = null;
    if (getRemoved() || adShowing) {
        return;
    }
    const waitMs = Date.now() - requestedAt;
    if (waitMs > AD_PENDING_MAX_MS) {
        trackEvent('ad_pending_dropped', { reason: 'expired', placement, wait_ms: waitMs });
        return;
    }
    if (!AD_PENDING_ALLOWED_SCENES.has(currentAdScene)) {
        trackEvent('ad_pending_dropped', { reason: 'context_changed', placement, wait_ms: waitMs });
        return;
    }
    trackEvent('ad_pending_shown', { wait_ms: waitMs, placement });
    displayLoadedAd(placement);
}

export const showAd = async (placement) => {
    if (getRemoved()) {
        // 広告削除課金を行っている場合は表示しない
        return;
    }
    if (!interstitial || adShowing) {
        // 初期化前、または別の広告を表示中(ゲームオーバーとプレイ中広告の同時発生など)は表示しない
        return;
    }

    console.log("showAd", placement);
    if (!isAdFresh()) {
        // 先読みが間に合っていない場合、短時間だけ読み込み完了を待ってから判断する
        await Promise.race([
            startAdLoad().catch(() => { }),
            new Promise((resolve) => setTimeout(resolve, AD_READY_WAIT_MS)),
        ]);
    }
    if (isAdFresh() && !adShowing) {
        await displayLoadedAd(placement);
        return;
    }

    // それでも間に合わなかった場合
    const reason = adLoading ? 'loading' : (isReloadWaiting() ? 'backoff' : 'not_loaded');
    trackAdShowFailed('not_ready', reason, { is_ad_loaded: false, ...adCommonParams(placement) });
    if (placement !== 'ingame') {
        // プレイ中広告以外は、読み込み完了後に「区切り」の場面がまだ続いていれば表示する
        pendingShow = { placement, requestedAt: Date.now() };
    }
    // 読み込み中/バックオフ待機中でなければ読み込みを試みる(バックオフ中なら何もしない)
    preloadAd();
}

/**
 * 読み込み済みの広告を表示する
 * @param {string} placement 表示箇所(gameover/clear/ingame/start)
 */
const displayLoadedAd = async (placement) => {
    if (adShowing) {
        // 別の広告を表示中なら重複表示しない(次の読み込み完了時に改めて表示を試みる)
        if (placement !== 'ingame') {
            pendingShow = { placement, requestedAt: Date.now() };
        }
        return;
    }
    adShowing = true;
    // 一度表示した広告は再表示できないため、表示前に読み込み済みフラグを落とす
    adLoaded = false;
    lastAdPlacement = placement;
    trackEvent('ad_show_attempt', adCommonParams(placement));
    try {
        await interstitial.show();
    } catch (error) {
        console.error('Ad failed to show:', error);
        trackAdShowFailed('show', error, { is_ad_loaded: true, ...adCommonParams(placement) });
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
        if (getRemoved() || !rewarded || adShowing) {
            // 他の全画面広告(インタースティシャル)を表示中の場合は同時表示によるクラッシュを避けるため表示しない
            resolve(false);
            return;
        }
        adShowing = true;
        let earned = false;
        const offReward = rewarded.on('reward', () => {
            earned = true;
        });
        const offDismiss = rewarded.on('dismiss', () => {
            adShowing = false;
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
                adShowing = false;
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
    trackEvent('ad_closed', adCommonParams(lastAdPlacement));
    adShowing = false;
    preloadAd();
});

// show()が成功扱いでも表示に失敗した場合は、表示中のまま固まらないよう状態を戻す
document.addEventListener('admob.ad.showfail', (evt) => {
    trackAdShowFailed('showfail', evt && evt.error ? evt.error : evt, { is_ad_loaded: true, ...adCommonParams(lastAdPlacement) });
    adShowing = false;
    preloadAd();
});

// アプリがバックグラウンドの間は再読み込みのバックオフタイマーを止め、フォアグラウンド復帰時に再開する
document.addEventListener('pause', () => {
    reloadSuspended = true;
    if (isReloadWaiting()) {
        reloadPendingOnResume = true;
    }
    clearReloadWait();
}, false);
document.addEventListener('resume', () => {
    reloadSuspended = false;
    if (reloadPendingOnResume) {
        reloadPendingOnResume = false;
        scheduleReload();
    }
}, false);

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
        pendingShow = null;
        clearReloadWait();
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

// 広告が実際に表示された(インプレッションが記録された)タイミングで送信
// (ad_impressionという名前はAdMob連携によるGA4自動収集イベントと衝突するため、
//  このad_impression_shownを実質的な"ad_impression"として扱う)
const onAdImpression = () => {
    trackOnceEvent("ad_first_impression", STORAGE_KEYS.adFirstImpression, { ad_type: "interstitial" });
    trackEvent("ad_impression_shown", adCommonParams(lastAdPlacement));
};
document.addEventListener('admob.ad.impression', onAdImpression);
document.addEventListener('admob.ad.show', onAdImpression);

const main = new Main();
main.main();
// 起動直後はJS側で明示的にtitlePageへ遷移しない(初期状態で表示済み)ため、ここで1回だけ計測する
trackEvent('title_screen_view');

