let sendRecipientContainer;
let recipientListGroup;
let amountListGroup;
let feeListGroup;
let recipientInput;
let amountInput;
let sendAmountContainer;
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
    feeSelectElements.style.display = 'block';
    sendAmountContainer.style.display = 'none';
    feeContainer.style.display = 'none';
    sendConfirmContainer.style.display = 'none';
    sendStatusContainer.style.display = 'none';

    populateRecipientList('');
    processAmountInput('');
    processFeeSelectInput('');
}

function initializeSend() {
    sendRecipientContainer = document.getElementById('SendRecipientContainer');
    recipientListGroup = document.getElementById('RecipientResultListGroup');
    amountListGroup = document.getElementById('AmountResultListGroup');
    feeListGroup = document.getElementById('FeeResultListGroup');
    recipientInput = document.getElementById('RecipientInput');
    amountInput = document.getElementById('AmountInput');
    sendAmountContainer = document.getElementById('SendAmountContainer');
    feeContainer = document.getElementById('FeeContainer');
    sendConfirmContainer = document.getElementById('SendConfirmContainer');
    feeSelectElements = document.getElementById('FeeSelectElements');
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
            fee: (+feeSelect.value) * Math.pow(10, -8)
        };

        sendStatusContainer.style.display = 'block';
        sendRecipientContainer.style.display = 'none';
        sendAmountContainer.style.display = 'none';
        feeContainer.style.display = 'none';
        sendConfirmContainer.style.display = 'none';

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
            sendAmountContainer.style.display = 'block';
            recipientListGroup.appendChild(item);
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
            sendAmountContainer.style.display = 'block';
            this.removeEventListener('click', eventHandler);
            this.setAttribute('disabled', '');
            recipientListGroup.replaceChildren(item);
        });
    });

    //If nothing found, fallback to this.
    if (recipientListGroup.children.length == 0) {
        let item = document.createElement('button');
        item.classList.add('list-group-item', 'list-group-item-action');
        item.innerHTML = `<i class="bi bi-x-lg"></i><br><small style="color:var(--bs-secondary)">Invalid NKN address or unknown name</small>\r\n`;
        recipientListGroup.appendChild(item);
    }
}

function processAmountInput(value) {
    if (value == undefined || value == '') {
        amountListGroup.innerHTML = '<button class="list-group-item list-group-item-action"><i class="bi bi-question"></i> How much would you like to send<br><small style="color:var(--bs-secondary)">enter the amount in NKN</small></button>';
        return;
    }

    let item = document.createElement('button');
    item.classList.add('list-group-item', 'list-group-item-action');

    if (value != '' && +value >= 0.0) {
        item.innerHTML = `<i class="bi bi-check"></i> ${value} NKN<br><small style="color:var(--bs-secondary)">${nknToUsd(value)} USD</small>`;
        item.addEventListener('click', function eventHandler() {
            amountInput.style.display = 'none';
            document.getElementById('AmountInputAppendix').style.display = 'none';
            feeContainer.style.display = 'block';
            this.removeEventListener('click', eventHandler);
            this.setAttribute('disabled', '');
        });
    } else {
        item.innerHTML = `<i class="bi bi-x"></i> Invalid amount<br><small style="color:var(--bs-secondary)">Enter an amount to transfer</small>`;
    }
    amountListGroup.replaceChildren(item);
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

    if (value == undefined || value == '') {
        feeListGroup.innerHTML = '<button class="list-group-item list-group-item-action"><i class="bi bi-question"></i> Select your transaction fee<br><small style="color:var(--bs-secondary)">One nit is 0.00000001 NKN</small></button>';
        return;
    }

    let item = document.createElement('button');
    item.classList.add('list-group-item', 'list-group-item-action');

    item.innerHTML = `<i class="bi bi-check"></i> ${value} nit<br><small style="color:var(--bs-secondary)">${nknToUsd(value / Math.pow(10, 8))} USD</small>`;
    item.addEventListener('click', function eventHandler() {
        feeSelectElements.style.display = 'none';
        sendConfirmContainer.style.display = 'block';
        this.removeEventListener('click', eventHandler);
        this.setAttribute('disabled', '');
    });
    feeListGroup.replaceChildren(item);
}