(function () {
  "use strict";

  let initialized = false;

  // Initialize the extension
  function init() {
    if (initialized) return;
    initialized = true;

    console.log("YouTube Ad Speed Controller content script loaded");

    // Send message to background script to start monitoring
    chrome.runtime.sendMessage({ action: "forceCheck" });

    // Add keyboard shortcut for manual testing
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        chrome.runtime.sendMessage({ action: "forceCheck" });
        console.log("Manual ad check triggered via content script");
      }
    });

    // Monitor for page navigation within YouTube
    let currentUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        if (currentUrl.includes("/watch")) {
          console.log(
            "YouTube navigation detected, triggering background check"
          );
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: "forceCheck" });
          }, 1000);
        }
      }
    });

    urlObserver.observe(document, { subtree: true, childList: true });

    // Additional triggers for ad detection
    document.addEventListener(
      "play",
      function (e) {
        if (e.target.tagName === "VIDEO") {
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: "forceCheck" });
          }, 500);
        }
      },
      true
    );

    document.addEventListener(
      "playing",
      function (e) {
        if (e.target.tagName === "VIDEO") {
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: "forceCheck" });
          }, 500);
        }
      },
      true
    );
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Fallback initialization
  setTimeout(init, 1000);
})();
