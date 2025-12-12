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

  // アプリ課金確認
  // ローカル状態の反映（起動直後）
  setRemoved(getRemoved());

  initIAP();
}, false);

const showAd = async () => {
  if(getRemoved()) {
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

  // 購入状態を復元
  inAppPurchase.restorePurchases()
  .then(function (purchase) {
    console.log('購入済みか確認');
    console.log(purchase);

    const owned = purchase.some(p => p.productId === SKU);

    if (owned) {
        console.log("広告削除を購入済み");
        // ストレージのフラグを立てる（例: localStorage に保存）
        localStorage.setItem('adsRemoved', '1');
        // 購入ボタンを非活性化 
        $('#removeAdsButton').removeClass('btn-danger').addClass('btn-secondary');
        $('#removeAdsButton').prop('disabled', true);
    } else {
        console.log("未購入");
        localStorage.setItem('adsRemoved', '0');
    }
  })
  .catch(function (err) {
    console.log(err);
  });

  inAppPurchase
  .getProducts([SKU])
  .then(function (products) {
    console.log(products);
    const price = products[0].price;
    console.log('price: ' + price);
    // 金額をダイアログに設定
    $('#iapPrice').text(price);
    initRemoveAdsBuyButton();
  })
  .catch(function (err) {
     console.log(err);
  });
}

// 購入ボタン押下時処理
const initRemoveAdsBuyButton = () => {
  console.log('initAdRemoveButton');
  $('#removeAdsBuyButton').on('click', function() {
    inAppPurchase
    .buy(SKU)
    .then(function (data) {
      console.log('購入完了');
      console.log(data);
    })
    .catch(function (err) {
      console.log(err);
    });
  });
};


const main = new Main();
main.main();
