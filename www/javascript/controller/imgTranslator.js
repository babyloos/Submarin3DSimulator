/**
 * 言語ごとの画像リソースに置換するためのクラス
 */
export default class ImgTranslator {
    static async translate(language) {
        console.log(language);

        if (language !== 'en' && language !== 'ja' && language !== 'zh' && language !== 'zh-CN' && language !== 'zh-TW') {
            // 登録されている言語でない場合は何もしない
            return;
        }

        let languageImgPath = language;
        if (languageImgPath === 'zh-CN' || languageImgPath === 'zh-TW') {
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