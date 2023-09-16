let displayBalance = 0;

async function setBalanceBoxDisplayValue(amount) {
    $('.balanceBoxValueNkn').children()[0].innerHTML = `${nknToHuman(amount)} NKN`;
    $('.balanceBoxValueUsd').children()[0].innerHTML = `${nknToUsd(amount)} USD`;
}

function StartDashboard() {
    fetchLatestPrice();
    initializeSend();
    initializeContacts();
    //initializeReceive(); requires a known address, set later.
    initializeHistory();
    initializeAccount();

    //Add click
    mainContent = document.getElementsByClassName('app-content')[0];
    const sendContent = document.getElementById('app-send-content');
    const receiveContent = document.getElementById('app-receive-content');
    const contactsContent = document.getElementById('app-contacts-content');
    const historyContent = document.getElementById('app-history-content');
    const accountContent = document.getElementById('app-account-content');

    document.getElementById('SplashContent').style.display = 'none';
    document.getElementById('DashboardContent').style.display = 'block';

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
        initializeHistory();
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

    document.getElementById("AccountButton").addEventListener("click", () => {
        resetAccount();
        focusSubContent(accountContent);
    });

    document.getElementById("AccountBackButton").addEventListener("click", () => {
        resetAccount();
        focusMainContent();
    });
}

