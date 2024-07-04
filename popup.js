// Make sure this extension works universally.
self.browser = self.browser || self.chrome;

import patternsFunc from './patternsFunc.js';
import html2canvas from './html2canvas.esm.js';

const CANONICAL = 'https://goo.gle/how-fugu-is-the-web';

const MAX_DISPLAY_URL_LENGTH = 50;

// DOM references.
const ul = document.querySelector('ul');
const shareButton = document.querySelector('#share');
const downloadButton = document.querySelector('#download');
const heading = document.querySelector('h1');
const paragraph = document.querySelector('p');
const ol = document.querySelector('ol');

// This needs to be prepared before the share button is clicked,
// else, the user gesture would be consumed by the time the PNG
// image can be created.
let blob;

// Runs the feature detection functions for all Fugu features.
const supported = await patternsFunc();

const shortenURL = (url) => {
  return `${url.hostname}${
    url.pathname.length > MAX_DISPLAY_URL_LENGTH
      ? `${url.pathname.substring(0, MAX_DISPLAY_URL_LENGTH)}…`
      : url.pathname
  }`;
};

// Render the message HTML. The message comes from the content script.
const displayMessage = (message, tab) => {
  if (!message.data) {
    return;
  }
  // Translated strings.
  document.title = browser.i18n.getMessage('extName');
  heading.textContent = document.title;
  const url = new URL(tab.url);
  paragraph.innerHTML = `${browser.i18n.getMessage('detectedAPIs')} <a href="${
    tab.url
  }">${shortenURL(url)}</a>:`;
  document.querySelector('#made-by').textContent =
    browser.i18n.getMessage('madeBy');
  document.querySelector('#source-code').textContent =
    browser.i18n.getMessage('sourceCode');
  shareButton.textContent = browser.i18n.getMessage('share');
  downloadButton.textContent = browser.i18n.getMessage('download');

  ul.innerHTML = '';
  for (const [key, values] of Object.entries(message.data)) {
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
          ? (resourceURL.pathname + resourceURL.search).length >
            MAX_DISPLAY_URL_LENGTH
            ? resourceURL.pathname + resourceURL.search + '…'
            : resourceURL.pathname + resourceURL.search
          : value.url.length > MAX_DISPLAY_URL_LENGTH
            ? value.url.substring(0, MAX_DISPLAY_URL_LENGTH) + '…'
            : value.url;
    });
  }
};

shareButton.addEventListener('click', async () => {
  browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = tab.url;
    browser.action.getBadgeText({ tabId: tab.id }, async (text) => {
      const numAPIs = Number(text);
      const message = `🙋 I just found an app…

👉 ${url} 👈

…that uses ${numAPIs} Fugu 🐡 API${numAPIs === 1 ? '' : 's'}!

How Fugu 🐡 is the Web? Find out by installing the extension from ${CANONICAL} and share on #HowFuguIsTheWeb!`.trim();

      if ('share' in navigator) {
        const shareData = {
          text: message,
          title: '',
          blob,
        };
        // The fallback when rich sharing isn't available.
        const shareTextOnly = async (shareData) => {
          delete shareData.blob;
          try {
            await navigator.share(shareData);
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error(err.name, err.message);
            }
          }
        };
        // Try rich sharing first.
        const share = async (shareData) => {
          if (!('canShare' in navigator) || !navigator.canShare(shareData)) {
            return shareTextOnly(shareData);
          }
          try {
            await navigator.share(shareData);
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error(err.name, err.message);
              delete shareData.files;
              shareTextOnly(shareData);
            }
          }
        };

        const files = [
          new File([blob], 'how-fugu-is-the-web.png', { type: blob.type }),
        ];
        shareData.files = files;
        share(shareData);
      } else {
        const shareURL = new URL('https://twitter.com/intent/tweet');
        const params = new URLSearchParams();
        params.append('text', message);
        shareURL.search = params;
        window.open(shareURL, '_blank', 'popup,noreferrer,noopener');
      }
    });
  });
});

const createScreenshot = async (url) => {
  const clone = document.body.querySelector('main').cloneNode(true);
  const footer = clone.querySelector('footer');
  const ol = clone.querySelector('ol');
  ol.remove();

  const computedStyle = getComputedStyle(document.documentElement);
  const mainColor = computedStyle.getPropertyValue('--main-color');
  const mainBackgroundColor = computedStyle.getPropertyValue(
    '--main-background-color',
  );
  const linkColor = computedStyle.getPropertyValue('--link-color');
  document.documentElement.style.color = mainColor;
  clone.style.color = mainColor;
  clone.style.backgroundColor = mainBackgroundColor;
  clone.querySelectorAll('a').forEach((a) => (a.style.color = linkColor));
  clone.querySelectorAll('button').forEach((button) => {
    button.style.display = 'none';
  });

  const link = footer.querySelector('a:nth-of-type(2)');
  link.textContent = CANONICAL;
  link.href = CANONICAL;
  footer.innerHTML = footer.innerHTML.replace(
    browser.i18n.getMessage('sourceCode'),
    '<br/>Install the extension from',
  );
  document.body.append(clone);
  const canvas = await html2canvas(clone, {
    backgroundColor: mainBackgroundColor,
    logging: false,
    windowWidth: 700,
  });
  clone.remove();
  blob = await fetch(canvas.toDataURL()).then((r) => r.blob());
  return blob;
};

// Receives messages from the content script.
browser.runtime.onMessage.addListener((message, sender) => {
  browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (message.type === 'return-results') {
      displayMessage(message, tab);
      setTimeout(async () => {
        blob = await createScreenshot(tab.url);
      }, 0);
      /Apple/.test(navigator.vendor)
        ? shareButton.classList.add('ios')
        : shareButton.classList.add('others');
      if ('share' in navigator) {
        downloadButton.style.display = 'none';
      } else {
        downloadButton.style.display = 'inline-block';
        ol.style.visibility = 'visible';
        // Fallback to use Twitter's Web Intent URL, as outlined in
        // https://web.dev/patterns/advanced-apps/share/.
        if (!downloadButton.dataset.eventListenerAdded) {
          downloadButton.addEventListener('click', () => {
            const a = document.createElement('a');
            a.download = 'how-fugu-is-the-web.png';
            a.style.display = 'none';
            a.href = URL.createObjectURL(blob);
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              document.body.remove(a);
              URL.revokeObjectURL(a.href);
            }, 30 * 1000);
          });
          downloadButton.dataset.eventListenerAdded = true;
        }
      }
      shareButton.style.display = 'inline-block';
    }
  });
});

// Request the results from the injected content script.
browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
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
