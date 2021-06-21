// Only execute once.
if (typeof lastMessage === 'undefined') {
  // Make sure this extension works universally.
  self.browser = self.browser || self.chrome;

  // Caches the last message.
  let lastMessage;

  // Either stores the last message or retrieves it.
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'store-results') {
      lastMessage = message.data;
    } else if (message.type === 'request-results') {
      browser.runtime.sendMessage({
        type: 'return-results',
        data: lastMessage,
      });
    }
  });
}
