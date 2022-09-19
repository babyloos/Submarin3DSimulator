/**
 * ステータスパネル用コントローラ
 */
export class StatusController {

    time;       // 時刻表示先
    damage;     // ダメージ表示先
    battery;    // バッテリー残量表示先
    o2;         // 酸素残量表示先

    /**
     * コンストラクタ
     */
    constructor() {
        this.time = $('.time > p');
        this.damage = $('#damage .progress-bar');
        this.battery = $('#battery .progress-bar');
        this.o2 = $('#o2 .progress-bar');
    }

    /**
     * ダメージ率表示の更新
     * @param {number} newDamage 更新後のダメージ率
     */
    updateDamage(newDamage) {
        this.#updatePlayerStatus(newDamage, this.damage);
    }

    /**
     * バッテリー残量表示の更新
     * @param {number} newBattery 更新後のバッテリー残量
     */
    updateBattery(newBattery) {
        this.#updatePlayerStatus(newBattery, this.battery);
    }

    /**
     * 酸素残量表示の更新
     * @param {number} newO2 更新後の酸素残量
     */
    updateO2(newO2) {
        this.#updatePlayerStatus(newO2, this.o2);
    }

    /**
     * プレイヤボートのステータス表示更新
     * @param {number} newValue 更新後の値
     * @param {jQueryObject} view 値反映先
     */
    #updatePlayerStatus(newValue, view) {
        newValue = parseInt(newValue);
        const oldValue = parseInt(view.css('width'));
        if (oldValue !== newValue) {
            view.css('width', newValue + "%");
        }
    }

    /**
     * ゲーム内時刻の更新
     * @param {Date} initTime ゲーム開始時刻
     * @param {int} time ゲーム経過時刻(s)
     */
    updateTime(initTime, time) {
        let newTime = new Date(initTime.getUTCSeconds());
        newTime.setUTCSeconds(initTime.getUTCSeconds() + time);
        let timeStr = this.#getTimeStr(newTime);
        this.time.html(timeStr);
    }

    #getTimeStr(date) {
        var d = new Date();
        var yyyy = date.getUTCFullYear();
        var MM = ('0' + (date.getUTCMonth() + 1)).slice(-2);
        var dd = ('0' + date.getUTCDate()).slice(-2);
        var hh = ('0' + date.getUTCHours()).slice(-2);
        var mm = ('0' + date.getUTCMinutes()).slice(-2);
        var ss = ('0' + date.getUTCSeconds()).slice(-2);
        return hh + ':' + mm + ':' + ss;
        // return yyyy + '-' + MM + '-' + dd + 'T' + hh + ':' + mm + ':' + ss + 'Z';
    }
}