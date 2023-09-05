function initializeReceive() {
    document.getElementById('CopyAddressButton').addEventListener('click', (e) => {
        e.currentTarget.innerHTML = `<i class="bi bi-clipboard-check"></i>`;
        navigator.clipboard.writeText(document.getElementById('ReceiveAddressInput').value);
    });

    if (qrcode) {
        qrcode.makeCode('NKNTrHTh1CjVNix73ydAkiNS93RRD8PvxpT4');
    } else {
        qrcode = new QRCode(document.getElementById("qrcode"), {
            text: 'NKNTrHTh1CjVNix73ydAkiNS93RRD8PvxpT4',
            width: 160,
            height: 160,
            colorDark: "#000000",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.L
        });
    }
}