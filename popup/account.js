function initializeAccount() {
    replaceEventListener(document.getElementById("WalletDeleteButton"), "click", () => {
        document.getElementById("AccountInfoBox").style.display = 'none';
        document.getElementById("DeleteWalletConfirmBox").style.display = 'block';

        document.getElementById("WalletDeleteConfirmationLabel").innerHTML = `I understand that this action is irreversable, wallet <strong>'${currentAccount.Name}'</strong> will be removed from Novio. If you have no backup of this wallet your funds will be lost.`;
    });

    replaceEventListener(document.getElementById('WalletDeleteConfirmationCheckbox'), 'change', (cb) => {
        if (cb.target.checked) {
            document.getElementById("DeleteConfirmButton").removeAttribute('disabled');
        } else {
            document.getElementById("DeleteConfirmButton").setAttribute('disabled', '');
        }
    });

    replaceEventListener(document.getElementById("DeleteConfirmButton"), "click", () => {
        deleteHistory();
        deleteAccount(currentAccount.Name);
    });

    replaceEventListener(document.getElementById("DeleteCancelButton"), "click", () => {
        resetAccount();
    });

    replaceEventListener(document.getElementById("ExportSeedButton"), 'click', async () => {
        document.getElementById("ExportSeedButton").style.display = 'none';
        document.getElementById("SeedDisplayGroup").style.display = 'flex';
        document.getElementById("SeedExport").value = await postToSandbox({ cmd: 'exportSeed' });;
    });


    //Copy buttons
    replaceEventListener(document.getElementById('AccountAddressInputCopy'), 'click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('AccountAddressInput').value);
    });
    replaceEventListener(document.getElementById('PublicKeyInputCopy'), 'click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('PublicKeyInput').value);
    });
    replaceEventListener(document.getElementById('SeedExportCopy'), 'click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('SeedExport').value);
    });
}

function resetAccount() {
    document.getElementById("AccountInfoBox").style.display = 'block';
    document.getElementById("DeleteWalletConfirmBox").style.display = 'none';
    document.getElementById("ExportSeedButton").style.display = 'block';
    document.getElementById("SeedDisplayGroup").style.display = 'none';

    document.getElementById("AccountAddressInput").value = currentAccount.Address;
    document.getElementById("PublicKeyInput").value = currentAccount.PublicKey;
    document.getElementById("SeedExport").value = '';
}