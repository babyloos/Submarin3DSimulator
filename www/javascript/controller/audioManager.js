/**
 * 音声管理用クラス
 */
export class AudioManager {
    audioSource;

    constructor() {
    }

    load(audioPath) {
        this.audioElement = new Audio(audioPath);
        this.audioElement.volume = 0.2;
    }

    play() {
        if (!this.audioElement.paused) { this.stop(); }
        this.audioElement.play().then(() => {
        }).catch((error) => {
            console.log(error);
        });
    }

    stop() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }
}