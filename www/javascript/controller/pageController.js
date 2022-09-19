/**
 * 画面切り替え用コントローラ
 */
export class PageController {

    // 各画面ID
    static pageIds = ["titlePage", "manualPage", "diffSelectPage", "mainPage", "threePage",
        "loadPage", "messageArea2", "controllArea2", "statusArea2", "instructionArea"];

    // 表示中の画面ID
    static activePage = "titlePage";

    /**
     * 画面の表示切り替えを行う
     * @param {string} pageId 切り替え先画面ID
     */
    static pageTransition(pageId) {
        PageController.pageIds.forEach(function (id) {
            PageController.deactivatePage(id);
        });

        if (pageId === "mainPage" || pageId === "threePage") {
            PageController.deactivatePage("topPage");
            PageController.activatePage("mainPageContainer");
            PageController.activatePage(pageId);
        } else if (pageId === "titlePage" || pageId === "manualPage" || pageId === "diffSelectPage" || pageId === "loadPage") {
            PageController.pageIds.forEach(function (id) {
                if (pageId !== id) {
                    PageController.deactivatePage(id);
                }
            });
            PageController.activatePage("topPage");
            PageController.activatePage(pageId);
        }

        PageController.activePageId = pageId;
    }

    static activatePage(pageId) {
        $("#" + pageId).removeClass("hiddenPage");
        $("#" + pageId).addClass("activePage");
    }

    static deactivatePage(pageId) {
        $("#" + pageId).removeClass("activePage");
        $("#" + pageId).addClass("hiddenPage");
    }

}