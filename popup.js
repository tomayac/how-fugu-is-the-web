// Make sure this extension works universally.
self.browser = self.browser || self.chrome;

import patternsFunc from './patternsFunc.js';
import html2canvas from './html2canvas.esm.js';

const CANONICAL = 'https://goo.gle/how-fugu-is-the-web';

// DOM references.
const ul = document.querySelector('ul');
const button = document.querySelector('button');
const footer = document.querySelector('footer');
const heading = document.querySelector('h1')
const body = document.body;

// This needs to be prepared before the share button is clicked,
// else, the user gesture would be consumed by the time the PNG
// image can be created.
let dataURL;

// Translated strings.
document.title = browser.i18n.getMessage('extName');
heading.textContent =
  browser.i18n.getMessage('detectedAPIs');
document.querySelector('#made-by').textContent =
  browser.i18n.getMessage('madeBy');
document.querySelector('#source-code').textContent =
  browser.i18n.getMessage('sourceCode');
button.textContent = browser.i18n.getMessage('share');
const footerHTML = footer.innerHTML;
const headingHTML = heading.innerHTML;

// Runs the feature detection functions for all Fugu features.
const supported = await patternsFunc();

// Render the message HTML. The message can come from the
// background service worker or be cached and come from the
// content script.
const displayMessage = (message, tab) => {
  if (!message?.data?.length) {
    return;
  }
  ul.innerHTML = '';
  for (const [key, values] of message.data) {
    const li = document.createElement('li');
    ul.append(li);
    const h2 = document.createElement('h2');
    h2.textContent = `${key}:`;
    li.append(h2);
    const span = document.createElement('span');
    li.append(span);
    span.innerHTML = supported[key]
      ? `<span class="emoji">✅</span> ${browser.i18n.getMessage('supported')} `
      : supported[key] === undefined
      ? `<span class="emoji">🤷</span> ${browser.i18n.getMessage('unknown')} `
      : `<span class="emoji">🚫</span> ${browser.i18n.getMessage(
          'notSupported',
        )} `;
    const a = document.createElement('a');
    li.append(a);
    a.href = values[0].documentation;
    a.classList.add('help');
    a.innerHTML = browser.i18n.getMessage('details');
    const nestedUl = document.createElement('ul');
    nestedUl.classList.add('nested');
    li.append(nestedUl);
    values.forEach((value) => {
      const nestedLi = document.createElement('li');
      nestedUl.append(nestedLi);
      const a = document.createElement('a');
      nestedLi.append(a);
      a.href = `${value.href}#:~:text=${encodeURIComponent(
        value.matchingText,
      )}`;
      const tabOrigin = new URL(tab.url).origin;
      const resourceURL = new URL(value.url);
      a.textContent =
        tabOrigin === resourceURL.origin
          ? resourceURL.pathname + resourceURL.search
          : value.url;
    });
  }
};

button.addEventListener('click', async () => {
  browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = tab.url;
    browser.action.getBadgeText({ tabId: tab.id }, async (text) => {
      const numAPIs = Number(text);
      /* eslint-disable no-irregular-whitespace */
      const message = `🙋 I just found an app…

👉 ${url} 👈

…that uses ${numAPIs} Fugu API${numAPIs === 1 ? '' : 's'} 🐡!

How Fugu 🐡 is the Web? Install the extension from ${CANONICAL} and share on #HowFuguIsTheWeb!`.trim();
      /* eslint-enable no-irregular-whitespace */

      const shareData = {
        text: message,
        title: '',
        dataURL,
      };
      browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        browser.tabs.sendMessage(
          tab.id,
          { type: 'share-results', data: shareData },
          () => {
            if (browser.runtime.lastError) {
              return;
            }
          },
        );
        window.close();
      });
    });
  });
});

const createScreenshot = async (url) => {
  console.log(url)
  const computedStyle = getComputedStyle(document.documentElement);
  const mainColor = computedStyle.getPropertyValue('--main-color');
  const mainBackgroundColor = computedStyle.getPropertyValue(
    '--main-background-color',
  );
  const linkColor = computedStyle.getPropertyValue('--link-color');
  document.documentElement.style.color = mainColor;
  body.style.color = mainColor;
  body.style.backgroundColor = mainBackgroundColor;
  body.querySelectorAll('a').forEach((a) => (a.style.color = linkColor));
  const link = footer.querySelector('a:nth-of-type(2)')
  link.textContent = CANONICAL;
  link.href = CANONICAL;
  footer.innerHTML = footer.innerHTML.replace(browser.i18n.getMessage('sourceCode'), '<br/>Install the extension from');
  heading.innerHTML = headingHTML.replace(/:$/, `<br/><a href ="${url}">${url}</a>:`);
  const canvas = await html2canvas(document.body, {backgroundColor: mainBackgroundColor});
  footer.innerHTML = footerHTML;
  heading.innerHTML = headingHTML;
  return canvas.toDataURL();
};

// Receives messages from either the background service worker or
// the content script. If the message comes from the background
// service worker, sets up the caching of the message in the content
// script of the page.
browser.runtime.onMessage.addListener((message, sender) => {
  browser.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (message.type === 'return-results') {
      displayMessage(message, tab);
      if ('share' in navigator) {
        dataURL = await createScreenshot(tab.url);
        /Apple/.test(navigator.vendor)
          ? button.classList.add('ios')
          : button.classList.add('others');
        button.style.display = 'inline-block';
      }
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
  browser.runtime.sendMessage(
    { type: 'request-results', data: tab.url },
    () => {
      if (browser.runtime.lastError) {
        return;
      }
    },
  );

  // Ask the content script.
  browser.tabs.sendMessage(
    tab.id,
    { type: 'request-results', data: tab.url },
    () => {
      if (browser.runtime.lastError) {
        return;
      }
    },
  );
});
