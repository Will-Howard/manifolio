chrome.action.onClicked.addListener((tab) => {
  // When the extension icon is clicked, open the popup
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['popup.js']
  });
});
