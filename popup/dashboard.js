const price = 10.01442;
let iframe = document.getElementById('sandboxFrame');
let mainContent;
let currentSubContent;
let qrcode;

//Trigger reload to make sure the sandbox libraries are loaded and available when popoup opens.
iframe.src += '';
iframe.onload = function () {
    //Startup();
};

function nknToUsd(amount) {
    // Format the price above to USD using the locale, style, and currency.
    let USDollar = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    });

    return USDollar.format(amount * price);
}

async function setBalanceBoxDisplayValue(amount) {
    //const price = await fetchLatestPrice();
    $('.balanceBoxValueNkn').children()[0].innerHTML = `${amount} NKN`;
    $('.balanceBoxValueUsd').children()[0].innerHTML = `${nknToUsd(amount)} USD`;
}

async function fetchLatestPrice() {
    return new Promise(async (resolve, reject) => {
        await fetch('https://min-api.cryptocompare.com/data/price?fsym=NKN&tsyms=USD').then((data) => {
            data.json().then((dataJSON) => {
                resolve(dataJSON['USD']);
            });
        });
    });
}

function focusSubContent(subContent) {
    mainContent.style.right = "100%";
    currentSubContent = subContent;
    currentSubContent.style.visibility = 'visible';
    currentSubContent.style.right = 0.0;
    setTimeout(() => {
        mainContent.style.visibility = 'hidden';
    }, 333);
}

function focusMainContent() {
    mainContent.style.visibility = 'visible';
    mainContent.style.right = "0%";
    currentSubContent.style.right = '-100%';
    setTimeout(() => {
        currentSubContent.style.visibility = 'hidden';
    }, 333);
}

async function postToSandbox(message) {
    return new Promise((resolve, _) => {
        //listen for sandbox reply
        window.addEventListener('message', function messageHandler(event) {
            if (event.data.cmd == message.cmd) {
                //cleanup and resolve
                this.window.removeEventListener('message', messageHandler);
                resolve(event.data.reply);
            }
        });
        //post message to sandbox
        iframe.contentWindow.postMessage(message, "*");
    });
}

$(document).ready(async function () {
    setBalanceBoxDisplayValue(5245.54);

    initializeSend();
    initializeContacts();
    initializeReceive();
    //initializeHistory();

    //Add click
    mainContent = document.getElementsByClassName('app-content')[0];
    const sendContent = document.getElementById('app-send-content');
    const receiveContent = document.getElementById('app-receive-content');
    const contactsContent = document.getElementById('app-contacts-content');
    const historyContent = document.getElementById('app-history-content');

    document.getElementById("SendButton").addEventListener("click", () => {
        resetSendView();
        focusSubContent(sendContent);
    });

    document.getElementById("ReceiveButton").addEventListener("click", () => {
        focusSubContent(receiveContent);
    });

    document.getElementById("ContactsButton").addEventListener("click", () => {
        resetContactsView();
        focusSubContent(contactsContent);
    });

    document.getElementById("HistoryButton").addEventListener("click", () => {
        focusSubContent(historyContent);
    });

    document.getElementById("SendBackButton").addEventListener("click", () => {
        focusMainContent();
    });

    document.getElementById("ReceiveBackButton").addEventListener("click", () => {
        focusMainContent();
    });

    document.getElementById("ContactsBackButton").addEventListener("click", () => {
        focusMainContent();
    });

    document.getElementById("HistoryBackButton").addEventListener("click", () => {
        focusMainContent();
    });
});

