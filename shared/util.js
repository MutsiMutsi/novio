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
    var accounts = await loadAccountStore();
    delete accounts[name];

    await chrome.storage.local.set(
        {
            accountStore: accounts
        },
        null
    );
    location.reload();
}

async function openAccount(name, password) {
    var accounts = await loadAccountStore();
    var walletJSON = accounts[name];

    let result = await postToSandbox({ cmd: 'openWallet', json: walletJSON, password: password });
    publicKey = result.publicKey;

    if (result.status == 'SUCCESS') {
        return {
            Name: name,
            Address: walletJSON.Address,
            PublicKey: result.publicKey,
        }
    } else {
        return null;
    }
}

async function loadAccountStore() {
    let accountStore = await chrome.storage.local.get(["accountStore"]);
    return accountStore.accountStore ?? {};
}

async function createNewAccount(name, seed, password) {
    var accounts = await loadAccountStore();

    //TODO: Verify name isnt already used!!
    var walletJSON = await postToSandbox({ cmd: 'createWallet', seed: seed, password: password });
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

const _eventListenerCache = new Map();

function replaceEventListener(element, event, func) {
    // Get the unique combination of element and event.
    const key = `${element.id}-${event}`;

    // If the key is in the cache remove the old listener
    if (_eventListenerCache.has(key)) {
        element.removeEventListener(event, _eventListenerCache.get(key));
    }

    _eventListenerCache.set(key, func);

    // Add the new event listener.
    element.addEventListener(event, func);
}

async function getLastUsedAccountName() {
    return (await chrome.storage.local.get(["lastUsedAccountName"])).lastUsedAccountName;
}

async function setLastUsedAccountName(name) {
    await chrome.storage.local.set(
        {
            lastUsedAccountName: name
        },
        null
    );
}

async function openLastUsedAccount(password) {
    const lastUsedName = await getLastUsedAccountName();
    let existingWallet = await openAccount(lastUsedName, password);

    if (existingWallet == null) {
        const accounts = await loadAccountStore();
        const firstEntryName = Object.keys(accounts)[0];
        existingWallet = await openAccount(firstEntryName, password);
    }

    return existingWallet;
}

async function hashToArray(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    return Array.from(new Uint8Array(hashBuffer));
}

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

async function setMasterPassword(password) {
    const salt = crypto.randomUUID();
    const hashArray = await hashToArray(password + salt);
    await chrome.storage.local.set(
        {
            masterPassword: { hash: hashArray, salt: salt }
        },
        null
    );
}

async function verifyMasterPassword(password) {
    const hashStored = (await chrome.storage.local.get(["masterPassword"])).masterPassword;
    const knownHashArray = hashStored.hash;
    const hashArray = await hashToArray(password + hashStored.salt);
    return arraysEqual(knownHashArray, hashArray);
}

async function isMasterPasswordSet() {
    return (await chrome.storage.local.get(["masterPassword"])).masterPassword != null;
}

async function persistSession(password) {
    const key = crypto.randomUUID();
    const encryptedPassword = await aesGcmEncrypt(password, key);
    await chrome.storage.session.set(
        {
            session: { a: encryptedPassword, b: key }
        },
        null
    );
}

async function openSession() {
    const storedSession = (await chrome.storage.session.get(["session"])).session;
    if (storedSession == null) {
        return null;
    }
    return await aesGcmDecrypt(storedSession.a, storedSession.b);
}