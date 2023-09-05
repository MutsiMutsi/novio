let myAddr = "Loading...";
let balance = "Loading...";
let wallet;

function loadFromSeed(seed) {
    try {
        wallet = new nkn.Wallet({
            seed: seed,
            tls: true,
        });

        this.memorypool = new MemoryPool(nkn, wallet.options.rpcServerAddr);

        myAddr = wallet.address;
        return { status: "SUCCESS", seed: wallet.account.key.seed, publicKey: wallet.account.key.publicKey };
    } catch (error) {
        return { status: error.message, seed: null };
    }
}

window.addEventListener('message', async function (event) {
    if (event.data.cmd == "getAddress") {
        event.source.postMessage({ cmd: event.data.cmd, reply: myAddr }, "*");
    }
    else if (event.data.cmd == "getBalance") {
        await wallet.getBalance().then((value) => {
            balance = value.toString();
            event.source.postMessage({ cmd: event.data.cmd, reply: balance }, "*");
        });
    } else if (event.data.cmd == "transfer") {
        handleTransferCommand(event);
    } else if (event.data.cmd == "loadFromSeed") {
        var message = loadFromSeed(event.data.seed);
        event.source.postMessage({ cmd: event.data.cmd, reply: message.status, seed: message.seed, publicKey: message.publicKey }, "*");
    }
    else if (event.data.cmd == "getTransaction") {
        getTransaction(event.data.hash).then((result) => {
            event.source.postMessage({ cmd: event.data.cmd, reply: result }, "*");
        }).catch((error) => {
            //nkn sdk library throws exceptions, digest.
            console.log("Transaction not yet confirmed")
        });
    } else if (event.data.cmd == "getFee") {
        event.source.postMessage({ cmd: event.data.cmd, reply: await memorypool.getFee() }, "*");
    } else if (event.data.cmd == "sendTransaction") {
        sendTransaction(event.data.transaction, event.data.fee).then(async (result) => {
            event.source.postMessage({ cmd: event.data.cmd, reply: result }, "*");
        }).catch((error) => {
            event.source.postMessage({ cmd: event.data.cmd, reply: { error: error.message } }, "*");
        });
    } else if (event.data.cmd == "signMessage") {
        signChallenge(event.data.data).then(async (result) => {
            event.source.postMessage({ cmd: event.data.cmd, reply: { signature: result, publicKey: wallet.account.key.publicKey } }, "*");
        }).catch((error) => {
            event.source.postMessage({ cmd: event.data.cmd, reply: { error: error.message } }, "*");
        });
    }
});

async function handleTransferCommand(event) {
    try {
        if (event.data.amount == '' || +event.data.amount == 0) {
            event.source.postMessage({ cmd: event.data.cmd, reply: "Invalid transfer amount" }, "*");
            return;
        }

        var recipientAddress = event.data.address;

        //If the address is not a valid nkn address, attempt to resolve a name registration
        var isValidNknAddress = nkn.Wallet.verifyAddress(recipientAddress);
        if (!isValidNknAddress) {
            var registrantResult = await wallet.getRegistrant(recipientAddress);
            if (registrantResult.expiresAt > 0) {
                recipientAddress = nkn.Wallet.publicKeyToAddress(registrantResult.registrant);
            } else {
                event.source.postMessage({ cmd: event.data.cmd, reply: `Name ${recipientAddress} is not registered` }, "*");
                return;
            }
        }

        transfer(recipientAddress, event.data.amount, event.data.fee).then((txnHash) => {
            event.source.postMessage({ cmd: event.data.cmd, reply: "SUCCESS", hash: txnHash, amount: event.data.amount }, "*");
        }).catch((error) => {
            let shortErr = error.message.split(':').pop().trim();
            shortErr = shortErr.replace("not sufficient", "insufficient");
            event.source.postMessage({ cmd: event.data.cmd, reply: shortErr }, "*");
        });
    } catch (error) {
        event.source.postMessage({ cmd: event.data.cmd, reply: error.message }, "*");
    }
}

function transfer(address, amount, fee) {
    return wallet.transferTo(address, amount, { fee: fee });
}

function getTransaction(hash) {
    return nkn.rpc.rpcCall(wallet.options.rpcServerAddr, 'gettransaction', { "hash": hash });
}

async function signChallenge(challenge) {
    const prefixedMsg = `NKN Signed Message:\n${challenge}`;

    var encoder = new TextEncoder();
    var encodedMsg = encoder.encode(prefixedMsg);

    const hashedOnce = await crypto.subtle.digest('SHA-256', encodedMsg);
    const hashedTwice = await crypto.subtle.digest('SHA-256', hashedOnce);
    var challengeFullform = new Uint8Array(hashedTwice);

    return await nkn.crypto.sign(wallet.account.key.privateKey, challengeFullform);
}

async function sendTransaction(transaction, fee) {
    var options = {
        fee: fee,
        attrs: transaction.data.slice(-1)
    }

    switch (transaction.type) {
        case 'transferTo':
            return await wallet.transferTo(transaction.data[0], transaction.data[1], options);
            break;
        case 'registerName':
            return await wallet.registerName(transaction.data[0], options);
            break;
        case 'transferName':
            return await wallet.transferName(transaction.data[0], transaction.data[1], options);
            break;
        case 'deleteName':
            return await wallet.deleteName(transaction.data[0], options);
            break;
        case 'subscribe':
            return await wallet.subscribe(transaction.data[0], transaction.data[1], transaction.data[2], transaction.data[3], options);
            break;
        case 'unsubscribe':
            return await wallet.unsubscribe(transaction.data[0], transaction.data[1], options);
            break;
    }
}