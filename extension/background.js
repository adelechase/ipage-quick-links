(() => {
  const Q=QuickBooks, inflight=new Map();let queue=Promise.resolve();
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function allowed(url,source) {const u=new URL(url);return u.protocol==='https:' && (source==='gr'?['goodreads.com','www.goodreads.com']:['netgalley.com','www.netgalley.com']).includes(u.hostname);}
  function searchUrl(target,source) {const query=target.isbn || target.title;return source==='gr'?`https://www.goodreads.com/search?q=${encodeURIComponent(query)}&search_type=books`:`https://www.netgalley.com/catalog/?text=${encodeURIComponent(query)}`;}
  function workspace(seed={}) {
    const tabs={gr:Number.isInteger(seed?.gr)?seed.gr:null,ng:Number.isInteger(seed?.ng)?seed.ng:null};
    return {
      ids:()=>({...tabs}),
      async show(url,source) {
        if(!allowed(url,source))throw Error('Unsupported source URL.');
        if(Number.isInteger(tabs[source])) {
          try {const tab=await browser.tabs.update(tabs[source],{url});return tab;}catch{}
        }
        const tab=await browser.tabs.create({url,active:false});tabs[source]=tab.id;return tab;
      }
    };
  }
  async function closeTabs(tabs) {
    const ids=[...new Set(['gr','ng'].map(source=>tabs?.[source]).filter(Number.isInteger))];
    for(const id of ids)await browser.tabs.remove(id).catch(()=>{});
    return {closed:ids.length,tabs:{gr:null,ng:null}};
  }
  async function tabRead(url,source,space) {
    const tab=await space.show(url,source);
    let latest=null;
    for(let i=0;i<20;i++) {
      await pause(1000);
      try {latest=await browser.tabs.sendMessage(tab.id,{type:'quick-books-snapshot'});}catch{continue;}
      if(latest.blocked)throw Error('Website verification required; lookup unavailable.');
      if(latest.book?.title && (source==='ng' || latest.book.authors.length)) {
        if(i<3)continue; // Allow client-rendered social counts to arrive.
        return latest;
      }
      if(latest.candidates.length && i>=2)return latest;
    }
    if(latest && !latest.book)return latest;
    throw Error('Page could not be read (sign-in, layout, or loading issue).');
  }
  async function read(url,source,space) {
    if(!allowed(url,source))throw Error('Unsupported source URL.');
    let parsed;
    try {
      const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
      let response;
      try{response=await fetch(url,{credentials:'include',signal:controller.signal});}finally{clearTimeout(timer);}
      if(response.status===429)throw Error('RATE_LIMIT');
      if(response.status===403)throw Error('BLOCKED');
      if(response.ok && allowed(response.url,source)) {
        const html=await response.text();
        parsed=Q.inspect(new DOMParser().parseFromString(html,'text/html'),response.url,source);
        if(parsed.blocked)throw Error('BLOCKED');
        if(parsed.book?.title && parsed.book.authors.length && (source==='ng' || parsed.book.want!==null))return parsed;
        if(!Q.canonical(url,source) && parsed.candidates.length)return parsed;
      }
    } catch(e) {
      if(e.message==='RATE_LIMIT')throw Error('Site rate limit; try again later.');
      if(e.message==='BLOCKED')throw Error('Site blocked automated access; lookup unavailable.');
    }
    try{return await tabRead(url,source,space);}catch(e){if(parsed?.book?.title && parsed.book.authors.length)return parsed;throw e;}
  }
  async function lookup(target,source,space) {
    const errors=[],seen=new Set();
    // ISBN first. Title fallback covers editions and NetGalley format differences.
    for(const query of [...new Set([target.isbn,target.title].filter(Boolean))]) {
      const url=source==='gr'?`https://www.goodreads.com/search?q=${encodeURIComponent(query)}&search_type=books`:`https://www.netgalley.com/catalog/?text=${encodeURIComponent(query)}`;
      let page;
      try{page=await read(url,source,space);}catch(e){errors.push(e.message);if(/blocked|rate limit|verification/i.test(e.message))break;continue;}
      if(page.book && Q.score(target,page.book))return {...page.book,status:'matched'};
      const candidates=page.candidates.filter(c=>Q.titleKey(c.title)===Q.titleKey(target.title));
      // Fetch candidate detail pages to verify the author/ISBN. Never return a search URL.
      const verified=[];
      for(const candidate of candidates.slice(0,4)) {
        if(seen.has(candidate.url))continue;seen.add(candidate.url);
        await pause(800);
        try {const detail=(await read(candidate.url,source,space)).book,s=Q.score(target,detail);if(s)verified.push({...detail,score:s});}catch(e){errors.push(e.message);}
      }
      if(verified.length) {
        verified.sort((a,b)=>b.score-a.score || (b.ratings??-1)-(a.ratings??-1) || a.url.localeCompare(b.url));
        return {...verified[0],status:'matched'};
      }
    }
    return {status:errors.length?errors.join(' '):'No reliable match found.',url:null};
  }
  async function reveal(book,result,space) {
    for(const source of ['gr','ng']) {
      const url=Q.canonical(result?.[source]?.url,source) || searchUrl(book,source);
      try{await space.show(url,source);}catch{}
    }
  }
  async function research(book,refresh,space,owner) {
    const key='quick-v1:'+JSON.stringify([book.isbn,Q.titleKey(book.title),Q.authorKey(book.author)]), inflightKey=owner+':'+key;
    if(inflight.has(inflightKey))return inflight.get(inflightKey);
    const work=(async()=>{
      if(!refresh){
        const saved=(await browser.storage.local.get(key))[key];
        if(saved && Date.now()-saved.at<saved.ttl){await reveal(book,saved,space);return {...saved,tabs:space.ids()};}
      }
      const run=async()=>{
        const gr=await lookup(book,'gr',space), ng=await lookup(book,'ng',space);
        const result={gr,ng,at:Date.now(),ttl:gr.url && ng.url?6*60*60*1000:5*60*1000};
        await browser.storage.local.set({[key]:result});return result;
      };
      const task=queue.then(run,run);queue=task.catch(()=>{});
      const result=await task;await reveal(book,result,space);return {...result,tabs:space.ids()};
    })();
    inflight.set(inflightKey,work);try{return await work;}finally{inflight.delete(inflightKey);}
  }
  browser.runtime.onMessage.addListener((m,sender)=>{
    if(sender.id!==browser.runtime.id || !sender.url?.startsWith('https://ipage.ingramcontent.com/'))return;
    if(m?.type==='quick-books-close-tabs')return closeTabs(m.tabs);
    if(m?.type!=='quick-books-lookup')return;
    const b=m.book;if(!b || typeof b.title!=='string' || !b.title.trim() || b.title.length>500 || typeof b.author!=='string' || b.author.length>300 || !/^(?:\d{13}|\d{9}[\dX]|)$/.test(b.isbn))return Promise.reject(Error('Could not identify this book.'));
    const space=workspace(m.tabs),owner=Number.isInteger(sender.tab?.id)?sender.tab.id:'ipage';
    return research({title:b.title,author:b.author,isbn:b.isbn},m.refresh===true,space,owner);
  });
})();
