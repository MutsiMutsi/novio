let waitingForRequestPage = true;

let tabId = -1;
let windowId = -1;
let requestTabId = -1;
let requestPopupWindow;
let offscreenClientTab = -1;

chrome.runtime.onConnect.addListener(async function (port) {
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

    else if (request.message === 'requestPageLoaded') {
        waitingForRequestPage = false;
    }

    else if (request.message === 'onNovioTxRequest' || request.message === 'onNovioSignRequest') {
        if (requestPopupWindow) {
            chrome.windows.remove(requestPopupWindow.id);
            requestPopupWindow = null;
        }

        //when the background goes to sleep we lose track so we fetch it instead
        if (windowId = -1) {
            chrome.windows.getCurrent((currentWindow) => {
                windowId = currentWindow.id;
                openRequest(request, sendResponse);
                return true;
            })
        } else {
            openRequest(request, sendResponse);
            return true;
        }
    }

    else if (request.message === 'onNovioClientMessage') {
        if (offscreenClientTab !== -1) {
            chrome.tabs.sendMessage(
                offscreenClientTab,
                { message: 'onNovioClientMessage', target: 'foreground', data: request.data }
            );
        } else {
            chrome.offscreen.closeDocument();
        }
    } else if (request.message === 'onNovioClientSend') {
        chrome.runtime.sendMessage({
            target: 'offscreen',
            message: 'clientSend',
            data: request.data
        });
    } else if (request.message === 'onNovioClientPing') {
        if (offscreenClientTab !== -1) {
            chrome.tabs.sendMessage(
                offscreenClientTab,
                { message: 'onNovioClientPing', target: 'foreground', data: request.data }
            ).then(response => {
                //No problems...
            }).catch((onError) => {
                offscreenClientTab = -1;
                console.warn('client connection to tab lost, closing offscreen document...', onError);
                chrome.offscreen.closeDocument();
            });
        } else {
            console.warn('client connection to tab lost, closing offscreen document...');
            chrome.offscreen.closeDocument();
        }
    }

    return true;
});

function openRequest(request, sendResponse) {
    chrome.windows.get(windowId, async (tabWindow) => {
        let width = 417;
        let height = 564;

        let url = 'request/request.html';
        if (request.message === 'onNovioSignRequest') {
            url = 'request/sign.html';
            height = 320;
        }

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
            url: url,
        });
        requestTabId = requestPopupWindow.tabs[0].id;

        setTimeout(async () => {
            while (waitingForRequestPage) {
                await sleep(50);
            }

            if (request.message === 'onNovioTxRequest') {
                chrome.runtime.sendMessage({
                    message: "transactionRequestData",
                    data: request.data
                }, (result) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({
                            error: 'cancelled'
                        });
                    } else {
                        sendResponse(result);
                    }
                    requestPopupWindow = null;
                });
            }
            else if (request.message === 'onNovioSignRequest') {
                chrome.runtime.sendMessage({
                    message: "signRequestData",
                    data: request.data,
                    allowClient: request.allowClient
                }, async (result) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({
                            error: 'cancelled'
                        });
                    } else {
                        if (requestPopupWindow) {
                            chrome.windows.remove(requestPopupWindow.id);
                            requestPopupWindow = null;
                        }

                        if (request.allowClient) {
                            if (offscreenClientTab !== -1) {
                                await chrome.offscreen.closeDocument();
                            }
                            await setupOffscreenSandbox();
                            offscreenClientTab = tabId;
                        }
                        sendResponse(result);
                    }
                    requestPopupWindow = null;
                });
            }
        }, 50);
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let creating; // A global promise to avoid concurrency issues
async function setupOffscreenSandbox() {
    // Check all windows controlled by the service worker to see if one 
    // of them is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
            justification: 'secure sandbox nkn client',
        });
        let created = await creating;
        creating = null;
        await authenticateOffscreen();
        return created;
    }
}

// Send message to offscreen document
async function authenticateOffscreen() {
    let lastUsedName = (await chrome.storage.local.get(["lastUsedAccountName"])).lastUsedAccountName;
    const storedSession = (await chrome.storage.session.get(["session"])).session;
    if (storedSession == null) {
        return null;
    }
    let decrypted = await aesGcmDecrypt(storedSession.a, storedSession.b);

    var accounts = await chrome.storage.local.get(["accountStore"]);
    var walletJSON = accounts.accountStore[lastUsedName];

    chrome.runtime.sendMessage({
        message: "clientAuthenticate",
        walletJson: walletJSON,
        walletPassword: decrypted,
    });
}

async function aesGcmDecrypt(ciphertext, password) {
    const pwUtf8 = new TextEncoder().encode(password);                                 // encode password as UTF-8
    const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8);                      // hash the password

    const ivStr = atob(ciphertext).slice(0, 12);                                        // decode base64 iv
    const iv = new Uint8Array(Array.from(ivStr).map(ch => ch.charCodeAt(0)));          // iv as Uint8Array

    const alg = { name: 'AES-GCM', iv: iv };                                           // specify algorithm to use

    const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['decrypt']); // generate key from pw

    const ctStr = atob(ciphertext).slice(12);                                          // decode base64 ciphertext
    const ctUint8 = new Uint8Array(Array.from(ctStr).map(ch => ch.charCodeAt(0)));     // ciphertext as Uint8Array
    // note: why doesn't ctUint8 = new TextEncoder().encode(ctStr) work?

    try {
        const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8);            // decrypt ciphertext using key
        const plaintext = new TextDecoder().decode(plainBuffer);                       // plaintext from ArrayBuffer
        return plaintext;                                                              // return the plaintext
    } catch (e) {
        throw new Error('Decrypt failed');
    }
}
