self.browser = self.browser || self.chrome;

import patternsFunc from './patternsFunc.js';

const ul = document.querySelector('ul');

const supported = await patternsFunc();

const displayMessage = (message) => {
  browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
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
        ? '<span class="emoji">✔️</span> Supported in your browser.'
        : supported[key] === undefined
        ? '<span class="emoji">🤷</span> Support unknown for your browser.'
        : '<span class="emoji">🚫</span> Not supported in your browser.';
      const nestedUl = document.createElement('ul');
      nestedUl.classList.add('nested');
      li.append(nestedUl);
      values.forEach((value) => {
        const nestedLi = document.createElement('li');
        nestedUl.append(nestedLi);
        const a = document.createElement('a');
        nestedLi.append(a);
        a.href = `${value.url}#:~:text=${encodeURIComponent(
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
  });
};

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'return-results') {
    displayMessage(message);
  }
});

browser.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  browser.runtime.sendMessage({ type: 'request-results', data: tab.url });
});
