const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const extension=path.resolve(__dirname,'../extension');
const book={title:'Test Book',author:'A Writer',isbn:''};
const result={gr:{url:'https://www.goodreads.com/book/show/1'},ng:{url:'https://www.netgalley.com/catalog/book/2'},at:Date.now(),ttl:999999};
const turn=()=>new Promise(r=>setImmediate(r));
function harness({cache=true,holdCreate=false,holdFetch=false}={}) {
 let listener,removed,next=10,releaseCreate,fetchStarted=false,fetchAborted=false;
 const tabs=new Map(),created=[],deleted=[];
 const browser={runtime:{id:'test',onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async key=>cache?{[key]:result}:{},set:async()=>{}}},tabs:{
 create:async data=>{const tab={id:++next,...data};tabs.set(tab.id,tab);created.push(tab);if(holdCreate){holdCreate=false;await new Promise(r=>releaseCreate=r);}return tab;},
 update:async(id,data)=>{if(!tabs.has(id))throw Error('No tab');return Object.assign(tabs.get(id),data);},
 remove:async id=>{tabs.delete(id);deleted.push(id);removed?.(id);},
 onRemoved:{addListener:fn=>removed=fn},sendMessage:async()=>{throw Error('Unexpected snapshot');}
 }};
 const context=vm.createContext({browser,URL,AbortController,setTimeout,clearTimeout,console,DOMParser:class{parseFromString(){return {};}}});
 context.fetch=async(url,{signal})=>{
  if(holdFetch){holdFetch=false;fetchStarted=true;await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{fetchAborted=true;reject(Error('Aborted'));},{once:true}));}
  return {ok:true,status:200,url,text:async()=>''};
 };
 vm.runInContext(fs.readFileSync(path.join(extension,'core.js'),'utf8'),context);
 context.QuickBooks.inspect=(doc,url,source)=>({book:{title:book.title,authors:[book.author],isbns:[],want:1,url:result[source].url},candidates:[]});
 vm.runInContext(fs.readFileSync(path.join(extension,'background.js'),'utf8'),context);
 const send=(m,owner=1)=>listener(m,{id:'test',url:'https://ipage.ingramcontent.com/ipage/productdetail',tab:{id:owner}});
 return {tabs,created,deleted,send,removeOwner:id=>removed(id),release:()=>releaseCreate(),fetchStarted:()=>fetchStarted,fetchAborted:()=>fetchAborted,
 lookup:(session='one',owner=1)=>send({type:'quick-books-lookup',book,session},owner),
 close:(session='one',owner=1)=>send({type:'quick-books-close-tabs',session},owner)};
}
test('Close removes only source tabs for this iPage tab and Refresh opens a new pair',async()=>{
 const h=harness();const first=await h.lookup();const other=await h.lookup('other',2);await h.close();assert.equal(h.tabs.size,2);assert.ok(h.tabs.has(other.tabs.gr));assert.ok(h.tabs.has(other.tabs.ng));assert.ok(!h.tabs.has(first.tabs.gr));await h.lookup();assert.equal(h.tabs.size,4);
});
test('Close during pending tab creation removes that tab and prevents NG reopening',async()=>{
 const h=harness({holdCreate:true});const work=h.lookup();await turn();assert.equal(h.created.length,1);await h.close();h.release();assert.equal((await work).cancelled,true);assert.equal(h.tabs.size,0);assert.equal(h.created.length,1);
});
test('Close during a fetch aborts it and lets the next book proceed',async()=>{
 const h=harness({cache:false,holdFetch:true});const old=h.lookup();await turn();assert.equal(h.fetchStarted(),true);await h.close();assert.equal((await old).cancelled,true);assert.equal(h.fetchAborted(),true);assert.equal(h.created.length,0);const next=await h.lookup('next');assert.ok(next.tabs.gr);assert.ok(next.tabs.ng);assert.equal(h.tabs.size,2);
});
test('old document late Close cannot remove the next product source tabs',async()=>{
 const h=harness();await h.lookup('old');const current=await h.lookup('next');await h.close('old');assert.equal(h.tabs.size,2);assert.ok(h.tabs.has(current.tabs.gr));assert.ok(h.tabs.has(current.tabs.ng));
});
test('repeated lookup reuses tabs, owner tab closure cleans them up',async()=>{
 const h=harness();await h.lookup();await h.lookup();assert.equal(h.created.length,2);h.removeOwner(1);await turn();assert.equal(h.tabs.size,0);
});
