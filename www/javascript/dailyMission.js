/**
 * デイリーミッション(B群のみ有効)
 *
 * - 1日1つの「今日の任務」を、安全な候補リストから日付ごとに決定する
 * - 進捗はlocalStorageに保存し、同じ日は何度起動しても同じミッション・同じ進捗になる
 * - 通常のゲーム(クリア判定・ゲームオーバー等)には影響しない追加目標として扱う
 *
 * A群では init 以外の処理を一切行わない(isEnabled() が false を返す)。
 */
import { ObjectType } from "./constants.js";
import { getExperimentVariant, getForegroundMs, trackEvent } from "./analytics.js";

// #region 定数

export const MissionType = {
    tonnage: 'tonnage',
    shipCount: 'ship_count',
    shipType: 'ship_type',
    restricted: 'restricted',
};

// 艦種(コード上に実在する艦種のみ)
const ShipType = {
    merchant: 'merchant',
    destroyer: 'destroyer',
};

const RestrictionType = {
    torpedoLimit: 'torpedo_limit',   // 魚雷N発以内でX隻撃沈
    timeLimit: 'time_limit',         // ゲーム内N分以内にXトン撃沈
};

/**
 * デイリーミッション候補
 * どの難易度でも達成可能であること(難易度別の敵数: 商船 5/4/3隻, 駆逐艦 1/2/4隻, 1隻=商船4000t/駆逐艦1200t)。
 * 進捗はその日の複数プレイをまたいで加算されるが、1プレイで5〜10分程度で達成できる水準にしている。
 */
const CANDIDATES = [
    { id: 'tonnage_8000', type: MissionType.tonnage, target: 8000 },
    { id: 'ship_count_3', type: MissionType.shipCount, target: 3 },
    { id: 'ship_type_merchant_2', type: MissionType.shipType, shipType: ShipType.merchant, target: 2 },
    { id: 'restricted_torpedo6_ship2', type: MissionType.restricted, restrictionType: RestrictionType.torpedoLimit, restrictionValue: 6, target: 2 },
    { id: 'ship_type_destroyer_1', type: MissionType.shipType, shipType: ShipType.destroyer, target: 1 },
    // ゲーム内時間で60分(最大16倍速なら実時間約4分)以内に8,000t(商船2隻ぶん)
    { id: 'restricted_time60_tonnage8000', type: MissionType.restricted, restrictionType: RestrictionType.timeLimit, restrictionValue: 60, target: 8000 },
];

const STORAGE_KEY_STATE = 'daily_mission_state';
const STORAGE_KEY_DEBUG_OFFSET = 'daily_mission_debug_day_offset';

// #endregion

// #region 開発モード

/**
 * 開発モードか。リリースビルド(BuildInfo.debug=false)では常にfalse
 * Cordovaが無い環境(ブラウザでの動作確認)も開発モードとして扱う
 */
export function isDevMode() {
    try {
        if (typeof BuildInfo !== 'undefined') {
            return BuildInfo.debug === true;
        }
        return typeof cordova === 'undefined';
    } catch (e) {
        return false;
    }
}

// #endregion

// #region localStorage(利用不可でも動くようにする)

let memoryState = null;

function loadRaw() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY_STATE);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        // 壊れたデータは無視して作り直す
    }
    return memoryState;
}

function saveRaw(state) {
    memoryState = state;
    try {
        window.localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
    } catch (e) {
        // 無視
    }
}

// #endregion

// #region 日付 / ミッション生成

/**
 * 今日の日付(端末のローカル日付)。開発モードでは日数オフセットで疑似的に日付を進められる
 */
function getTodayDate() {
    const now = new Date();
    if (isDevMode()) {
        try {
            const offset = parseInt(window.localStorage.getItem(STORAGE_KEY_DEBUG_OFFSET) || '0', 10) || 0;
            now.setDate(now.getDate() + offset);
        } catch (e) {
            // 無視
        }
    }
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

/**
 * 日付から候補を決定する。連続する日は必ず別のミッションになる(日数 % 候補数で巡回)
 */
function pickCandidate(dateString) {
    const [y, m, d] = dateString.split('-').map(Number);
    const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    return CANDIDATES[dayNumber % CANDIDATES.length];
}

function createState(dateString) {
    const c = pickCandidate(dateString);
    return {
        date: dateString,
        missionId: 'daily_' + dateString.replace(/-/g, '') + '_' + c.id,
        type: c.type,
        target: c.target,
        shipType: c.shipType || null,
        restrictionType: c.restrictionType || null,
        restrictionValue: c.restrictionValue || null,
        progress: 0,
        completed: false,
        viewed: false,
    };
}

function isValidState(state) {
    return state && typeof state === 'object'
        && typeof state.date === 'string'
        && typeof state.missionId === 'string'
        && typeof state.target === 'number'
        && typeof state.progress === 'number'
        && Object.values(MissionType).includes(state.type);
}

/**
 * 今日のミッション状態を取得する(日付が変わっていれば新しいミッションを生成して保存する)
 */
export function getState() {
    const today = getTodayDate();
    let state = loadRaw();
    if (!isValidState(state) || state.date !== today) {
        state = createState(today);
        saveRaw(state);
    }
    return state;
}

// #endregion

// #region 有効判定

/**
 * デイリーミッションが有効か(B群のみ)
 */
export function isEnabled() {
    try {
        return getExperimentVariant() === 'B';
    } catch (e) {
        return false;
    }
}

// #endregion

// #region 進捗管理

// 1プレイ(1回のゲーム)中のみ有効な値
let attempt = { torpedoesUsed: 0, startForegroundMs: 0, failed: false, gameTimeBase: null, gameElapsedSec: 0, shownRemainMin: null };

// 現在のミッションが未達成の時間制限ミッションか(onGameTimeを毎フレーム軽くするためのキャッシュ)
let timeLimitActive = false;
let timeLimitSec = 0;   // 時間制限(ゲーム内秒)。毎フレームlocalStorageを読まないようキャッシュする

function missionParams(state) {
    const params = {
        mission_kind: 'daily',
        mission_id: state.missionId,
        mission_type: state.type,
        mission_target: state.target,
    };
    if (state.shipType) {
        params.target_ship_type = state.shipType;
    }
    if (state.restrictionType) {
        params.restriction_type = state.restrictionType;
        params.restriction_value = state.restrictionValue;
    }
    return params;
}

/**
 * ゲーム開始時に呼ぶ。1プレイ単位の値をリセットし、mission_startを送信する
 */
export function onGameStart() {
    if (!isEnabled()) {
        return;
    }
    try {
        attempt = { torpedoesUsed: 0, startForegroundMs: getForegroundMs(), failed: false, gameTimeBase: null, gameElapsedSec: 0, shownRemainMin: null };
        const state = getState();
        // 制限付きミッションは1プレイごとにやり直し
        if (state.type === MissionType.restricted && !state.completed) {
            state.progress = 0;
            saveRaw(state);
        }
        timeLimitActive = !state.completed && state.type === MissionType.restricted
            && state.restrictionType === RestrictionType.timeLimit;
        timeLimitSec = timeLimitActive ? state.restrictionValue * 60 : 0;
        if (!state.completed) {
            trackEvent('mission_start', missionParams(state));
        }
        renderAll();
    } catch (e) {
        console.error('[DailyMission] onGameStart error', e);
    }
}

/**
 * ゲーム内時間の更新時に呼ぶ(毎フレーム呼ばれるため、時間制限ミッション以外では即return)
 * @param {number} gameTimeSec ゲーム内経過秒数
 */
export function onGameTime(gameTimeSec) {
    if (!timeLimitActive) {
        return;
    }
    try {
        if (attempt.gameTimeBase === null) {
            // コンティニュー時は読み込んだ時点を起点にする
            attempt.gameTimeBase = gameTimeSec;
        }
        attempt.gameElapsedSec = gameTimeSec - attempt.gameTimeBase;

        const remainMin = Math.max(0, Math.ceil((timeLimitSec - attempt.gameElapsedSec) / 60));
        let needRender = false;
        if (!attempt.failed && attempt.gameElapsedSec > timeLimitSec) {
            attempt.failed = true;
            needRender = true;
        }
        // 表示は残り時間(分)が変わったときと時間切れになったときだけ更新する(毎フレームの再描画を避ける)
        if (remainMin !== attempt.shownRemainMin) {
            attempt.shownRemainMin = remainMin;
            needRender = true;
        }
        if (needRender) {
            renderAll();
        }
    } catch (e) {
        console.error('[DailyMission] onGameTime error', e);
    }
}

/**
 * 魚雷発射時に呼ぶ
 */
export function onTorpedoFired() {
    if (!isEnabled()) {
        return;
    }
    try {
        attempt.torpedoesUsed++;
        const state = getState();
        if (state.type === MissionType.restricted && !state.completed
            && attempt.torpedoesUsed > state.restrictionValue) {
            attempt.failed = true;
        }
        renderAll();
    } catch (e) {
        console.error('[DailyMission] onTorpedoFired error', e);
    }
}

/**
 * 敵艦撃沈時に呼ぶ
 * @param {number} tonnage 撃沈した艦のトン数
 * @param {number} objectType 撃沈した艦のObjectType
 * @param {Function} showMessage 完了時のメッセージ表示(speaker, text)
 */
export function onEnemySunk(tonnage, objectType, showMessage) {
    if (!isEnabled()) {
        return;
    }
    try {
        const state = getState();
        if (state.completed) {
            return;
        }
        const sunkShipType = objectType === ObjectType.destoryer1 ? ShipType.destroyer : ShipType.merchant;
        switch (state.type) {
            case MissionType.tonnage:
                state.progress += tonnage;
                break;
            case MissionType.shipCount:
                state.progress += 1;
                break;
            case MissionType.shipType:
                if (state.shipType === sunkShipType) {
                    state.progress += 1;
                }
                break;
            case MissionType.restricted:
                if (!attempt.failed) {
                    // 魚雷制限は撃沈数、時間制限は撃沈トン数を進捗とする
                    state.progress += state.restrictionType === RestrictionType.timeLimit ? tonnage : 1;
                }
                break;
        }

        if (state.progress >= state.target) {
            state.completed = true;
            state.progress = state.target;
            saveRaw(state);
            onComplete(state, showMessage);
        } else {
            saveRaw(state);
        }
        renderAll();
    } catch (e) {
        console.error('[DailyMission] onEnemySunk error', e);
    }
}

function onComplete(state, showMessage) {
    timeLimitActive = false;
    const params = missionParams(state);
    params.elapsed_seconds = Math.round((getForegroundMs() - attempt.startForegroundMs) / 1000);
    // 既存イベント(mission_complete)と、デイリー専用イベントの両方を送る
    trackEvent('mission_complete', params);
    trackEvent('daily_mission_complete', params);

    if (typeof showMessage === 'function') {
        const speaker = $('#RES_DeputyChief').html();
        showMessage(speaker, $('#RES_DM_Complete').html());
        showMessage(speaker, $('#RES_DM_NextTitle').html() + ' : ' + $('#RES_DM_NextBody').html());
    }
}

// #endregion

// #region UI

function formatNumber(n) {
    return Number(n).toLocaleString('en-US');
}

function tpl(id) {
    const el = $('#' + id);
    return el.length ? el.html() : '';
}

/**
 * ミッション内容の文言
 */
function describe(state) {
    switch (state.type) {
        case MissionType.tonnage:
            return tpl('RES_DM_Tonnage').replace('xxx', formatNumber(state.target));
        case MissionType.shipCount:
            return tpl('RES_DM_ShipCount').replace('xxx', state.target);
        case MissionType.shipType:
            return tpl(state.shipType === ShipType.destroyer ? 'RES_DM_ShipTypeDestroyer' : 'RES_DM_ShipTypeMerchant')
                .replace('xxx', state.target);
        case MissionType.restricted:
            if (state.restrictionType === RestrictionType.timeLimit) {
                return tpl('RES_DM_TimeLimit').replace('xxx', formatNumber(state.target)).replace('yyy', state.restrictionValue);
            }
            return tpl('RES_DM_TorpedoLimit').replace('xxx', state.target).replace('yyy', state.restrictionValue);
    }
    return '';
}

/**
 * 進捗の文言 (例: "1 / 3", "8,500 / 10,000 t")
 */
function describeProgress(state) {
    if (state.type === MissionType.tonnage || state.restrictionType === RestrictionType.timeLimit) {
        return formatNumber(state.progress) + ' / ' + formatNumber(state.target) + ' t';
    }
    return state.progress + ' / ' + state.target;
}

function progressPercent(state) {
    return Math.min(100, Math.round(state.progress / state.target * 100));
}

/**
 * 制限付きミッションで、現在のプレイの制限状況の補足文言
 */
function describeRestriction(state) {
    if (state.type !== MissionType.restricted || state.completed) {
        return '';
    }
    if (state.restrictionType === RestrictionType.timeLimit) {
        if (attempt.failed) {
            return tpl('RES_DM_TimeUp') + ' - ' + tpl('RES_DM_RetryHint');
        }
        const remain = attempt.shownRemainMin !== null ? attempt.shownRemainMin : state.restrictionValue;
        return tpl('RES_DM_TimeLeft').replace('xxx', remain);
    }
    const used = attempt.torpedoesUsed + ' / ' + state.restrictionValue;
    if (attempt.failed) {
        return tpl('RES_DM_Torpedoes') + ' ' + used + ' - ' + tpl('RES_DM_RetryHint');
    }
    return tpl('RES_DM_Torpedoes') + ' ' + used;
}

/**
 * タイトル画面のカードとゲーム内HUDを更新する
 */
export function renderAll() {
    if (!isEnabled()) {
        return;
    }
    try {
        const state = getState();
        const cards = $('#dailyMissionCard, #dailyMissionHud');
        cards.removeClass('hiddenPage');
        cards.toggleClass('dailyMissionCompleted', state.completed);

        cards.find('.dmDescription').text(describe(state));
        cards.find('.dmProgressText').text(describeProgress(state));
        cards.find('.dmProgressBar').css('width', progressPercent(state) + '%');
        cards.find('.dmRestriction').text(describeRestriction(state));
        cards.find('.dmComplete').toggleClass('hiddenPage', !state.completed);
        cards.find('.dmNext').toggleClass('hiddenPage', !state.completed);
        cards.find('.dmProgressRow').toggleClass('hiddenPage', state.completed);
    } catch (e) {
        console.error('[DailyMission] render error', e);
    }
}

/**
 * タイトル画面表示時に呼ぶ。カード描画と、その日初めて表示した場合のdaily_mission_view送信を行う
 */
export function showTitleCard() {
    if (!isEnabled()) {
        return;
    }
    try {
        renderAll();
        const state = getState();
        if (!state.viewed) {
            state.viewed = true;
            saveRaw(state);
            trackEvent('daily_mission_view', {
                mission_kind: 'daily',
                mission_id: state.missionId,
                mission_type: state.type,
            });
        }
    } catch (e) {
        console.error('[DailyMission] showTitleCard error', e);
    }
}

// #endregion

// #region デバッグ(開発モードのみ)

if (isDevMode()) {
    window.dailyMissionDebug = {
        /** 現在の状態をコンソールに表示して返す */
        info() {
            const state = getState();
            const info = {
                experiment_variant: getExperimentVariant(),
                enabled: isEnabled(),
                today: getTodayDate(),
                mission_id: state.missionId,
                mission_type: state.type,
                target: state.target,
                progress: state.progress,
                completed: state.completed,
                shipType: state.shipType,
                restriction: state.restrictionType ? state.restrictionType + '=' + state.restrictionValue : null,
                torpedoesUsedThisGame: attempt.torpedoesUsed,
            };
            console.table(info);
            return info;
        },
        /** 日付をn日進める(負数で戻す)。ミッションが切り替わる */
        setDayOffset(days) {
            window.localStorage.setItem(STORAGE_KEY_DEBUG_OFFSET, String(days));
            renderAll();
            return this.info();
        },
        nextDay() {
            const cur = parseInt(window.localStorage.getItem(STORAGE_KEY_DEBUG_OFFSET) || '0', 10) || 0;
            return this.setDayOffset(cur + 1);
        },
        /** variantを強制する('A' or 'B')。反映にはリロードが必要 */
        setVariant(variant) {
            window.localStorage.setItem('experiment_daily_mission_variant', variant);
            location.reload();
        },
        /** 今日のミッション状態を初期化する */
        reset() {
            window.localStorage.removeItem(STORAGE_KEY_STATE);
            memoryState = null;
            renderAll();
            return this.info();
        },
        candidates: CANDIDATES,
    };
}

// #endregion
