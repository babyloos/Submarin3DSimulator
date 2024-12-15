/**
 * 言語ごとの画像リソースに置換するためのクラス
 */
export default class ImgTranslator {
    static async translate() {
        const language = navigator.language;
        console.log(language);
        const json = await this.getJson();

        if (language !== 'ja') {
            // 日本語版出ない場合は何もしない
            return;
        }

        // translateのついているimgタグのsrcを書き換える
        const imgElements = document.querySelectorAll('img[translate]');
        console.log(imgElements);
    }

    static async getJson() {
        return await fetch('./resources/imgSrc.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }
                return response.json();
            })
            .then(jsonData => {
                return jsonData;
            })
            .catch(error => {
                console.error('jsonファイル取得エラー:', error);
            });
    }
}