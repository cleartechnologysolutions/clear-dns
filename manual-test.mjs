import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('./worker/index.js',import.meta.url),'utf8').replace('import { connect } from "cloudflare:sockets";','').replace('export default {','globalThis.worker={');
const ctx=vm.createContext({URL,Response,Request,TextDecoder,TextEncoder,AbortController,setTimeout,clearTimeout,crypto:webcrypto});vm.runInContext(source,ctx);
for(const raw of ['"v=spf1 include:a.test " "-all"','"v=sp"\t"f1 -all"','v=spf1 -all','"v=spf1\\032-all"']){
 const data=ctx.summarizeMail('example.com',{MX:{Status:0,Answer:[]},TXT:{Status:0,Answer:[{type:16,data:raw}]},DMARC:{Status:0,Answer:[]}});
 assert.equal(data.spf,'SPF found',raw);
}
assert.equal(ctx.summarizeMail('example.com',{TXT:{Status:0,Answer:[{type:16,data:'"v=spf10 -all"'}]}}).records.spf.length,0);
assert.match(ctx.summarizeMail('example.com',{TXT:{Status:2}}).spf,/incomplete.*SERVFAIL/);
assert.equal(ctx.summarizeMail('example.com',{TXT:{Status:0,Answer:[{type:16,data:'"v=spf1 -all"'},{type:16,data:'"v=spf1 ~all"'}]}}).spf,'Multiple SPF records found');
for(const [q,z,answer] of [['@','example.com','example.com'],['www','example.com','www.example.com'],['_sip._tcp','example.com','_sip._tcp.example.com'],['mail.other.com.','example.com','mail.other.com'],['example.com','','example.com']])assert.equal(ctx.manualQueryName(q,z),answer);
assert.throws(()=>ctx.manualQueryName('@',''));
const makeReply=packet=>{const response=Buffer.concat([Buffer.from(packet),Buffer.from([192,12,0,1,0,1,0,0,0,60,0,4,8,8,4,4])]);response[2]=129;response[3]=128;response[7]=1;return response;};
const packet=ctx.encodeDnsQuery('example.com',1,42),reply=makeReply(packet);
assert.equal(ctx.decodeDnsPacket(reply,42,'example.com',1).answers[0].value,'8.8.4.4');
assert.throws(()=>ctx.decodeDnsPacket(reply,41,'example.com',1),/Unexpected/);
assert.throws(()=>ctx.decodeDnsPacket(reply.subarray(0,15),42,'example.com',1),/Truncated/);
const loop=Buffer.from(reply);loop[12]=192;loop[13]=12;assert.throws(()=>ctx.decodeDnsPacket(loop,42,'example.com',1),/loop/);
let closed=0,selected=[];
ctx.connect=({hostname,port})=>{
 selected.push([hostname,port]);let frame,pos=0;
 return {opened:Promise.resolve(),closed:Promise.resolve(),close:async()=>{closed++;},
 writable:{getWriter:()=>({write:async bytes=>{const payload=makeReply(bytes.slice(2));frame=Buffer.concat([Buffer.from([payload.length>>8,payload.length&255]),payload]);},releaseLock(){}})},
 readable:{getReader:()=>({read:async()=>{if(pos>=frame.length)return {done:true};const value=frame.slice(pos,pos+3);pos+=3;return {done:false,value};},releaseLock(){}})}};
};
const answer=await ctx.manualDnsLookup('8.8.8.8','@','example.com','A');assert.equal(answer.answers[0].value,'8.8.4.4');assert.deepEqual(selected,[['8.8.8.8',53]]);assert.equal(closed,1);
await assert.rejects(()=>ctx.manualDnsLookup('127.0.0.1','@','example.com','A'),/public/);
await assert.rejects(()=>ctx.manualDnsLookup('10.0.0.1','@','example.com','A'),/public/);
await assert.rejects(()=>ctx.manualDnsLookup('8.8.8.8','@','example.com','AXFR'),/Unsupported/);
ctx.fetch=async (url,options)=>{assert.equal(url,'https://1.1.1.1/dns-query');return new Response(makeReply(options.body));};
assert.equal((await ctx.manualDnsLookup('1.1.1.1','@','example.com','A')).transport,'DNS over HTTPS');
const html=await (await ctx.worker.fetch(new Request('https://dns.example/dns-lookup'))).text();assert.match(html,/id="manual-form"/);assert.doesNotMatch(html,/id="lookup-form"/);
// Execute delivered browser script and submit @ without a standard scan.
const elements=new Map();const browser=vm.createContext({URLSearchParams,document:{getElementById(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',addEventListener(event,fn){this[event]=fn;}});return elements.get(id);}},fetch:async url=>{assert.match(url,/query=%40/);return Response.json(answer);},navigator:{clipboard:{writeText:async()=>{}}}});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],browser);
for(const [id,value] of [['server','8.8.8.8'],['zone','example.com'],['query','@'],['record-type','A']])browser.document.getElementById(id).value=value;
await elements.get('manual-form').submit({preventDefault(){}});assert.match(elements.get('manual-output').textContent,/8.8.4.4/);assert.equal(elements.get('manual-status').textContent,'Done.');
console.log('PASS: TXT/SPF chunks and escapes, failed TXT vs absent SPF, duplicate SPF, apex/relative/absolute queries, DNS compression and bounds, fragmented TCP reads, chosen server, private-address rejection, Cloudflare DoH and standalone UI submission.');
