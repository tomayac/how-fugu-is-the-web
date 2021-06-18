self.browser = self.browser || self.chrome;

importScripts(['patterns.js']);

let previousOrigin = '';
let responseBodies = [];
let result = new Map();

const updatePopup = async () => {
  const length = result.size;
  chrome.tabs.query({ currentWindow: true, active: true }, async ([tab]) => {
    if (!length) {
      await browser.action.setBadgeText({
        text: '',
      });
      await browser.action.setTitle({
        title: '',
      });
      return await browser.action.disable({ tabId: tab.id });
    }
    await browser.action.setBadgeText({
      text: String(length),
      tabId: tab.id,
    });
    await browser.action.setTitle({
      title: `${length} Project Fugu 🐡 API${length > 1 ? 's' : ''} detected.`,
      tabId: tab.id,
    });
    await browser.action.enable({ tabId: tab.id });
  });
};

const detect = async () => {
  // To make sure we don't match on, e.g., blog posts that contain the patterns,
  // make sure that the file names fulfill certain conditions as a heuristic.
  const checkURLConditions = (where, type) => {
    // If the pattern has to occur in JavaScript, make sure the file name
    // includes either `.js` or `.mjs` and uses a correct-ish MIME type
    // (https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#textjavascript).
    if (where === 'JavaScript' && type === 'script') {
      return true;
    }
    // If the pattern has to occur in the Web App Manifest, make sure the file
    // name includes either `.json` or `.webmanifest` and uses a MIME type that
    // ends in "json"
    // (https://w3c.github.io/manifest/#:~:text=file%20extension%3A%20.webmanifest%20or%20.json%3F).
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
      if (value.regEx.test(har.response_body)) {
        if (
          result.has(key) &&
          !result.get(key).find((entry) => entry.url === har.url)
        ) {
          if (checkURLConditions(value.where, har.type)) {
            result.set(
              key,
              result.get(key).concat({
                url: har.url,
                featureDetection: value.featureDetection,
              }),
            );
          }
        } else {
          if (checkURLConditions(value.where, har.type)) {
            result.set(key, [
              { url: har.url, featureDetection: value.featureDetection },
            ]);
          }
        }
      }
    }
  });
  if (result.size) {
    console.log(result.entries());
    await updatePopup();
  }
};

const checkAndResetIfOriginChanged = async (url) => {
  const currentOrigin = new URL(url).origin;
  if (currentOrigin !== previousOrigin) {
    previousOrigin = currentOrigin;
    responseBodies = [];
    result.clear();
    await updatePopup();
    return true;
  }
  return false;
};

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    console.log(details.url, details.type);
    if (details.type === 'main_frame') {
      if (await checkAndResetIfOriginChanged(details.url)) {
        return;
      }
    }
    const body = await fetch(details.url).then((response) => response.text());
    responseBodies.push({
      url: details.url,
      type: details.type,
      response_body: body,
    });
  },
  {
    urls: ['https://*/*'],
    types: ['main_frame', 'script', 'other'],
  },
);

browser.webNavigation.onCompleted.addListener(detect);

browser.webNavigation.onBeforeNavigate.addListener(async ({ url }) => {
  await checkAndResetIfOriginChanged(url);
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.message === 'request-results') {
    if (result.size) {
      await browser.runtime.sendMessage(Array.from(result.entries()));
    }
  }
});

browser.runtime.onSuspend.addListener(async () => {
  previousOrigin = '';
  responseBodies = [];
  result.clear();
  await updatePopup();
});
