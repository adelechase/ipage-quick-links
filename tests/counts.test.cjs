const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../extension'),grUrl='https://www.goodreads.com/book/show/101',ngUrl='https://www.netgalley.com/catalog/book/202';
const book={title:'Dangerous Ground',author:'Alice Henderson',isbn:''};
const detail=(source,want=null)=>({title:book.title,authors:[book.author],isbns:[],rating:4.1,ratings:200,reviews:30,want,url:source==='gr'?grUrl:ngUrl});
const snapshot=(source,want=null)=>({blocked:false,book:detail(source,want),candidates:[]});
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,1));}assert.ok(fn(),'expected async operation started');}
function harness(options={}) {
 let listener,next=10,releasePrivate,anonymousStarted=false,aborted=false;
 const tabs=new Map(),requests=[],windows=[],removed=[],saved=[];
 const signedWant=options.signedWant??null;
 const browser={runtime:{id:'test',onMessage:{addListener:f=>listener=f}},storage:{local:{get:async()=>({}),set:async r=>saved.push(r)}},extension:{isAllowedIncognitoAccess:async()=>options.allowed!==false},windows:{create:async data=>{
  windows.push(data);if(options.windowError)throw Error('Cannot open window');
  const tab={id:++next,url:data.url,incognito:true};tabs.set(tab.id,tab);
  if(options.holdPrivate)await new Promise(r=>releasePrivate=r);
  return {id:50,incognito:true,tabs:[tab]};
 }},tabs:{create:async data=>{const t={id:++next,...data};tabs.set(t.id,t);return t;},update:async(id,data)=>{if(!tabs.has(id))throw Error('Missing tab');return Object.assign(tabs.get(id),data);},remove:async id=>{removed.push(id);tabs.delete(id);},onRemoved:{addListener:()=>{}},sendMessage:async id=>{
  const t=tabs.get(id);if(!t)throw Error('Missing tab');
  if(t.incognito){if(options.privateError)throw Error('No reader');const s=snapshot('gr',options.privateWant??4321);if(options.wrongPrivate)s.book.url='https://www.goodreads.com/book/show/999';if(options.privateBlocked)s.blocked=true;return s;}
  return snapshot(t.url.includes('goodreads')?'gr':'ng',signedWant);
 }}};
 const ctx=vm.createContext({URL,AbortController,browser,setTimeout:(f,ms)=>setTimeout(f,[800,1000].includes(ms)?0:ms),clearTimeout,DOMParser:class{parseFromString(s){return JSON.parse(s);}}});
 ctx.fetch=async(url,init)=>{
  requests.push({url,...init});const source=url.includes('goodreads')?'gr':'ng';let data;
  if(init.credentials==='omit'){
   anonymousStarted=true;
   if(options.holdAnonymous)await new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{aborted=true;reject(Error('Cancelled'));},{once:true}));
   data=snapshot('gr',options.anonymousWant??null);if(options.wrongAnonymous)data.book.url='https://www.goodreads.com/book/show/999';if(options.anonymousBlocked)data.blocked=true;
  }else if(!url.includes('/book/'))data={book:null,candidates:[{title:book.title,url:source==='gr'?grUrl:ngUrl}]};
  else data=snapshot(source,signedWant);
  const status=init.credentials==='omit'?(options.status??200):200;
  return {ok:status===200,status,url,text:async()=>JSON.stringify(data)};
 };
 vm.runInContext(fs.readFileSync(path.join(root,'core.js'),'utf8'),ctx);ctx.QuickBooks.inspect=doc=>doc;
 vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx);
 const send=m=>listener(m,{id:'test',url:'https://ipage.ingramcontent.com/ipage/productdetail',tab:{id:1}});
 return {tabs,requests,windows,removed,saved,lookup:(target=book)=>send({type:'quick-books-lookup',session:'page',book:target,refresh:true}),close:()=>send({type:'quick-books-close-tabs',session:'page'}),release:()=>releasePrivate(),anonymousStarted:()=>anonymousStarted,aborted:()=>aborted};
}
test('public count comes from a cookie-free request and does not overwrite other signed-in statistics',async()=>{
 const h=harness({anonymousWant:12345});const r=await h.lookup();assert.equal(r.gr.want,12345);assert.equal(r.gr.rating,4.1);assert.equal(r.gr.ratings,200);assert.equal(r.gr.url,grUrl);assert.equal(h.windows.length,0);const request=h.requests.find(r=>r.credentials==='omit');assert.equal(request.cache,'no-store');assert.equal(request.url,grUrl);assert.equal(h.tabs.size,2);
});
test('a count already present including zero does not trigger any extra lookup',async()=>{
 const h=harness({signedWant:0});const r=await h.lookup();assert.equal(r.gr.want,0);assert.equal(h.requests.some(r=>r.credentials==='omit'),false);assert.equal(h.windows.length,0);
});
test('private lookup is minimized, cleans up its own tab, and leaves normal source tabs open',async()=>{
 const h=harness({privateWant:0});const r=await h.lookup();assert.equal(r.gr.want,0);assert.equal(h.windows.length,1);assert.deepEqual(JSON.parse(JSON.stringify(h.windows[0])),{url:grUrl,incognito:true,focused:false,state:'minimized'});assert.equal(h.tabs.size,2);assert.ok([...h.tabs.values()].every(t=>!t.incognito));assert.equal(h.removed.length,1);
});
test('private access denied preserves results and explains the setting to enable',async()=>{
 const h=harness({allowed:false});const r=await h.lookup();assert.equal(r.gr.want,null);assert.match(r.gr.wantStatus,/Run in Private Windows/);assert.equal(r.gr.rating,4.1);assert.equal(r.ng.url,ngUrl);assert.equal(h.windows.length,0);
});
test('wrong-book anonymous counts are rejected and a private count is used instead',async()=>{
 const h=harness({anonymousWant:999,wrongAnonymous:true,privateWant:123});const r=await h.lookup();assert.equal(r.gr.want,123);assert.equal(h.windows.length,1);
});
test('wrong-book private count and missing snapshots stay unavailable and always clean up',async()=>{
 for(const options of [{wrongPrivate:true},{privateError:true}]){const h=harness(options);const r=await h.lookup();assert.equal(r.gr.want,null);assert.match(r.gr.wantStatus,/did not expose/);assert.ok([...h.tabs.values()].every(t=>!t.incognito));assert.equal(h.tabs.size,2);}
});
test('explicit access restrictions stop the anonymous fallback without opening private windows',async()=>{
 for(const options of [{status:403},{status:429},{anonymousBlocked:true}]){const h=harness(options);const r=await h.lookup();assert.equal(r.gr.want,null);assert.match(r.gr.wantStatus,/restricted|verification/);assert.equal(h.windows.length,0);}
});
test('private creation failures or verification pages keep other results',async()=>{
 for(const options of [{windowError:true},{privateBlocked:true}]){const h=harness(options);const r=await h.lookup();assert.equal(r.gr.want,null);assert.ok(r.gr.wantStatus);assert.equal(r.ng.url,ngUrl);assert.ok([...h.tabs.values()].every(t=>!t.incognito));}
});
test('Update while private window creation is pending cleans up the late tab',async()=>{
 const h=harness({holdPrivate:true});const work=h.lookup();await until(()=>h.windows.length===1);await h.close();h.release();assert.equal((await work).cancelled,true);assert.equal(h.tabs.size,0);assert.equal(h.saved.length,0);
});
test('Update aborts the anonymous request and does not open a private window',async()=>{
 const h=harness({holdAnonymous:true});const work=h.lookup();await until(h.anonymousStarted);await h.close();assert.equal((await work).cancelled,true);assert.equal(h.aborted(),true);assert.equal(h.windows.length,0);assert.equal(h.tabs.size,0);
});
test('full lookup reaches title-before-colon fallback and verifies author on the detail page',async()=>{
 const h=harness({signedWant:123});const r=await h.lookup({...book,title:'Dangerous Ground: A Novel of Suspense (Alex Carter #6)'});assert.equal(r.gr.url,grUrl);assert.ok(h.requests.some(r=>new URL(r.url).searchParams.get('q')==='Dangerous Ground Alice Henderson'));assert.equal(r.ng.url,null);
});
