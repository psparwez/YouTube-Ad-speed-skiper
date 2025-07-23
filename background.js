let activeTabId = null;
let monitoringInterval = null;
let isMonitoring = false;

chrome.runtime.onStartup.addListener(() => {
  console.log("YouTube Ad Speed Controller service worker started");
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("YouTube Ad Speed Controller installed");
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    handleTabChange(tab);
  }
});

async function handleTabChange(tab) {
  if (tab.url && tab.url.includes("youtube.com/watch")) {
    activeTabId = tab.id;
    startMonitoring(tab.id);
  } else {
    stopMonitoring();
  }
}

// Start continuous monitoring
function startMonitoring(tabId) {
  if (isMonitoring) return;

  isMonitoring = true;
  console.log("Starting background monitoring for tab:", tabId);

  // Clear any existing interval
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  // Monitor every 500ms
  monitoringInterval = setInterval(async () => {
    try {
      await checkForAds(tabId);
    } catch (error) {
      console.log("Monitoring error:", error);
      // If tab is no longer valid, stop monitoring
      if (error.message.includes("tab") || error.message.includes("Tab")) {
        stopMonitoring();
      }
    }
  }, 500);
}

// Stop monitoring
function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  isMonitoring = false;
  activeTabId = null;
  console.log("Stopped background monitoring");
}

// Check for ads and inject speed control
async function checkForAds(tabId) {
  if (!tabId) return;

  try {
    // Inject script to check for ads and control speed
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: detectAndControlAds,
    });

    if (results && results[0] && results[0].result) {
      const { adDetected, action, adCount } = results[0].result;

      if (action === "speedUp") {
        console.log(`Background: Ad #${adCount} detected - speeding up`);
      } else if (action === "restore") {
        console.log("Background: Ad ended - restoring speed");
      }
    }
  } catch (error) {
    // Silently handle errors to avoid spam
    if (
      !error.message.includes("Cannot access") &&
      !error.message.includes("tab")
    ) {
      console.log("Script injection error:", error);
    }
  }
}

// Function to be injected into the page
function detectAndControlAds() {
  // Store state in window object to persist between injections
  if (!window.adSpeedController) {
    window.adSpeedController = {
      originalSpeed: 1,
      isAdPlaying: false,
      adCount: 0,
      lastCheck: 0,
      lastAdCheck: 0,
    };
  }

  const controller = window.adSpeedController;
  const currentTime = Date.now();

  // Function to check if an ad is currently playing
  function isAdCurrentlyPlaying() {
    // Skip if we just checked recently
    if (currentTime - controller.lastAdCheck < 200) {
      return controller.isAdPlaying;
    }
    controller.lastAdCheck = currentTime;

    // Primary check for "Sponsored" text element
    const sponsoredElement = document.querySelector(
      ".ad-simple-attributed-string.ytp-ad-badge__text--clean-player"
    );

    if (
      sponsoredElement &&
      sponsoredElement.textContent.trim() === "Sponsored"
    ) {
      return true;
    }

    // Additional checks for "Sponsored" text in various locations
    const sponsoredSelectors = [
      '[aria-label="Sponsored"]',
      ".ytp-ad-badge__text--clean-player",
      ".ad-simple-attributed-string",
    ];

    for (let selector of sponsoredSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim() === "Sponsored") {
        return true;
      }
    }

    // Fallback detection methods
    const adIndicators = [
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-modern",
      ".video-ads",
      ".ytp-ad-text",
      ".ytp-ad-preview-text",
      '[class*="ad-showing"]',
      ".ytp-ad-player-overlay",
      ".ytp-ad-module:not([hidden])",
    ];

    for (let selector of adIndicators) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    // Check if video container has ad-related classes
    const videoContainer = document.querySelector("#movie_player");
    if (videoContainer && videoContainer.classList.contains("ad-showing")) {
      return true;
    }

    return false;
  }

  // Get video element
  function getVideoElement() {
    return document.querySelector("video");
  }

  const video = getVideoElement();
  if (!video) {
    return { adDetected: false, action: "none", adCount: controller.adCount };
  }

  // Prevent too frequent changes (debounce)
  if (currentTime - controller.lastCheck < 200) {
    return {
      adDetected: controller.isAdPlaying,
      action: "none",
      adCount: controller.adCount,
    };
  }

  controller.lastCheck = currentTime;
  const adDetected = isAdCurrentlyPlaying();
  let action = "none";

  // Ad detected and not currently speeding up
  if (adDetected && !controller.isAdPlaying) {
    controller.originalSpeed = video.playbackRate;
    video.playbackRate = 14;
    controller.isAdPlaying = true;
    controller.adCount++;
    action = "speedUp";

    // Add visual indicator
    if (!document.querySelector("#ad-speed-indicator")) {
      const indicator = document.createElement("div");
      indicator.id = "ad-speed-indicator";
      indicator.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: rgba(255, 0, 0, 0.8);
          color: white;
          padding: 5px 10px;
          border-radius: 5px;
          font-size: 12px;
          z-index: 10000;
          font-family: Arial, sans-serif;
        `;
      indicator.textContent = "⚡ Ad Speed: 14x";
      //   document.body.appendChild(indicator);
    }
  }
  // No ad detected but currently speeding up
  else if (!adDetected && controller.isAdPlaying) {
    video.playbackRate = controller.originalSpeed;
    controller.isAdPlaying = false;
    action = "restore";

    // Remove visual indicator
    const indicator = document.querySelector("#ad-speed-indicator");
    if (indicator) {
      indicator.remove();
    }
  }

  // Additional safety check - if we think an ad is playing but video is at normal speed
  if (
    controller.isAdPlaying &&
    video.playbackRate === controller.originalSpeed
  ) {
    controller.isAdPlaying = false;
    action = "restore";
    const indicator = document.querySelector("#ad-speed-indicator");
    if (indicator) {
      indicator.remove();
    }
  }

  return {
    adDetected,
    action,
    adCount: controller.adCount,
    currentSpeed: video.playbackRate,
    isAdPlaying: controller.isAdPlaying,
  };
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.includes("youtube.com/watch")) {
    // Force check for ads
    await checkForAds(tab.id);
  }
});

// Message handling from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "forceCheck" && sender.tab) {
    checkForAds(sender.tab.id);
    sendResponse({ status: "checking" });
  } else if (request.action === "getStatus") {
    sendResponse({
      isMonitoring,
      activeTabId,
      monitoringActive: !!monitoringInterval,
    });
  }
});

console.log("YouTube Ad Speed Controller background script loaded");
