let contacts = {};
let cachedEditName = '';
let contactListContainer;
let contactViewContainer;
let contactListGroup;
let contactViewButtons;
let contactViewEditButtons;
let contactEditButton;
let contactSaveButton;
let contactDeleteButton;
let contactNameInput;
let contactAddressInput;
let contactsAddButton;

function resetContactsView() {
    contactListContainer.style.display = 'block';
    contactViewContainer.style.display = 'none';
    ContactsAddButton.style.display = 'block';
    populateContactList();
}

function initializeContacts() {
    //Contact elements
    contactListContainer = document.getElementById("ContactListContainer");
    contactViewContainer = document.getElementById("ContactViewContainer");
    contactListGroup = document.getElementById("ContactListGroup");
    contactViewButtons = document.getElementById("ContactViewButtons");
    contactViewEditButtons = document.getElementById("ContactViewEditButtons");
    contactEditButton = document.getElementById("ContactEditButton");
    contactSaveButton = document.getElementById("ContactSaveButton");
    contactDeleteButton = document.getElementById("ContactDeleteButton");
    contactNameInput = document.getElementById('ContactNameInput');
    contactAddressInput = document.getElementById('ContactAddressInput');
    contactsAddButton = document.getElementById('ContactsAddButton');

    contactEditButton.addEventListener('click', () => {
        contactViewButtons.style.display = 'none';
        contactViewEditButtons.style.display = 'flex';

        contactNameInput.removeAttribute('readonly', '');
        contactAddressInput.removeAttribute('readonly', '');

        cachedEditName = contactNameInput.value;
    });

    contactSaveButton.addEventListener('click', () => {
        contactViewButtons.style.display = 'block';
        contactViewEditButtons.style.display = 'none';

        contactNameInput.setAttribute('readonly', '');
        contactAddressInput.setAttribute('readonly', '');

        delete contacts[cachedEditName];
        saveContact(contactNameInput.value, contactAddressInput.value);
    });

    contactDeleteButton.addEventListener('click', () => {
        contactViewButtons.style.display = 'block';
        contactViewEditButtons.style.display = 'none';
        deleteContact(contactNameInput.value);
        resetContactsView();
    });

    contactsAddButton.addEventListener('click', () => {
        contactListContainer.style.display = 'none';
        contactViewContainer.style.display = 'block';
        contactViewButtons.style.display = 'block';
        contactViewEditButtons.style.display = 'none';
        contactsAddButton.style.display = 'none';

        contactViewButtons.style.display = 'none';
        contactViewEditButtons.style.display = 'flex';

        contactNameInput.removeAttribute('readonly', '');
        contactAddressInput.removeAttribute('readonly', '');


        contactNameInput.value = '';
        contactAddressInput.value = '';
    });


    contactNameInput.addEventListener('input', async (e) => {
        let value = e.target.value;

        //If a valid NKN address is entered go right away!!
        if (value.length > 0 && await postToSandbox({ cmd: 'verifyAddress', address: contactAddressInput.value })) {
            contactSaveButton.removeAttribute('disabled', '');
            return;
        }
        contactSaveButton.setAttribute('disabled', '');
    });

    contactAddressInput.addEventListener('input', async (e) => {
        let value = e.target.value;

        //If a valid NKN address is entered go right away!!
        if (value.length == '36') {
            const isValidAddr = await postToSandbox({ cmd: 'verifyAddress', address: value });
            if (isValidAddr) {
                contactSaveButton.removeAttribute('disabled', '');
                return;
            }
        }
        contactSaveButton.setAttribute('disabled', '');
    });
}

function populateContactList() {
    chrome.storage.local.get(["contacts"]).then((result) => {
        if (result.contacts) {
            contacts = result.contacts;
        }

        contactListGroup.replaceChildren();
        for (var name in contacts) {
            var address = contacts[name];

            let item = document.createElement('button');
            item.classList.add('list-group-item', 'list-group-item-action');

            item.innerHTML = `<i class="bi bi-person-fill"></i> ${name}<br><small style="color:var(--bs-secondary)">${address}</small>`;
            contactListGroup.appendChild(item);

            let cacheName = name;
            let cacheAddress = address;
            item.addEventListener('click', function eventHandler() {
                contactListContainer.style.display = 'none';
                contactViewContainer.style.display = 'block';
                contactViewButtons.style.display = 'block';
                contactViewEditButtons.style.display = 'none';
                contactsAddButton.style.display = 'none';

                contactNameInput.value = cacheName;
                contactAddressInput.value = cacheAddress;
            });
        }
    });
}

function saveContact(name, address) {
    contacts[name] = address;
    chrome.storage.local.set({ contacts: contacts });
}

function deleteContact(name) {
    delete contacts[name];
    chrome.storage.local.set({ contacts: contacts });
}