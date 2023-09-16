function initializeAccount() {
    document.getElementById("WalletDeleteButton").addEventListener("click", () => {
        document.getElementById("AccountInfoBox").style.display = 'none';
        document.getElementById("DeleteWalletConfirmBox").style.display = 'block';
    });

    document.getElementById("DeleteConfirmButton").addEventListener("click", () => {
        deleteAccount('main');
    });

    document.getElementById("DeleteCancelButton").addEventListener("click", () => {
        resetAccount();
    });

    document.getElementById("ExportSeedButton").addEventListener('click', async () => {
        document.getElementById("ExportSeedButton").style.display = 'none';
        document.getElementById("SeedDisplayGroup").style.display = 'flex';
        document.getElementById("SeedExport").value = await postToSandbox({cmd: 'exportSeed'});;
    });


    //Copy buttons
    document.getElementById('AccountAddressInputCopy').addEventListener('click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('AccountAddressInput').value);
    });
    document.getElementById('PublicKeyInputCopy').addEventListener('click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('PublicKeyInput').value);
    });
    document.getElementById('SeedExportCopy').addEventListener('click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('SeedExport').value);
    });
}

function resetAccount() {
    document.getElementById("AccountInfoBox").style.display = 'block';
    document.getElementById("DeleteWalletConfirmBox").style.display = 'none';
    document.getElementById("ExportSeedButton").style.display = 'block';
    document.getElementById("SeedDisplayGroup").style.display = 'none';

    document.getElementById("PublicKeyInput").value = publicKey;
    document.getElementById("SeedExport").value = '';
}