chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  let currentTab = tabs[0];
  let tabURL = new URL(currentTab.url);

  if (tabURL.hostname !== "manifold.markets") {
    showError();
  } else {
    // Your existing logic for loading the iframe, etc.
    let iframeSrc = `https://manifol.io/?market=${encodeURIComponent(currentTab.url)}`;
    document.getElementById('myIframe').src = iframeSrc;
  }
});

function showError() {
  const errorDiv = document.createElement("div");
  errorDiv.innerText = "You must on a page on manifold.markets to use this extension.";
  errorDiv.style.color = "red";
  errorDiv.style.textAlign = "center";
  errorDiv.style.marginTop = "20px";
  errorDiv.style.fontWeight = "600";
  document.body.innerHTML = '';  // Clear the body
  document.body.appendChild(errorDiv);  // Append the error message
}
