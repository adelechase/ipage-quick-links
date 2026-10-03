(() => {
  const Q=QuickBooks;let state=null,scheduled=false;
  function scan() {
    const notes=document.getElementById('add-to-sl-note-gb'),book=Q.identity(document);
    if(!notes || !book.title || (!book.author && !book.isbn)){if(state){state.host.remove();state=null;}return;}
    const key=JSON.stringify(book);
    if(state?.key===key && state.notes===notes && state.host.isConnected)return;
    if(state)state.host.remove();
    const host=document.createElement('div');host.id='ipage-quick-links';
    const shadow=host.attachShadow({mode:'open'});
    const style=document.createElement('style');style.textContent=':host{display:block;margin:8px 0}section{font:13px/1.5 Arial,sans-serif;color:#222;background:#fff;border:1px solid #aaa;border-radius:4px;padding:8px;overflow-wrap:anywhere}a{color:#0645ad}button{margin-top:5px;font:11px Arial;cursor:pointer}';shadow.append(style);
    const panel=document.createElement('section'),text=document.createElement('span'),retry=document.createElement('button');
    text.setAttribute('role','status');text.setAttribute('aria-live','polite');retry.textContent='Refresh';retry.type='button';
    panel.append(text,document.createElement('br'),retry);shadow.append(panel);
    const label=notes.closest('td')?.querySelector('strong');
    const anchor=label && /^Notes\s*:?$/.test(label.textContent.trim())?label:notes;
    anchor.before(host);
    const current={key,notes,host};state=current;
    function link(url,source){const a=document.createElement('a');a.href=Q.canonical(url,source);a.textContent=a.href;a.target='_blank';a.rel='noopener noreferrer';text.append(a);}
    async function load(refresh=false) {
      retry.disabled=true;text.textContent='GR / NG: looking up this book…';
      try {
        const data=await browser.runtime.sendMessage({type:'quick-books-lookup',book,refresh});
        if(state!==current || !host.isConnected || JSON.stringify(Q.identity(document))!==key)return;
        text.replaceChildren(document.createTextNode(Q.line(data.gr)));
        if(Q.canonical(data.gr?.url,'gr'))link(data.gr.url,'gr');else text.append('GR link unavailable');
        text.append('; ');
        if(Q.canonical(data.ng?.url,'ng'))link(data.ng.url,'ng');else text.append('NG link unavailable');
        panel.title=`${book.title} — ${book.author}\nGR: ${data.gr.status}\nNG: ${data.ng.status}\nMissing counts are unavailable, not zero.`;
      } catch(e){if(state===current)text.textContent='GR / NG: unavailable — '+e.message;}
      finally{retry.disabled=false;}
    }
    retry.onclick=()=>load(true);load();
  }
  scan();
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;scan();},300);}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['pd-ean']});
})();
