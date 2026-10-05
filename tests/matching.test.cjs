const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const context=vm.createContext({URL});vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/core.js'),'utf8'),context);const Q=context.QuickBooks;
const target={title:'Dangerous Ground: A Novel of Suspense (Alex Carter #6)',author:'Alice Henderson',isbn:'9781234567890'};
const found={title:'Dangerous Ground',authors:['Alice Henderson'],isbns:[]};
test('subtitle fallback is last, searches short title plus author, and leaves NetGalley unchanged',()=>{
 const plans=Q.lookupPlans(target,'gr');assert.equal(plans.length,3);assert.equal(plans[0].query,target.isbn);assert.equal(plans[1].query,target.title);assert.equal(plans[2].query,'Dangerous Ground Alice Henderson');assert.equal(plans[2].shortTitle,true);
 assert.equal(Q.lookupPlans(target,'ng').length,2);
});
test('Dangerous Ground requires the short-title stage and matching author',()=>{
 assert.equal(Q.score(target,found),0);assert.equal(Q.score(target,found,true),0);assert.equal(Q.score(target,found,true,true),80);
 assert.equal(Q.score(target,{...found,authors:['Other Writer']},true,true),0);
 assert.equal(Q.score(target,{...found,title:'Dangerous Grounds'},true,true),0);
 assert.equal(Q.score(target,{...found,authors:['Other Writer'],isbns:[target.isbn]},true,true),0);
});
test('deluxe search precedes subtitle fallback and series labels do not break matching',()=>{
 const t={...target,title:target.title+' (Deluxe Edition)'};const plans=Q.lookupPlans(t,'gr');assert.equal(plans.length,4);assert.equal(plans[2].regularEdition,true);assert.equal(plans[2].shortTitle,undefined);assert.equal(plans[3].query,'Dangerous Ground Alice Henderson');
 assert.equal(Q.score(t,{...found,title:'Dangerous Ground (Alex Carter #6)'},true,true),80);
});
test('no author or empty prefix cannot enable short-title matching',()=>{
 assert.equal(Q.lookupPlans({...target,author:''},'gr').length,2);
 assert.equal(Q.lookupPlans({...target,title:': Subtitle'},'gr').length,2);
 assert.equal(Q.score({...target,author:''},found,true,true),0);
});
test('regular-edition matching and requested rating format remain intact',()=>{
 assert.equal(Q.score({title:'A Book (Deluxe Edition)',author:'Jane Smith',isbn:''},{title:'A Book',authors:['Jane Smith']},true),80);
 assert.match(Q.line({rating:2.85}),/^NR: 2.85 GR;/);assert.match(Q.line({rating:3,want:0}),/^3.00 GR;.*0wtr/);assert.match(Q.line({rating:4.67}),/^4.67 GR;/);
});
