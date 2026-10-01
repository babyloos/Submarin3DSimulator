/**
 * ゲームプレイ行動分析用のGA4イベント計測
 *
 * - イベント名/パラメータ名を一元管理する(GA_EVENT / GA_PARAM)
 * - 1プレイ分のコンテキスト(mode, mission_id, attempt_no, 経過時間, 集計値)を保持し、
 *   ゲームプレイ関連イベントへ共通パラメータを自動付与する
 * - 送信はanalytics.jsのtrackEvent経由(experiment_variantも自動付与される)
 *
 * 高頻度イベント(毎フレーム・座標/舵角変化)は送らない。状態が変わった時・ユーザーが操作した時のみ送る。
 * 送信失敗がゲーム処理に影響しないよう、公開関数は全て例外を握りつぶす。
 */
import { getForegroundMs, trackEvent } from "./analytics.js";

// #region イベント名 / パラメータ名

export const GA_EVENT = {
    // タイトル〜ゲーム開始導線(title_screen_view / start_button_tap / game_loaded / mission_start は既存イベントを継続利用)
    START_TAP: 'start_tap',
    MODE_SELECT_VIEW: 'mode_select_view',
    MODE_SELECTED: 'mode_selected',
    MISSION_SELECT_VIEW: 'mission_select_view',
    MISSION_SELECTED: 'mission_selected',
    GAME_LOADED: 'game_loaded',             // 既存。仕様書のgame_readyに相当(パラメータを追加)
    MISSION_START: 'mission_start',         // 既存

    // 初回ガイド
    TUTORIAL_STEP: 'tutorial_step',
    TUTORIAL_COMPLETE: 'tutorial_complete',
    TUTORIAL_SKIP: 'tutorial_skip',

    // 操作
    CONTROL_ACTION: 'control_action',
    VIEW_ACTION: 'view_action',

    // 索敵
    ENEMY_FIRST_DETECTED: 'enemy_first_detected',

    // 魚雷
    TORPEDO_AIM_BEGIN: 'torpedo_aim_begin',
    TORPEDO_FIRED: 'torpedo_fired',
    TORPEDO_HIT: 'torpedo_hit',
    TORPEDO_MISS: 'torpedo_miss',
    TORPEDO_EMPTY: 'torpedo_empty',
    TORPEDO_FIRE_BLOCKED: 'torpedo_fire_blocked',

    // 撃沈
    ENEMY_SUNK: 'enemy_sunk',

    // 被害
    ENEMY_FIRST_ATTACK: 'enemy_first_attack',
    PLAYER_DAMAGED: 'player_damaged',
    PLAYER_SUNK: 'player_sunk',

    // 終了
    LEVEL_END: 'level_end',
    MISSION_ABANDONED: 'mission_abandoned',
    MISSION_SUMMARY: 'mission_summary',

    // リザルト後
    RESULT_VIEW: 'result_view',
    RETRY_SELECTED: 'retry_selected',
    RETURN_TITLE_SELECTED: 'return_title_selected',
};

export const GA_PARAM = {
    MODE: 'mode',
    MISSION_ID: 'mission_id',
    DIFFICULTY: 'difficulty',
    ATTEMPT_NO: 'attempt_no',
    ELAPSED_SEC: 'elapsed_sec',
    IS_FIRST_GAME: 'is_first_game',
    IS_FIRST_SESSION: 'is_first_session',
    IS_CONTINUE: 'is_continue',
    IS_RECOMMENDED: 'is_recommended',
    RECOMMENDATION_SHOWN: 'recommendation_shown',
    ENTRY: 'entry',
    LOAD_MS: 'load_ms',
    ACTION: 'action',
    VIEW: 'view',
    ENEMY_TYPE: 'enemy_type',
    TARGET_TYPE: 'target_type',
    DISTANCE_M: 'distance_m',
    AIM_ERROR_DEG: 'aim_error_deg',
    AIM_INPUT: 'aim_input',
    DETECTION_METHOD: 'detection_method',
    FOUND_COUNT: 'found_count',
    SHOT_NO: 'shot_no',
    REASON: 'reason',
    CAUSE: 'cause',
    DAMAGE: 'damage',
    ENEMY_TONNAGE: 'enemy_tonnage',
    SUCCESS: 'success',
    END_REASON: 'end_reason',
    DURATION_SEC: 'duration_sec',
    ENEMIES_DETECTED: 'enemies_detected',
    ENEMIES_SUNK: 'enemies_sunk',
    TORPEDOES_FIRED: 'torpedoes_fired',
    TORPEDOES_HIT: 'torpedoes_hit',
    DAMAGE_TAKEN: 'damage_taken',
    MAX_DEPTH: 'max_depth',
    MAX_TIME_SCALE: 'max_time_scale',
    TUTORIAL_STEP: 'tutorial_step',
};

// #endregion

// #region 定数

const STORAGE_KEYS = {
    gameAttemptCount: 'analytics_game_attempt_count',   // ユーザー単位のゲーム開始回数(ニューゲーム+コンティニュー)
    launchCount: 'analytics_launch_count',              // アプリ起動回数
};

// 同じcontrol_action/view_action/torpedo_fire_blockedを連続送信しない間隔(ms, 実時間)
const REPEAT_SUPPRESS_MS = 10 * 1000;

// 潜望鏡の照準方向と敵船の方位差がこの角度以内なら、その船を狙っているとみなす
const AIM_TARGET_TOLERANCE_DEG = 20;

// 敵船がこの距離(m)以内に入ったら、索敵操作をしなくても視認できる距離にいるとみなす(enemy_first_detectedのproximity)
const PROXIMITY_DETECT_RANGE_M = 3000;

// #endregion

// #region localStorage(利用不可でも動くようにする)

function storageGetNumber(key) {
    try {
        const value = parseInt(window.localStorage.getItem(key), 10);
        return isNaN(value) ? 0 : value;
    } catch (e) {
        return 0;
    }
}

function storageSetNumber(key, value) {
    try {
        window.localStorage.setItem(key, String(value));
    } catch (e) {
        // 無視
    }
}

// #endregion

// #region 初回セッション判定(モジュール読み込み=アプリ起動時に1回だけ判定する)

const isFirstSession = (() => {
    const launchCount = storageGetNumber(STORAGE_KEYS.launchCount);
    storageSetNumber(STORAGE_KEYS.launchCount, launchCount + 1);
    return launchCount === 0;
})();

// #endregion

// #region 1プレイ分のコンテキスト

let ctx = null;

/**
 * これまでのゲーム開始回数(ニューゲーム/コンティニューの合計)
 */
export function getGameAttemptCount() {
    return storageGetNumber(STORAGE_KEYS.gameAttemptCount);
}

/**
 * ゲーム開始時(Gameのコンストラクタ)に呼ぶ。プレイ単位のフラグ・集計値をリセットする
 * @param {object} info { mode, missionId, difficulty, isContinue }
 */
export function beginGame(info) {
    try {
        const attemptNo = getGameAttemptCount() + 1;
        storageSetNumber(STORAGE_KEYS.gameAttemptCount, attemptNo);
        ctx = {
            mode: info.mode,
            missionId: info.missionId,
            difficulty: info.difficulty,
            isContinue: !!info.isContinue,
            attemptNo: attemptNo,
            isFirstGame: attemptNo === 1,
            startForegroundMs: getForegroundMs(),
            loadStartedAt: Date.now(),
            once: {},               // 1プレイ1回だけ送るイベントの送信済みフラグ
            lastSentAt: {},         // 連続送信抑止用(キー→実時刻)
            shotNo: 0,
            torpedoesFired: 0,
            torpedoesHit: 0,
            enemiesSunk: 0,
            detectedShips: new Set(),
            damageTaken: 0,
            maxDepth: 0,
            maxTimeScale: 1,
            lastDamageCause: null,
            aimActive: false,       // 前回の発射以降に照準操作を始めたか
            lastEngineAction: null,
            lastDepthAction: null,
            ended: false,
        };
    } catch (e) {
        console.error('[GameAnalytics] beginGame error', e);
    }
}

/**
 * コンティニュー時など、セーブデータ読み込み後に判明したmode/mission_id/difficultyを反映する
 */
export function updateGameInfo(info) {
    if (!ctx) {
        return;
    }
    if (info.mode) ctx.mode = info.mode;
    if (info.missionId) ctx.missionId = info.missionId;
    if (info.difficulty) ctx.difficulty = info.difficulty;
}

/**
 * mission_id("skirmish_easy"等)からmode/difficultyを取り出す
 */
export function parseMissionId(missionId) {
    const parts = String(missionId || '').split('_');
    return { mode: parts[0] || undefined, difficulty: parts[1] || undefined };
}

function elapsedSec() {
    if (!ctx) {
        return 0;
    }
    return Math.max(0, Math.round((getForegroundMs() - ctx.startForegroundMs) / 1000));
}

/**
 * ゲームプレイ関連イベントの共通パラメータ
 */
function commonParams() {
    if (!ctx) {
        return flowParams();
    }
    return {
        [GA_PARAM.MODE]: ctx.mode,
        [GA_PARAM.MISSION_ID]: ctx.missionId,
        [GA_PARAM.DIFFICULTY]: ctx.difficulty,
        [GA_PARAM.ATTEMPT_NO]: ctx.attemptNo,
        [GA_PARAM.ELAPSED_SEC]: elapsedSec(),
        [GA_PARAM.IS_FIRST_GAME]: ctx.isFirstGame ? 1 : 0,
        [GA_PARAM.IS_FIRST_SESSION]: isFirstSession ? 1 : 0,
    };
}

/**
 * ゲーム開始前の導線イベント用パラメータ(まだプレイが無いのでmode等は付けない)
 */
function flowParams() {
    return {
        // これから始めるゲームが初回か(まだ1回もゲームを開始していないか)
        [GA_PARAM.IS_FIRST_GAME]: getGameAttemptCount() === 0 ? 1 : 0,
        [GA_PARAM.IS_FIRST_SESSION]: isFirstSession ? 1 : 0,
    };
}

function send(name, params) {
    try {
        // undefinedのパラメータは送らない
        const clean = {};
        Object.keys(params).forEach((key) => {
            if (params[key] !== undefined && params[key] !== null) {
                clean[key] = params[key];
            }
        });
        trackEvent(name, clean);
    } catch (e) {
        console.error('[GameAnalytics] send error: ' + name, e);
    }
}

/**
 * ゲーム開始前の導線イベントを送信する(タイトル〜モード/難易度選択)
 */
export function trackFlow(name, params = {}) {
    send(name, Object.assign(flowParams(), params));
}

/**
 * ゲームプレイ関連イベントを共通パラメータ付きで送信する
 */
export function trackGame(name, params = {}) {
    send(name, Object.assign(commonParams(), params));
}

/**
 * 1プレイにつき1回だけ送信する
 * @return {boolean} 今回送信したか
 */
function trackGameOnce(name, params = {}) {
    if (!ctx || ctx.once[name]) {
        return false;
    }
    ctx.once[name] = true;
    trackGame(name, params);
    return true;
}

/**
 * 同じキーの送信から一定時間内なら送らない(連打・連続操作対策)
 * @return {boolean} 今回送信したか
 */
function trackGameThrottled(key, name, params = {}) {
    if (!ctx) {
        return false;
    }
    const now = Date.now();
    const last = ctx.lastSentAt[key];
    if (last !== undefined && now - last < REPEAT_SUPPRESS_MS) {
        return false;
    }
    ctx.lastSentAt[key] = now;
    trackGame(name, params);
    return true;
}

// #endregion

// #region 共通ユーティリティ

function enemyTypeOf(ship) {
    // ObjectType.destoryer1 = 5, marchant1 = 4 (constants.jsとの循環参照を避けるため値で判定)
    if (!ship) {
        return 'none';
    }
    return ship.objectType === 5 ? 'destroyer' : 'merchant';
}

function angleDiff(a, b) {
    const diff = Math.abs(((a - b) % 360 + 540) % 360 - 180);
    return diff;
}

/**
 * 潜望鏡の照準方向(艦首方位+TDCの目標方位)に最も近い敵船を推定する
 * @return {object} { target_type, distance_m, aim_error_deg }
 */
function estimateAimTarget(uboat, enemies) {
    const result = {
        [GA_PARAM.TARGET_TYPE]: 'none',
        [GA_PARAM.DISTANCE_M]: undefined,
        [GA_PARAM.AIM_ERROR_DEG]: undefined,
    };
    if (!uboat || !enemies) {
        return result;
    }
    const aimDirection = ((uboat.course + (uboat.tdc ? uboat.tdc.bearing : 0)) % 360 + 360) % 360;
    let best = null;
    let bestDiff = Infinity;
    enemies.forEach((ship) => {
        if (!ship.isEnabled) {
            return;
        }
        const diff = angleDiff(uboat.calcDirectionOtherObject(ship), aimDirection);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = ship;
        }
    });
    if (best) {
        result[GA_PARAM.AIM_ERROR_DEG] = Math.round(bestDiff);
        result[GA_PARAM.DISTANCE_M] = Math.round(uboat.calcRangeOtherObject(best));
        result[GA_PARAM.TARGET_TYPE] = bestDiff <= AIM_TARGET_TOLERANCE_DEG ? enemyTypeOf(best) : 'none';
    }
    return result;
}

function nearestEnemy(uboat, ships) {
    let best = null;
    let bestRange = Infinity;
    (ships || []).forEach((ship) => {
        if (!ship || !ship.isEnabled) {
            return;
        }
        const range = uboat.calcRangeOtherObject(ship);
        if (range < bestRange) {
            bestRange = range;
            best = ship;
        }
    });
    return best ? { ship: best, range: bestRange } : null;
}

// #endregion

// #region ゲーム開始

/**
 * 3D画面が表示され操作可能になった時(既存game_loadedにパラメータを追加して送る。1プレイ1回)
 */
export function onGameReady() {
    try {
        if (!ctx) {
            return;
        }
        trackGameOnce(GA_EVENT.GAME_LOADED, {
            [GA_PARAM.LOAD_MS]: Date.now() - ctx.loadStartedAt,
            [GA_PARAM.IS_CONTINUE]: ctx.isContinue ? 1 : 0,
        });
    } catch (e) {
        console.error('[GameAnalytics] onGameReady error', e);
    }
}

// #endregion

// #region 定期チェック(Gameの更新ループから実時間1秒ごとに呼ぶ)

/**
 * 最大深度の記録と、近距離の敵船(視認可能距離)によるenemy_first_detectedの判定
 */
export function onPeriodicCheck(uboat, enemies) {
    try {
        if (!ctx || ctx.ended || !uboat) {
            return;
        }
        if (uboat.depth > ctx.maxDepth) {
            ctx.maxDepth = uboat.depth;
        }
        const nearest = nearestEnemy(uboat, enemies);
        if (nearest && nearest.range <= PROXIMITY_DETECT_RANGE_M) {
            ctx.detectedShips.add(nearest.ship);
            trackGameOnce(GA_EVENT.ENEMY_FIRST_DETECTED, {
                [GA_PARAM.ENEMY_TYPE]: enemyTypeOf(nearest.ship),
                [GA_PARAM.DISTANCE_M]: Math.round(nearest.range),
                [GA_PARAM.DETECTION_METHOD]: 'proximity',
            });
        }
    } catch (e) {
        console.error('[GameAnalytics] onPeriodicCheck error', e);
    }
}

// #endregion

// #region 操作

/**
 * エンジン出力の変更(前進/後進/停止の区分が変わった時のみ送る)
 * @param {number} engineOut EngineOut(-3〜3)
 */
export function onEngineChanged(engineOut) {
    try {
        if (!ctx) {
            return;
        }
        const action = engineOut > 0 ? 'engine_forward' : (engineOut < 0 ? 'engine_reverse' : 'engine_stop');
        if (action === ctx.lastEngineAction) {
            return;
        }
        ctx.lastEngineAction = action;
        trackGame(GA_EVENT.CONTROL_ACTION, { [GA_PARAM.ACTION]: action });
    } catch (e) {
        console.error('[GameAnalytics] onEngineChanged error', e);
    }
}

/**
 * 目標深度の変更(浮上/潜望鏡深度/潜航の区分が変わった時のみ送る)
 * @param {number} distDepth 目標深度(m)
 */
export function onDepthOrdered(distDepth) {
    try {
        if (!ctx) {
            return;
        }
        // GameObject.depthState()と同じ区分(5m以下: 浮上, 14m以下: 潜望鏡深度, それ以上: 潜航)
        const action = distDepth <= 5 ? 'surface' : (distDepth <= 14 ? 'periscope_depth' : 'dive');
        if (action === ctx.lastDepthAction) {
            return;
        }
        ctx.lastDepthAction = action;
        trackGame(GA_EVENT.CONTROL_ACTION, { [GA_PARAM.ACTION]: action });
    } catch (e) {
        console.error('[GameAnalytics] onDepthOrdered error', e);
    }
}

/**
 * 針路の変更(同じ向きへの連続変更は一定時間送らない)
 * @param {number} relativeDeg 現在の針路からの変更量(0〜360, 時計回り)
 */
export function onCourseOrdered(relativeDeg) {
    try {
        if (!ctx) {
            return;
        }
        const deg = ((relativeDeg % 360) + 360) % 360;
        if (deg === 0) {
            return;
        }
        const action = deg < 180 ? 'turn_starboard' : 'turn_port';
        trackGameThrottled('control:' + action, GA_EVENT.CONTROL_ACTION, { [GA_PARAM.ACTION]: action });
    } catch (e) {
        console.error('[GameAnalytics] onCourseOrdered error', e);
    }
}

/**
 * 時間倍率の変更(上げ/下げそれぞれ一定時間内の連続操作は1回にまとめる。最大倍率はsummaryに記録)
 * @param {number} before 変更前の倍率
 * @param {number} after 変更後の倍率
 */
export function onTimeScaleChanged(before, after) {
    try {
        if (!ctx || before === after) {
            return;
        }
        ctx.maxTimeScale = Math.max(ctx.maxTimeScale, after);
        const action = after > before ? 'time_accel_up' : 'time_accel_down';
        trackGameThrottled('control:' + action, GA_EVENT.CONTROL_ACTION, { [GA_PARAM.ACTION]: action });
    } catch (e) {
        console.error('[GameAnalytics] onTimeScaleChanged error', e);
    }
}

/**
 * 画面/報告の表示(潜望鏡画面を開いた・見張り/聴音の報告を受けた)
 * @param {string} view periscope / lookout / sonar
 * @param {object} extra 追加パラメータ
 */
export function onView(view, extra = {}) {
    try {
        trackGameThrottled('view:' + view, GA_EVENT.VIEW_ACTION, Object.assign({ [GA_PARAM.VIEW]: view }, extra));
    } catch (e) {
        console.error('[GameAnalytics] onView error', e);
    }
}

// #endregion

// #region 索敵

/**
 * 見張り/聴音で敵船の報告を受けた時
 * @param {string} method lookout / sonar
 * @param {object} uboat プレイヤボート
 * @param {Array} foundShips [{ ship, range, ... }]
 */
export function onEnemiesReported(method, uboat, foundShips) {
    try {
        const ships = (foundShips || []).map((found) => found.ship);
        onView(method, { [GA_PARAM.FOUND_COUNT]: ships.length });
        if (!ctx || ships.length === 0) {
            return;
        }
        ships.forEach((ship) => ctx.detectedShips.add(ship));
        const nearest = nearestEnemy(uboat, ships);
        trackGameOnce(GA_EVENT.ENEMY_FIRST_DETECTED, {
            [GA_PARAM.ENEMY_TYPE]: enemyTypeOf(nearest && nearest.ship),
            [GA_PARAM.DISTANCE_M]: nearest ? Math.round(nearest.range) : undefined,
            [GA_PARAM.DETECTION_METHOD]: method,
        });
    } catch (e) {
        console.error('[GameAnalytics] onEnemiesReported error', e);
    }
}

// #endregion

// #region 魚雷

/**
 * 照準操作(潜望鏡の旋回・TDC諸元の入力)。前回の発射以降で最初の操作時のみtorpedo_aim_beginを送る
 * @param {string} input periscope / tdc_bearing / tdc_range / tdc_speed / tdc_aob
 */
export function onAimInput(input, uboat, enemies) {
    try {
        if (!ctx || ctx.aimActive || ctx.ended) {
            return;
        }
        ctx.aimActive = true;
        trackGame(GA_EVENT.TORPEDO_AIM_BEGIN, Object.assign({ [GA_PARAM.AIM_INPUT]: input }, estimateAimTarget(uboat, enemies)));
    } catch (e) {
        console.error('[GameAnalytics] onAimInput error', e);
    }
}

/**
 * 魚雷発射時。torpedo_firedを送り、発射番号を返す
 * (初回発射時は既存のfirst_torpedo_fired(ユーザー単位で1回)も別途送られる。役割が異なるため両方送る)
 * @return {number} shot_no(このプレイで何本目か)
 */
export function onTorpedoFired(uboat, enemies) {
    try {
        if (!ctx) {
            return 0;
        }
        ctx.shotNo++;
        ctx.torpedoesFired++;
        ctx.aimActive = false;
        trackGame(GA_EVENT.TORPEDO_FIRED, Object.assign({ [GA_PARAM.SHOT_NO]: ctx.shotNo }, estimateAimTarget(uboat, enemies)));
        return ctx.shotNo;
    } catch (e) {
        console.error('[GameAnalytics] onTorpedoFired error', e);
        return 0;
    }
}

/**
 * 発射ボタンを押したが撃てなかった時
 * @param {string} reason empty / reloading / too_deep
 */
export function onTorpedoFireBlocked(reason) {
    try {
        if (reason === 'empty') {
            trackGameThrottled('fire_blocked:empty', GA_EVENT.TORPEDO_EMPTY);
        } else {
            trackGameThrottled('fire_blocked:' + reason, GA_EVENT.TORPEDO_FIRE_BLOCKED, { [GA_PARAM.REASON]: reason });
        }
    } catch (e) {
        console.error('[GameAnalytics] onTorpedoFireBlocked error', e);
    }
}

/**
 * 魚雷が敵船に命中した時
 */
export function onTorpedoHit(torpedo, enemyShip) {
    try {
        if (!ctx || ctx.ended) {
            return;
        }
        ctx.torpedoesHit++;
        trackGame(GA_EVENT.TORPEDO_HIT, {
            [GA_PARAM.TARGET_TYPE]: enemyTypeOf(enemyShip),
            [GA_PARAM.SHOT_NO]: torpedo.shotNo || 0,
        });
    } catch (e) {
        console.error('[GameAnalytics] onTorpedoHit error', e);
    }
}

/**
 * 魚雷が命中せずに航走距離を使い切った時(明確に外れたと判定できるケースのみ)
 */
export function onTorpedoMiss(torpedo) {
    try {
        if (!ctx || ctx.ended) {
            return;
        }
        trackGame(GA_EVENT.TORPEDO_MISS, { [GA_PARAM.SHOT_NO]: torpedo.shotNo || 0 });
    } catch (e) {
        console.error('[GameAnalytics] onTorpedoMiss error', e);
    }
}

// #endregion

// #region 撃沈

/**
 * 敵船撃沈時(初回は既存first_enemy_sunk(ユーザー単位で1回)も別途送られる)
 */
export function onEnemySunk(objectType, tonnage) {
    try {
        if (!ctx || ctx.ended) {
            return;
        }
        ctx.enemiesSunk++;
        trackGame(GA_EVENT.ENEMY_SUNK, {
            [GA_PARAM.ENEMY_TYPE]: enemyTypeOf({ objectType }),
            [GA_PARAM.ENEMY_TONNAGE]: tonnage,
        });
    } catch (e) {
        console.error('[GameAnalytics] onEnemySunk error', e);
    }
}

// #endregion

// #region 被害

/**
 * 駆逐艦がプレイヤーへの攻撃(砲撃/爆雷投下)を初めて行った時(1プレイ1回)
 * @param {string} cause shell / depth_charge
 */
export function onEnemyAttack(cause) {
    try {
        trackGameOnce(GA_EVENT.ENEMY_FIRST_ATTACK, {
            [GA_PARAM.CAUSE]: cause,
            [GA_PARAM.ENEMY_TYPE]: 'destroyer',
        });
    } catch (e) {
        console.error('[GameAnalytics] onEnemyAttack error', e);
    }
}

/**
 * プレイヤーが被弾した時(砲弾命中/至近距離での爆雷爆発。命中ごとの離散イベントのため間引かない)
 * @param {string} cause shell / depth_charge
 * @param {number} damage 今回のダメージ(%)
 */
export function onPlayerDamaged(cause, damage) {
    try {
        if (!ctx || ctx.ended || !(damage > 0)) {
            return;
        }
        ctx.damageTaken += damage;
        ctx.lastDamageCause = cause;
        trackGame(GA_EVENT.PLAYER_DAMAGED, {
            [GA_PARAM.CAUSE]: cause,
            [GA_PARAM.ENEMY_TYPE]: 'destroyer',
            [GA_PARAM.DAMAGE]: Math.round(damage),
        });
    } catch (e) {
        console.error('[GameAnalytics] onPlayerDamaged error', e);
    }
}

/**
 * イベントを送らずに直近のダメージ原因だけを記録する(深度超過による継続ダメージ・酸素切れ等、毎フレーム発生するもの)
 * @param {string} cause depth / oxygen
 */
export function markDamageCause(cause) {
    if (ctx && !ctx.ended) {
        ctx.lastDamageCause = cause;
    }
}

/**
 * プレイヤーが撃沈された時(原因は直近のダメージ原因)
 */
export function onPlayerSunk() {
    try {
        if (!ctx || ctx.ended) {
            return;
        }
        const cause = ctx.lastDamageCause || 'other';
        trackGameOnce(GA_EVENT.PLAYER_SUNK, {
            [GA_PARAM.CAUSE]: cause,
            [GA_PARAM.ENEMY_TYPE]: (cause === 'shell' || cause === 'depth_charge') ? 'destroyer' : undefined,
        });
    } catch (e) {
        console.error('[GameAnalytics] onPlayerSunk error', e);
    }
}

// #endregion

// #region 終了・リザルト

/**
 * プレイ終了時。level_end / mission_abandoned と mission_summary を送る(1プレイ1回)
 * @param {string} endReason clear / gameover / abandoned
 * @param {string} abandonReason endReasonがabandonedの場合の理由(quit_button等)
 */
export function endGame(endReason, abandonReason) {
    try {
        if (!ctx || ctx.ended) {
            return;
        }
        const duration = elapsedSec();
        const success = endReason === 'clear' ? 1 : 0;
        const totals = {
            [GA_PARAM.DURATION_SEC]: duration,
            [GA_PARAM.ENEMIES_SUNK]: ctx.enemiesSunk,
            [GA_PARAM.TORPEDOES_FIRED]: ctx.torpedoesFired,
            [GA_PARAM.TORPEDOES_HIT]: ctx.torpedoesHit,
        };
        if (endReason === 'abandoned') {
            trackGame(GA_EVENT.MISSION_ABANDONED, { [GA_PARAM.REASON]: abandonReason || 'other' });
        } else {
            trackGame(GA_EVENT.LEVEL_END, Object.assign({ [GA_PARAM.SUCCESS]: success }, totals));
        }
        trackGameOnce(GA_EVENT.MISSION_SUMMARY, Object.assign({
            [GA_PARAM.SUCCESS]: success,
            [GA_PARAM.END_REASON]: endReason,
            [GA_PARAM.ENEMIES_DETECTED]: ctx.detectedShips.size,
            [GA_PARAM.DAMAGE_TAKEN]: Math.round(ctx.damageTaken),
            [GA_PARAM.MAX_DEPTH]: Math.round(ctx.maxDepth),
            [GA_PARAM.MAX_TIME_SCALE]: ctx.maxTimeScale,
        }, totals));
        ctx.ended = true;
        ctx.endedDurationSec = duration;
        ctx.endSuccess = success;
    } catch (e) {
        console.error('[GameAnalytics] endGame error', e);
    }
}

/**
 * リザルト(ゲームクリア/ゲームオーバー)ダイアログ表示時
 */
export function onResultView(success) {
    trackGame(GA_EVENT.RESULT_VIEW, {
        [GA_PARAM.SUCCESS]: success ? 1 : 0,
        [GA_PARAM.DURATION_SEC]: ctx ? ctx.endedDurationSec : undefined,
    });
}

/**
 * リザルトから再挑戦した時
 */
export function onRetrySelected() {
    trackGame(GA_EVENT.RETRY_SELECTED, { [GA_PARAM.SUCCESS]: ctx ? ctx.endSuccess : undefined });
}

/**
 * リザルトからタイトルへ戻った時
 */
export function onReturnTitleSelected() {
    trackGame(GA_EVENT.RETURN_TITLE_SELECTED, { [GA_PARAM.SUCCESS]: ctx ? ctx.endSuccess : undefined });
}

// #endregion
