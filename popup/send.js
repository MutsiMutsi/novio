let sendRecipientContainer;
let recipientListGroup;
let recipientInput;
let amountInput;
let feeContainer;
let sendConfirmButton;
let feeSelect;
let sendStatusContainer;

function resetSendView() {
    recipientInput.value = '';
    amountInput.value = '';

    sendRecipientContainer.style.display = 'block'
    recipientInput.style.display = 'block';
    amountInput.style.display = 'block';
    feeContainer.style.display = 'none';
    sendStatusContainer.style.display = 'none';

    populateRecipientList('');
    processAmountInput('');
    processFeeSelectInput('');
}

function initializeSend() {
    sendRecipientContainer = document.getElementById('SendRecipientContainer');
    recipientListGroup = document.getElementById('RecipientResultListGroup');
    recipientInput = document.getElementById('RecipientInput');
    amountInput = document.getElementById('AmountInput');
    feeContainer = document.getElementById('FeeContainer');
    sendConfirmButton = document.getElementById('SendConfirmButton');
    feeSelect = document.getElementById('feeRange');
    sendStatusContainer = document.getElementById('SendStatusContainer');


    recipientInput.addEventListener('input', (e) => {
        populateRecipientList(e.target.value);
    });

    amountInput.addEventListener('input', (e) => {
        processAmountInput(e.target.value);
    });

    feeSelect.addEventListener('input', function () {
        processFeeSelectInput(this.value);
    });

    sendConfirmButton.addEventListener('click', async () => {
        let transferBody = {
            cmd: 'transfer',
            address: recipientInput.value,
            amount: +amountInput.value,
            fee: +feeSelect.value
        };

        sendStatusContainer.style.display = 'block';
        sendRecipientContainer.style.display = 'none';
        feeContainer.style.display = 'none';

        var sendResult = await postToSandbox(transferBody);
        if (validateTransactionHexValue(sendResult)) {
            addTransactionRow("Transfer", transferBody.amount, sendResult);
            humane.log("✔ transfer successful");
        } else {
            humane.log(`❌ ${sendResult}`);
        }
        focusMainContent();
    });
}

async function populateRecipientList(value) {
    //Empty it out
    recipientListGroup.replaceChildren();

    if (value == undefined || value == '') {
        recipientListGroup.innerHTML = `<button class="list-group-item list-group-item-action"><i class="bi bi-question"></i> Where do you want to send to<br><small style="color:var(--bs-secondary)">Enter an address, wallet registration, or contact
    name.</small></button>`;
        return;
    }

    //If a valid NKN address is entered go right away!!
    if (value.length == 36) {
        const isValidAddr = await postToSandbox({ cmd: 'verifyAddress', address: value });
        if (isValidAddr) {
            let item = document.createElement('button');
            item.classList.add('list-group-item', 'list-group-item-action');
            item.innerHTML = `<i class="bi bi-check"></i> Custom NKN Address<br><small style="color:var(--bs-secondary)">${value}</small>`;
            item.setAttribute('disabled', '');
            recipientInput.style.display = 'none';
            recipientListGroup.appendChild(item);

            feeContainer.style.display = 'block';
            feeSelect.value = 0.001;
            processFeeSelectInput(0.001);

            return;
        }
    }

    //Else filter the contact list on name.
    let contactsResult = await processRecipientInput(value);
    contactsResult.forEach(element => {
        let item = document.createElement('button');
        item.classList.add('list-group-item', 'list-group-item-action');

        item.innerHTML = `<i class="bi bi-person-fill"></i> ${element[0]}<br><small style="color:var(--bs-secondary)">${element[1]}</small>\r\n`;
        recipientListGroup.appendChild(item);

        let cacheAddress = element[1];
        item.addEventListener('click', function eventHandler() {
            recipientInput.value = cacheAddress;
            recipientInput.style.display = 'none';
            this.removeEventListener('click', eventHandler);
            this.setAttribute('disabled', '');
            recipientListGroup.replaceChildren(item);

            feeContainer.style.display = 'block';
            feeSelect.value = 0.001;
            processFeeSelectInput(0.001);
        });
    });


    //check if input is a valid NNS name candidate
    if (validateNameForNns(value)) {
        let item = document.createElement('button');
        item.classList.add('list-group-item', 'list-group-item-action');
        item.innerHTML = `<i class="bi bi-hourglass"></i> ${value}<br><small style="color:var(--bs-secondary)">Loading NNS registration</small>\r\n`;
        recipientListGroup.appendChild(item);

        const cacheName = value;
        updateRegistrantElementDebounced(cacheName, item);
    }

    //If nothing found, fallback to this.
    if (recipientListGroup.children.length == 0) {
        let item = document.createElement('button');
        item.classList.add('list-group-item', 'list-group-item-action');
        item.innerHTML = `<i class="bi bi-x-lg"></i><br><small style="color:var(--bs-secondary)">Invalid NKN address or unknown name</small>\r\n`;
        recipientListGroup.appendChild(item);
    }
}

const updateRegistrantElementDebounced = debounce((cacheName, item) => {
    console.log(cacheName);
    updateRegistrantElement(cacheName, item);
}, 1000);

async function updateRegistrantElement(cacheName, item) {
    const registrantAddress = await postToSandbox({ cmd: 'getRegistrant', name: cacheName });

    if (registrantAddress != '') {
        item.innerHTML = `<i class="bi bi-journals"></i> ${cacheName} (external)<br><small style="color:var(--bs-secondary)">NNS registration</small>\r\n`;
        registrantFound = true;
        item.addEventListener('click', function eventHandler() {
            recipientInput.value = registrantAddress;
            recipientInput.style.display = 'none';
            this.removeEventListener('click', eventHandler);
            this.setAttribute('disabled', '');
            recipientListGroup.replaceChildren(item);

            feeContainer.style.display = 'block';
            feeSelect.value = 0.001;
            processFeeSelectInput(0.001);
        });
    } else {
        recipientListGroup.removeChild(item);
        //If nothing found, fallback to this.
        if (recipientListGroup.children.length == 0) {
            let item = document.createElement('button');
            item.classList.add('list-group-item', 'list-group-item-action');
            item.innerHTML = `<i class="bi bi-x-lg"></i><br><small style="color:var(--bs-secondary)">Invalid NKN address or unknown name</small>\r\n`;
            recipientListGroup.appendChild(item);
        }
    }
}

function processAmountInput(value) {

}

async function processRecipientInput(input) {
    const contacts = await chrome.storage.local.get(["contacts"]);
    if (contacts.contacts) {
        const filteredContacts =
            Object.entries(contacts.contacts).filter(([key, value]) => key.toLowerCase().startsWith(input.toLowerCase()));
        return filteredContacts;
    } else {
        return [];
    }
}

function processFeeSelectInput(value) {
    document.getElementById('averageFee').innerText = `fee (${value})`;
}