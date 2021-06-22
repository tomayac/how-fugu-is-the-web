// Make sure this extension works universally.
self.browser = self.browser || self.chrome;

import patternsFunc from './patternsFunc.js';

// DOM references.
const ul = document.querySelector('ul');
const main = document.querySelector('main');

// Translated strings.
document.title = browser.i18n.getMessage('extName');
document.querySelector('h1').textContent =
  browser.i18n.getMessage('detectedAPIs');
document.querySelector('#made-by').textContent =
  browser.i18n.getMessage('madeBy');
document.querySelector('#source-code').textContent =
  browser.i18n.getMessage('sourceCode');

// Runs the feature detection functions for all Fugu features.
const supported = await patternsFunc();

// Render the message HTML. The message can come from the
// background service worker or be cached and come from the
// content script.
const displayMessage = (message, tab) => {
  if (!message.data.length) {
    return;
  }
  ul.innerHTML = '';
  if (message.data.length > 4) {
    main.style.columns = 2;
  }
  for (const [key, values] of message.data) {
    const li = document.createElement('li');
    ul.append(li);
    const h2 = document.createElement('h2');
    h2.textContent = `${key}:`;
    li.append(h2);
    const span = document.createElement('span');
    li.append(span);
    span.innerHTML = supported[key]
      ? '<span class="emoji">✔️</span> ' + browser.i18n.getMessage('supported')
      : supported[key] === undefined
      ? '<span class="emoji">🤷</span> ' + browser.i18n.getMessage('unknown')
      : '<span class="emoji">🚫</span> ' +
        browser.i18n.getMessage('notSupported');
    const nestedUl = document.createElement('ul');
    nestedUl.classList.add('nested');
    li.append(nestedUl);
    values.forEach((value) => {
      const nestedLi = document.createElement('li');
      nestedUl.append(nestedLi);
      const a = document.createElement('a');
      nestedLi.append(a);
      a.href = `${value.url}#:~:text=${encodeURIComponent(value.matchingText)}`;
      const tabOrigin = new URL(tab.url).origin;
      const resourceURL = new URL(value.url);
      a.textContent =
        tabOrigin === resourceURL.origin
          ? resourceURL.pathname + resourceURL.search
          : value.url;
    });
  }
};

// Receives messages from either the background service worker or
// the content script. If the message comes from the background
// service worker, sets up the caching of the message in the content
// script of the page.
browser.runtime.onMessage.addListener((message, sender) => {
  browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (message.type === 'return-results') {
      displayMessage(message, tab);
    }
    if (!sender.tab) {
      browser.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ['contentInject.js'],
        },
        () => {
          browser.tabs.sendMessage(tab.id, {
            type: 'store-results',
            data: message.data,
          });
        },
      );
    }
  });
});

// Race the background service worker against the cached result.
browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  // Ask the background service worker.
  browser.runtime.sendMessage({ type: 'request-results', data: tab.url });
  // Ask the content script.
  browser.tabs.sendMessage(tab.id, { type: 'request-results', data: tab.url });
});
