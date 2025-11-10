function toggleLoading() {
    const overlay = document.getElementById('loadingOverlay');

    if (overlay.classList.contains('hidden')) {
        // Show loading (remove hidden and fade-out classes)
        overlay.classList.remove('hidden', 'fade-out');
    } else {
        // Hide loading with fade out
        overlay.classList.add('fade-out');
        // Remove from DOM after fade out completes
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 400); // Match the CSS transition duration
    }
}

const iframe = document.getElementById('sandboxFrame');

document.getElementById("walletAvatar").style.position = 'relative';
document.getElementById("walletAvatar").style.top = '-1px';

//Listen to foreground/background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == 'signRequestData') {

        //Set header.
        const shortenedAddr = request.account.Address.substring(0, 10) + "..." + request.account.Address.substring(26);
        document.getElementById('walletName').innerText = request.account.Name;
        document.getElementById('walletAddress').innerText = shortenedAddr;
        generatePictogram(document.getElementById("walletAvatar"), request.account.Address, 40);

        this.document.getElementById("signData").innerHTML = generateSignDataHtml(request);

        toggleLoading();

        this.document.getElementById("signConfirm").onclick = async () => {
            const signResult = await postToSandbox({
                cmd: 'signMessage',
                data: request.data
            });
            sendResponse(signResult);
        };
        return true;
    }
});

//Trigger reload to make sure the sandbox libraries are loaded and available when popoup opens.
iframe.src += '';
iframe.onload = function () {
    Startup();
};

async function Startup() {
    let lastUsedName = await getLastUsedAccountName();
    const session = await openSession();
    await openAccount(lastUsedName, session);

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
    console.log(data);

    let html = '';
    html += `<h4>Signature Request</h4>`;
    html += generateValueBoxHtml(data.data.message);
    if (data.data.useClient) {
        html += `<div style="width: 100%; text-align:center;'">
<sup style="color: var(--bs-primary);width: 100%;text-align: center;">This site is requesting permission to send and receive messages over NKN.</sup>
</div>`;

        html += `<h6>Using node TLS Connection:</h6>`;
        html += generateValueBoxHtml(data.data.tls ?? "false");
        html += `<h6>Encrypting node messages:</h6>`;
        html += generateValueBoxHtml(data.data.encrypt ?? "false");
        html += `<h6>Node client identifier:</h6>`;
        html += generateValueBoxHtml(data.data.identifier ?? "");
    }

    return html;
}
