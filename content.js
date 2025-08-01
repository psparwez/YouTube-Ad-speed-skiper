(function () {
  const controller = {
    originalSpeed: 1,
    isAdPlaying: false,
    skipAttempted: false,
    lastSpeedCheck: 0,
    intervalId: null,
    observerActive: false,
    lastUrl: window.location.href,
  };

  function isAdVisible(selector) {
    const el = document.querySelector(selector);
    return (
      el &&
      el.offsetParent !== null &&
      el.offsetHeight > 0 &&
      el.offsetWidth > 0
    );
  }

  function isAdPlaying() {
    const adSelectors = [
      ".ytp-ad-player-overlay-layout",
      ".ytp-ad-badge__text--clean-player",
      ".video-ads.ytp-ad-module",
      ".ytp-ad-skip-button",
      ".ytp-skip-ad-button",
      ".ytp-ad-preview-text",
      "#movie_player.ad-showing",
      ".ytp-ad-player-overlay",
      ".ytp-ad-overlay-container",
      ".ytp-ad-text",
      "[class*='ad-showing']",
      "[class*='ytp-ad']",
    ];

    const video = document.querySelector("video");
    if (video) {
      const videoContainer = video.closest("#movie_player");
      if (videoContainer && videoContainer.classList.contains("ad-showing")) {
        return true;
      }
    }

    return adSelectors.some(isAdVisible);
  }

  function trySkipAd() {
    const skipSelectors = [
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-modern",
      ".ytp-skip-ad",
      "[aria-label*='Skip']",
      "button[class*='skip']",
    ];

    for (const selector of skipSelectors) {
      const btn = document.querySelector(selector);

      if (btn) {
        const style = window.getComputedStyle(btn);
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          btn.offsetHeight > 0 &&
          btn.offsetWidth > 0;

        if (visible && !btn.disabled) {
          btn.click();
          console.log("[AdSkipper] Clicked skip button:", selector);
          return true;
        }
      }
    }
    return false;
  }

  function detectAndControlAds() {
    const video = document.querySelector("video");
    if (!video) {
      console.log("[AdSkipper] No video element found");
      return;
    }

    const now = Date.now();
    if (now - controller.lastSpeedCheck < 100) return;
    controller.lastSpeedCheck = now;

    const adDetected = isAdPlaying();

    if (adDetected) {
      console.log("[AdSkipper] Ad detected!");

      const skipClicked = trySkipAd();

      if (!controller.isAdPlaying) {
        controller.originalSpeed = video.playbackRate;
        controller.isAdPlaying = true;
        console.log("[AdSkipper] Ad started - setting up speed manipulation");
      }

      if (video.playbackRate !== 1) {
        video.playbackRate = 1;
      }

      setTimeout(() => {
        const stillAdPlaying = isAdPlaying();
        if (stillAdPlaying && video) {
          video.playbackRate = 16;
          console.log("[AdSkipper] Speed boosted to 16x");
        }
      }, 200);
    } else {
      if (controller.isAdPlaying) {
        video.playbackRate = controller.originalSpeed;
        controller.isAdPlaying = false;
        controller.skipAttempted = false;
        console.log(
          "[AdSkipper] Ad ended - restored original speed:",
          controller.originalSpeed
        );
      }
    }
  }

  function handleUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== controller.lastUrl) {
      console.log("[AdSkipper] URL changed, reinitializing...");
      controller.lastUrl = currentUrl;
      controller.isAdPlaying = false;
      controller.skipAttempted = false;

      setTimeout(() => {
        initializeForNewVideo();
      }, 1000);
    }
  }

  function initializeForNewVideo() {
    const video = document.querySelector("video");
    if (video) {
      console.log("[AdSkipper] New video detected, monitoring ads...");
      controller.originalSpeed = video.playbackRate || 1;
    }
  }

  function setupMutationObserver() {
    if (controller.observerActive) return;

    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;

      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              const nodeStr =
                String(node.className || "") + " " + String(node.id || "");
              if (nodeStr.includes("ad") || nodeStr.includes("ytp")) {
                shouldCheck = true;
                break;
              }
            }
          }
        }

        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "class" ||
            mutation.attributeName === "id")
        ) {
          const target = mutation.target;
          const attrValue =
            String(target.className || "") + " " + String(target.id || "");
          if (attrValue.includes("ad") || attrValue.includes("ytp")) {
            shouldCheck = true;
          }
        }
      });

      if (shouldCheck) {
        setTimeout(detectAndControlAds, 50);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id"],
    });

    controller.observerActive = true;
    console.log("[AdSkipper] Mutation observer activated");
  }

  function initialize() {
    console.log("[AdSkipper] Initializing YouTube Ad Skipper...");

    if (controller.intervalId) {
      clearInterval(controller.intervalId);
    }

    controller.intervalId = setInterval(detectAndControlAds, 200);

    setInterval(handleUrlChange, 1000);

    setupMutationObserver();

    setTimeout(initializeForNewVideo, 500);

    console.log("[AdSkipper] Initialization complete");
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      console.log("[AdSkipper] Page became visible, reinitializing...");
      setTimeout(initialize, 500);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
  window.adSkipperController = controller;
})();
