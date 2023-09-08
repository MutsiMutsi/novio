let transactionHistory = [];

function initializeHistory() {
    document.getElementById('HistoryListGroup').replaceChildren();
    loadTransactionHistory();
}

function loadTransactionHistory() {
    chrome.storage.local.get(["txHistory"]).then((result) => {
        if (result.txHistory) {
            transactionHistory = result.txHistory;
            result.txHistory.forEach(tx => {
                addTransactionRowElement(tx);
            });
        }
    });
}

function addTransactionRow(type, value, txHash) {
    let tx = {
        date: +new Date(),
        type: type,
        value: value,
        txHash: txHash
    };
    transactionHistory.push(tx)
    //$("#transactionBox").prepend(createTransactionRow(type, value, txHash));
    chrome.storage.local.set({ txHistory: transactionHistory }, null);
}

function addTransactionRowElement(transaction) {

    const formattedDate = new Date(transaction.date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

    let item = document.createElement('button');
    item.classList.add('list-group-item', 'list-group-item-action');
    item.setAttribute('readonly', '');

    /*<i class="bi bi-credit-card"></i> Transfer
    <small style="float: right; color:var(--bs-secondary);">Aug 26, 2023</small>
    <br>
    <small style="color:var(--bs-secondary)">50 NKN</small>
    <a class="btn-sm" href="https://nscan.io/transactions/228692cb092588230465d052301adeb951647790a61507744456dd4f99425e30" target="_blank" style="float: right;"><i class="bi-box-arrow-up-right"></i></a>*/

    item.innerHTML = `<i class="bi bi-credit-card"></i> ${transaction.type}<small style="float: right; color:var(--bs-secondary);">${formattedDate}</small>
    <br>
    <small style="color:var(--bs-secondary)">${transaction.value} NKN</small>
    <a class="btn-sm" href="https://nscan.io/transactions/${transaction.txHash}" target="_blank" style="float: right;"><i class="bi-box-arrow-up-right"></i></a>`;
    document.getElementById('HistoryListGroup').prepend(item);
}