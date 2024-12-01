/**
 * 音声管理用クラス
 */
export class AudioManager {
    audioContext;
    audioElement;
    audioSource;
    isFirstPlay = true;

    constructor() {
    }

    load(audioPath) {
        this.audioElement = new Audio(audioPath);
    }

    play() {
        if (!this.isFirstPlay) {
            return;
        }
        this.audioElement.play().then(() => {
            this.isFirstPlay = false;
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