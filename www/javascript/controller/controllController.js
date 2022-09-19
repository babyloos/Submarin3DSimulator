import { EngineOut } from "../constants.js";
import { Point } from "../model/point.js";
import { Uboat } from "../model/uBoat.js";
import { Util } from "../util.js";
import { TimeManager } from "./timeManger.js";

/**
 * ユーザ入力可能なパネル用コントローラ
 */
export class ControllController {

    speedController;        // 各速度ボタン
    courseController;       // course欄

    // 数値入力欄用
    initialScreentY;        // タッチ開始時Y座標
    initialValue;           // タッチ開始時の値

    uBoat                   // 参照先のuBoatクラス
    timeManager             // 参照先TimeManagerクラス

    dispSpeed;              // 速度表示欄
    dispCourse;             // 針路表示欄
    dispDepth;              // 深度表示欄

    compassBack;            // 羅針盤

    depthMatorAllow;        // 深度計矢印
    depthMatorAllowShadow;  // 深度計透過矢印

    compassAllowShadow;     // 羅針盤透過矢印

    // TDCパネル用
    bearing = 0;
    range = 1000;
    angleOnBow = 90;
    targetSpeed = 0;
    torpedoSpeed = 40;
    gyroAngle = 0;

    // STATUSパネル用
    torpedoCount;        // 魚雷残数表示欄

    /**
     * コンストラクタ
     */
    constructor() {
    }

    /**
     * コントロールパネル全体の初期設定
     * @param {Uboat} uBoat 参照先のuBoatクラス
     * @param {TimeManager} timeManager 参照先のtimeManagerクラス
     */
    initialize(uBoat, timeManager) {
        this.timeManager = timeManager;
        this.uBoat = uBoat;

        this.speedController = $('#speedController input:radio[name="speedSelect"]');
        this.courseController = $('#course');
        this.depthController = $('#depth');
        this.timeSpeedController = $('#timeSpeed');
        this.torpedoCount = $('.torpedoCount');
        this.dispSpeed = $('#dispSpeed');
        this.dispCourse = $('#dispCourse');
        this.dispDepth = $('#dispDepth');
        this.engineTelegraph = $('#engineTelegraph');
        this.compassBack = $('#compassFrame');
        this.depthMatorAllow = $('#depthMaterAllow');
        this.depthMatorAllowShadow = $('#depthMaterAllowShadow');
        this.compassAllowShadow = $('#compassAllowShadow');

        // 魚雷残数欄の初期設定
        this.#torpedoCountInitialize(this.torpedoCount);
        // エンジンテレグラフのイベント設定
        this.#engineTelegraphInitialize();
        // コンパスのイベント設定
        this.#compassInitialize();
        // 深度計のイベント設定
        this.#depthMaterInitialize();

        // 速度変更ボタンのイベント設定
        this.#speedChangeButtonInitialize();

        // パネル閉じるボタンのイベント設定
        this.#panelCloseButtonInitialize();

        // 潜望鏡深度ボタンのイベント設定
        this.#periscopeDepthButtonInitialize();

        // 潜望鏡画面
        this.#bearingInitialize();
        this.#rangeInitialize();
        this.#speedInitialize();
        this.#aOnBowInitialize();
        this.#fireButtonInitialize();
    }

    /**
    * 潜望鏡深度ボタンの初期設定 
    */
    #periscopeDepthButtonInitialize() {
        const periscopeDepth = 11;
        const shadowAllow = $('#depthMaterAllowShadow');
        $('#periscopeDepthButton').on('click', function() {
            const clickDeg = this.#depthToClickDeg(periscopeDepth);
            shadowAllow.css('display', 'block');
            shadowAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
            this.uBoat.updateDistDepth(periscopeDepth);
        }.bind(this));
    }

    /**
     * 魚雷発射ボタンの初期設定
     */
    #fireButtonInitialize() {
        $('#fireButton').on('click', function () {
            this.uBoat.fireTorpedo();
        }.bind(this));
    }

    /**
    * コンパス
    */
    #bearingInitialize() {
        const bearingBack = $('#bearingBack');
        const bearingAllow = $('#bearingAllow');

        const getClickDeg = this.#getClickDeg;

        bearingBack.on('touchstart', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            bearingAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
        });

        bearingBack.on('touchmove', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            bearingAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
        });

        const self = this;
        bearingBack.on('touchend', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            var bearing = 0;
            if (clickDeg >= 0 && clickDeg < 180) {
                bearing = clickDeg;
            } else {
                bearing = -180 + (clickDeg - 180);
            }
            self.bearing = bearing;
            self.#updateTdc();
        });

        // 潜望鏡の回転によるtdcの更新
        this.uBoat.tdc.onUpdateTdcAction = function (result) {
            self.bearing = self.uBoat.tdc.bearing;
            bearingAllow.css('transform', 'rotate(' + self.uBoat.tdc.bearing + 'deg)');
            const gyro = result[0];
            const hitTime = result[1];
            const hitTimeStr = Util.numbToNDigitsStr(hitTime, 3, false, 0);
            $('#gyroAllow').css('transform', 'rotate(' + gyro + 'deg)');
            $('#hitTime').html(hitTimeStr);
        }
    }

    #rangeInitialize() {
        const rangeBack = $('#rangeBack');
        const rangeAllow = $('#rangeAllow');

        const self = this;
        const minDeg = 28.5;
        const maxDeg = 360;

        const getClickDeg = this.#getClickDeg;

        const calcUpAndLowRange = function (deg) {
            var upperRange = 0;
            var lowerRange = 0;
            if (deg <= 360 && deg >= 333) {
                lowerRange = 3;
                upperRange = 4;
            } else if (deg < 333 && deg >= 313) {
                lowerRange = 4;
                upperRange = 5;
            } else if (deg < 313 && deg >= 302) {
                lowerRange = 5;
                upperRange = 6;
            } else if (deg < 302 && deg >= 283) {
                lowerRange = 6;
                upperRange = 7;
            } else if (deg < 283 && deg >= 271) {
                lowerRange = 7;
                upperRange = 8;
            } else if (deg < 271 && deg >= 260) {
                lowerRange = 8;
                upperRange = 9;
            } else if (deg < 260 && deg >= 252) {
                lowerRange = 9;
                upperRange = 10;
            } else if (deg < 252 && deg >= 188) {
                lowerRange = 10;
                upperRange = 20;
            } else if (deg < 188 && deg >= 144) {
                lowerRange = 20;
                upperRange = 30;
            } else if (deg < 144 && deg >= 118) {
                lowerRange = 30;
                upperRange = 40;
            } else if (deg < 118 && deg >= 95) {
                lowerRange = 40;
                upperRange = 50;
            } else if (deg < 95 && deg >= 77) {
                lowerRange = 50;
                upperRange = 60;
            } else if (deg < 77 && deg >= 50) {
                lowerRange = 60;
                upperRange = 80;
            } else if (deg < 50 && deg >= 28) {
                lowerRange = 80;
                upperRange = 100;
            }

            return [lowerRange, upperRange];
        }

        const calcDegToRange = function (deg) {
            const upLowRange = calcUpAndLowRange(deg);
            const lowerRange = upLowRange[0];
            const upperRange = upLowRange[1];

            const degs = [
                360, 333, 313, 302, 282, 271, 260, 252, 188, 144, 118, 95, 77, 50, 28
            ];

            let lowerDeg;
            let upperDeg;
            for (var i = 0; i < degs.length - 1; i++) {
                if (degs[i] >= deg && degs[i + 1] <= deg) {
                    upperDeg = degs[i];
                    lowerDeg = degs[i + 1];
                }
            }
            const degPer = (upperDeg - lowerDeg) / (upperDeg - deg)
            const rangePer = lowerRange + (upperRange - lowerRange) / degPer;
            return rangePer;
        }

        rangeBack.on('touchstart', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg < minDeg || clickDeg > maxDeg) {
                return;
            }

            rangeAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
            self.range = calcDegToRange(clickDeg) * 100;
            self.#updateTdc();
        });

        rangeBack.on('touchmove', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg < minDeg || clickDeg > maxDeg) {
                return;
            }

            rangeAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
            self.range = calcDegToRange(clickDeg) * 100;
            self.#updateTdc();
        });

        rangeBack.on('touchend', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg < minDeg || clickDeg > maxDeg) {
                return;
            }

            self.range = calcDegToRange(clickDeg) * 100;
            self.#updateTdc();
        });
    }

    #speedInitialize() {
        const speedBack = $('#speedBack');
        const speedAllow = $('#speedAllow');

        const self = this;
        const minDeg = 15.5;
        const maxDeg = 347.0;
        const getClickDeg = this.#getClickDeg;

        const getSpeed = function (deg) {
            return (deg - minDeg) / (45 - minDeg) * 5;
        }

        speedBack.on('touchstart', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg < minDeg || clickDeg > maxDeg) {
                return;
            }

            speedAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
            self.targetSpeed = getSpeed(clickDeg);
            self.#updateTdc();
        });

        speedBack.on('touchmove', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg < minDeg || clickDeg > maxDeg) {
                return;
            }

            speedAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
            self.targetSpeed = getSpeed(clickDeg);
            self.#updateTdc();
        });

        speedBack.on('touchend', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg < minDeg || clickDeg > maxDeg) {
                return;
            }

            self.targetSpeed = getSpeed(clickDeg);
            self.#updateTdc();
        });
    }

    #aOnBowInitialize() {
        const aOnBowBack = $('#aOnBowBack');
        const aOnBowAllow = $('#aOnBowAllow');

        const self = this;
        const getClickDeg = this.#getClickDeg;
        const getAngle = function (deg) {
            if (deg <= 180) {
                return deg;
            } else {
                return -(180 - (deg - 180));
            }
        }

        aOnBowBack.on('touchstart', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            aOnBowAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
            self.angleOnBow = getAngle(clickDeg);
            self.#updateTdc();
        });

        aOnBowBack.on('touchmove', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            aOnBowAllow.css('transform', 'rotate(' + clickDeg + 'deg)');
            self.angleOnBow = getAngle(clickDeg);
            self.#updateTdc();
        });

        aOnBowBack.on('touchend', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            self.angleOnBow = getAngle(clickDeg);
            self.#updateTdc();
        });
    }

    /**
     * uBoatのTDCの更新
     */
    #updateTdc() {
        var result = this.uBoat.tdc.setSpec(parseFloat(this.bearing), parseFloat(this.range), parseFloat(this.angleOnBow), parseFloat(this.targetSpeed));
        const gyro = result[0];
        const hitTime = result[1];
        const hitTimeStr = Util.numbToNDigitsStr(hitTime, 3, false, 0);
        $('#gyroAllow').css('transform', 'rotate(' + gyro + 'deg)');
        $('#hitTime').html(hitTimeStr);
    }

    /**
     * パネル閉じるボタンのイベント設定
     */
    #panelCloseButtonInitialize() {
        const panelCloseButton = $('.panelCloseButton');

        panelCloseButton.on('click', function () {
            const obj = $(this);
            const id = obj.attr('id');
            const isClose = Util.toBoolean(obj.attr('isClose'));

            var panel;
            switch (id) {
                case "messageAreaCloseButton":
                    panel = $("#messageArea2");
                    break;
                case "controllAreaCloseButton":
                    panel = $("#controllArea2");
                    break;
                case "statusAreaCloseButton":
                    panel = $("#statusArea2");
                    break;
            }

            if (!isClose) {
                // 閉じる処理
                if (panel.attr('id') === 'statusArea2') {
                    panel.children('div').css('display', 'none');
                }
                panel.css('height', '7%');
                obj.css('transform', 'rotate(' + 180 + 'deg)');
                obj.attr('isClose', true);
            } else {
                // 開く処理
                if (id === "messageAreaCloseButton") {
                    panel.css('height', '40%');
                } else {
                    panel.css('height', '');
                }

                if (panel.attr('id') === 'statusArea2') {
                    panel.children('div').css('display', 'flex');
                }
                obj.css('transform', '');
                obj.attr('isClose', false);
            }
        });
    }

    /**
     * 速度変更ボタンのイベント設定
     */
    #speedChangeButtonInitialize() {
        const dispTimeSpeed = $('#dispTimeSpeed');
        const speedMinButton = $('#speedMinButton');
        const speedReduceButton = $('#speedReduceButton');
        const speedIncreaseButton = $('#speedIncreaseButton');
        const speedMaxButton = $('#speedMaxButton');
        const timeManager = this.timeManager;

        // 初期状態設定
        const dispSpeed = Util.numbToNDigitsStr(timeManager.gameSpeed, 4, false, 0);
        dispTimeSpeed.html(dispSpeed);

        const updateDisabled = function (timeManager) {
            const disabledKey = 'disabled';
            speedMinButton.attr(disabledKey, false);
            speedReduceButton.attr(disabledKey, false);
            speedIncreaseButton.attr(disabledKey, false);
            speedMaxButton.attr(disabledKey, false);

            if (timeManager.gameSpeed === 1) {
                speedMinButton.attr(disabledKey, true);
                speedReduceButton.attr(disabledKey, true);
            } else if (timeManager.gameSpeed === 16) {
                speedIncreaseButton.attr(disabledKey, true);
                speedMaxButton.attr(disabledKey, true);
            }
        }

        // 活性非活性設定
        updateDisabled(timeManager);

        $('.speedChangeButton').on('click', function () {
            // 押下時動作
            switch (this.getAttribute('id')) {
                case speedMinButton.attr('id'):
                    timeManager.gameSpeed = 1;
                    break;
                case speedReduceButton.attr('id'):
                    timeManager.gameSpeed /= 2;
                    break;
                case speedIncreaseButton.attr('id'):
                    timeManager.gameSpeed *= 2;
                    break;
                case speedMaxButton.attr('id'):
                    timeManager.gameSpeed = 16;
                    break;
            }
            // 活性非活性切り替え
            updateDisabled(timeManager);
            // 速度表示更新
            const dispSpeed = Util.numbToNDigitsStr(timeManager.gameSpeed, 4, false, 0);
            dispTimeSpeed.html(dispSpeed);
        });
    }

    /**
     * エンジンテレグラフのイベント設定
     */
    #engineTelegraphInitialize() {
        const uBoat = this.uBoat;
        const getClickDeg = this.#getClickDeg;
        const engineTelegraph = $('#engineTelegraph');
        const allow = $('#telegraphAllow');
        const allowShadow = $('#telegraphAllowShadow');
        const minDeg = 40;
        const maxDeg = 315;

        // 初期選択状態設定
        const engineOutDeg = this.#enginOutToDeg(uBoat.engineOut);
        allow.css('transform', 'rotate(' + engineOutDeg + 'deg)');

        engineTelegraph.on('touchstart', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg >= minDeg && clickDeg <= maxDeg) {
                allowShadow.css('display', 'block');
                allowShadow.css('transform', 'rotate(' + clickDeg + 'deg)');
            }
        });

        engineTelegraph.on('touchmove', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg >= minDeg && clickDeg <= maxDeg) {
                allowShadow.css('transform', 'rotate(' + clickDeg + 'deg)');
            }
        });

        engineTelegraph.on('touchend', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            if (clickDeg > 160 && clickDeg <= 198) {
                // 停止
                uBoat.updateEngineOut(0);
            } else if (clickDeg > 198 && clickDeg <= 240) {
                // 微速前進
                uBoat.updateEngineOut(1);
            } else if (clickDeg > 240 && clickDeg <= 270) {
                // 半速前進
                uBoat.updateEngineOut(2);
            } else if (clickDeg > 270 && clickDeg <= maxDeg) {
                // 全速前進
                uBoat.updateEngineOut(3);
            } else if (clickDeg > 120 && clickDeg <= 160) {
                // 微速後進
                uBoat.updateEngineOut(-1);
            } else if (clickDeg > 85 && clickDeg <= 120) {
                // 半速後進
                uBoat.updateEngineOut(-2);
            } else if (clickDeg >= minDeg && clickDeg <= 85) {
                // 全速後進
                uBoat.updateEngineOut(-3);
            }

            // ハンドルの角度を更新
            if (clickDeg >= minDeg && clickDeg <= maxDeg) {
                allow.css('transform', 'rotate(' + clickDeg + 'deg)');
            }
            allowShadow.css('display', 'none');
        });
    }

    /**
     * エンジン出力からテレグラフの角度を取得
     * @param {EngineOut} engineOut エンジン出力
     * @return {number} テレグラフの角度
     */
    #enginOutToDeg(engineOut) {
        const range = 30;
        switch (engineOut) {
            case EngineOut.stop:
                const stopRange = 210 - 150;
                return 150 + stopRange / 2;
            case EngineOut.aheadSlow:
                return 210 + range / 2;
            case EngineOut.aheadHalf:
                return 240 + range / 2;
            case EngineOut.aheadFull:
                return 270 + range / 2;
            case EngineOut.asternSlow:
                return 120 + range / 2;
            case EngineOut.asternHalf:
                return 90 + range / 2;
            case EngineOut.asternFull:
                return 60 + range / 2;
        }
    }

    /**
     * 羅針盤のイベント設定
     */
    #compassInitialize() {
        const getClickDeg = this.#getClickDeg;
        const uBoat = this.uBoat;
        const allowShadow = this.compassAllowShadow;

        // 初期針路設定
        const dispCourse = 360 - uBoat.course;
        $('#compassBack').css('transform', 'rotate(' + dispCourse + 'deg)');

        this.compassBack.on('touchstart', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            var clickDeg = getClickDeg(this, new Point(clickX, clickY));

            allowShadow.attr('noupdate', 'true');
            allowShadow.css('display', 'block');
            allowShadow.css('transform', 'rotate(' + clickDeg + 'deg)');
        });

        this.compassBack.on('touchmove', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            var clickDeg = getClickDeg(this, new Point(clickX, clickY));

            allowShadow.css('transform', 'rotate(' + clickDeg + 'deg)');
        });

        this.compassBack.on('touchend', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            const clickDeg = getClickDeg(this, new Point(clickX, clickY));

            const resultCourse = Util.arrangeCourseDig(uBoat.course + clickDeg);
            uBoat.updateDistCourse(resultCourse);
            allowShadow.attr('noupdate', 'false');
        });
    }

    /**
     * 深度計のイベント設定
     */
    #depthMaterInitialize() {
        const getClickDeg = this.#getClickDeg;
        const uBoat = this.uBoat;
        const minDeg = 208;
        const maxDeg = 360;
        const maxDepthDeg = 152;
        const depthMater = $('#depthMater');
        const allowShadow = this.depthMatorAllowShadow;

        // 初期深度設定
        const allowDeg = this.#depthToDeg(uBoat.depth);
        this.depthMatorAllow.css('transform', 'rotate(' + allowDeg + 'deg)');
        const allowShadowDeg = this.#depthToDeg(uBoat.distDepth);
        allowShadow.css('display', 'block');
        allowShadow.css('transform', 'rotate(' + allowShadowDeg + 'deg)');

        depthMater.on('touchstart', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            var clickDeg = getClickDeg(this, new Point(clickX, clickY));

            // 180°~minDegの間をクリックしたら0mの位置をクリックしたとみなす
            if (clickDeg >= 180 && clickDeg <= minDeg) {
                clickDeg = minDeg;
            }

            // maxDepthDeg~180°の間をクリックしたら260mの位置をクリックしたとみなす
            if (clickDeg >= maxDepthDeg && clickDeg < 180) {
                clickDeg = maxDepthDeg;
            }

            if ((clickDeg <= maxDeg && clickDeg >= minDeg)
                || (clickDeg >= 0 && clickDeg <= maxDepthDeg)) {
                allowShadow.attr('noupdate', 'true');
                allowShadow.css('display', 'block');
                allowShadow.css('transform', 'rotate(' + clickDeg + 'deg)');
            }
        });

        depthMater.on('touchmove', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            var clickDeg = getClickDeg(this, new Point(clickX, clickY));

            // 180°~minDegの間をクリックしたら0mの位置をクリックしたとみなす
            if (clickDeg >= 180 && clickDeg <= minDeg) {
                clickDeg = minDeg;
            }

            // maxDepthDeg~180°の間をクリックしたら260mの位置をクリックしたとみなす
            if (clickDeg >= maxDepthDeg && clickDeg < 180) {
                clickDeg = maxDepthDeg;
            }

            if ((clickDeg <= maxDeg && clickDeg >= minDeg)
                || (clickDeg >= 0 && clickDeg <= maxDepthDeg)) {
                allowShadow.css('transform', 'rotate(' + clickDeg + 'deg)');
            }
        });

        const clickDegToDepth = this.#clickDegToDepth;
        depthMater.on('touchend', function (event) {
            const touchObject = event.changedTouches[0];
            const clickX = touchObject.pageX;
            const clickY = touchObject.pageY;
            var clickDeg = getClickDeg(this, new Point(clickX, clickY));

            // 180°~minDegの間をクリックしたら0mの位置をクリックしたとみなす
            if (clickDeg >= 180 && clickDeg <= minDeg) {
                clickDeg = minDeg;
            }

            // maxDepthDeg~180°の間をクリックしたら260mの位置をクリックしたとみなす
            if (clickDeg >= maxDepthDeg && clickDeg < 180) {
                clickDeg = maxDepthDeg;
            }

            if ((clickDeg <= maxDeg && clickDeg >= minDeg)
                || (clickDeg >= 0 && clickDeg <= maxDepthDeg)) {
                const depth = clickDegToDepth(clickDeg);
                uBoat.updateDistDepth(depth);
            }

            allowShadow.attr('noupdate', 'false');
        });
    }

    /**
     * 深度計のクリック角度(deg)から指定深度を計算する
     * @param {number} clickDeg クリック角度(deg)
     * @return {number} 深度
     */
    #clickDegToDepth(clickDeg) {
        var diffAngleForCalc = clickDeg;
        if (clickDeg <= 180) {
            diffAngleForCalc = clickDeg + 360;
        }
        const diff = diffAngleForCalc - 208;
        const depth = diff * 0.86;
        return depth;
    }

    /**
     * 深度からクリック角度を計算する
     * @param {number} depth 深度
     * @return {number} クリック角度
     */
    #depthToClickDeg(depth) {
        var diffAngleForCalc = depth / 0.86 + 208;
        return diffAngleForCalc;
    }

    /**
     * 特定要素上のクリック位置の中心点からの角度を取得する
     * @param {JqueryObject} client クリックする要素
     * @param {Point} clickPoint 要素上のクリック位置
     * @returns {number} クリック位置の中心点からの角度(deg)
     */
    #getClickDeg(client, clickPoint) {
        // 要素の位置を取得
        var clientRect = client.getBoundingClientRect();
        var positionX = clientRect.left + window.pageXOffset;
        var positionY = clientRect.top + window.pageYOffset;

        // 要素内におけるクリック位置を計算
        var x = clickPoint.x - positionX;
        var y = clickPoint.y - positionY;

        // 中心点からの相対位置を取得
        const centerPoint = new Point(client.width / 2, client.height / 2);
        const relativePoint = new Point(x - centerPoint.x, y - centerPoint.y);
        // 中心点からの角度を取得
        const clickRad = Util.calcAngle2Point(new Point(0, 0), relativePoint);
        const clickDeg = Util.arrangeCourseDig(Util.radianToDegree(clickRad) + 90);
        return clickDeg;
    }

    /**
     * 魚雷残数表示欄の初期設定
     */
    #torpedoCountInitialize(torpedoCount) {
        torpedoCount.html(this.uBoat.torpedoCount);
    }

    /**
     * 速度変更パネルの初期設定
     * @param {jQueryObject} speedController
     */
    #speedControllerInitialize(speedController) {
        switch (this.uBoat.engineOut) {
            case EngineOut.aheadFull:
                $('#aheadFull').prop('checked', true);
                break;
            case EngineOut.aheadHalf:
                $('#aheadHalf').prop('checked', true);
                break;
            case EngineOut.aheadSlow:
                $('#aheadSlow').prop('checked', true);
                break;
            case EngineOut.stop:
                $('#stop').prop('checked', true);
                break;
            case EngineOut.asternSlow:
                $('#asternSlow').prop('checked', true);
                break;
            case EngineOut.asternHalf:
                $('#asternHalf').prop('checked', true);
                break;
            case EngineOut.asternFull:
                $('#asternFull').prop('checked', true);
                break;
        }
        let uBoat = this.uBoat;
        speedController.change(function () {
            let val = parseInt($(this).attr('val'));
            uBoat.updateEngineOut(val);
        });
    }
    
    /**
     * 船の速度表示を更新する
     * @param {number} newSpeed 更新後の船速
     */
    updateSpeed(newSpeed) {
        let oldSpeed = parseInt(this.dispSpeed.html());
        if (newSpeed !== oldSpeed) {
            let newSpeedStr = Util.numbToNDigitsStr(Math.abs(parseInt(newSpeed)), 3);
            this.dispSpeed.html(newSpeedStr);
        }
    }

    /**
     * 船の針路表示を更新する
     * @param {number} newCourse 更新後の針路(deg)
     */
    updateCourse(newCourse) {
        const nowDispCourse = 360 - Util.getRotationDegrees(this.compassBack);
        const dispCourse = 360 - newCourse;
        const canUpdate = this.compassAllowShadow.attr('noupdate') === 'false';
        if (nowDispCourse !== dispCourse) {
            $('#compassBack').css('transform', 'rotate(' + dispCourse + 'deg)');
            let newCourseStr = Util.numbToNDigitsStr(Math.abs(parseInt(newCourse)), 3);
            this.dispCourse.html(newCourseStr);

            if (canUpdate) {
                const shadowAllowDeg = Util.arrangeCourseDig(dispCourse + this.uBoat.distCourse);
                this.compassAllowShadow.css('transform', 'translateZ(1px) rotate(' + shadowAllowDeg + 'deg)');
            }
        }

        if (Math.round(this.uBoat.course) === Math.round(this.uBoat.distCourse) && canUpdate) {
            this.compassAllowShadow.css('display', 'none');
        }
    }

    /**
     * 船の深度表示を更新する
     * @param {number} newDepth 更新後の深度
     */
    updateDepth(newDepth) {
        const oldDepth = parseInt(this.dispDepth.html());
        const depthToDeg = this.#depthToDeg;
        const canUpdate = this.depthMatorAllowShadow.attr('noupdate') === 'false';
        if (newDepth !== oldDepth) {
            let newDepthStr = Util.numbToNDigitsStr(Math.abs(parseInt(newDepth)), 3);
            this.dispDepth.html(newDepthStr);

            const deg = depthToDeg(newDepth);
            this.depthMatorAllow.css('transform', 'rotate(' + deg + 'deg)');
        }

        if (Math.round(this.uBoat.depth) === Math.round(this.uBoat.distDepth) && canUpdate) {
            this.depthMatorAllowShadow.css('display', 'none');
        }
    }

    /**
     * 深度から矢印の表示角度を取得する
     * @param {number} depth 深度
     * @return {number} 矢印の表示角度(deg)
     */
    #depthToDeg(depth) {
        const diff = depth / 0.86;
        const clickDeg = diff + 208;
        const deg = Util.arrangeCourseDig(clickDeg);
        return deg;
    }

    /**
     * 魚雷の状態を更新する
     * @param {number} torpedoCount 更新後の魚雷残数
     * @param {number} torpedoEnable 魚雷の発射が可能か
     */
    updateTorpedoStatus(torpedoCount, torpedoEnable) {
        this.torpedoCount.html(torpedoCount);
        const fireButton = $('#fireButton');
        if (torpedoEnable) {
            fireButton.attr('disabled', false)
            fireButton.attr('src', 'resources/fireOff.png');
        } else {
            fireButton.attr('disabled', true)
            fireButton.attr('src', 'resources/fireOn.png');
        }
    }

    /**
     * 指定した名前のフィールド値を取得する
     * @param {string} name フィールド名
     * @return {object} フィールドの値
     */
    #getFieldByName(name) {
        const tdc = this.uBoat.tdc;
        switch (name) {
            case "bearing":
                return tdc.bearing;
            case "range":
                return tdc.range;
            case "aonbow":
                return tdc.angleOfBow;
            case "targetSpeed":
                return tdc.targetSpeed;
            case "torpedoSpeed":
                return tdc.torpedoSpeed;
            case "gyroAngle":
                return tdc.gyroAngle;
            case "hitTime":
                return tdc.hitTime;
            default:
                return null;
        }
    }
}
