var iframe = document.getElementById('sandboxFrame');

//Listen to foreground/background messages
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.message == 'clientSend') {
        await postToSandbox({ cmd: 'clientSend', data: { addr: request.data.addr, payload: request.data.payload } });
    } else if (request.message == 'clientAuthenticate') {
        let result = await postToSandbox({ cmd: 'openWallet', json: request.walletJson, password: request.walletPassword });
        await initClient(sendResponse);

        //Ping client
        setInterval(async () => {
            let pingResponse = await postToSandbox({ cmd: 'pingClient' });
            chrome.runtime.sendMessage({
                message: "onNovioClientPing",
                data: { clientReady: pingResponse }
            });
        }, 3000);

        return true;
    }
});

//Trigger reload to make sure the sandbox libraries are loaded and available when popoup opens.
/*iframe.src += '';
iframe.onload = function () {
    initClient();
};*/

async function initClient(sendResponse) {
    let addr = await postToSandbox({ cmd: 'getClient' });
    window.addEventListener('message', function messageHandler(event) {

        if (event.data.clientMsg == null) {
            return;
        }
        let msg = JSON.parse(event.data.clientMsg);

        chrome.runtime.sendMessage({
            message: "onNovioClientMessage",
            data: { Sender: event.data.clientSrc, Message: msg }
        }, (result) => {
            if (chrome.runtime.lastError) {
                sendResponse({
                    error: chrome.runtime.lastError
                });
            } else {
                sendResponse(result);
            }
            requestPopupWindow = null;
        });
    });
}