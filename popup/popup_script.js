var iframe = document.getElementById('sandboxFrame');
var importedSeed = null;

//Listen to sandbox replies
window.addEventListener('message', function (event) {
    if (event.data.cmd == 'getAddress') {
        document.getElementById("address").innerHTML = event.data.reply;
    }
    else if (event.data.cmd == 'getBalance') {
        document.getElementById("balance").innerHTML = event.data.reply;
    }
    else if (event.data.cmd == 'loadFromSeed') {
        if (event.data.reply == "SUCCESS") {
            chrome.storage.local.set({ seed: event.data.seed }, null);
            iframe.contentWindow.postMessage({
                cmd: 'getAddress'
            }, "*");
            iframe.contentWindow.postMessage({
                cmd: 'getBalance'
            }, "*");
            document.getElementById("importBox").style.display = 'none';
            document.getElementById("walletBox").style.display = 'block';
            humane.log("Login Success!");
        } else {
            humane.log("Error on seed import!");
            document.getElementById("seedInput").value = "";
        }
    }
    else if (event.data.cmd == 'transfer') {
        if (event.data.reply === "SUCCESS") {
            humane.log("Transfer Success!");
        } else {
            humane.log(event.data.reply);
        }
        document.getElementById("sendButton").disabled = false;
    }
});

iframe.onload = function () {
    document.getElementById("importButton").addEventListener("click", importWallet);
    document.getElementById("sendButton").addEventListener("click", transfer);
    document.getElementById("deleteButton").addEventListener("click", deleteWallet);

    chrome.storage.local.get(["seed"]).then((result) => {
        if (result.seed) {
            importedSeed = result.seed;
            loadFromSeed(result.seed);
        }
    });

    function importWallet() {
        importedSeed = document.getElementById("seedInput").value;
        loadFromSeed(importedSeed);
    }

    function transfer() {
        document.getElementById("sendButton").disabled = true;

        iframe.contentWindow.postMessage({
            cmd: 'transfer',
            address: document.getElementById("transferToAddress").value,
            amount: document.getElementById("transferToAmount").value
        }, "*");
    }

    function loadFromSeed(seed) {
        //Load from seed 
        iframe.contentWindow.postMessage({
            cmd: 'loadFromSeed',
            seed: seed
        }, "*");
    }

    function deleteWallet() {
        chrome.storage.local.set({ seed: null }, null);
        document.getElementById("importBox").style.display = 'block';
        document.getElementById("walletBox").style.display = 'none';
    }

    //, currentWindow: true
    chrome.tabs.query({ active: true }, tabs => {
        let url = tabs[0].url;
        chrome.runtime.sendMessage({
            message: "getDonationAddress",
            url: url
        }, response => {
            if (response.address) {
                document.getElementById("donationBox").style.display = 'block'
                document.getElementById("connectedPage").innerHTML = `<i class="bi bi-check"></i>` + url;
                document.getElementById("donateToAddress").value = response.address;
            }
        });
    });

};

