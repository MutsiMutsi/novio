let donationMap = {};

chrome.runtime.onInstalled.addListener(() => {

});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    let tabData = await chrome.tabs.query({ active: true, currentWindow: true })

    if (tabData[0]) {
        donationAddress = donationMap[tabData[0].url];
        donationSource = tabData[0].url;
    } else {
        donationAddress = '';
        donationSource = '';
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && /^http/.test(tab.url)) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["./foreground.js"]
        }).then(() => {

        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'set_page_donation') {
        donationMap[sender.url] = request.address;
        return true;
    }

    if (request.message === 'getDonationAddress') {
        var url = request.url;
        sendResponse({
            address: donationMap[url],
            source: url
        });
    }
});