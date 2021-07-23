// Only execute once.
if (typeof lastMessage === 'undefined') {
  // Make sure this extension works universally.
  self.browser = self.browser || self.chrome;

  // Caches the last message.
  let lastMessage;

  // Either stores the last message or retrieves it.
  browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'store-results') {
      lastMessage = message.data;
    } else if (message.type === 'request-results') {
      browser.runtime.sendMessage({
        type: 'return-results',
        data: lastMessage,
      });
    } else if (message.type === 'share-results') {
      const shareTextOnly = async (shareData) => {
        try {
          await navigator.share?.(shareData);
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error(err.name, err.message);
          }
        }
      };

      const share = async (shareData) => {
        const actuallyShare = async () => {
          document.removeEventListener('pointermove', actuallyShare);
          if (!navigator.canShare?.(shareData)) {
            return shareTextOnly(shareData);
          }
          try {
            await navigator.share?.(shareData);
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error(err.name, err.message);
              delete shareData.files;
              shareTextOnly(shareData);
            }
          }
        };
        window.focus();
        document.addEventListener('pointermove', actuallyShare);
      };

      const shareData = message.data;
      const blob = await fetch(shareData.dataURL).then((r) => r.blob());
      const files = [
        new File([blob], 'howfuguismybrowser.png', { type: blob.type }),
      ];
      shareData.files = files;
      delete shareData.dataURL;
      share(shareData);
    }
  });
}
