// Offline startup diagnostic: no browser automation, credentials, or network writes.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dataset = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const appRole = process.argv[3] || 'leader';
const source = fs.readFileSync(path.join(__dirname, '..', 'app-bundle-v88.js'), 'utf8');
const nodes = new Map();
const errors = [];
const calls = new Map();
let activePage = 'dashboard';
let deadline = Infinity;
let lastCalls = [];
function node(id) {
  if (nodes.has(id)) return nodes.get(id);
  const listeners = {};
  let html = '', value = '';
  const classes = new Set(id === 'page-dashboard' ? ['active'] : []);
  const item = {
    id, tagName: 'DIV', textContent: '', dataset: {}, style: {}, disabled: false,
    options: [], selectedOptions: [], files: [], children: [],
    classList: {add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains(n){return classes.has(n);},toggle(n,on){if(on ?? !classes.has(n))classes.add(n);else classes.delete(n);}},
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    dispatchEvent(event) { (listeners[event.type] || []).forEach(fn=>fn(event)); },
    querySelector(selector) { return node(id + ':' + selector); }, querySelectorAll() { return []; },
    closest() { return item; }, insertAdjacentHTML() {}, appendChild() {}, remove() {},
    setAttribute(name, v) { item[name] = v; }, getAttribute(name) { return item[name] || null; },
    reset() {}, click() {}, focus() {}, scrollIntoView() {},
    getBoundingClientRect() { return {width:1200,height:900}; },
  };
  Object.defineProperty(item,'innerHTML',{get:()=>html,set:v=>{html=String(v);item.options=Array.from(html.matchAll(/<option(?: value="([^"]*)")?[^>]*>(.*?)<\/option>/g),m=>({value:m[1] ?? m[2],text:m[2],dataset:{}})); if(item.options.length)value=item.options[0].value;}});
  Object.defineProperty(item,'value',{get:()=>value,set:v=>{value=String(v);}});
  nodes.set(id,item); return item;
}
function storage() { const values = new Map(); return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}; }
const document = {getElementById:node,querySelector:s=>s==='.page.active'?node('page-'+activePage):node(s),querySelectorAll:()=>[],createElement:()=>node('created'),addEventListener(){},body:node('body'),hidden:false};
const sessionStorage = storage(), localStorage = storage();
const context = {
  document, sessionStorage, localStorage, Headers, Response, Request, URL, FormData, Blob,
  navigator:{userAgent:'offline-runtime'},history:{replaceState(){}},
  setTimeout:()=>0, clearTimeout(){},
  console:{log:console.log,warn:(...args)=>errors.push(args.map(String).join(' ')),error:(...args)=>errors.push(args.map(String).join(' '))},
  __enter(name){calls.set(name,(calls.get(name)||0)+1);lastCalls.push(name);if(lastCalls.length>12)lastCalls.shift();if(Date.now()>deadline)throw Error('CPU budget exceeded at '+name+'; path '+lastCalls.join(' > '));},
};
context.window = {location:{href:'https://example.test/',hash:'',pathname:'/',search:''},localStorage,navigator:context.navigator,addEventListener(){},scrollTo(){},setTimeout:context.setTimeout,supabase:{createClient:()=>({auth:{onAuthStateChange(){},getSession:()=>Promise.resolve({data:{session:null}})}})},fetch:async url=>{
  const endpoint = new URL(url).pathname.split('/bloggers-api')[1];
  let body = {};
  if(endpoint==='/whoami')body={profile:{name:'Offline test'},appRole};
  else if(endpoint==='/api/shared-state')body={records:dataset.shared,latestUpdatedAt:'2026-10-06T00:00:00Z'};
  else if(endpoint==='/api/employees')body={employees:dataset.employees};
  else if(endpoint==='/api/evidence-reports')body={reports:dataset.evidence};
  else if(endpoint==='/api/department-months')body={periods:[{month:'2026-10',status:'active'},{month:'2026-09',status:'archived'}]};
  else if(endpoint==='/api/finance-summary')body={archive:[],current:null};
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
}};
vm.createContext(context);
const start=source.indexOf('    (function () {',source.indexOf('/*__REACH_UPDATES__*/'));
const end=source.lastIndexOf('})();');
let runtime=source.slice(start,end)+"this.__crm={activateSession,navigate,refreshAllDerivedViews,compareKpi:()=>{const cards=groupedKpiBloggers();const reportsIndex=kpiExitSourceIndex(evidenceReports,true);const placementsIndex=kpiExitSourceIndex(synchronizedPlacementRecords(),false);return {cards:cards.length,equal:cards.every(card=>JSON.stringify(confirmedKpiExitForBlogger(card))===JSON.stringify(confirmedKpiExitForBlogger(card,{reports:indexedKpiExitSources(card,reportsIndex),placements:indexedKpiExitSources(card,placementsIndex)})))};},counts:()=>({bloggers:bloggers.length,placements:placementRecords.length,employees:employees.length,reports:evidenceReports.length,role}),health:()=>document.getElementById('syncHealthStrip').textContent};})();";
runtime=runtime.replace(/function ([A-Za-z0-9_]+)\(([^)]*)\) \{/g,(match,name)=>match+`__enter('${name}');`);
vm.runInContext(runtime,context,{timeout:10000});
async function main(){
  const began=Date.now();deadline=began+10000;
  await context.__crm.activateSession({access_token:'offline-test-token'});
  console.log(JSON.stringify({phase:'startup',ms:Date.now()-began,...context.__crm.counts(),errors}));
  if(process.argv.includes('--compare-kpi')){deadline=Date.now()+10000;const result=context.__crm.compareKpi();console.log(JSON.stringify({phase:'kpi-equivalence',...result}));if(!result.equal)throw Error('KPI changed');}
  for(const page of ['bloggers','placements','calendar','reports','profile','kpi','team']){
    activePage=page;deadline=Date.now()+10000;const began=Date.now();context.__crm.navigate(page);
    console.log(JSON.stringify({phase:page,ms:Date.now()-began}));
  }
  console.log(JSON.stringify({calls:Object.fromEntries([...calls].sort((a,b)=>b[1]-a[1]).slice(0,15)),errors}));
}
main().catch(error=>{console.error(error.stack);console.log(JSON.stringify({errors,calls:Object.fromEntries([...calls].sort((a,b)=>b[1]-a[1]).slice(0,20))}));process.exitCode=1;});
