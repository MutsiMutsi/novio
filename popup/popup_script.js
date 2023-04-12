var iframe = document.getElementById('sandboxFrame');
var seed = null;
let getTransactionIntervalId = -1;
let fees = {
    min: 0,
    avg: 0,
    max: 0.01
};

//Listen to sandbox replies
window.addEventListener('message', function (event) {
    if (event.data.cmd == 'getAddress') {
        document.getElementById("address").innerHTML = event.data.reply;
    }
    else if (event.data.cmd == 'getBalance') {
        document.getElementById("balance").innerHTML = event.data.reply;
    }
    else if (event.data.cmd == 'getFee') {
        this.document.getElementById("minFee").innerHTML = `Slow (${event.data.reply.min.toFixed(2)})`;
        this.document.getElementById("avgFee").innerHTML = `Average (${event.data.reply.avg.toFixed(2)})`;
        this.document.getElementById("maxFee").innerHTML = `Fast (${event.data.reply.max.toFixed(2)})`;
    }
    else if (event.data.cmd == 'loadFromSeed') {
        if (event.data.reply == "SUCCESS") {
            seed = event.data.seed;
            chrome.storage.local.set({ seed: seed }, null);
            iframe.contentWindow.postMessage({
                cmd: 'getAddress'
            }, "*");
            iframe.contentWindow.postMessage({
                cmd: 'getBalance'
            }, "*");
            iframe.contentWindow.postMessage({
                cmd: 'getFee'
            }, "*");
            document.getElementById("importBox").style.display = 'none';
            document.getElementById("walletBox").style.display = 'block';
            humane.log("Login Success!");
        } else {
            humane.log("Error on seed import!");
            document.getElementById("seedInput").value = "";
        }
    }
    else if (event.data.cmd == 'transfer') {
        if (event.data.reply === "SUCCESS") {
            document.getElementById("transferToAddress").value = '';
            document.getElementById("transferToAmount").value = '';

            //Poll for transaction
            this.clearInterval(getTransactionIntervalId);
            getTransactionIntervalId = setInterval(() => {
                iframe.contentWindow.postMessage({
                    cmd: 'getTransaction',
                    hash: event.data.hash
                }, "*");
            }, 3000)

            //Show last tx box
            document.getElementById("lastTxInfoBox").style.display = 'block';
            document.getElementById("lastTxHash").innerHTML = event.data.hash;
            document.getElementById("lastTxPending").style.display = 'block';
            document.getElementById("lastTxConfirmed").style.display = 'none';
        } else {
            humane.log(event.data.reply);
        }
        document.getElementById("sendButton").disabled = false;
    }
    else if (event.data.cmd == 'getTransaction') {
        if (event.data.reply != null) {
            clearInterval(getTransactionIntervalId);
            humane.log("Transfer Confirmed!");
            document.getElementById("lastTxPending").style.display = 'none';
            document.getElementById("lastTxConfirmed").style.display = 'block';
            iframe.contentWindow.postMessage({
                cmd: 'getBalance'
            }, "*");
        }
    }
});

//Trigger reload to make sure the sandbox libraries are loaded and available when popoup opens.
iframe.src += '';
iframe.onload = function () {
    Startup();
};

function Startup() {
    document.getElementById("importButton").addEventListener("click", importWallet);
    document.getElementById("sendButton").addEventListener("click", transfer);
    document.getElementById("deleteButton").addEventListener("click", deleteWallet);
    document.getElementById("deleteConfirmButton").addEventListener("click", confirmDelete);
    document.getElementById("deleteCancelButton").addEventListener("click", cancelDelete);

    //Inject the seed into view when toggled, remove when untoggled.
    let details = document.getElementById("deleteDetails");
    details.addEventListener("toggle", (event) => {
        if (details.open) {
            /* the element was toggled open */
            details.innerHTML = `<summary>Seed</summary>` + seed;
        } else {
            /* the element was toggled closed */
            details.innerHTML = `<summary>Seed</summary>`;
        }
    });

    chrome.storage.local.get(["seed"]).then((result) => {
        if (result.seed) {
            loadFromSeed(result.seed);
        }
    });

    chrome.runtime.sendMessage({
        message: "getPageAddress",
    });
}

function importWallet() {
    var importedSeed = document.getElementById("seedInput").value;
    loadFromSeed(importedSeed);
}

function transfer() {
    document.getElementById("sendButton").disabled = true;

    var selectedFeeIndex = +document.getElementById("feeRange").value;
    var selectedFeeValue = 0;
    switch (selectedFeeIndex) {
        case 0:
            selectedFeeValue = fees.min;
            break;
        case 1:
            selectedFeeValue = fees.avg;
            break;
        case 2:
            selectedFeeValue = fees.max;
            break;
    };

    iframe.contentWindow.postMessage({
        cmd: 'transfer',
        address: document.getElementById("transferToAddress").value,
        amount: document.getElementById("transferToAmount").value,
        fee: selectedFeeValue
    }, "*");
}

function loadFromSeed(seed) {
    //Load from seed 
    iframe.contentWindow.postMessage({
        cmd: 'loadFromSeed',
        seed: seed
    }, "*");
}

function deleteWallet() {
    document.getElementById("walletBox").style.display = 'none';
    document.getElementById("deleteWalletBox").style.display = 'block';
    document.getElementById("deleteDetails").removeAttribute("open");
}

function confirmDelete() {
    chrome.storage.local.set({ seed: null }, null);
    document.getElementById("importBox").style.display = 'block';
    document.getElementById("deleteWalletBox").style.display = 'none';
}

function cancelDelete() {
    document.getElementById("walletBox").style.display = 'block';
    document.getElementById("deleteWalletBox").style.display = 'none';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'pageDataLoaded') {
        document.getElementById("pageAddressBox").style.display = 'block'
        document.getElementById("connectedPage").innerHTML = `<i class="bi bi-check"></i>page connected<br>${request.data}`;
    }
});