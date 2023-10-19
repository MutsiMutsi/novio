let displayBalance = 0;
let balanceNKNSpan;
let balanceUSDSpan;

async function setBalanceBoxDisplayValue(amount) {
    balanceNKNSpan.innerHTML = `${nknToHuman(+amount)} NKN`;
    balanceUSDSpan.innerHTML = `${nknToUsd(+amount)} USD`;
}

function StartDashboard() {
    fetchLatestPrice();
    initializeSend();
    initializeContacts();
    //initializeReceive(); requires a known address, set later.
    initializeHistory();
    initializeAccount();
    initializeCreateAccountModal();

    //Add click
    mainContent = document.getElementsByClassName('app-content')[0];
    const sendContent = document.getElementById('app-send-content');
    const receiveContent = document.getElementById('app-receive-content');
    const contactsContent = document.getElementById('app-contacts-content');
    const historyContent = document.getElementById('app-history-content');
    const accountContent = document.getElementById('app-account-content');

    balanceNKNSpan = document.getElementById("BalanceNKNSpan");
    balanceUSDSpan = document.getElementById("BalanceUSDSpan");

    document.getElementById('SplashContent').style.display = 'none';
    document.getElementById('DashboardContent').style.display = 'block';

    replaceEventListener(document.getElementById("SendButton"), 'click', () => {
        resetSendView();
        focusSubContent(sendContent);
    });

    replaceEventListener(document.getElementById("ReceiveButton"), "click", () => {
        focusSubContent(receiveContent);
    });

    replaceEventListener(document.getElementById("ContactsButton"), "click", () => {
        resetContactsView();
        focusSubContent(contactsContent);
    });

    replaceEventListener(document.getElementById("HistoryButton"), "click", () => {
        initializeHistory();
        focusSubContent(historyContent);
    });

    replaceEventListener(document.getElementById("SendBackButton"), "click", () => {
        focusMainContent();
    });

    replaceEventListener(document.getElementById("ReceiveBackButton"), "click", () => {
        focusMainContent();
    });

    replaceEventListener(document.getElementById("ContactsBackButton"), "click", () => {
        focusMainContent();
    });

    replaceEventListener(document.getElementById("HistoryBackButton"), "click", () => {
        focusMainContent();
    });

    replaceEventListener(document.getElementById("AccountButton"), "click", () => {
        resetAccount();
        focusSubContent(accountContent);
    });

    replaceEventListener(document.getElementById("AccountBackButton"), "click", () => {
        resetAccount();
        focusMainContent();
    });

    populateAccountSelectList();
}

async function populateAccountSelectList() {

    const listGroup = document.getElementById("AccountSelectListGroup");
    const accounts = await loadAccountStore();

    //Empty it out
    listGroup.replaceChildren();

    //Add entries
    for (const [key, value] of Object.entries(accounts)) {
        const button = await createAccountSelectButton(key, value.Address);
        listGroup.appendChild(button);
    }
}

async function createAccountSelectButton(name, address) {
    const shortenedAddr = address.substring(0, 10) + "..." + address.substring(26);

    let item = document.createElement('button');
    item.classList.add('list-group-item', 'list-group-item-action');
    item.innerHTML = `<i class="bi bi-wallet"></i> ${name}
    <small style="float: right;">Loading...</small>
    <br>
    <small style="color:var(--bs-secondary)">${shortenedAddr}</small>
    <small style="float: right; color:var(--bs-secondary);">Loading...</small>`;

    item.setAttribute('data-bs-dismiss', 'modal');

    item.addEventListener('click', async () => {
        const accountOpened = await openAccount(name, await openSession());
        if (accountOpened != null) {
            onAccountOpened(accountOpened);
        }
    });

    postToSandbox({ cmd: 'getBalance', addr: address }).then((balance) => {
        const nknHuman = nknToHuman(+balance);
        const usdHuman = nknToUsd(+balance);

        item.children[1].innerHTML = `${nknHuman} NKN`;
        item.children[4].innerHTML = usdHuman;
    });

    return item;
}

async function initializeCreateAccountModal() {
    const session = await openSession();

    document.getElementById('CreateAccountModalNameInput').addEventListener('input', async (e) => {
        if (e.target.value.length == 0) {
            document.getElementById('CreateAccountModalSeedInput').setAttribute('disabled', '');
            document.getElementById('CreateAccountModalGenerateSeedButton').setAttribute('disabled', '')

            document.getElementById('CreateAccountModalNameInput').classList.add('is-invalid');
            document.getElementById('CreateAccountModalNameInput').classList.remove('is-valid');

            document.getElementById('CreateAccountModalNameInputInvalid').innerHTML = 'required';
        } else {
            document.getElementById('CreateAccountModalSeedInput').removeAttribute('disabled');
            document.getElementById('CreateAccountModalGenerateSeedButton').removeAttribute('disabled');

            document.getElementById('CreateAccountModalNameInput').classList.remove('is-invalid');
            document.getElementById('CreateAccountModalNameInput').classList.add('is-valid');
        }
    });

    let accountLoadedPromise = new Promise((resolve, _) => {
        //Valid seed provided
        document.getElementById('CreateAccountModalSeedInput').addEventListener('input', async (e) => {
            if (validateTransactionHexValue(e.target.value)) {
                await createNewAccount(document.getElementById('CreateAccountModalNameInput').value, e.target.value, session);
                resolve(true);
            }
        });

        //Seed generated
        document.getElementById('CreateAccountModalGenerateSeedButton').addEventListener('click', async () => {
            await createNewAccount(document.getElementById('CreateAccountModalNameInput').value, '', session);
            resolve(true);
        });
    });


    walletBalance = 0.0;
    await accountLoadedPromise;
    bootstrap.Modal.getInstance(document.getElementById('CreateAccountModal')).hide();

    let createdWallet = await openAccount(document.getElementById('CreateAccountModalNameInput').value, session);

    //Clear out the input so that seed isnt cached anywhere!
    document.getElementById('CreateAccountModalSeedInput').value = '';
    //Clear out the input for further use
    document.getElementById('CreateAccountModalNameInput').value = '';
    document.getElementById('CreateAccountModalNameInput').classList.add('is-invalid');
    document.getElementById('CreateAccountModalNameInput').classList.remove('is-valid');
    document.getElementById('CreateAccountModalNameInputInvalid').innerHTML = '&nbsp;';

    onAccountOpened(createdWallet);
}