let iframe = document.getElementById('sandboxFrame');
let pingInterval = null;
let clientTabId = -1;


chrome.runtime.onConnect.addListener((port) => {
    const expectedSenderUrl = `chrome-extension://${chrome.runtime.id}/background.js`;

    //ignore novio-contentScript we dont need this.
    if (port.name === 'novio-contentScript') {
        return;
    }

    if (port.sender?.url !== expectedSenderUrl || port.name !== "secure-auth-channel") {
        console.warn("Rejected untrusted port connection from:", port.sender?.url);
        port.disconnect();
        return;
    }

    port.onMessage.addListener((msg) => {
        if (msg.message === "clientAuthenticate") {
            clientTabId = msg.clientTabId;
            handleClientAuthenticate(msg, null, msg.data);
        }
    });
});

// Helper function to safely send runtime messages
function sendRuntimeMessage(message) {
    try {
        message.clientTabId = clientTabId;
        message.fromOffscreen = true;
        chrome.runtime.sendMessage(message);
    } catch (error) {
        console.error('Failed to send runtime message:', error);
    }
}

// Listen to foreground/background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.fromOffscreen) {
        //Don't handle our own requests!!!
        return false;
    }

    if (request.target != 'offscreen') {
        //If its not for us we dont need it!
        return false;
    }

    if (clientTabId == -1) {
        //throw new Error("CLIENT TAB WAS NOT DEFINED");
        return false;
    }
    if (request.tabId !== clientTabId) {
        //console.log(request);
        //console.log(`GOT: ${request.tabId} EXPECTED: ${clientTabId}`);
        //throw new Error("WRONG CLIENT TAB RECEIVED FOR REQUEST");
        return false;
    }

    if (request.message == 'clientSend') {
        handleClientSend(request, sendResponse);
        return true; // Keep channel open for async response
    }
    else if (request.message == 'clientDisconnect') {
        handleClientDisconnect(request, sendResponse);
        return true; // Keep channel open for async response
    }
    else if (request.message == 'onNovioSignOutRequest') {
        handleClientDisconnect(request, sendResponse);
        return true; // Keep channel open for async response
    }
    return false; // No async response needed
});

async function handleClientSend(request, sendResponse) {
    try {
        await postToSandbox({
            cmd: 'clientSend',
            data: {
                addr: request.data.addr,
                payload: request.data.payload,
                options: request.data.options,
                requestId: request.data.requestId
            }
        });
        sendResponse({ success: true });
    } catch (error) {
        sendResponse({ error: error.message });
    }
}

async function handleClientAuthenticate(request, sendResponse, data) {
    try {
        sendRuntimeMessage({ message: "NovioDisconnectedClient", });

        await postToSandbox({
            cmd: 'openWallet',
            json: request.walletJson,
            password: request.walletPassword
        });

        await initClient(sendResponse, data);

        sendRuntimeMessage({ message: "NovioConnectedClient", });

        // Clear any existing ping interval
        if (pingInterval) {
            clearInterval(pingInterval);
        }

        // Ping client with error handling
        pingInterval = setInterval(async () => {
            try {
                let pingResponse = await postToSandbox({ cmd: 'pingClient' });
                sendRuntimeMessage({
                    message: "onNovioClientPing",
                    data: { clientReady: pingResponse }
                });
            } catch (error) {
                console.error('Ping failed:', error);
                // Optionally clear interval if ping consistently fails
            }
        }, 3000);
    } catch (error) {
        throw new Error("Failed to authenticate client: " + error.message);
    }
}

async function handleClientDisconnect(request, sendResponse) {
    try {
        let result = await postToSandbox({
            cmd: 'disconnectClient'
        });

        // Remove existing listener
        window.removeEventListener('message', messageHandler);

        // Clear any existing ping interval
        if (pingInterval) {
            clearInterval(pingInterval);
        }

        sendResponse({ success: true, result: result });
    } catch (error) {
        sendResponse({ error: error.message });
    }
}

async function initClient(sendResponse, data) {
    try {
        let addr = await postToSandbox({ cmd: 'getClient', tls: data.tls, encrypt: data.encrypt, identifier: data.identifier });
        // Remove existing event listener to prevent duplicates
        window.removeEventListener('message', messageHandler);
        window.addEventListener('message', messageHandler);
        return addr;
    } catch (error) {
        sendResponse({ error: error.message });
        throw error;
    }
}

function messageHandler(event) {
    if (event.data.clientMsg == null) {
        return;
    }

    sendRuntimeMessage({
        message: "onNovioClientMessage",
        data: {
            Sender: event.data.clientSrc,
            Message: event.data.clientMsg,
            replyTo: event.data.replyTo
        }
    });
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (pingInterval) {
        clearInterval(pingInterval);
    }
    window.removeEventListener('message', messageHandler);
});
