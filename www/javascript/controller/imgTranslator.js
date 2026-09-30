/**
 * 言語ごとの画像リソースに置換するためのクラス
 */
export default class ImgTranslator {
    /**
     * @param {string} language words.jsonの言語キー(en, ja, zh, zh-TW, ko, ...)
     */
    static async translate(language) {
        console.log(language);

        // 画像はen/ja/zhのみ用意している。繁体字は中国語画像、それ以外の言語は英語画像を使う
        let languageImgPath = 'en';
        if (language === 'ja') {
            languageImgPath = 'ja';
        } else if (language === 'zh' || language === 'zh-TW') {
            languageImgPath = 'zh';
        }

        // translateのついているimgタグのsrcを書き換える
        const imgElements = document.querySelectorAll('img[translate]');
        imgElements.forEach((imgElement) => {
            imgElement.src = imgElement.src.replace(
                /resources\/img\/(en|ja|zh)?\/?/,
                `resources/img/${languageImgPath}/`
            );
        });
    }
}
