var iframe = document.getElementById('sandboxFrame');
var paymentData;
var fees;

//Listen to sandbox replies
window.addEventListener('message', function (event) {
    if (event.data.cmd == 'transfer') {
        if (event.data.reply === "SUCCESS") {
            chrome.runtime.sendMessage({
                message: "requestPaymentResponse",
                hash: event.data.hash
            }).then(() => {
                this.window.close();
            })
        }
    }
    else if (event.data.cmd == 'loadFromSeed') {
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

        var payButton = document.getElementById("payButton");
        payButton.disabled = false;

        payButton.onclick = () => {
            transfer(paymentData.amount, paymentData.address);
        };
    }
});

//Listen to background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == 'paymentData') {
        paymentData = request.data;
        this.document.getElementById("paymentAmount").innerHTML = paymentData.amount;
        this.document.getElementById("paymentAddress").innerHTML = paymentData.address;
    }
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
        message: "paymentPageLoaded",
    });
}

function transfer(amount, address) {
    document.getElementById("payButton").disabled = true;

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
        amount: amount,
        address: address,
        fee: selectedFeeValue
    }, "*");
}