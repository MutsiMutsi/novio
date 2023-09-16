let qrcode;

function initializeReceive() {
    document.getElementById('ReceiveAddressInput').value = address;
    document.getElementById('CopyAddressButton').addEventListener('click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('ReceiveAddressInput').value);
    });

    if (qrcode) {
        qrcode.makeCode(address);
    } else {
        qrcode = new QRCode(document.getElementById("qrcode"), {
            text: address,
            width: 160,
            height: 160,
            colorDark: "#000000",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.L
        });
    }
}