let qrcode;

function initializeReceive() {
    document.getElementById('ReceiveAddressInput').value = currentAccount.Address;
    replaceEventListener(document.getElementById('CopyAddressButton'), 'click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('ReceiveAddressInput').value);
    });

    if (qrcode) {
        qrcode.makeCode(currentAccount.Address);
    } else {
        qrcode = new QRCode(document.getElementById("qrcode"), {
            text: currentAccount.Address,
            width: 160,
            height: 160,
            colorDark: "#000000",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.L
        });
    }
}