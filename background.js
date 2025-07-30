let waitingForRequestPage = true;
let requestPopupWindow;
let currentAccount;


let portToOffscreen;

chrome.runtime.onConnect.addListener(async function (port) {
}); // just accept connection

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.fromOffscreen) {
        return handleOffscreenMessages(request, sender, sendResponse);
    }

    else if (request.message === 'requestPageLoaded') {
        waitingForRequestPage = false;
        sendResponse({ success: true });
        return false; // Synchronous response
    }

    else if (request.message === 'onNovioTxRequest') {
        //You need to be authenticated to send requests.
        getTabWallet('' + sender.tab?.id).then((assignedWallet) => {
            if (assignedWallet == null) {
                sendResponse({
                    error: `Not authenticated`
                })
                return false;
            }

            if (requestPopupWindow) {
                chrome.windows.remove(requestPopupWindow.id);
                requestPopupWindow = null;
            }

            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            openTransactionRequest(request, sendResponse, sender, assignedWallet);
            return true;
        })
        return true;
    }
    else if (request.message === 'onNovioSignRequest') {
        //first open the wallet if the extension is locked.
        const readyForRequest = new Promise((resolve) => {
            if (currentAccount == null) {

                chrome.action.openPopup().catch((err) => {
                    console.error("Failed to open popup:", err);
                });

                chrome.runtime.onMessage.addListener((innerRequest, sender, sendResponse) => {
                    if (innerRequest.message === 'NovioAccountOpened') {
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        })

        readyForRequest.then(() => {
            if (requestPopupWindow) {
                chrome.windows.remove(requestPopupWindow.id);
                requestPopupWindow = null;
            }

            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            openSignRequest(request, sendResponse, sender);
        })

        return true; // We're sending an async response
    }
    else if (request.message === 'onNovioClientSend') {
        chrome.runtime.sendMessage({
            target: 'offscreen',
            message: 'clientSend',
            data: request.data,
            tabId: sender.tab?.id,
        });
        sendResponse({ success: true });
        return false; // Synchronous response
    }
    else if (request.message === 'NovioAccountOpened') {
        currentAccount = request.account;
        sendResponse({ success: true });
        return false; // Synchronous response
    }

    // For any unhandled messages
    sendResponse({ error: 'Unknown message type' });
    return false;
});

async function openSignRequest(request, sendResponse, sender) {
    chrome.windows.get(sender.tab.windowId, async (tabWindow) => {
        const width = 440;
        let height = 310;
        const url = 'request/sign.html';
        if (request.allowClient) {
            height += 20;
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

        setTimeout(async () => {
            while (waitingForRequestPage) {
                await sleep(50);
            }
            if (request.message === 'onNovioSignRequest') {
                chrome.runtime.sendMessage({
                    message: "signRequestData",
                    data: request.data,
                    allowClient: request.allowClient,
                    account: currentAccount
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

                        setTabWallet('' + sender.tab?.id, currentAccount.Name);

                        if (request.allowClient) {
                            try {
                                await chrome.offscreen.closeDocument();
                            } catch (error) {
                                //We clean up first, but if there is no offscreen document we dont want any errors to show, thats fine.
                            }
                            await setupOffscreenSandbox(sender);
                        }

                        sendResponse(result);
                    }
                    requestPopupWindow = null;
                });
            }
        }, 50);
    })
}

async function openTransactionRequest(request, sendResponse, sender, assignedWallet) {
    chrome.windows.get(sender.tab.windowId, async (tabWindow) => {
        const width = 420;
        const height = 280;
        const url = 'request/request.html';
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

        setTimeout(async () => {
            while (waitingForRequestPage) {
                await sleep(50);
            }

            chrome.runtime.sendMessage({
                message: "transactionRequestData",
                data: request.data,
                assignedWalletName: assignedWallet
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
        }, 50);
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let creating; // A global promise to avoid concurrency issues
async function setupOffscreenSandbox(sender) {
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

        await authenticateOffscreenSecurely(sender);
        return created;
    }
}

async function authenticateOffscreenSecurely(sender) {
    if (!portToOffscreen) {
        portToOffscreen = chrome.runtime.connect({ name: "secure-auth-channel" });
        portToOffscreen.onDisconnect.addListener(function () {
            console.log('we disconnected with offscreen.');

            chrome.tabs.sendMessage(
                portToOffscreen.clientTabId,
                { message: 'NovioDisconnectedClient', target: 'content' }
            );

            portToOffscreen = undefined;
        });
    }

    let lastUsedName = (await chrome.storage.local.get(["lastUsedAccountName"])).lastUsedAccountName;
    const storedSession = (await chrome.storage.session.get(["session"])).session;
    if (!storedSession) return;

    let decrypted = await aesGcmDecrypt(storedSession.a, storedSession.b);
    let accounts = await chrome.storage.local.get(["accountStore"]);
    let walletJSON = accounts.accountStore[lastUsedName];

    portToOffscreen.clientTabId = sender.tab?.id;
    portToOffscreen.postMessage({
        message: "clientAuthenticate",
        walletJson: walletJSON,
        walletPassword: decrypted,
        clientTabId: sender.tab?.id,
    });
}

async function handleOffscreenMessages(request, sender, sendResponse) {

    if (request.clientTabId == null) {
        throw new Error("Offscreen message received which has no target tab.");
    }

    //This is how we close the offscreen document.
    //TODO: identify when the website disconnects, closes/refreshes tab, so we can close offscreen.
    //chrome.offscreen.closeDocument();


    if (request.message === 'onNovioClientPing') {
        chrome.tabs.sendMessage(
            request.clientTabId,
            { message: 'onNovioClientPing', target: 'content', data: request.data }
        ).then(response => {
            sendResponse({ success: true, response });
        }).catch((onError) => {
            console.warn('client connection to tab lost, closing offscreen document...', onError);
            try {
                chrome.offscreen.closeDocument();
            } catch (error) {
            }
            sendResponse({ error: onError.message });
        });
        return true; // We're sending an async response
    }
    else if (request.message === 'NovioConnectedClient') {
        chrome.tabs.sendMessage(
            request.clientTabId,
            { message: 'NovioConnectedClient', target: 'content', data: request.data }
        );
        sendResponse({ success: true });
        return false; // We're sending an async response
    }
    else if (request.message === 'NovioDisconnectedClient') {
        chrome.tabs.sendMessage(
            request.clientTabId,
            { message: 'NovioDisconnectedClient', target: 'content', data: request.data }
        );
        sendResponse({ success: true });
        return false; // We're sending an async response
    }
    else if (request.message === 'onNovioClientMessage') {
        chrome.tabs.sendMessage(
            request.clientTabId,
            { message: 'onNovioClientMessage', target: 'content', data: request.data }
        ).then(() => {
            sendResponse({ success: true });
        }).catch((error) => {
            sendResponse({ error: error.message });
        });
        return true; // We're sending an async response
    }
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

async function setTabWallet(tabId, name) {
    await chrome.storage.session.set({
        [tabId]: name
    });
}

async function getTabWallet(tabId) {
    try {
        const result = await chrome.storage.session.get([tabId]);
        return result[tabId];
    } catch (error) {
    }
    return null;
}
