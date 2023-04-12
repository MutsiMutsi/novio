let waitingForPaymentPage = true;
var paymentWindow;

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.message === 'set_page_address') {
        //request.address
        chrome.runtime.sendMessage({
            message: "pageDataLoaded",
            data: request.address
        });
    }

    if (request.message === 'getPageAddress') {
        chrome.tabs.query({ active: true }, tabs => {
            let tabId = tabs[0].id;
            try {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ["./foreground.js"]
                }).catch((error) => {
                    console.log(error);
                })
            } catch (error) {
                //Some pages like chrome extensions block scripting, digest this exception.
                console.log(error);
            }
        });
    }

    if (request.message === 'requestPayment') {
        chrome.windows.getCurrent(async (tabWindow) => {
            const width = 417;
            const height = 417
            const left = Math.round((tabWindow.width - width) * 0.5 + tabWindow.left)
            const top = Math.round((tabWindow.height - height) * 0.5 + tabWindow.top)

            waitingForPaymentPage = true;
            paymentWindow = await chrome.windows.create({
                width: width,
                height: height,
                top: Math.round(top),
                left: Math.round(left),
                focused: true,
                type: 'popup',
                url: 'payment/payment.html',
            }
            )

            setTimeout(async () => {
                while (waitingForPaymentPage) {
                    await sleep(50);
                }
                chrome.runtime.sendMessage({
                    message: "paymentData",
                    data: request.data
                });
            }, 50);
        })

        //Feature not out yet
        /*chrome.action.openPopup(() => {

        }
        );*/
    }

    if (request.message === 'paymentPageLoaded') {
        waitingForPaymentPage = false;
    }

    if (request.message === 'requestPaymentResponse') {
        chrome.tabs.query({ active: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                message: 'requestPaymentResponseForeground',
                hash: request.hash
            });
        });
    }

});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}