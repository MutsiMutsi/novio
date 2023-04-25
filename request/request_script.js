var iframe = document.getElementById('sandboxFrame');
var fees;

//Listen to sandbox replies
window.addEventListener('message', function (event) {
    if (event.data.cmd == 'loadFromSeed') {
        if (event.data.reply == "SUCCESS") {
            iframe.contentWindow.postMessage({
                cmd: 'getFee'
            }, "*");
        }
    } else if (event.data.cmd == 'getFee') {
        fees = event.data.reply;
        this.document.getElementById("minFee").innerHTML = `Slow (${event.data.reply.min.toFixed(2)})`;
        this.document.getElementById("avgFee").innerHTML = `Average (${event.data.reply.avg.toFixed(2)})`;
        this.document.getElementById("maxFee").innerHTML = `Fast (${event.data.reply.max.toFixed(2)})`;
        this.document.getElementById("transactionConfirm").disabled = false;
    }
});

//Listen to foreground/background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == 'transactionRequestData') {
        this.document.getElementById("transactionData").innerHTML = generateTransactionDataHtml(request.data);
        this.document.getElementById("transactionConfirm").onclick = () => {

            this.document.getElementById("transactionDisplay").style.display = 'none';
            this.document.getElementById("waitingDisplay").style.display = 'block';
            this.document.getElementById("progressDisplay").style.display = 'block';
            this.document.getElementById("waitingIcon").style.display = 'block';

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
                cmd: 'sendTransaction',
                transaction: request.data,
                fee: selectedFeeValue
            }, "*");

            window.addEventListener('message', (event) => {
                if (event.data.cmd == 'sendTransaction') {



                    sendResponse(event.data.reply);

                    if (event.data.reply.error) {
                        this.document.getElementById("progressDisplay").style.display = 'none';
                        this.document.getElementById("waitingIcon").style.display = 'none';
                        this.document.getElementById("failedIcon").style.display = 'block';
                    }
                    else {
                        let dataValueIndex = typeDataDisplayIndex[request.data.type];
                        let displayValue = request.data.data[dataValueIndex];
                        addTransactionHistory(typeDisplay[request.data.type], displayValue, event.data.reply);

                        this.document.getElementById("progressDisplay").style.display = 'none';
                        this.document.getElementById("waitingIcon").style.display = 'none';
                        this.document.getElementById("successIcon").style.display = 'block';
                    }
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

const typeDisplay = {
    'transferTo': 'Transfer',
    'registerName': 'Register Name',
    'transferName': 'Transfer Name',
    'deleteName': 'Delete Name',
    'subscribe': 'Subscribe',
    'unsubscribe': 'Unsubscribe',
}

//Describes the index of the data array which is to be displayed in UI history
const typeDataDisplayIndex = {
    'transferTo': 1,
    'registerName': 0,
    'transferName': 0,
    'deleteName': 0,
    'subscribe': 0,
    'unsubscribe': 0,
}

function generateValueBoxHtml(value) {
    return `<p class="card-text valueBox">${value}</p>`;
}

function generateValueTitleHtml(title) {
    return `<h4>${title}</h4>`;
}

function generateTransactionDataHtml(requestData) {
    let html = '';
    html += `<h4>${typeDisplay[requestData.type]}</h4>`;

    switch (requestData.type) {
        case 'transferTo':
            html += generateValueBoxHtml(`${requestData.data[1]} NKN`) +
                generateValueTitleHtml("to") +
                generateValueBoxHtml(requestData.data[0]);
            break;
        case 'registerName':
        case 'deleteName':
            html += generateValueBoxHtml(requestData.data[0]);
            break;
        case 'transferName':
            html += generateValueBoxHtml(requestData.data[0]) +
                generateValueTitleHtml("to") +
                generateValueBoxHtml(requestData.data[1]);
            break;
        case 'subscribe':
            html += generateValueBoxHtml(requestData.data[0]) +
                generateValueTitleHtml("duration") +
                generateValueBoxHtml(requestData.data[1]) +
                generateValueTitleHtml("identifier") +
                generateValueBoxHtml(requestData.data[2]) +
                generateValueTitleHtml("meta") +
                generateValueBoxHtml(requestData.data[3]);
            break;
        case 'unsubscribe':
            html += generateValueBoxHtml(requestData.data[0]) +
                generateValueTitleHtml("identifier") +
                generateValueBoxHtml(requestData.data[1]);
            break;
        default:
            html += "UNKNOWN TYPE";
            break;
    }

    let attr = requestData.data.slice(-1);
    if (attr == '') {
        attr = null;
    }
    if (attr != null) {
        html += `<h4>Attributes</h4>
        <p class="card-text valueBox">${attr}</p>`
    }
    html += `<h4> Fee</h4>`;

    return html;
}

function addTransactionHistory(type, value, hash) {
    chrome.storage.local.get(["txHistory"]).then((result) => {
        let transactionHistory = result.txHistory;
        if (!transactionHistory) {
            transactionHistory = [];
        }
        transactionHistory.unshift({
            date: +new Date(),
            type: type,
            value: value,
            txHash: hash
        })
        chrome.storage.local.set({ txHistory: transactionHistory }, null);
    });
}
