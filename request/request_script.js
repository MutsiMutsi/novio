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

(async () => {
    const iframe = document.getElementById('sandboxFrame');

    var txDataReceivedResolve;
    const txDataReceivedPromise = new Promise((resolve) => {
        txDataReceivedResolve = resolve;
    });
    var sandboxLoadedResolve;
    const sandboxLoadedPromise = new Promise((resolve) => {
        sandboxLoadedResolve = resolve;
    });

    //Listen to foreground/background messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

        if (request.message == 'transactionRequestData') {
            sandboxLoadedPromise.then(() => {
                openSession().then((session) => {
                    openAccountInIFrame(request.assignedWalletName, session, iframe).then((currentAccount) => {
                        txDataReceivedResolve();

                        //Set header.
                        const shortenedAddr = currentAccount.Address.substring(0, 10) + "..." + currentAccount.Address.substring(26);
                        document.getElementById('walletName').innerText = currentAccount.Name;
                        document.getElementById('walletAddress').innerText = shortenedAddr;
                        generatePictogram(document.getElementById("walletAvatar"), currentAccount.Address, 40);

                        this.document.getElementById("transactionData").innerHTML = generateTransactionDataHtml(request.data);

                        resizeWindowToFitBody();
                        toggleLoading();

                        this.document.getElementById("transactionConfirm").onclick = async () => {

                            this.document.getElementById("transactionDisplay").style.display = 'none';
                            this.document.getElementById("waitingDisplay").style.display = 'block';
                            this.document.getElementById("progressDisplay").style.display = 'block';
                            this.document.getElementById("waitingIcon").style.display = 'block';

                            const sendTxReply = await postToIFrame({
                                cmd: 'sendTransaction',
                                transaction: request.data,
                                fee: +document.getElementById("feeRange").value
                            }, iframe)

                            sendResponse(sendTxReply);

                            if (sendTxReply.error) {
                                this.document.getElementById("progressDisplay").style.display = 'none';
                                this.document.getElementById("waitingIcon").style.display = 'none';
                                this.document.getElementById("failedIcon").style.display = 'block';
                            }
                            else {
                                let dataValueIndex = typeDataDisplayIndex[request.data.type];
                                let displayValue = request.data.data[dataValueIndex];
                                debugger;

                                addTransactionRow(typeDisplay[request.data.type], displayValue, sendTxReply, currentAccount.Address);

                                this.document.getElementById("progressDisplay").style.display = 'none';
                                this.document.getElementById("waitingIcon").style.display = 'none';
                                this.document.getElementById("successIcon").style.display = 'block';

                                this.document.getElementById("openTxInBrowser").style.display = 'block';
                                this.document.getElementById("openTxInBrowser").onclick = () => {
                                    window.open(`https://nstatus.org/ntrack/?s=${sendTxReply}`, '_blank').focus();
                                    window.close();
                                }
                            }
                        };
                    })
                })
            });
            return true;
        }
    });

    //Trigger reload to make sure the sandbox libraries are loaded and available when popoup opens.
    iframe.src += '';
    iframe.onload = function () {
        sandboxLoadedResolve();
    };

    async function Startup() {

        postToIFrame({ cmd: 'getFee' }, iframe).then((fee) => {
            this.document.getElementById("transactionConfirm").disabled = false

            let minFee = +fee.min;
            let maxFee = +fee.max;
            let avgFee = (minFee + maxFee / 2);

            let maxPrecision = Math.max(Math.max(precision(minFee), precision(avgFee)), avgFee);

            document.getElementById('minFee').innerText = `slow (${minFee})`;
            document.getElementById('avgFee').innerText = `average (${avgFee})`;
            document.getElementById('maxFee').innerText = `fast (${maxFee})`;

            let feeSelect = document.getElementById("feeRange");

            feeSelect.min = minFee;
            feeSelect.max = maxFee;

            let stepSize = 1.0 / Math.pow(10, maxPrecision);
            feeSelect.step = stepSize;

            feeSelect.addEventListener('input', function () {
                document.getElementById('avgFee').innerText = `fee (${this.value})`;
            });

            feeSelect.value = 0.001;
            document.getElementById('avgFee').innerText = `fee (${feeSelect.value})`;
        }, iframe);
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
        return `<input type="text" class="form-control" value="${value}" readonly>`;
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

    chrome.runtime.sendMessage({
        message: "requestPageLoaded",
    });

    Promise.all([txDataReceivedPromise, sandboxLoadedPromise]).then(() => {
        Startup();
    })
})();