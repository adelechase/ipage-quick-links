(() => {
  const Q=QuickBooks,session=crypto.randomUUID();let state=null,scheduled=false,sourceTabs={gr:null,ng:null},request=0;
  const normalizeTabs=tabs=>({gr:Number.isInteger(tabs?.gr)?tabs.gr:null,ng:Number.isInteger(tabs?.ng)?tabs.ng:null});
  const hasTabs=()=>Number.isInteger(sourceTabs.gr) || Number.isInteger(sourceTabs.ng);
  async function closeSources() {
    const id=++request; // Ignore a lookup reply that arrives after Update or Close.
    const result=await browser.runtime.sendMessage({type:'quick-books-close-tabs',session,tabs:sourceTabs});
    if(id===request){sourceTabs={gr:null,ng:null};state?.stopped();}
    return result;
  }
  document.addEventListener('click',event=>{
    const update=event.target.closest?.('a.doPdPost[pd-path-state="selReturnUrl"]');
    if(!update || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
    // Recognize the selection-list Update, never an order or another form action.
    if(![...update.attributes].some(a=>/^pd-append-selector-\d+$/.test(a.name) && a.value==='#add-to-sl-note-gb'))return;
    const original=update.getAttribute('href');
    let action;try{action=new URL(original,location.href);}catch{return;}
    if(action.origin!==location.origin || action.pathname!=='/ipage/customer/selectionlist/or2200.action')return;
    const next=[...document.querySelectorAll('a.doPdLink[href]')].find(a=>/^next product in list\b/i.test(a.textContent.trim()));
    if(next) {
      try {
        const url=new URL(next.getAttribute('href'),location.href);
        if(url.origin===location.origin && url.pathname==='/ipage/productdetail' && url.searchParams.has('listID') && url.searchParams.has('R')) {
          // iPage copies this query parameter into its native POST, overriding
          // the current-page return URL. The server handles navigation after save.
          // Keep percent-encoding: iPage's parser does not decode '+' as a space.
          const parts=original.split('?'),params=(parts[1] || '').split('&').filter(p=>p && p.split('=')[0]!=='selReturnUrl');
          params.push('selReturnUrl='+encodeURIComponent(url.pathname+url.search));
          update.setAttribute('href',parts[0]+'?'+params.join('&'));
          setTimeout(()=>update.setAttribute('href',original),0);
        }
      }catch{}
    }
    // Do not cancel the click: iPage keeps its own validation and save handler.
    closeSources().catch(()=>{});
  },true);
  function scan() {
    const notes=document.getElementById('add-to-sl-note-gb'),book=Q.identity(document);
    if(!notes || !book.title || (!book.author && !book.isbn)){if(state){state.host.remove();state=null;}return;}
    const key=JSON.stringify(book);
    if(state?.key===key && state.notes===notes && state.host.isConnected)return;
    if(state)state.host.remove();
    const host=document.createElement('div');host.id='ipage-quick-links';
    const shadow=host.attachShadow({mode:'open'});
    const style=document.createElement('style');style.textContent=':host{display:block;margin:8px 0}section{font:13px/1.5 Arial,sans-serif;color:#222;background:#fff;border:1px solid #aaa;border-radius:4px;padding:8px;overflow-wrap:anywhere}a{color:#0645ad}button{margin-top:5px;font:11px Arial;cursor:pointer}button+button{margin-left:6px}';shadow.append(style);
    const panel=document.createElement('section'),text=document.createElement('span'),hint=document.createElement('small'),retry=document.createElement('button'),close=document.createElement('button');
    hint.style.display='block';
    text.setAttribute('role','status');text.setAttribute('aria-live','polite');retry.textContent='Refresh';retry.type='button';close.textContent='Close GR/NG tabs';close.type='button';close.disabled=!hasTabs();
    panel.append(text,hint,document.createElement('br'),retry,close);shadow.append(panel);
    const label=notes.closest('td')?.querySelector('strong');
    const anchor=label && /^Notes\s*:?$/.test(label.textContent.trim())?label:notes;
    anchor.before(host);
    const current={key,notes,host,stopped:()=>{close.disabled=true;retry.disabled=false;if(loading)text.textContent='GR / NG: lookup stopped. Use Refresh to try again.';loading=false;}};state=current;
    let loading=false;
    function link(url,source){const a=document.createElement('a');a.href=Q.canonical(url,source);a.textContent=a.href;a.target='_blank';a.rel='noopener noreferrer';text.append(a);}
    async function load(refresh=false) {
      const id=++request;loading=true;retry.disabled=true;close.disabled=false;hint.textContent='';text.textContent='GR / NG: looking up this book…';
      try {
        const data=await browser.runtime.sendMessage({type:'quick-books-lookup',session,book,refresh,tabs:sourceTabs});
        if(id!==request || state!==current || !host.isConnected || JSON.stringify(Q.identity(document))!==key)return;
        if(data?.cancelled){current.stopped();return;}
        sourceTabs=normalizeTabs(data?.tabs);
        close.disabled=!hasTabs();close.title='';
        text.replaceChildren(document.createTextNode(Q.line(data.gr)));
        if(Q.canonical(data.gr?.url,'gr'))link(data.gr.url,'gr');else text.append('GR link unavailable');
        text.append('; ');
        if(Q.canonical(data.ng?.url,'ng'))link(data.ng.url,'ng');else text.append('NG link unavailable');
        hint.textContent=data.gr?.want==null?(data.gr?.wantStatus || ''):'';
        panel.title=`${book.title} — ${book.author}\nGR: ${data.gr.status}\nNG: ${data.ng.status}\nMissing counts are unavailable, not zero.`;
      } catch(e){if(id===request && state===current)text.textContent='GR / NG: unavailable — '+e.message;}
      finally{if(id===request){loading=false;retry.disabled=false;close.disabled=!hasTabs();}}
    }
    close.onclick=async()=>{
      close.disabled=true;close.title='';
      try {
        await closeSources();
      } catch(e) {
        close.title='Could not close the source tabs: '+e.message;
      } finally {
        if(state===current && host.isConnected)close.disabled=!hasTabs();
      }
    };
    retry.onclick=()=>load(true);load();
  }
  scan();
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;scan();},300);}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['pd-ean']});
})();
