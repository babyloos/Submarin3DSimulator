/**
 * デバッグ用クラス
 */
export class Debug {

    fps;       // FPS表示エリア

    constructor() {
        this.fps = $('#fps');
    }

    /**
     * FPS表示
     */
    showFPS(fps) {
        this.fps.html(fps);
    }
}