/**
 * 音声管理用クラス
 */
export class AudioManager {
    audioContext;
    audioElement;
    audioSource;

    constructor(audioPath) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioElement = new Audio(audioPath);
        this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);

        const panner = this.audioContext.createPanner();
        panner.positionX.value = 0;
        panner.positionY.value = 0;
        panner.positionZ.value = 0;

        this.audioContext.listener.positionX.value = 0;
        this.audioContext.listener.positionY.value = 0;
        this.audioContext.listener.positionZ.value = 0;

        this.audioSource.connect(panner).connect(this.audioContext.destination);
    }

    play() {
        this.audioElement.play().then(() => {
            console.log("audio element: " + this.audioElement);
        }).catch((error) => {
            console.log(error);
        });
    }
}