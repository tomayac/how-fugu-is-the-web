// Make sure this extension works universally.
self.browser = self.browser || self.chrome;

importScripts(['patterns.js']);

// The previously visited URL.
let previousURL = '';

// The response bodies of all resources requested by the page.
let responseBodies = [];

// The detected Fugu APIs.
let detectedAPIs = new Map();

// Update the browser popup according to the detected APIs.
const updatePopup = () => {
  browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    // Reset the badge and the title for the current tab if no APIs are detected.
    const length = detectedAPIs.size;
    if (!length) {
      browser.action.setBadgeText({
        text: '',
        tabId: tab.id,
      });
      browser.action.setTitle({
        title: '',
        tabId: tab.id,
      });
      browser.action.disable({
        tabId: tab.id,
      });
      return;
    }
    // Set the badge and the title in function of the detected APIs
    // on the current page.
    browser.action.setBadgeText({
      text: String(length),
      tabId: tab.id,
    });
    browser.action.setTitle({
      title: `${length} Project Fugu 🐡 API${length > 1 ? 's' : ''} detected.`,
      tabId: tab.id,
    });
    browser.action.enable({
      tabId: tab.id,
    });
  });
};

const detect = () => {
  // To make sure we don't match on, e.g., blog posts that contain the patterns,
  // make sure that the file names fulfill certain conditions as a heuristic.
  const checkURLConditions = (where, type) => {
    // The pattern occurs in the JavaScript.
    if (where === 'JavaScript' && type === 'script') {
      return true;
    }
    // The patterns occurs in the Web App Manifest.
    if (where === 'Web App Manifest' && type === 'other') {
      return true;
    }
    // Fall-through in all other cases.
    return false;
  };

  // Iterate over all response bodies and over all patterns and populate the
  // result object.
  responseBodies.forEach((har) => {
    for (const [key, value] of Object.entries(patterns)) {
      const matches = value.regEx.exec(har.response_body);
      if (matches) {
        if (
          detectedAPIs.has(key) &&
          !detectedAPIs.get(key).find((entry) => entry.url === har.url)
        ) {
          if (checkURLConditions(value.where, har.type)) {
            detectedAPIs.set(
              key,
              detectedAPIs.get(key).concat({
                url: har.url,
                featureDetection: value.featureDetection,
                matchingText: matches[0],
              }),
            );
          }
        } else {
          if (checkURLConditions(value.where, har.type)) {
            detectedAPIs.set(key, [
              {
                url: har.url,
                featureDetection: value.featureDetection,
                matchingText: matches[0],
              },
            ]);
          }
        }
      }
    }
  });
  if (detectedAPIs.size) {
    console.log(detectedAPIs.entries());
    updatePopup();
  }
};

// If the URL has changed, reset everything to the empty state.
const checkAndResetIfURLChanged = (url) => {
  const currentURL = new URL(url.split('#')[0]).href;
  if (currentURL !== previousURL) {
    previousURL = currentURL;
    responseBodies = [];
    detectedAPIs.clear();
    updatePopup();
    return true;
  }
  return false;
};

// Track each main document, JavaScript, or Web App Manifest request.
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log(details.type, details.url);
    if (details.type === 'main_frame') {
      if (!previousURL) {
        previousURL = new URL(details.url.split('#')[0]).href;
      }
      if (checkAndResetIfURLChanged(details.url)) {
        return;
      }
    }
    if (
      !responseBodies.find((responseBody) => details.url === responseBody.url)
    ) {
      fetch(details.url)
        .then((response) => response.text())
        .then((body) => {
          responseBodies.push({
            url: details.url,
            type: details.type,
            response_body: body,
          });
        })
        .catch((err) => {
          console.error(err.name, err.message);
        });
    }
  },
  {
    urls: ['https://*/*'],
    types: ['main_frame', 'script', 'other'],
  },
);

// When the navigation has completed, detect if any of the tracked
// requests looks like it contains a Fugu API.
browser.webNavigation.onCompleted.addListener(detect);

// Upon each main frame navigation, check if the URL has changed, and if so,
// reset everything to the empty state.
browser.webNavigation.onBeforeNavigate.addListener(({ url, frameId }) => {
  if (frameId > 0) {
    return;
  }
  checkAndResetIfURLChanged(url);
});

// When the popup asks for results, deliver them, but only if the URLs match.
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'request-results') {
    if (
      detectedAPIs.size &&
      previousURL === new URL(message.data.split('#')[0]).href
    ) {
      browser.runtime.sendMessage({
        type: 'return-results',
        data: Array.from(detectedAPIs.entries()),
      });
    }
  }
});

// When the background service worker gets suspended, reset everything to the
// empty state.
browser.runtime.onSuspend.addListener(() => {
  previousURL = '';
  responseBodies = [];
  detectedAPIs.clear();
  updatePopup();
});

// Make sure the action is clickable when there are detected APIs.
browser.tabs.onActivated.addListener(({ tabId }) => {
  browser.action.getBadgeText(
    {
      tabId: tabId,
    },
    (text) => {
      if (text && Number(text) > 0) {
        browser.action.enable({
          tabId: tabId,
        });
      }
    },
  );
});
