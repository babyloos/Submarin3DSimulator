/**
 * 音声管理用クラス
 */
export class AudioManager {
    audioSource;

    constructor() {
    }

    load(audioPath) {
        this.audioElement = new Audio(audioPath);
    }

    play() {
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