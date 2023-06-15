var iframe = document.getElementById('sandboxFrame');

//Listen to sandbox replies
window.addEventListener('message', function (event) {
    if (event.data.cmd == 'loadFromSeed') {
        this.document.getElementById("signConfirm").disabled = false;
    }
});

//Listen to foreground/background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == 'signRequestData') {
        this.document.getElementById("signData").innerHTML = generateSignDataHtml(request.data);
        this.document.getElementById("signConfirm").onclick = () => {

            iframe.contentWindow.postMessage({
                cmd: 'signMessage',
                data: request.data
            }, "*");

            window.addEventListener('message', (event) => {
                if (event.data.cmd == 'signMessage') {
                    sendResponse(event.data.reply);
                }
            }, false);
        };
    }
    return true;
});

//Trigger reload to make sure the sandbox libraries are loaded and available when popoup opens.
iframe.src += '';
iframe.onload = function () {
    Startup();
};

function Startup() {
    chrome.storage.local.get(["seed"]).then((result) => {
        if (result.seed) {
            //Load from seed 
            iframe.contentWindow.postMessage({
                cmd: 'loadFromSeed',
                seed: result.seed
            }, "*");
        }
    });
    chrome.runtime.sendMessage({
        message: "requestPageLoaded",
    });
}

function generateValueBoxHtml(value) {
    return `<p class="card-text valueBox">${value}</p>`;
}

function generateValueTitleHtml(title) {
    return `<h4>${title}</h4>`;
}


function generateSignDataHtml(data) {
    let html = '';
    html += `<h4>Signature Request</h4>`;
    html += generateValueBoxHtml(data);

    return html;
}
