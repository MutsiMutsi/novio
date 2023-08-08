var iframe = document.getElementById('sandboxFrame');
var seed = null;
let getTransactionIntervalId = -1;
let fees = {
    min: 0,
    avg: 0,
    max: 0.01
};
let qrcode;
const explorerTxEndpoint = "https://nscan.io/transactions/";
const explorerAddrEndpoint = "https://nscan.io/addresses/";
let transactionHistory = [];

function getCopyValueElement(element) {
    let copyElement = document.createElement('i');
    copyElement.classList.add("bi");
    copyElement.classList.add("bi-subtract");
    copyElement.classList.add("copyValue");

    copyElement.onclick = () => {
        navigator.clipboard.writeText(element.innerText);
    };

    element.appendChild(copyElement);
}

//Listen to sandbox replies
window.addEventListener('message', function (event) {
    if (event.data.cmd == 'getAddress') {
        var addressElement = document.getElementById("address");
        addressElement.innerHTML = `${event.data.reply}`
        getCopyValueElement(addressElement);

        var addressElement = document.getElementById("addressDelete");
        addressElement.innerHTML = `${event.data.reply}`
        getCopyValueElement(addressElement);

        if (qrcode) {
            qrcode.makeCode(event.data.reply);
        } else {
            qrcode = new QRCode(document.getElementById("qrcode"), {
                text: event.data.reply,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#FFFFFF",
                correctLevel: QRCode.CorrectLevel.L
            });
        }
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

            addTransactionRow("Transfer", event.data.amount, event.data.hash);
            humane.log("Transfer sent awaiting confirmation!");

            //Poll for transaction
            this.clearInterval(getTransactionIntervalId);
            getTransactionIntervalId = setInterval(() => {
                iframe.contentWindow.postMessage({
                    cmd: 'getTransaction',
                    hash: event.data.hash
                }, "*");
            }, 3000)
        } else {
            humane.log(event.data.reply);
        }
        document.getElementById("sendButton").disabled = false;
    }
    else if (event.data.cmd == 'getTransaction') {
        if (event.data.reply != null) {
            clearInterval(getTransactionIntervalId);
            humane.log("Transfer Confirmed!");
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

$("#contactsBox").prepend(createContactRow('peter', "NKNNp6U8yGFeb1N8fHfQunFuDwtgT2t2zJhJ"));


function Startup() {
    document.getElementById("importButton").addEventListener("click", importWallet);
    document.getElementById("sendButton").addEventListener("click", transfer);
    document.getElementById("editWalletButton").addEventListener("click", editWallet);
    document.getElementById("closeEditWalletButton").addEventListener("click", stopEditWallet);

    document.getElementById("deleteWalletButton").addEventListener("click", openDeleteBox)
    document.getElementById("deleteConfirmButton").addEventListener("click", confirmDelete);
    document.getElementById("deleteCancelButton").addEventListener("click", cancelDelete);

    //Inject the seed into view when toggled, remove when untoggled.
    let details = document.getElementById("seedDetails");
    details.addEventListener("toggle", (event) => {
        if (details.open) {
            /* the element was toggled open */
            details.innerHTML = `<summary>Hide seed</summary>` + `<p class="card-text valueBox">${seed}</p>`;
        } else {
            /* the element was toggled closed */
            details.innerHTML = `<summary>Reveal seed</summary>`;
        }
    });

    chrome.storage.local.get(["seed"]).then((result) => {
        if (result.seed) {
            loadFromSeed(result.seed);
        }
    });

    chrome.runtime.sendMessage({
        message: "executeForeground",
    });

    loadTransactionHistory();
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

function hideAll() {
    document.getElementById("importBox").style.display = 'none';
    document.getElementById("walletBox").style.display = 'none';
    document.getElementById("editWalletBox").style.display = 'none';
    document.getElementById("deleteWalletBox").style.display = 'none';
    document.getElementById("seedDetails").removeAttribute("open");
}

function showBox(boxName) {
    hideAll();
    document.getElementById(boxName).style.display = 'block';
}

function editWallet() {
    showBox("editWalletBox");
}

function stopEditWallet() {
    showBox("walletBox");
}

function openDeleteBox() {
    showBox("deleteWalletBox");
}

function confirmDelete() {
    chrome.storage.local.set({ seed: null }, null);
    chrome.storage.local.set({ txHistory: null }, null);
    document.getElementById("seedInput").value = "";
    $("#transactionBox").empty();
    showBox("importBox");
}

function cancelDelete() {
    showBox("editWalletBox");
}

function loadTransactionHistory() {
    chrome.storage.local.get(["txHistory"]).then((result) => {
        if (result.txHistory) {
            transactionHistory = result.txHistory;
            result.txHistory.forEach(tx => {
                $("#transactionBox").append(createTransactionRow(tx.type, tx.value, tx.txHash));
            });
        }
    });
}

function addTransactionRow(type, value, txHash) {
    transactionHistory.push({
        date: +new Date(),
        type: type,
        value: value,
        txHash: txHash
    })
    $("#transactionBox").prepend(createTransactionRow(type, value, txHash));
    chrome.storage.local.set({ txHistory: transactionHistory }, null);
}

function createTransactionRow(type, value, txHash) {
    var explorer = `<a href="${explorerTxEndpoint + txHash}" target="_blank">explorer <i class="bi-box-arrow-up-right" style="color: var(--bs-secondary);"></i></a>`;
    var rowElement = $(`
    <div class="transactionRow hover-box">
        <div class="dismiss-box" id="dismiss-box">
            <p class="bi bi-trash text-center"></p>
        </div>
        <div class="row">
            <div class="col-4">
                <div class="bi bi-credit-card" style="height: 100% height: 100%; color: var(--bs-primary); font-weight: normal;"> ${type}</div>
            </div>
            <div class="col-8" style="text-align: right;">
                ${value}
            </div>
        </div>
        <div class="row">
            <div class="col-8">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${txHash}
                </div>
            </div>
            <div class="col-4" style="text-align: right;">
                ${explorer}
            </div>
        </div>
    </div>`);

    $(rowElement).find("#dismiss-box").on("click", function () {
        $(rowElement).remove();
        transactionHistory = transactionHistory.filter(item => item.txHash !== txHash);
        chrome.storage.local.set({ txHistory: transactionHistory }, null);
    });

    return rowElement;
}

function createContactRow(name, value) {
    var rowElement = $(`
    <div class="contactRow hover-box">
        <div class="dismiss-box" id="dismiss-box">
            <p class="bi bi-trash text-center"></p>
        </div>
        <div class="row">
            <div class="col-4">
                <div class="bi bi-person" style="height: 100% height: 100%; color: var(--bs-primary); font-weight: normal;"> ${name}</div>
            </div>
            <div class="col-8" style="text-align: right;">
                
            </div>
        </div>
        <div class="row">
            <div class="col-12">
                <div id="valueField" class="valueField" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${value}
                </div>
            </div>
        </div>
    </div>`);

    debugger;
    let el = $(rowElement).find("#valueField")[0];
    getCopyValueElement(el);


    $(rowElement).find("#dismiss-box").on("click", function () {
        $(rowElement).remove();
        //transactionHistory = transactionHistory.filter(item => item.txHash !== txHash);
        //chrome.storage.local.set({ txHistory: transactionHistory }, null);
    });

    return rowElement;
}