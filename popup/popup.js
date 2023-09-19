var price = 0;
var walletBalance = 0;
var publicKey = '';
var address = '';

let iframe = document.getElementById('sandboxFrame');
let mainContent;
let currentSubContent;

function nknToHuman(amount) {
    if (amount > 10) {
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
    var existingWallet = await openAccount('main');

    if (!existingWallet) {
        //Show the splash screen!
        document.getElementById('SplashContent').style.display = 'block';

        let accountLoadedPromise = new Promise((resolve, _) => {
            //Valid seed provided
            document.getElementById('SeedInput').addEventListener('input', async (e) => {
                if (validateTransactionHexValue(e.target.value)) {
                    await createNewAccount('main', e.target.value, '');
                    resolve(true);
                }
            });

            //Seed generated
            document.getElementById('GenerateSeedButton').addEventListener('click', async () => {
                await createNewAccount('main', '', '');
                resolve(true);
            });
        });

        //Clear out the input so that seed isnt cached anywhere!
        document.getElementById('SeedInput').value = '';

        walletBalance = 0.0;
        await accountLoadedPromise;
        await openAccount('main');
    }

    //Wallet should be created or loaded at this point, start the dashboard!
    StartDashboard();

    //Initiate
    chrome.runtime.sendMessage({
        message: "executeForeground",
    });

    postToSandbox({ cmd: 'getAddress' }).then((addr) => {
        address = addr;
        initializeReceive();
        initializeAccount();
    });
    postToSandbox({ cmd: 'getBalance' }).then((balance) => {
        walletBalance = balance;
        setInterval(() => {
            displayBalance = displayBalance * 0.8 + walletBalance * 0.2;
            setBalanceBoxDisplayValue(displayBalance);
        }, 1.0 / 60.0);
    });
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
};

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