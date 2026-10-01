/**
 * 新規ユーザー向けの初回プレイ導線
 * - モード/難易度選択画面で「スカーミッシュ」→「簡単」をおすすめとして強調表示する
 * - 魚雷を一度も撃ったことがないユーザーに、ゲーム中に「潜望鏡を開く → 魚雷を撃つ」を案内する
 */
import { STORAGE_KEYS } from "./analytics.js";
import { GA_EVENT, GA_PARAM, getGameAttemptCount, trackGame } from "./gameAnalytics.js";

const GUIDE_DONE_KEY = 'first_play_guide_done';   // 初回ガイドを完了/スキップしたか

// 発射後のメッセージを表示しておく時間(ms)
const FIRED_MESSAGE_MS = 8000;

const STEP = {
    openPeriscope: 'open_periscope',
    fire: 'fire',
    fired: 'fired',
};

function storageGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function storageSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (e) {
        // 無視
    }
}

function text(resId) {
    return $('#' + resId).html() || '';
}

// #region おすすめ表示(モード/難易度選択)

/**
 * 初めてゲームを遊ぶユーザーか(セーブデータ・ゲーム開始履歴が無い)
 */
export function isFirstPlay() {
    return storageGet('initTime') === null
        && storageGet(STORAGE_KEYS.firstGameStart) !== '1'
        && getGameAttemptCount() === 0;
}

/**
 * モード選択画面のおすすめ表示を切り替える
 * @return {boolean} おすすめを表示したか
 */
export function applyModeRecommendation() {
    const show = isFirstPlay();
    $('#gameModeSelectPage').toggleClass('firstPlayRecommend', show);
    return show;
}

/**
 * 難易度選択画面のおすすめ表示を切り替える
 * @return {boolean} おすすめを表示したか
 */
export function applyDifficultyRecommendation() {
    const show = isFirstPlay();
    $('#diffSelectPage').toggleClass('firstPlayRecommend', show);
    return show;
}

// #endregion

// #region ゲーム中の初回ガイド

let guide = null;   // { step, uboat, timerId, onResize }

/**
 * 初回ガイドを表示すべきか(魚雷を一度も撃っておらず、ガイドを完了/スキップしていない)
 */
function shouldShowGuide() {
    return storageGet(GUIDE_DONE_KEY) !== '1' && storageGet(STORAGE_KEYS.firstTorpedoFired) !== '1';
}

function ensureBubble() {
    let bubble = $('#firstPlayGuide');
    if (bubble.length) {
        return bubble;
    }
    bubble = $(
        '<div id="firstPlayGuide" class="firstPlayGuide hiddenPage">' +
        '<div class="firstPlayGuideText"></div>' +
        '<button type="button" class="firstPlayGuideSkip btn btn-sm btn-outline-light"></button>' +
        '</div>'
    );
    $('body').append(bubble);
    return bubble;
}

function targetOf(step) {
    switch (step) {
        case STEP.openPeriscope:
            return $('#periscopeButton');
        case STEP.fire:
            return $('#fireButton');
        default:
            return $();
    }
}

/**
 * 吹き出しを対象要素の近くに配置する(上に余裕があれば上、無ければ下。左右は画面内に収める)
 */
function positionBubble() {
    if (!guide) {
        return;
    }
    const bubble = $('#firstPlayGuide');
    const target = targetOf(guide.step);
    const margin = 10;
    const width = bubble.outerWidth();
    const height = bubble.outerHeight();
    if (!target.length || !target.is(':visible')) {
        // 対象が無い(発射後のメッセージ等)場合は画面上部中央
        bubble.css({ left: (window.innerWidth - width) / 2, top: margin });
        return;
    }
    const rect = target.get(0).getBoundingClientRect();
    let top = rect.top - height - margin;
    if (top < margin) {
        top = rect.bottom + margin;
    }
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    bubble.css({ left: left, top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)) });
}

function showStep(step) {
    if (!guide) {
        return;
    }
    $('.firstPlayGuideTarget').removeClass('firstPlayGuideTarget');
    guide.step = step;
    if (guide.timerId) {
        clearTimeout(guide.timerId);
        guide.timerId = null;
    }

    const bubble = ensureBubble();
    const textId = step === STEP.openPeriscope ? 'RES_TUT_Periscope'
        : step === STEP.fire ? 'RES_TUT_Fire' : 'RES_TUT_Fired';
    bubble.find('.firstPlayGuideText').html(text(textId));
    bubble.find('.firstPlayGuideSkip').html(text('RES_TUT_Skip')).toggle(step !== STEP.fired);
    bubble.removeClass('hiddenPage');
    targetOf(step).addClass('firstPlayGuideTarget');
    positionBubble();

    trackGame(GA_EVENT.TUTORIAL_STEP, { [GA_PARAM.TUTORIAL_STEP]: step });

    if (step === STEP.fired) {
        guide.timerId = setTimeout(() => finish(true), FIRED_MESSAGE_MS);
    }
}

function hide() {
    $('.firstPlayGuideTarget').removeClass('firstPlayGuideTarget');
    $('#firstPlayGuide').addClass('hiddenPage');
}

function finish(completed) {
    if (!guide) {
        return;
    }
    const step = guide.step;
    storageSet(GUIDE_DONE_KEY, '1');
    trackGame(completed ? GA_EVENT.TUTORIAL_COMPLETE : GA_EVENT.TUTORIAL_SKIP, { [GA_PARAM.TUTORIAL_STEP]: step });
    stop();
}

/**
 * ゲーム画面表示時に呼ぶ。対象ユーザーなら初回ガイドを開始する
 * @param {boolean} isPeriscopeOpen 潜望鏡画面が開いているか
 */
export function startGuide(isPeriscopeOpen) {
    try {
        stop();
        if (!shouldShowGuide()) {
            return;
        }
        guide = { step: null, timerId: null, onResize: () => positionBubble() };
        window.addEventListener('resize', guide.onResize);
        const bubble = ensureBubble();
        bubble.find('.firstPlayGuideSkip').off('click').on('click', () => finish(false));
        showStep(isPeriscopeOpen ? STEP.fire : STEP.openPeriscope);
    } catch (e) {
        console.error('[FirstPlayGuide] start error', e);
    }
}

/**
 * ゲーム終了時に呼ぶ(未完了のまま終わった場合は次回のゲームで再度案内する)
 */
export function stop() {
    if (!guide) {
        return;
    }
    if (guide.timerId) {
        clearTimeout(guide.timerId);
    }
    window.removeEventListener('resize', guide.onResize);
    guide = null;
    hide();
}

/**
 * 潜望鏡画面の開閉時に呼ぶ
 */
export function onPeriscopeChanged(isOpen) {
    if (!guide) {
        return;
    }
    if (isOpen && guide.step === STEP.openPeriscope) {
        showStep(STEP.fire);
    } else if (!isOpen && guide.step === STEP.fire) {
        // 撃つ前に潜望鏡を閉じたら、潜望鏡を開く案内に戻る
        showStep(STEP.openPeriscope);
    } else {
        positionBubble();
    }
}

/**
 * 魚雷発射時に呼ぶ
 */
export function onTorpedoFired() {
    if (guide && guide.step === STEP.fire) {
        showStep(STEP.fired);
    }
}

/**
 * 魚雷命中時に呼ぶ(発射後メッセージ表示中なら完了とする)
 */
export function onTorpedoHit() {
    if (guide && guide.step === STEP.fired) {
        finish(true);
    }
}

// #endregion
