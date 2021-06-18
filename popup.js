self.browser = self.browser || self.chrome;

import patternsFunc from './patternsFunc.js';

const supported = await patternsFunc();

const ul = document.querySelector('ul');

browser.runtime.onMessage.addListener(async (message) => {
  browser.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const url = tabs[0].url;
    ul.innerHTML = '';
    for (const [key, values] of message) {
      const li = document.createElement('li');
      ul.append(li);
      const h2 = document.createElement('h2');
      h2.textContent = key;
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
      values.forEach(async (value) => {
        const nestedLi = document.createElement('li');
        nestedUl.append(nestedLi);
        const a = document.createElement('a');
        nestedLi.append(a);
        a.href = value.url;
        const tabOrigin = new URL(url).origin;
        const resourceURL = new URL(value.url);
        a.textContent =
          tabOrigin === resourceURL.origin
            ? resourceURL.pathname + resourceURL.search
            : value.url;
      });
    }
  });
});

browser.runtime.sendMessage({ message: 'request-results' });
