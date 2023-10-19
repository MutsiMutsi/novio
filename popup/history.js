let transactionHistory = [];
const historyStoreKeyTemplate = 'history-';

function initializeHistory() {
    document.getElementById('HistoryListGroup').replaceChildren();
    loadTransactionHistory();
}

function loadTransactionHistory() {
    const key = getStoreKey();

    chrome.storage.local.get([key]).then((result) => {
        if (result[key]) {
            transactionHistory = result[key];
            transactionHistory.forEach(tx => {
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

    const key = getStoreKey();
    let store = {};
    store[key] = transactionHistory;
    chrome.storage.local.set(store, null);
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

    item.innerHTML = `<i class="bi bi-credit-card"></i> ${transaction.type}<small style="float: right; color:var(--bs-secondary);">${formattedDate}</small>
    <br>
    <small style="color:var(--bs-secondary)">${transaction.value} NKN</small>
    <a class="btn-sm" href="https://nscan.io/transactions/${transaction.txHash}" target="_blank" style="float: right;"><i class="bi-box-arrow-up-right"></i></a>`;
    document.getElementById('HistoryListGroup').prepend(item);
}

function getStoreKey() {
    return historyStoreKeyTemplate + currentAccount.Address;
}

function deleteHistory() {
    chrome.storage.local.remove([getStoreKey()]);
}