(() => {
  const Q=QuickBooks, inflight=new Map(),owners=new Map();let queue=Promise.resolve(),serial=0;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function allowed(url,source) {const u=new URL(url);return u.protocol==='https:' && (source==='gr'?['goodreads.com','www.goodreads.com']:['netgalley.com','www.netgalley.com']).includes(u.hostname);}
  function searchUrl(target,source) {const query=target.isbn || target.title;return source==='gr'?`https://www.goodreads.com/search?q=${encodeURIComponent(query)}&search_type=books`:`https://www.netgalley.com/catalog/?text=${encodeURIComponent(query)}`;}
  function workspace(seed={}) {
    const tabs={gr:Number.isInteger(seed?.gr)?seed.gr:null,ng:Number.isInteger(seed?.ng)?seed.ng:null};
    const controllers=new Set(),privateTabs=new Set();let closed=false;
    const guard=()=>{if(closed)throw Error('Lookup closed.');};
    return {
      token:++serial,controllers,privateTabs,guard,isClosed:()=>closed,
      ids:()=>({...tabs}),
      async close() {
        closed=true;for(const controller of controllers)controller.abort();
        const old={...tabs};tabs.gr=null;tabs.ng=null;
        for(const id of privateTabs)await browser.tabs.remove(id).catch(()=>{});
        privateTabs.clear();
        return closeTabs(old);
      },
      async show(url,source) {
        guard();
        if(!allowed(url,source))throw Error('Unsupported source URL.');
        if(Number.isInteger(tabs[source])) {
          try {const tab=await browser.tabs.update(tabs[source],{url});guard();return tab;}catch{guard();}
        }
        const tab=await browser.tabs.create({url,active:false});
        // Close may arrive while Firefox is still creating the source tab.
        if(closed){await browser.tabs.remove(tab.id).catch(()=>{});guard();}
        tabs[source]=tab.id;return tab;
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
      space.guard();
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
    space.guard();
    if(!allowed(url,source))throw Error('Unsupported source URL.');
    let parsed;
    try {
      const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
      space.controllers.add(controller);
      let response;
      try{response=await fetch(url,{credentials:'include',signal:controller.signal});}finally{clearTimeout(timer);space.controllers.delete(controller);}
      space.guard();
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
      space.guard();
      if(e.message==='RATE_LIMIT')throw Error('Site rate limit; try again later.');
      if(e.message==='BLOCKED')throw Error('Site blocked automated access; lookup unavailable.');
    }
    try{return await tabRead(url,source,space);}catch(e){space.guard();if(parsed?.book?.title && parsed.book.authors.length)return parsed;throw e;}
  }
  async function lookup(target,source,space) {
    const errors=[],seen=new Set();
    // ISBN, exact title, regular edition, then Goodreads title before ':' + author.
    for(const {query,regularEdition,shortTitle=false} of Q.lookupPlans(target,source)) {
      space.guard();
      const matchKey=title=>Q.matchTitle(title,regularEdition,shortTitle);
      const url=source==='gr'?`https://www.goodreads.com/search?q=${encodeURIComponent(query)}&search_type=books`:`https://www.netgalley.com/catalog/?text=${encodeURIComponent(query)}`;
      let page;
      try{page=await read(url,source,space);space.guard();}catch(e){space.guard();errors.push(e.message);if(/blocked|rate limit|verification/i.test(e.message))break;continue;}
      if(page.book && Q.score(target,page.book,regularEdition,shortTitle))return {...page.book,status:'matched'};
      const candidates=page.candidates.filter(c=>matchKey(c.title)===matchKey(target.title));
      // Fetch candidate detail pages to verify the author/ISBN. Never return a search URL.
      const verified=[];
      for(const candidate of candidates.slice(0,4)) {
        const candidateKey=regularEdition+':'+shortTitle+':'+candidate.url;
        if(seen.has(candidateKey))continue;seen.add(candidateKey);
        await pause(800);
        try {const detail=(await read(candidate.url,source,space)).book,s=Q.score(target,detail,regularEdition,shortTitle);space.guard();if(s)verified.push({...detail,score:s});}catch(e){space.guard();errors.push(e.message);}
      }
      if(verified.length) {
        verified.sort((a,b)=>b.score-a.score || (b.ratings??-1)-(a.ratings??-1) || a.url.localeCompare(b.url));
        return {...verified[0],status:'matched'};
      }
    }
    return {status:errors.length?errors.join(' '):'No reliable match found.',url:null};
  }
  const exactCount=value=>Number.isSafeInteger(value) && value>=0;
  function publicWant(snapshot,url) {
    // Copy only the public count, and only from the exact matched Goodreads page.
    const book=snapshot?.book;
    return Q.canonical(book?.url,'gr')===url && exactCount(book?.want)?book.want:null;
  }
  async function anonymousWant(url,space) {
    space.guard();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    space.controllers.add(controller);
    try {
      const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:controller.signal});
      space.guard();
      if(response.status===403 || response.status===429)return {stop:true,status:'Goodreads restricted the logged-out count request; try again later.'};
      if(!response.ok || Q.canonical(response.url,'gr')!==url)return {};
      const html=await response.text();space.guard();
      const snapshot=Q.inspect(new DOMParser().parseFromString(html,'text/html'),response.url,'gr');
      if(snapshot.blocked)return {stop:true,status:'Goodreads requires verification; want-to-read count unavailable.'};
      return {want:publicWant(snapshot,url)};
    }catch{space.guard();return {};}
    finally{clearTimeout(timer);space.controllers.delete(controller);}
  }
  async function privateWant(url,space) {
    space.guard();
    const permitted=await browser.extension.isAllowedIncognitoAccess();space.guard();
    if(!permitted)return {status:'For the missing want-to-read count, enable Run in Private Windows for this extension, then Refresh.'};
    let tab;
    try {
      // Firefox cannot hide an active/only tab. Use a minimized private window;
      // do not reuse or alter any private windows the user already has open.
      const win=await browser.windows.create({url,incognito:true,focused:false,state:'minimized'});
      tab=win.tabs?.[0];
      if(Number.isInteger(tab?.id))space.privateTabs.add(tab.id);
      space.guard();
      if(!Number.isInteger(tab?.id) || !win.incognito)throw Error('Private window unavailable.');
      for(let i=0;i<20;i++) {
        await pause(1000);space.guard();
        let snapshot;
        try{snapshot=await browser.tabs.sendMessage(tab.id,{type:'quick-books-snapshot'});}catch{continue;}
        space.guard();
        if(snapshot?.blocked)return {status:'Goodreads requires verification; want-to-read count unavailable.'};
        const want=publicWant(snapshot,url);
        if(want!==null)return {want};
      }
      return {status:'Goodreads did not expose a total want-to-read count in the private page.'};
    }finally {
      // Removing our tab closes the window if it is still its only tab. Never
      // remove the entire window: the user may have added another tab to it.
      if(Number.isInteger(tab?.id)){space.privateTabs.delete(tab.id);await browser.tabs.remove(tab.id).catch(()=>{});}
    }
  }
  async function fillWant(gr,space) {
    const url=Q.canonical(gr?.url,'gr');
    if(!url || exactCount(gr.want))return gr;
    const anonymous=await anonymousWant(url,space);
    if(exactCount(anonymous.want))return {...gr,want:anonymous.want};
    if(anonymous.stop)return {...gr,wantStatus:anonymous.status};
    try {
      const result=await privateWant(url,space);
      return exactCount(result.want)?{...gr,want:result.want}:{...gr,wantStatus:result.status};
    }catch{space.guard();return {...gr,wantStatus:'The private Goodreads count lookup could not finish. Try Refresh.'};}
  }
  async function reveal(book,result,space) {
    for(const source of ['gr','ng']) {
      const url=Q.canonical(result?.[source]?.url,source) || searchUrl(book,source);
      try{await space.show(url,source);}catch{space.guard();}
    }
  }
  async function research(book,refresh,space) {
    const key='quick-v3:'+JSON.stringify([book.isbn,Q.titleKey(book.title),Q.authorKey(book.author)]), inflightKey=space.token+':'+key;
    if(inflight.has(inflightKey))return inflight.get(inflightKey);
    const work=(async()=>{
      if(!refresh){
        const saved=(await browser.storage.local.get(key))[key];
        space.guard();
        if(saved && Date.now()-saved.at<saved.ttl){await reveal(book,saved,space);return {...saved,tabs:space.ids()};}
      }
      const run=async()=>{
        space.guard();
        const gr=await fillWant(await lookup(book,'gr',space),space), ng=await lookup(book,'ng',space);
        space.guard();
        const result={gr,ng,at:Date.now(),ttl:gr.url && ng.url && exactCount(gr.want)?6*60*60*1000:5*60*1000};
        await browser.storage.local.set({[key]:result});return result;
      };
      const task=queue.then(run,run);queue=task.catch(()=>{});
      const result=await task;await reveal(book,result,space);return {...result,tabs:space.ids()};
    })();
    inflight.set(inflightKey,work);try{return await work;}catch(e){if(space.isClosed())return {cancelled:true,tabs:space.ids()};throw e;}finally{inflight.delete(inflightKey);}
  }
  browser.runtime.onMessage.addListener((m,sender)=>{
    if(sender.id!==browser.runtime.id || !sender.url?.startsWith('https://ipage.ingramcontent.com/'))return;
    if(!Number.isInteger(sender.tab?.id) || typeof m?.session!=='string' || m.session.length>100)return;
    const owner=sender.tab.id,prior=owners.get(owner);
    if(m.type==='quick-books-close-tabs') {
      // An old document's late close must never close the next book's tabs.
      if(prior)return prior.session===m.session?prior.space.close():Promise.resolve({closed:0});
      const space=workspace(m.tabs);owners.set(owner,{session:m.session,space});return space.close();
    }
    if(m?.type!=='quick-books-lookup')return;
    const b=m.book;if(!b || typeof b.title!=='string' || !b.title.trim() || b.title.length>500 || typeof b.author!=='string' || b.author.length>300 || !/^(?:\d{13}|\d{9}[\dX]|)$/.test(b.isbn))return Promise.reject(Error('Could not identify this book.'));
    let space=prior?.space;
    if(!space || prior.session!==m.session || space.isClosed()) {
      if(space)space.close().catch(()=>{});
      space=workspace(prior?{}:m.tabs);owners.set(owner,{session:m.session,space});
    }
    return research({title:b.title,author:b.author,isbn:b.isbn},m.refresh===true,space);
  });
  browser.tabs.onRemoved.addListener(id=>{const entry=owners.get(id);if(entry){owners.delete(id);entry.space.close().catch(()=>{});}});
})();
