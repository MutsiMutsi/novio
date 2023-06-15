if (!document.novioWalletConnected) {
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

    const onNovioConnectedEvent = new CustomEvent("onNovioConnected", {
        "bubbles": true,
        "cancelable": false,
        "detail": {},
    });
    document.dispatchEvent(onNovioConnectedEvent);

    var port = chrome.runtime.connect({ name: "novio-contentScript" });
    port.onDisconnect.addListener(function () {
        document.removeEventListener('onNovioTxRequest', novioTxRequestEventHandler);
        document.novioWalletConnected = false;
        const onNovioDisconnectedEvent = new CustomEvent("onNovioDisconnected", {
            "bubbles": true,
            "cancelable": false,
            "detail": {},
        });
        document.dispatchEvent(onNovioDisconnectedEvent);
    });
}

document.novioWalletConnected = true;