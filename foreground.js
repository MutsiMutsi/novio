var narwhallet = document.getElementById("narwhallet");
if (narwhallet != null) {
    var donationAddress = narwhallet.dataset.donation;
    if (donationAddress) {
        chrome.runtime.sendMessage({
            message: "set_page_donation",
            address: donationAddress
        });
    }
}