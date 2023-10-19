(async function () {
    if (!await isMasterPasswordSet()) {
        let internalUrl = chrome.runtime.getURL("setup/setup.html");
        chrome.tabs.create({ url: internalUrl }, function (tab) {

        });
    }
})();

var price = 0;
var walletBalance = 0;
var currentAccount = null;

let iframe = document.getElementById('sandboxFrame');
let mainContent;
let currentSubContent;

let balanceCounterUpdating = false;

function nknToHuman(amount) {
    if (amount < 0.00000001) {
        return 0;
    }
    else if (amount > 10) {
        // Format the price above to USD using the locale, style, and currency.
        let USDollar = new Intl.NumberFormat('en-US');
        return USDollar.format(amount);
    } else {
        return amount.toFixed(8);
    }
}

function nknToUsd(amount) {
    // Format the price above to USD using the locale, style, and currency.
    let USDollar = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    });

    return USDollar.format(amount * price);
}

async function fetchLatestPrice() {
    // If last price is recent use that:
    const lastPrice = await chrome.storage.local.get("lastPrice");
    if (lastPrice && Date.now() - lastPrice.lastUpdated < 60000) {
        price = lastPrice.value;
        return;
    }

    // Else fetch and store new latest price.
    var data = await fetch('https://min-api.cryptocompare.com/data/price?fsym=NKN&tsyms=USD');
    dataJSON = await data.json();
    chrome.storage.local.set(
        {
            lastPrice: { lastUpdated: Date.now(), value: dataJSON['USD'] }
        },
        null
    );
    price = dataJSON['USD'];
}

window.onload = async function () {
    const sessionPassword = await openSession();

    //If session expired ask for password
    if (sessionPassword == null) {
        const passwordInput = document.getElementById('PasswordInput');
        passwordInput.focus({ focusVisible: true });
        document.getElementById('UnlockContent').style.display = 'block';
        document.getElementById('UnlockButton').addEventListener('click', async () => {
            if (await verifyMasterPassword(passwordInput.value)) {
                onUnlock(passwordInput.value);
                passwordInput.value = '';
            } else {
                passwordInput.classList.add('is-invalid');
            }
        });
        passwordInput.addEventListener('keyup', function (event) {
            if (event.key === 'Enter') {
                // Call the same function that is called when the confirm button is clicked.
                document.getElementById('UnlockButton').click();
            }
        });
    } else {
        //open last session
        document.getElementById('UnlockContent').style.display = 'none';
        onUnlock(sessionPassword);
    }
};

async function onUnlock(password) {
    persistSession(password);

    document.getElementById('UnlockContent').style.display = 'none';

    document.getElementById('NameInput').addEventListener('input', async (e) => {
        if (e.target.value.length == 0) {
            document.getElementById('SeedInput').setAttribute('disabled', '');
            document.getElementById('GenerateSeedButton').setAttribute('disabled', '')

            document.getElementById('NameInput').classList.add('is-invalid');
            document.getElementById('NameInput').classList.remove('is-valid');

            document.getElementById('NameInputInvalid').innerHTML = 'required';
        } else {
            document.getElementById('SeedInput').removeAttribute('disabled');
            document.getElementById('GenerateSeedButton').removeAttribute('disabled');

            document.getElementById('NameInput').classList.remove('is-invalid');
            document.getElementById('NameInput').classList.add('is-valid');
        }
    });

    var existingWallet = await openLastUsedAccount(password);

    if (existingWallet == null) {
        //Show the splash screen!
        document.getElementById('SplashContent').style.display = 'block';

        let accountLoadedPromise = new Promise((resolve, _) => {
            //Valid seed provided
            document.getElementById('SeedInput').addEventListener('input', async (e) => {
                if (validateTransactionHexValue(e.target.value)) {
                    await createNewAccount(document.getElementById('NameInput').value, e.target.value, password);
                    resolve(true);
                }
            });

            //Seed generated
            document.getElementById('GenerateSeedButton').addEventListener('click', async () => {
                await createNewAccount(document.getElementById('NameInput').value, '', password);
                resolve(true);
            });
        });

        //Clear out the input so that seed isnt cached anywhere!
        document.getElementById('SeedInput').value = '';

        walletBalance = 0.0;
        await accountLoadedPromise;
        existingWallet = await openAccount(document.getElementById('NameInput').value, password);
    }

    onAccountOpened(existingWallet);

    postToSandbox({ cmd: 'getFee' }).then((fee) => {

        let minFee = +fee.min;
        let maxFee = +fee.max;
        let avgFee = (minFee + maxFee / 2);

        let maxPrecision = Math.max(Math.max(precision(minFee), precision(avgFee)), avgFee);

        document.getElementById('minimumFee').innerText = `slow (${minFee})`;
        document.getElementById('averageFee').innerText = `average (${avgFee})`;
        document.getElementById('maximumFee').innerText = `fast (${maxFee})`;

        feeSelect.min = minFee;
        feeSelect.max = maxFee;

        let stepSize = 1.0 / Math.pow(10, maxPrecision);
        feeSelect.step = stepSize;
    });

    setInterval(() => {
        if (balanceCounterUpdating) {
            displayBalance = displayBalance * 0.8 + walletBalance * 0.2;
            setBalanceBoxDisplayValue(displayBalance);
        }
    }, 1.0 / 60.0);
};

function onAccountOpened(account) {
    currentAccount = account;
    setLastUsedAccountName(currentAccount.Name);

    document.getElementById("AccountName").innerHTML = currentAccount.Name;
    StartDashboard();

    //Initiate
    chrome.runtime.sendMessage({
        message: "executeForeground",
    });

    balanceCounterUpdating = false;
    balanceNKNSpan.innerHTML = "Loading...";
    balanceUSDSpan.innerHTML = "Loading...";

    initializeReceive();
    initializeAccount();

    postToSandbox({ cmd: 'getBalance' }).then((balance) => {
        balanceCounterUpdating = true;
        walletBalance = balance;
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