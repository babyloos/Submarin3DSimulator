/**
 * 言語ごとの画像リソースに置換するためのクラス
 */
export default class ImgTranslator {
    static async translate() {
        const language = navigator.language;
        console.log(language);

        if (language !== 'ja') {
            // 日本語版でない場合は何もしない
            return;
        }

        // translateのついているimgタグのsrcを書き換える
        const imgElements = document.querySelectorAll('img[translate]');
        imgElements.forEach((imgElement) => {
            imgElement.src = imgElement.src.replace('resources/img/', `resources/img/${language}/`);
        });
    }
}