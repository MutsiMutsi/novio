function precision(a) {
    if (!isFinite(a)) return 0;
    var e = 1, p = 0;
    while (Math.round(a * e) / e !== a) { e *= 10; p++; }
    return p;
}

async function postToSandbox(message) {
    let uuid = crypto.randomUUID();

    return new Promise((resolve, _) => {
        //listen for sandbox reply
        window.addEventListener('message', function messageHandler(event) {
            if (event.data.uuid == uuid) {
                //cleanup and resolve
                this.window.removeEventListener('message', messageHandler);
                resolve(event.data.reply);
            }
        });
        //post message to sandbox
        message.uuid = uuid;
        iframe.contentWindow.postMessage(message, "*");
    });
}

function validateTransactionHexValue(hexValue) {
    // Check if the string length is 64 characters.
    if (hexValue.length !== 64) {
        return false;
    }
    // Check if all characters in the string are hexadecimal digits.
    for (let i = 0; i < hexValue.length; i++) {
        if (!/[0-9a-fA-F]/.test(hexValue[i])) {
            return false;
        }
    }

    return true;
}

function validateNameForNns(name) {
    const regex = /(^[A-Za-z0-9][A-Za-z0-9-_+]{5,62}$)/g;
    return name.match(regex) != null;
}


async function deleteAccount(name) {
    await chrome.storage.local.set(
        {
            accountStore: {}
        },
        null
    );
    location.reload();
}

async function openAccount(name) {
    var accounts = await loadAccountStore('');
    var walletJSON = accounts[name];

    let result = await postToSandbox({ cmd: 'openWallet', json: walletJSON, password: '' });
    publicKey = result.publicKey;
    return result.status == 'SUCCESS';
}

async function loadAccountStore(password) {
    let accountStore = await chrome.storage.local.get(["accountStore"]);
    return accountStore.accountStore ?? {};
}

async function createNewAccount(name, seed, password) {
    var accounts = await loadAccountStore();

    //TODO: Verify name isnt already used!!
    var walletJSON = await postToSandbox({ cmd: 'createWallet', seed: seed, password: '' });
    accounts[name] = walletJSON;

    chrome.storage.local.set(
        {
            accountStore: accounts
        },
        null
    );
}

function throttle(callback, delay = 1000) {
    let shouldWait = false;

    return (...args) => {
        if (shouldWait) return;

        callback(...args);
        shouldWait = true;
        setTimeout(() => {
            shouldWait = false;
        }, delay);
    };
}

function debounce(callback, delay = 1000) {
    var time;
    return (...args) => {
        clearTimeout(time);
        time = setTimeout(() => {
            callback(...args);
        }, delay);
    };
}