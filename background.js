let waitingForRequestPage = true;

let tabId = -1;
let windowId = -1;
let requestTabId = -1;
let requestPopupWindow;


chrome.runtime.onConnect.addListener(function (port) {
}); // just accept connection

async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

chrome.windows.onFocusChanged.addListener(async (focusInfo) => {
    var currentTab = await getCurrentTab();
    if (currentTab) {
        tabId = currentTab.id;
        windowId = focusInfo;
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeInfo.tabId == requestTabId) {
        return;
    }
    tabId = activeInfo.tabId;
    windowId = activeInfo.windowId;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.message === 'executeForeground') {
        try {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ["./foreground.js"]
            }).catch((error) => {
                console.log(error);
            })
        } catch (error) {
            //Some pages like chrome extensions block scripting, digest this exception.
            console.log(error);
        }
    }

    if (request.message === 'requestPageLoaded') {
        waitingForRequestPage = false;
    }

    if (request.message === 'onNovioTxRequest') {
        if (requestPopupWindow) {
            chrome.windows.remove(requestPopupWindow.id);
            requestPopupWindow = null;
        }

        //when the background goes to sleep we lose track so we fetch it instead
        if (windowId = -1) {
            chrome.windows.getCurrent((currentWindow) => {
                windowId = currentWindow.id;
                openRequest(request, sendResponse);
            })
        } else {
            openRequest(request, sendResponse);
        }
    }

    return true;
});

function openRequest(request, sendResponse) {
    chrome.windows.get(windowId, async (tabWindow) => {
        const width = 417;
        const height = 560;
        const left = Math.round((tabWindow.width - width) * 0.5 + tabWindow.left)
        const top = Math.round((tabWindow.height - height) * 0.5 + tabWindow.top)

        waitingForRequestPage = true;
        requestPopupWindow = await chrome.windows.create({
            width: width,
            height: height,
            top: Math.round(top),
            left: Math.round(left),
            focused: true,
            type: 'popup',
            url: 'request/request.html',
        });
        requestTabId = requestPopupWindow.tabs[0].id;

        setTimeout(async () => {
            while (waitingForRequestPage) {
                await sleep(50);
            }

            chrome.runtime.sendMessage({
                message: "transactionRequestData",
                data: request.data
            }, (result) => {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                    sendResponse({
                        error: 'cancelled'
                    });
                } else {
                    sendResponse(result);
                }
                requestPopupWindow = null;
            });
        }, 50);
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}