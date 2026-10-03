// Read-only fallback for the extension's temporary source tabs.
browser.runtime.onMessage.addListener(message => {
  if(message?.type!=='quick-books-snapshot')return;
  const source=location.hostname.endsWith('goodreads.com')?'gr':'ng';
  return Promise.resolve(QuickBooks.inspect(document,location.href,source));
});
