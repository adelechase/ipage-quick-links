// Read-only snapshot responder for extension-opened Goodreads/NetGalley background tabs.
browser.runtime.onMessage.addListener(message => {
  if(message?.type!=='quick-books-snapshot')return;
  const source=location.hostname.endsWith('goodreads.com')?'gr':'ng';
  return Promise.resolve(QuickBooks.inspect(document,location.href,source));
});
