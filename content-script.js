function injectProvider() {
    // Prevent double injection
    if (document.querySelector('script[data-novio-provider]')) {
        return;
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected-provider.js');
    script.setAttribute('data-novio-provider', 'true');

    script.onload = () => {
        console.log('Novio provider injected successfully');
        script.remove(); // Clean up after successful injection
    };

    script.onerror = () => {
        console.error('Failed to inject Novio provider');
    };

    // Find the best injection target
    const target = document.head || document.documentElement;

    if (target) {
        target.appendChild(script);
    } else {
        // Wait for DOM if neither head nor documentElement exists yet
        const observer = new MutationObserver((mutations, obs) => {
            const newTarget = document.head || document.documentElement;
            if (newTarget) {
                newTarget.appendChild(script);
                obs.disconnect();
            }
        });

        observer.observe(document, {
            childList: true,
            subtree: true
        });

        // Timeout fallback
        setTimeout(() => {
            observer.disconnect();
            if (document.documentElement && !document.querySelector('script[data-novio-provider]')) {
                document.documentElement.appendChild(script);
            }
        }, 1000);
    }
}

// Inject the provider
injectProvider();

document.addEventListener('onNovioTxRequest', novioTxRequestEventHandler);
function novioTxRequestEventHandler(event) {
    chrome.runtime.sendMessage({
        message: "onNovioTxRequest",
        data: event.detail,
    }, (response) => {
        const txResponseEvent = new CustomEvent("onNovioTxResponse", {
            bubbles: true,
            cancelable: false,
            detail: {
                type: event.detail.type,
                data: response,
            },
        });
        document.dispatchEvent(txResponseEvent);
    });
}

document.addEventListener('onNovioSignRequest', novioSignRequestEventHandler);
function novioSignRequestEventHandler(event) {
    chrome.runtime.sendMessage({
        message: "onNovioSignRequest",
        data: event.detail.data,
        allowClient: event.detail.allowClient,
    }, (response) => {
        const signResponseEvent = new CustomEvent("onNovioSignResponse", {
            bubbles: true,
            cancelable: false,
            detail: {
                type: event.detail.type,
                data: response,
            },
        });
        document.dispatchEvent(signResponseEvent);
    });
}


function fireOnNovioConnected() {
    setTimeout(() => {
        const onNovioConnectedEvent = new CustomEvent("onNovioConnected", {
            "bubbles": true,
            "cancelable": false,
            "detail": {
                //TODO: can we add whether the account is already logged in here?
            },
        });
        document.dispatchEvent(onNovioConnectedEvent);
    }, 100);
}

if (document.readyState === 'complete') {
    fireOnNovioConnected();
} else {
    window.addEventListener('load', fireOnNovioConnected);
}


var port = chrome.runtime.connect({ name: "novio-contentScript" });
port.onDisconnect.addListener(function () {
    Disconnect();
});

//Listen to background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == 'onNovioClientMessage') {
        const onNovioClientMessageEvent = new CustomEvent("onNovioClientMessage", {
            "bubbles": true,
            "cancelable": false,
            "detail": {
                message: request.data
            },
        });
        document.dispatchEvent(onNovioClientMessageEvent);
    }
    else if (request.message == 'onNovioClientPing') {
        const onNovioCLientPingEvent = new CustomEvent("onNovioClientPing", {
            "bubbles": true,
            "cancelable": false,
            "detail": {
                message: request.data
            },
        });
        document.dispatchEvent(onNovioCLientPingEvent);
    }
    else if (request.message == 'NovioConnectedClient') {
        document.dispatchEvent(
            new CustomEvent("NovioClientConnected", {
                "bubbles": true,
                "cancelable": false,
                "detail": {
                    message: request.data
                },
            }));
    }
    else if (request.message == 'NovioDisconnectedClient') {
        document.dispatchEvent(
            new CustomEvent("NovioClientDisconnected", {
                "bubbles": true,
                "cancelable": false,
                "detail": {
                    message: request.data
                },
            }));
    }
});

//Listen for clientSend requests
document.addEventListener('onNovioClientSend', novioClientSend);

function Disconnect() {
    document.removeEventListener('onNovioTxRequest', novioTxRequestEventHandler);
    document.removeEventListener('onNovioClientSend', novioClientSend);
    document.removeEventListener('onNovioSignRequest', novioSignRequestEventHandler);

    document.novioWalletConnected = false;
    const onNovioDisconnectedEvent = new CustomEvent("onNovioDisconnected", {
        "bubbles": true,
        "cancelable": false,
        "detail": {},
    });
    document.dispatchEvent(onNovioDisconnectedEvent);
}

function novioClientSend(event) {
    chrome.runtime.sendMessage({
        message: "onNovioClientSend",
        data: event.detail.data,
    });
}

window.addEventListener('message', (event) => {
    if (event.data.type === 'onNovioSignOutRequest') {
        chrome.runtime.sendMessage(
            {
                message: "onNovioSignOutRequest"
            }
        );
    }
});
