/**
 * メッセージパネル用コントローラ
 */
export class MessageController {

    messageBox;

    /**
    * コンストラクタ
    */
    constructor() {
        this.messageBox = $('#messageBox2');
        // すべてのメッセージを削除
        this.messageBox.html('');
    }

    /**
     * メッセージの表示
     * @param speaker 発言者
     * @param text 表示文言
     */
    showMessage(speaker, text) {
        let speakerMessage = $('<span></span>', {
            text: speaker + " : ",
            class: 'fst-italic',
        });
        let message = $("<p></p>", {
            text: text,
            class: 'mb-0',
        }).prepend(speakerMessage);
        this.messageBox.append(message);

        // スクロールを一番下まで下げる
        this.messageBox.scrollTop(this.messageBox.get(0).scrollHeight);
    }
}
