/* Shared DOM parsing; does not execute any source-page scripts. */
(() => {
  const clean = x => String(x ?? '').replace(/\s+/g, ' ').trim();
  const norm = x => clean(x).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const titleKey = x => norm(clean(x).replace(/\s*\([^)]*#\s*\d[^)]*\)\s*$/, '').replace(/:\s*a novel\s*$/i, ''));
  function editionTitle(title) {
    // Remove explicit deluxe edition labels, preserving the rest of the title.
    const label=String.raw`(?:(?:limited|special|collector['’]?s?|collectors|illustrated)\s+)*deluxe(?:\s+(?:limited|special|collector['’]?s?|collectors|hardcover|hardback|paperback|illustrated))*(?:\s+edition)?`;
    let value=clean(title).replace(new RegExp(String.raw`\s*[\[(]\s*${label}\s*[\])]`,'gi'),'');
    const suffix=label.replace('(?:\\s+edition)?','\\s+edition');
    value=value.replace(new RegExp(String.raw`(?:\s*[:–—-]\s*|\s+)${suffix}\s*$`,'i'),'');
    return clean(value) || clean(title);
  }
  function lookupPlans(target,source) {
    const plans=[...new Set([target.isbn,target.title].filter(Boolean))].map(query=>({query,regularEdition:false}));
    const title=editionTitle(target.title);
    if(source==='gr' && target.author && titleKey(title)!==titleKey(target.title)) {
      plans.push({query:clean(title+' '+target.author),regularEdition:true});
    }
    return plans;
  }
  const authorKey = x => {
    const s=clean(x).replace(/^by\s+/i,'').replace(/\s*\(Author\)\s*$/i,'');
    return norm(s.includes(',') ? s.split(',').slice(1).join(' ')+' '+s.split(',')[0] : s).replace(/\s/g,'');
  };
  function count(x) {
    const s=clean(x); // Reject abbreviations rather than pretend they are exact counts.
    return /^\d+(?:,\d{3})*$/.test(s) ? Number(s.replaceAll(',','')) : null;
  }
  function canonical(url, source) {
    try {
      const u=new URL(url), host=source==='gr'?'goodreads.com':'netgalley.com';
      if(!['www.'+host,host].includes(u.hostname) || u.protocol!=='https:')return null;
      const m=u.pathname.match(source==='gr'?/^\/book\/show\/(\d+)(?:[.\-/]|$)/:/^\/(?:catalog\/)?book\/(\d+)(?:\/|$)/);
      return m ? `https://www.${host}/${source==='gr'?'book/show':'catalog/book'}/${m[1]}` : null;
    } catch { return null; }
  }
  function schemas(doc) {
    const out=[];
    function visit(x) {if(!x || typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return;}
      if([x['@type']].flat().some(t=>t==='Book'||t==='https://schema.org/Book'))out.push(x);
      if(x['@graph'])visit(x['@graph']);if(x.mainEntity)visit(x.mainEntity);
    }
    for(const s of doc.querySelectorAll('script[type="application/ld+json"]'))try{visit(JSON.parse(s.textContent));}catch{}
    return out;
  }
  function identity(doc) {
    const title=clean(doc.querySelector('#pd-title')?.textContent);
    const section=doc.querySelector('#pd-title')?.closest('td');
    const authors=[...(section?.querySelectorAll('a.doContributorSearch') || [])].filter(a=>/^\s*\(Author\)/i.test(a.nextSibling?.textContent || '')).map(a=>clean(a.textContent));
    const isbn=doc.querySelector('.pdImage[pd-ean]')?.getAttribute('pd-ean') || clean(doc.querySelector('#pd-product-id')?.textContent);
    return {title,author:authors[0] || '',isbn:/^(?:\d{13}|\d{9}[\dX])$/.test(isbn || '')?isbn:''};
  }
  function separatedText(el) {
    if(!el)return '';
    const walker=el.ownerDocument.createTreeWalker(el,4), parts=[];
    while(walker.nextNode())parts.push(walker.currentNode.textContent);
    return clean(parts.join(' '));
  }
  function book(doc,url,source) {
    const direct=canonical(url,source);if(!direct)return null;
    const schema=schemas(doc)[0] || {};
    const primary=doc.querySelector(source==='gr'?'h1[data-testid="bookTitle"], h1#bookTitle':'h1[itemprop="name"]');
    const meta=doc.querySelector('meta[property="og:title"],meta[name="og:title"]')?.content;
    const title=clean(primary?.textContent || schema.name || meta);
    let authors=[schema.author || []].flat().map(x=>typeof x==='string'?x:x?.name).filter(Boolean);
    if(!authors.length)authors=[...doc.querySelectorAll(source==='gr'?'.BookPageMetadataSection .ContributorLink__name, .BookPageTitleSection .ContributorLink__name, .authorName span[itemprop="name"], #bookAuthors .authorName':'[itemprop="author"] [itemprop="name"]')].map(x=>clean(x.textContent));
    const isbns=[schema.isbn,...doc.querySelectorAll('[itemprop="isbn"]')].map(x=>typeof x==='string'?x:x?.content || x?.textContent).filter(Boolean).map(x=>x.replace(/[-\s]/g,''));
    if(source==='ng') { // NG's own title metadata includes ISBN, unlike recommendation cards.
      const m=doc.title.match(/\|\s*(\d{13}|\d{9}[\dX])\s*\|\s*NetGalley/i);if(m)isbns.push(m[1]);
      if(!authors.length)authors=doc.title.split('|').slice(1,2).map(clean);
    }
    const stats=doc.querySelector('.RatingStatistics'), aggregate=schema.aggregateRating || {};
    const statText=separatedText(stats);
    const numeric=/(?<![\d.,])(\d[\d,]*)\s+ratings?\b/i.exec(statText), review=/(?<![\d.,])(\d[\d,]*)\s+reviews?\b/i.exec(statText);
    const ratingRaw=clean(doc.querySelector('.RatingStatistics__rating')?.textContent || aggregate.ratingValue);
    const rating=ratingRaw!=='' && Number.isFinite(Number(ratingRaw)) && Number(ratingRaw)>=0 && Number(ratingRaw)<=5 ? Number(ratingRaw):null;
    let want=null;
    // Only main-book social statistics; never review prose or recommended books.
    const social=[...doc.querySelectorAll('.SocialSignalsSection, [data-testid="socialSignals"], .BookPageMetadataSection')];
    for(const el of social){const m=separatedText(el).match(/(?:^|\s)(\d[\d,]*)\s+(?:people\s+)?want(?:s)?\s+to\s+read\b/i);if(m){want=count(m[1]);break;}}
    return {url:direct,title,authors,isbns,rating,ratings:count(numeric?.[1] ?? aggregate.ratingCount),reviews:count(review?.[1] ?? aggregate.reviewCount),want};
  }
  function candidates(doc,url,source) {
    const out=new Map();
    for(const a of doc.querySelectorAll(source==='gr'?'a.bookTitle[href], a[href*="/book/show/"]':'a[href*="/catalog/book/"]')) {
      const link=canonical(new URL(a.getAttribute('href'),url).href,source);if(!link)continue;
      const title=clean(a.querySelector('[itemprop="name"]')?.textContent || a.textContent || a.querySelector('img')?.alt?.replace(/^book cover for\s+/i,''));
      if(!title)continue;
      const container=a.closest('tr, [itemtype*="schema.org/Book"], .book-details');
      const authors=[...(container?.querySelectorAll('.authorName, [itemprop="author"]') || [])].map(x=>clean(x.textContent));
      if(!out.has(link) || a.matches('.bookTitle, [itemprop="name"]'))out.set(link,{url:link,title,authors});
    }
    return [...out.values()].slice(0,60);
  }
  function score(target,found,regularEdition=false) {
    if(!found || !found.title)return 0;
    if(target.isbn && found.isbns?.includes(target.isbn))return 100;
    const key=title=>titleKey(regularEdition?editionTitle(title):title);
    if(!target.title || !target.author || key(target.title)!==key(found.title))return 0;
    return found.authors?.some(a=>authorKey(a)===authorKey(target.author))?80:0;
  }
  function inspect(doc,url,source) {
    const title=clean(doc.title);
    const blocked=/just a moment|access denied|robot check|verify you are human|captcha/i.test(title) || !!doc.querySelector('#challenge-form, #captcha, form[action*="captcha"]');
    return {blocked,book:book(doc,url,source),candidates:candidates(doc,url,source)};
  }
  const format=x=>x==null?'unavailable':Number(x).toLocaleString('en-US');
  function line(gr) {
    const rating=gr?.rating==null?'unavailable':`${gr.rating<3?'NR: ':''}${gr.rating.toFixed(2)}`;
    return `${rating} GR; ${format(gr?.ratings)}rat; ${format(gr?.reviews)}rev; ${format(gr?.want)}wtr; `;
  }
  globalThis.QuickBooks={clean,norm,titleKey,editionTitle,lookupPlans,authorKey,count,canonical,identity,book,candidates,score,inspect,line};
})();
