/**
 * シリアル化用クラス
 * ストレージに保存する必要のあるオブジェクトが継承する
 */
export class Serializable {

    /**
     * コンストラクタ
     */
    constructor() {
    }

    /**
     * オブジェクトをシリアル化する
     * @return {JSON} シリアル化したJSONオブジェクト
     */
    serialize() {
        return JSON.stringify({});
    }

    /**
     * シリアルからオブジェクトを生成する
     * @param {JSON} json シリアル化したJSONオブジェクト
     * @return {GameObject} 生成したオブジェクト
     */
    static deserialize() {
    }
}