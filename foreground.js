var narwhallet = document.getElementById("narwhallet");
if (narwhallet) {
    var address = narwhallet.dataset.address;
    if (address) {
        chrome.runtime.sendMessage({
            message: "set_page_address",
            address: address
        });
    }

    var paymentButton = document.getElementById("narwhalletPaymentButton");
    if (paymentButton) {
        var dataPayment = {
            amount: paymentButton.dataset.payment,
            address: address
        }

        var paymentInfo = document.getElementById("narwhalletPaymentInfo");
        paymentInfo.textContent = `${dataPayment.amount} NKN`;
        paymentButton.style.display = 'block';
        paymentButton.onclick = () => {
            chrome.runtime.sendMessage({
                message: "requestPayment",
                data: dataPayment,
            })
            paymentButton.innerText = "Waiting"
            paymentButton.disabled = true;
        }
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.message === 'requestPaymentResponseForeground') {
                paymentInfo.innerHTML = `Payment Received<br>✔`;
                paymentButton.style.display = 'none';

                const txReceivedEvent = new CustomEvent("onTransactionReceived", {
                    "bubbles": true,
                    "cancelable": false,
                    "detail": { hash: request.hash },
                });
                document.dispatchEvent(txReceivedEvent);
            }
        });
    }
}

