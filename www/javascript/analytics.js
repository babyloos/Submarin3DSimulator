/**
 * Analytics共通処理
 * - イベント送信ラッパー(trackEvent / trackOnceEvent)
 * - A/Bテストのvariant割り当て
 * - フォアグラウンド時間ベースのセッション計測(session_5min / session_10min)
 *
 * 送信失敗がゲーム処理に影響しないよう、全て例外を握りつぶす。
 */

// 開発時ログ(console)の出力有無。本番で不要ならfalseにする
const ANALYTICS_LOG_ENABLED = true;

// #region ローカルストレージのキー
export const STORAGE_KEYS = {
    experimentVariant: 'experiment_daily_mission_variant',
    firstGameStart: 'analytics_first_game_start_sent',
    firstTorpedoFired: 'analytics_first_torpedo_fired_sent',
    firstEnemySunk: 'analytics_first_enemy_sunk_sent',
    adFirstImpression: 'analytics_ad_first_impression_sent',
    missionClearedOnce: 'analytics_mission_cleared_once',
};
// #endregion

const VARIANT_A = 'A';
const VARIANT_B = 'B';

// GA4のセッションタイムアウトに合わせ、これ以上バックグラウンドにいたら新セッション扱いにする
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// #region localStorage(利用不可でも動くようにする)

const memoryStorage = {};

function storageGet(key) {
    try {
        const value = window.localStorage.getItem(key);
        if (value !== null) {
            return value;
        }
    } catch (e) {
        // 無視
    }
    return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
}

function storageSet(key, value) {
    memoryStorage[key] = value;
    try {
        window.localStorage.setItem(key, value);
    } catch (e) {
        // 無視
    }
}

// #endregion

// #region イベント送信

/**
 * Firebase Analyticsへイベントを送信する
 * @param {string} name イベント名
 * @param {object} params パラメータ
 * @param {boolean} withVariant experiment_variantを自動付与するか
 * @return {boolean} 送信処理を行えたか
 */
export function trackEvent(name, params = {}, withVariant = true) {
    try {
        const sendParams = Object.assign({}, params);
        if (withVariant) {
            sendParams.experiment_variant = getExperimentVariant();
        }
        if (ANALYTICS_LOG_ENABLED) {
            console.log('[Analytics] ' + name, JSON.stringify(sendParams));
        }
        if (typeof FirebasePlugin !== 'undefined') {
            FirebasePlugin.logEvent(name, sendParams, () => { }, (error) => {
                console.error('[Analytics] send failed: ' + name, error);
            });
        }
        return true;
    } catch (e) {
        console.error('[Analytics] error: ' + name, e);
        return false;
    }
}

/**
 * 1ユーザー1回だけイベントを送信する
 * @param {string} name イベント名
 * @param {string} storageKey 送信済みフラグを保存するlocalStorageキー
 * @param {object} params パラメータ
 * @return {boolean} 今回送信したか
 */
export function trackOnceEvent(name, storageKey, params = {}) {
    try {
        if (storageGet(storageKey) === '1') {
            return false;
        }
        // 二重送信を避けるため先にフラグを立てる
        storageSet(storageKey, '1');
        return trackEvent(name, params);
    } catch (e) {
        console.error('[Analytics] error: ' + name, e);
        return false;
    }
}

// #endregion

// #region A/Bテスト

let cachedVariant = null;

/**
 * ユーザーのA/B variantを取得する(未割り当てなら50%でA/Bを割り当てて保存する)
 * @return {string} "A" または "B"
 */
export function getExperimentVariant() {
    if (cachedVariant !== null) {
        return cachedVariant;
    }
    let variant = storageGet(STORAGE_KEYS.experimentVariant);
    if (variant !== VARIANT_A && variant !== VARIANT_B) {
        variant = Math.random() < 0.5 ? VARIANT_A : VARIANT_B;
        storageSet(STORAGE_KEYS.experimentVariant, variant);
        if (ANALYTICS_LOG_ENABLED) {
            console.log('[Analytics] assign experiment variant: ' + variant);
        }
    }
    cachedVariant = variant;
    return variant;
}

/**
 * B版(ミッション種類追加版)か
 */
export function isVariantB() {
    return getExperimentVariant() === VARIANT_B;
}

/**
 * GA4上でvariant別にリテンション等を比較できるよう、ユーザープロパティに設定する
 */
function setVariantUserProperty() {
    try {
        if (typeof FirebasePlugin !== 'undefined') {
            FirebasePlugin.setUserProperty('experiment_variant', getExperimentVariant());
        }
    } catch (e) {
        console.error('[Analytics] setUserProperty failed', e);
    }
}

// #endregion

// #region ゲーム進行状況

/**
 * ミッション達成済みとして記録する(game_progress算出用)
 */
export function markMissionClearedOnce() {
    storageSet(STORAGE_KEYS.missionClearedOnce, '1');
}

/**
 * 現在のゲーム進行状況(purchase_dialog_shownのgame_progress用)
 * @return {string} cleared / sunk_enemy / played / not_played
 */
export function getGameProgress() {
    if (storageGet(STORAGE_KEYS.missionClearedOnce) === '1') {
        return 'cleared';
    }
    if (storageGet(STORAGE_KEYS.firstEnemySunk) === '1') {
        return 'sunk_enemy';
    }
    if (storageGet(STORAGE_KEYS.firstGameStart) === '1') {
        return 'played';
    }
    return 'not_played';
}

// #endregion

// #region フォアグラウンド時間 / セッション計測

let foregroundAccumMs = 0;      // バックグラウンドに入るまでに積算したフォアグラウンド時間
let foregroundSince = null;     // フォアグラウンドになった時刻(バックグラウンド中はnull)
let backgroundedAt = null;      // バックグラウンドに入った時刻
let sessionBaseMs = 0;          // セッション開始時点の累計フォアグラウンド時間
let session5minSent = false;
let session10minSent = false;

/**
 * アプリ起動からの累計フォアグラウンド時間(ms)。バックグラウンド中は進まない
 */
export function getForegroundMs() {
    return foregroundAccumMs + (foregroundSince !== null ? Date.now() - foregroundSince : 0);
}

function startNewSession() {
    sessionBaseMs = getForegroundMs();
    session5minSent = false;
    session10minSent = false;
}

function onAppPause() {
    if (foregroundSince === null) {
        return;
    }
    const now = Date.now();
    foregroundAccumMs += now - foregroundSince;
    foregroundSince = null;
    backgroundedAt = now;
}

function onAppResume() {
    if (foregroundSince !== null) {
        return;
    }
    const now = Date.now();
    if (backgroundedAt !== null && now - backgroundedAt >= SESSION_TIMEOUT_MS) {
        startNewSession();
    }
    foregroundSince = now;
    backgroundedAt = null;
}

function checkSessionTime() {
    try {
        const sessionMs = getForegroundMs() - sessionBaseMs;
        if (!session5minSent && sessionMs >= 5 * 60 * 1000) {
            session5minSent = true;
            trackEvent('session_5min');
        }
        if (!session10minSent && sessionMs >= 10 * 60 * 1000) {
            session10minSent = true;
            trackEvent('session_10min');
        }
    } catch (e) {
        console.error('[Analytics] session check error', e);
    }
}

function initSessionTimer() {
    if (document.visibilityState !== 'hidden') {
        foregroundSince = Date.now();
    }
    startNewSession();

    // Cordovaのライフサイクルイベント
    document.addEventListener('pause', onAppPause, false);
    document.addEventListener('resume', onAppResume, false);
    // ブラウザでの動作確認用(冪等なので二重に呼ばれても問題ない)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            onAppPause();
        } else {
            onAppResume();
        }
    }, false);

    // setTimeoutで5分/10分後に発火させるのではなく、積算したフォアグラウンド時間を定期的に判定する
    setInterval(checkSessionTime, 1000);
}

// #endregion

// 初回起動時にvariantを割り当てる
getExperimentVariant();
setVariantUserProperty();
initSessionTimer();

// FirebasePluginはdeviceready後に使えるようになるため、ユーザープロパティは再設定する
document.addEventListener('deviceready', setVariantUserProperty, false);
