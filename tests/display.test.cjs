const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({URL});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/core.js'),'utf8'),context);
const {line}=context.QuickBooks;
const goodreads='https://www.goodreads.com/book/show/101';

test('matched Goodreads book displays 0wtr when the count is unavailable',()=>{
  const result=line({url:goodreads,rating:4.2,ratings:100,reviews:20,want:null});
  assert.match(result,/0wtr/);
  assert.doesNotMatch(result,/unavailablewtr/);
});

test('real Goodreads want-to-read totals including zero are displayed unchanged',()=>{
  assert.match(line({url:goodreads,rating:4.2,want:0}),/0wtr/);
  assert.match(line({url:goodreads,rating:4.2,want:12345}),/12,345wtr/);
});

test('books without a Goodreads match display em dashes instead of unavailable',()=>{
  assert.equal(line({url:null,status:'No reliable match found.',want:null}),'— GR; —rat; —rev; —wtr; ');
});

test('missing rating and review counts display em dashes for matched books',()=>{
  assert.equal(line({url:goodreads,rating:null,ratings:null,reviews:null,want:42}),'— GR; —rat; —rev; 42wtr; ');
});

test('the unavailable-private-page explanation is suppressed in the display',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../extension/content.js'),'utf8');
  assert.match(ui,/wantStatus!=='Goodreads did not expose a total want-to-read count in the private page\.'/);
});
