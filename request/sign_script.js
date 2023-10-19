var iframe = document.getElementById('sandboxFrame');

//Listen to foreground/background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == 'signRequestData') {
        this.document.getElementById("signData").innerHTML = generateSignDataHtml(request.data);
        this.document.getElementById("signConfirm").onclick = async () => {
            const signResult = await postToSandbox({
                cmd: 'signMessage',
                data: request.data
            });
            sendResponse(signResult);
        };
    }
    return true;
});

//Trigger reload to make sure the sandbox libraries are loaded and available when popoup opens.
iframe.src += '';
iframe.onload = function () {
    Startup();
};

async function Startup() {
    let lastUsedName = await getLastUsedAccountName();
    await openAccount(lastUsedName, await openSession());

    chrome.runtime.sendMessage({
        message: "requestPageLoaded",
    });

    this.document.getElementById("signConfirm").disabled = false;
}

function generateValueBoxHtml(value) {
    return `<input type="text" class="form-control" value="${value}" readonly>`;
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
