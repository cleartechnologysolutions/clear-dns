import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('./worker/index.js',import.meta.url),'utf8').replace('import { connect } from "cloudflare:sockets";','').replace('export default {','globalThis.worker={');
const server=vm.createContext({Response,URL});vm.runInContext(src,server);const html=await server.pageResponse().text(),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const storage=new Map();const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
function browser(storageApi=localStorage){const elements=new Map(),context=vm.createContext({URL,URLSearchParams,setTimeout,clearTimeout,localStorage:storageApi,location:{origin:'https://dns.example',href:'https://dns.example/',search:''},history:{replaceState(){}},document:{getElementById(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},removeAttribute(k){delete this[k];}});return elements.get(id);}},fetch(){throw Error('Restoring history must not query DNS');}});vm.runInContext(script,context);return {context,elements};}
const b=browser();
for(let n=0;n<6;n++)vm.runInContext(`savedAudit={domain:'d${n}.example',hosts:['d${n}.example'],data:{domain:'d${n}.example',hostCount:1,checked:1,found:1,checks:[{name:'d${n}.example',type:'A',status:'NOERROR',answers:[{ttl:60,value:'8.8.8.8'}]}]}};rememberScan();`,b.context);
assert.equal(vm.runInContext('recentScans.length',b.context),5);assert.equal(vm.runInContext('recentScans[0].domain',b.context),'d5.example');
const reloaded=browser();assert.equal(vm.runInContext('standardCache.size',reloaded.context),5);
reloaded.elements.get('recent-scans').listeners.click({target:{closest:()=>({dataset:{scan:'1'}})}});
assert.equal(reloaded.elements.get('domain').value,'d4.example');assert.match(reloaded.elements.get('results').innerHTML,/8.8.8.8/);assert.match(reloaded.elements.get('status').textContent,/Restored/);
vm.runInContext('rememberScan()',reloaded.context);assert.equal(vm.runInContext('recentScans.length',reloaded.context),5);
reloaded.elements.get('clear-history').listeners.click();assert.equal(storage.size,0);assert.match(reloaded.elements.get('results').innerHTML,/8.8.8.8/);
const failed=browser({getItem(){throw Error('denied');},setItem(){throw Error('full');},removeItem(){throw Error('denied');}});assert.match(failed.elements.get('history-note').textContent,/could not be loaded/);
vm.runInContext("savedAudit={domain:'example.com',hosts:[],data:{domain:'example.com',checks:[]}};rememberScan()",failed.context);assert.match(failed.elements.get('history-note').textContent,/storage is unavailable or full/);
assert.match(html,/<button[^>]*id="dns-lookup">DNS Lookup<\/button>/);assert.doesNotMatch(html,/Open DNS Lookup →/);
console.log('PASS: five-domain limit, reload recovery, no-network restore, duplicate replacement, clear preserves output, blocked storage handling, DNS Lookup button.');
