import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

// Exercise the Worker API and its delivered client script with mocked DNS.
const source = readFileSync(new URL("./worker/index.js", import.meta.url), "utf8")
  .replace('import { connect } from "cloudflare:sockets";', "")
  .replace("export default {", "globalThis.worker = {");
let queries = [], active = 0, peak = 0;
let crtFailure = 0, crtCalls = 0;
let probeMode = "none";
const probeQueries = [];
const certificateRows = [
  { name_value: "WWW.example.com\nextra.example.com\nv6.example.com\nretired.example.com", common_name: "extra.example.com" },
  { name_value: "extra.example.com\n*.example.com\n*.wild.example.com\noutside.test\nexample.com.attacker.test\n<img>.example.com" },
  { name_value: "www.example.com.\nextra.example.com" },
  ...Array.from({ length: 15 }, (_, i) => ({ name_value: "cert" + i + ".example.com" })),
];
const server = vm.createContext({
  URL, Response, Request, AbortController, TextDecoder, setTimeout, clearTimeout, crypto: webcrypto,
  fetch: async (url, options) => {
    if (new URL(url).hostname === "crt.sh") {
      crtCalls++;
      assert.equal(new URL(url).searchParams.get("q"), "%.example.com");
      assert.equal(new URL(url).searchParams.get("output"), "json");
      assert.ok(options.signal);
      assert.equal(options.redirect, "manual", "Use the redirect mode supported by Cloudflare Workers.");
      return crtFailure ? new Response("Unavailable", { status: crtFailure }) : Response.json(certificateRows);
    }
    const params = new URL(url).searchParams;
    const name = params.get("name"), type = params.get("type");
    if (name.startsWith("wcprobe-")) {
      probeQueries.push([name, type]);
      const number = new Set(probeQueries.map(([n]) => n)).size;
      if (probeMode === "error" && type === "AAAA") return Response.json({ Status: 2 });
      if (probeMode === "none") return Response.json({ Status: 3 });
      const code = { A: 1, AAAA: 28, CNAME: 5 }[type];
      const value = { A: "192.0.2." + (number % 2 + 1), AAAA: "2001:db8::1", CNAME: "PARKING.EXAMPLE.NET." }[type];
      return Response.json({ Status: 0, Answer: [{ type: code, TTL: number * 60, data: value }] });
    }
    queries.push([name, type]);
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 0));
    active--;
    let answer = type === "A" ? [{type: 1, TTL: 300, data: "192.0.2.1"}] :
      type === "CNAME" ? [{type: 5, TTL: 300, data: "target.example.net."}] : [];
    if (["mail.example.com", "retired.example.com"].includes(name)) answer = [];
    if (name === "extra.example.com" && type !== "A") answer = [];
    if (name === "v6.example.com") answer = type === "AAAA" ? [{ type: 28, TTL: 60, data: "2001:db8::1" }] : [];
    return Response.json({ Status: 0, Answer: answer });
  },
});
vm.runInContext(source, server);
const worker = server.worker;
const html = await worker.fetch(new Request("https://dns.example")).text();
assert.match(html, />Standard Records<\/button>/);
assert.match(html, /<title>DNS Tools<\/title>/);
assert.match(html, /Build 18/);
assert.doesNotMatch(html, /Clear Technology Solutions|Clear DNS|CLEAR DNS|>CTS</);
assert.doesNotMatch(html, /Standard scan|STANDARD SCAN/);

const elements = new Map();
const batches = [];
const client = vm.createContext({
  URL, URLSearchParams, setTimeout, clearTimeout,
  location: { href: "https://dns.example/", origin: "https://dns.example", search: "" },
  history: { replaceState() {} },
  document: { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "", textContent: "", removeAttribute(name) { delete this[name]; }, listeners: {}, addEventListener(event, handler) { this.listeners[event] = handler; } });
    return elements.get(id);
  }},
  fetch: async (url, options) => {
    const before = queries.length;
    const response = await worker.fetch(new Request(url, options));
    if (new URL(url).searchParams.get("mode") !== "wildcard") batches.push(queries.length - before);
    return response;
  },
});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1] +
  "\nglobalThis.run = runLookup; globalThis.render = renderAudit; globalThis.report = () => lastText;", client);
elements.get("domain").value = "example.com";

await client.run("audit");

const requested = "www mail ftp webmail smtp pop web cpanel m imap test blog pop3 dev secure api admin whm forum remote vpn app shop store support portal server news staging host beta crm en mx1 sso status billing docs chat video cloud sql login uat db connect".split(" ");
const hosts = vm.runInContext("STANDARD_HOSTS", server);
assert.equal(hosts.length, 914);
assert.equal(new Set(hosts).size, 914);
const additions = "email mx stage qa prod demo sandbox preview ci cd build auth identity gw panel manage press cart pay help jobs careers community cdn static assets img images download jira confluence zendesk slack salesforce hr finance legal marketing okta workday servicenow teams sharepoint intune screenconnect datadog prometheus airwatch splunk azure aws gitlab bitbucket api.staging".split(" ");
for (const name of additions) assert.ok(hosts.includes(name), "Missing " + name);
for (const host of hosts) assert.match(host, /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/);
for (const name of [...requested, "autodiscover", "autoconfig", "owa"]) assert.ok(hosts.includes(name));
for (const host of hosts) {
  for (const type of ["A", "AAAA", "CNAME"]) {
    assert.equal(queries.filter(([name, t]) => name === host + ".example.com" && t === type).length, 1, host + " " + type);
  }
}
assert.deepEqual(batches, [...Array(68).fill(40), 35, 0, 40, 14]);
assert.ok(peak <= 6);
assert.equal(queries.length, 2809);
assert.equal(crtCalls, 1);
assert.ok(probeQueries.length >= 9);
assert.match(client.report(), /No wildcard answers detected/);
assert.equal(elements.get("result-title").textContent, "Standard Records");
assert.equal(elements.get("status").textContent, "Done.");
const report = client.report();
assert.match(report, /Found:  1860 of 2809 checks/);
assert.match(report, /Scope:  914 service\/vendor hostnames/);
for (const name of additions) assert.ok(report.includes(name + ".example.com A"), "Missing resolved host " + name);
assert.match(report, /connect.example.com A/);
assert.match(report, /connect.example.com CNAME/);
assert.match(report, /db.example.com CNAME/);
assert.match(report, /enterpriseenrollment.example.com CNAME/);
assert.match(report, /rdgateway.example.com A/);
assert.match(report, /gitlab.example.com A/);
assert.match(report, /A \/ AAAA RECORDS/);
assert.match(report, /CNAME RECORDS/);
assert.match(report, /extra.example.com A.*\[crt.sh\]/);
assert.match(report, /www.example.com A.*\[crt.sh\]/, "Standard-list overlaps retain certificate provenance");
assert.match(report, /v6.example.com AAAA.*2001:db8::1.*\[crt.sh\]/);
assert.doesNotMatch(report, /^mail\.example\.com|NOT FOUND|No records found|MX RECORDS/m);
assert.match(report, /retired.example.com  \[crt.sh\] No current A\/AAAA\/CNAME answer/);
assert.match(report, /\*\.example.com  \[crt.sh\] Wildcard certificate pattern/);
assert.match(report, /\*\.wild.example.com  \[crt.sh\] Wildcard certificate pattern/);
assert.equal(queries.filter(([name, type]) => name === "www.example.com" && type === "A").length, 1);
assert.equal(queries.filter(([name]) => name.includes("*") || name.includes("attacker") || name === "outside.test").length, 0);
assert.equal(queries.filter(([name]) => name.includes("_domainkey")).length, 4);
assert.equal(queries.filter(([name]) => name === "_dmarc.example.com").length, 1);
const mixedAnswers = { Status: 0, Answer: [
  { type: 5, TTL: 300, data: "target.example.net." },
  { type: 1, TTL: 300, data: "192.0.2.55" },
] };
assert.equal(server.answerValues(mixedAnswers, "A").length, 1);
assert.equal(server.answerValues(mixedAnswers, "A")[0].value, "192.0.2.55");
assert.equal(server.answerValues(mixedAnswers, "CNAME")[0].value, "target.example.net.");
assert.equal(server.answerValues(mixedAnswers, "AAAA").length, 0);
assert.equal(server.answerValues({ ...mixedAnswers, Status: 3 }, "A").length, 0);
const before = queries.length;
const invalid = await worker.fetch(new Request("https://dns.example/api/lookup?name=example.com&mode=audit&offset=-1"));
assert.equal(invalid.status, 502);
assert.equal(queries.length, before);
const rejected = await worker.fetch(new Request("https://dns.example/api/lookup?name=example.com&mode=crt-records", {
  method: "POST", body: JSON.stringify({ tasks: [{ name: "example.com.attacker.test", type: "A" }] }),
}));
assert.equal(rejected.status, 400);
assert.equal(queries.length, before);
const excessive = await worker.fetch(new Request("https://dns.example/api/lookup?name=example.com&mode=crt-records", {
  method: "POST", body: JSON.stringify({ tasks: Array.from({ length: 41 }, () => ({ name: "extra.example.com", type: "A" })) }),
}));
assert.equal(excessive.status, 400);
assert.equal(queries.length, before);
const capped = server.certificateNames(Array.from({ length: 1002 }, (_, i) => ({ name_value: "host" + i + ".example.com" })), "example.com");
assert.equal(capped.names.length, 1000);
assert.equal(capped.limited, true);
assert.throws(() => server.certificateNames({}, "example.com"), /unexpected response/);

// Provider outages must not discard valid standard results or look like no matches.
crtFailure = 503;
await client.run("audit");
assert.match(client.report(), /connect.example.com A/);
assert.match(client.report(), /crt.sh discovery incomplete: crt.sh returned HTTP 503/);
assert.match(elements.get("status").textContent, /Done.*HTTP 503.*Retry crt.sh only/);
assert.doesNotMatch(client.report(), /retired.example.com|NOT FOUND/);
// Saved navigation makes no network calls; certificate-only retry preserves DNS work.
assert.equal(elements.get("retry-crt").hidden,false);
const beforeRetryQueries=queries.length, beforeRetryProbes=probeQueries.length, beforeRetryCrt=crtCalls;
await vm.runInContext('startStandard(false)',client);
assert.equal(queries.length,beforeRetryQueries);assert.equal(crtCalls,beforeRetryCrt);
crtFailure=0;
await vm.runInContext('retryCertificateDiscovery()',client);
assert.equal(crtCalls,beforeRetryCrt+1);assert.equal(probeQueries.length,beforeRetryProbes);
assert.equal(queries.length-beforeRetryQueries,54);
assert.match(client.report(),/connect.example.com A/);
assert.equal(elements.get("retry-crt").hidden,true);
const afterRetryQueries=queries.length;
await vm.runInContext('startStandard(false)',client);
assert.equal(queries.length,afterRetryQueries);
await vm.runInContext('startStandard(true)',client);
assert.ok(queries.length>afterRetryQueries);
assert.doesNotMatch(html,/All common records<\/button>/);
crtFailure = 302;
const redirected = await worker.fetch(new Request("https://dns.example/api/lookup?name=example.com&mode=crt"));
assert.equal(redirected.status, 502);
assert.match((await redirected.json()).error, /crt.sh returned HTTP 302/);
await client.run("all");
assert.doesNotMatch(client.report(), /MX RECORDS|No records found/);

// Three random probes per scope, rotating IPs, IPv6 and CNAME normalization.
probeQueries.length = 0;
probeMode = "wildcard";
const wildcardRequest = scopes => new Request("https://dns.example/api/lookup?name=example.com&mode=wildcard", {
  method: "POST", body: JSON.stringify({ scopes }),
});
const wildcardResponse = await worker.fetch(wildcardRequest(["example.com", "dev.example.com"]));
assert.equal(wildcardResponse.status, 200);
const { profiles } = await wildcardResponse.json();
assert.equal(probeQueries.length, 18);
assert.equal(new Set(probeQueries.map(([name]) => name)).size, 6);
assert.deepEqual(profiles[0].values.A.sort(), ["192.0.2.1", "192.0.2.2"]);
assert.deepEqual(profiles[0].values.CNAME, ["parking.example.net"]);
assert.deepEqual(profiles[0].values.AAAA, ["2001:db8::1"]);
assert.equal((await worker.fetch(wildcardRequest(["outside.test"]))).status, 400);
assert.equal((await worker.fetch(wildcardRequest(Array(5).fill("example.com")))).status, 400);
assert.equal((await worker.fetch(new Request("https://dns.example/api/lookup?name=example.com&mode=wildcard"))).status, 405);

const hostChecks = (name, values, source) => ["A", "AAAA", "CNAME"].map(type => ({
  name, type, source, status: "NOERROR", answers: (values[type] || []).map(value => ({ value, ttl: 123 })),
}));
const checks = [
  ...hostChecks("example.com", { A: ["192.0.2.1"] }),
  ...hostChecks("www.example.com", { A: ["192.0.2.1"] }),
  ...hostChecks("overlap.example.com", { A: ["192.0.2.1"] }),
  ...hostChecks("fake.example.com", { A: ["192.0.2.2"], AAAA: ["2001:db8::1"], CNAME: ["Parking.Example.Net."] }),
  ...hostChecks("real.example.com", { A: ["192.0.2.55"] }),
  ...hostChecks("alias.example.com", { A: ["192.0.2.1"], CNAME: ["real.vendor.net."] }),
  ...hostChecks("cert.dev.example.com", { A: ["192.0.2.1"] }, "crt.sh"),
  ...hostChecks("unknown.other.example.com", { A: ["192.0.2.1"] }),
  ...hostChecks("mixed.example.com", { A: ["192.0.2.1", "192.0.2.88"] }),
  ...hostChecks("failedtype.example.com", { A: ["192.0.2.1"] }).map(check => check.type === "AAAA" ? { ...check, status: "SERVFAIL" } : check),
];
const fixture = { domain: "example.com", hostCount: 914, checks, checked: checks.length,
  found: checks.filter(c => c.answers.length).length, wildcards: profiles, certificateNames: ["overlap.example.com"] };
client.render(fixture);
assert.match(client.report(), /2 likely wildcard names hidden/);
assert.doesNotMatch(client.report(), /^fake\.example\.com|^failedtype\.example\.com/m);
for (const name of ["example.com", "www.example.com", "overlap.example.com", "cert.dev.example.com", "real.example.com", "alias.example.com", "unknown.other.example.com", "mixed.example.com"]) {
  assert.ok(client.report().includes(name + " A"), name + " should remain visible");
}
const callsBeforeToggle = queries.length + probeQueries.length;
elements.get("results").listeners.change({ target: { id: "show-wildcards", checked: true } });
assert.match(client.report(), /fake.example.com A.*uncertain: wildcard match/);
assert.match(client.report(), /cert.dev.example.com A.*\[crt.sh\]/);
assert.match(elements.get("results").innerHTML, / checked/);
assert.equal(queries.length + probeQueries.length, callsBeforeToggle, "Toggle does not rerun DNS");
elements.get("results").listeners.change({ target: { id: "show-wildcards", checked: false } });
assert.doesNotMatch(client.report(), /^fake\.example\.com/m);

// Failed AAAA probes do not invalidate successful A/CNAME probes.
probeMode = "error";
const failedProfiles = (await (await worker.fetch(wildcardRequest(["example.com"]))).json()).profiles;
assert.equal(failedProfiles[0].incomplete, true);
assert.deepEqual(failedProfiles[0].values.A.sort(), ["192.0.2.1", "192.0.2.2"]);
assert.equal(failedProfiles[0].values.AAAA, undefined);
client.render({ ...fixture, wildcards: failedProfiles });
assert.match(client.report(), /Wildcard detection incomplete/);
assert.match(client.report(), /fake.example.com A/);
assert.doesNotMatch(client.report(), /^failedtype\.example\.com/m);
client.render({ ...fixture, wildcards: [{ scope: "example.com", incomplete: true, values: {} }] });
assert.match(client.report(), /failedtype.example.com A/);

// Reproduce the reported catchall IP with failed AAAA/CNAME checks.
const productionChecks = [
  ...hostChecks("example.com", { A: ["35.193.225.90"] }),
  ...hostChecks("www.example.com", { A: ["35.193.225.90"] }),
  ...hostChecks("rest.example.com", { A: ["35.193.225.90"] }).map(check => check.type !== "A" ? { ...check, status: "ERROR" } : check),
  ...hostChecks("staff.example.com", { A: ["35.193.225.90"], CNAME: ["www.example.com."] }),
  ...hostChecks("cert.example.com", { A: ["35.193.225.90"] }, "crt.sh"),
  ...hostChecks("overlap.example.com", { A: ["35.193.225.90"] }),
];
client.render({ ...fixture, checks: productionChecks, wildcards: [{ scope: "example.com", incomplete: true, values: { A: ["35.193.225.90"] } }] });
assert.doesNotMatch(client.report(), /^rest\.example\.com/m);
for (const name of ["example.com", "www.example.com", "staff.example.com", "cert.example.com", "overlap.example.com"]) assert.ok(client.report().includes(name + " A"));
client.render({ ...fixture, checks: [
  ...hostChecks("stale.example.com", {}),
  ...hostChecks("failed.example.com", {}).map(check => ({ ...check, status: "ERROR" })),
], certificateNames: ["stale.example.com", "failed.example.com", "pending.example.com"] });
assert.match(client.report(), /stale.example.com  \[crt.sh\] No current A\/AAAA\/CNAME answer/);
assert.match(client.report(), /failed.example.com  \[crt.sh\] DNS check incomplete/);
assert.match(client.report(), /pending.example.com  \[crt.sh\] DNS not yet checked/);
console.log("PASS: 914-host and crt.sh coverage; root/www/certificate exemptions including overlaps; wildcard filtering despite unrelated DNS errors; distinct aliases retained; nested, IPv6, rotating answers and show/hide checks.");

// New workflow must reuse the completed retained-host list, with no discovery requests.
assert.doesNotMatch(html,/Common ports<\/button>/);
assert.match(html,/id="ports" disabled/);
const webRequests=[];
client.fetch=async(url,options)=>{
 const u=new URL(url);assert.equal(u.searchParams.get('mode'),'web');
 const hosts=JSON.parse(options.body).hosts;assert.ok(hosts.length<=4);webRequests.push(...hosts);
 return Response.json({results:hosts.flatMap(hostname=>[
  {hostname,port:80,url:'http://'+hostname+'/',status:'OPEN',detail:'HTTP 301'},
  {hostname,port:443,status:'UNCONFIRMED',detail:'No response'}
 ])});
};
vm.runInContext('savedAudit={domain:"example.com",hosts:["www.example.com","jira.example.com"]};',client);
await vm.runInContext('runWebCheck()',client);
assert.deepEqual(webRequests,['www.example.com','jira.example.com']);
assert.match(elements.get('results').innerHTML,/href="http:\/\/jira.example.com\/" target="_blank" rel="noopener noreferrer"/);
assert.match(client.report(),/UNCONFIRMED/);
await vm.runInContext('runWebCheck()',client);assert.equal(webRequests.length,2);
await vm.runInContext('runWebCheck(true)',client);assert.equal(webRequests.length,4);
elements.get('domain').value='other.example';
await vm.runInContext('runWebCheck()',client);assert.equal(webRequests.length,4);
assert.match(elements.get('status').textContent,/Standard Records.*first/);

const contacts=server.rdapContacts([{roles:['registrant'],handle:'REG',vcardArray:['vcard',[
 ['fn',{},'text','Example Owner'],['org',{},'text',['Example Org']],['email',{},'text','contact@example.com'],
 ['adr',{label:'123 Main Street'},'text',['','','123 Main Street','City','State','12345','US']]
]],entities:[{roles:['technical'],vcardArray:['vcard', [['fn',{},'text','Tech Support'],['tel',{},'uri','tel:+1-555-1234']]]}]},{roles:['administrative']}]);
assert.equal(contacts.length,3);assert.equal(contacts[1].parent,'Example Owner');assert.equal(contacts[0].address[0],'123 Main Street');
client.contactFixture=contacts;
vm.runInContext('renderDomainInfo({domain:"example.com",registrar:"Registrar",registrant:"Owner",contacts:contactFixture})',client);
assert.match(client.report(),/WHOIS \/ RDAP CONTACTS/);assert.match(client.report(),/Tech Support/);assert.match(client.report(),/contact@example.com/);assert.match(client.report(),/Billing: Not published or redacted/);
assert.equal((await worker.fetch(new Request('https://dns.example/api/lookup?name=example.com&mode=web'))).status,405);
assert.equal((await worker.fetch(new Request('https://dns.example/api/lookup?name=example.com&mode=web',{method:'POST',body:JSON.stringify({hosts:['outside.test']})}))).status,400);
let headCalls=0,closed=0;
server.fetch=async(url,options)=>{headCalls++;assert.equal(options.method,'HEAD');assert.equal(options.redirect,'manual');return new Response(null,{status:403});};
const httpResult=await server.checkWebPort('www.example.com',443,'8.8.8.8');assert.equal(httpResult.status,'OPEN');assert.equal(httpResult.detail,'HTTP 403');
server.fetch=async()=>{throw Error('TLS failure');};
server.connect=()=>({opened:Promise.resolve(),closed:Promise.resolve(),close:async()=>{closed++;}});
const tcpResult=await server.checkWebPort('www.example.com',443,'8.8.8.8');assert.equal(tcpResult.status,'OPEN');assert.match(tcpResult.detail,/not verified/);assert.equal(closed,1);
server.connect=()=>({opened:Promise.reject(Error('restricted')),closed:Promise.resolve(),close:async()=>{closed++;}});
const blocked=await server.checkWebPort('www.example.com',80,'8.8.8.8');assert.equal(blocked.status,'UNCONFIRMED');assert.equal(closed,2);
for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(server.publicWebAddress(ip),false);
console.log('PASS: cached discovered-host web checks, prior-scan/domain gate, clickable links, HTTP errors count as open, TCP fallback/cleanup, unconfirmed failures, nested RDAP contacts and redaction.');

// Subdomain mail work reuses the completed scan, preserves primary output,
// queries only MX/TXT/direct DMARC, and keeps failed checks visible.
const mailQueries=[];
server.fetch=async url=>{
 const q=new URL(url).searchParams,name=q.get('name'),type=q.get('type');mailQueries.push([name,type]);
 if(name==='broken.example.com')return Response.json({Status:2});
 const answer=name==='jira.example.com'&&type==='MX'?[{type:15,TTL:300,data:'10 mx.vendor.test.'}]:
  name==='jira.example.com'&&type==='TXT'?[{type:16,TTL:60,data:'"v=spf1 -all"'},{type:16,TTL:60,data:'"verification=abc"'}]:[];
 return Response.json({Status:0,Answer:answer});
};
const mailRequest=hosts=>new Request('https://dns.example/api/lookup?name=example.com&mode=mail-subdomains',{method:'POST',body:JSON.stringify({hosts})});
assert.equal((await worker.fetch(mailRequest(['outside.test']))).status,400);
assert.equal((await worker.fetch(mailRequest(['example.com']))).status,400);
assert.equal((await worker.fetch(mailRequest(Array(13).fill('jira.example.com')))).status,400);
const response=await worker.fetch(mailRequest(['jira.example.com','jira.example.com','empty.example.com','broken.example.com']));
assert.equal(response.status,200);const mailBatch=await response.json();assert.equal(mailBatch.checks.length,9);assert.equal(mailQueries.length,9);
assert.deepEqual(mailQueries.filter(([n])=>n==='jira.example.com').map(([,t])=>t).sort(),['MX','TXT']);
assert.ok(mailQueries.some(([n,t])=>n==='_dmarc.jira.example.com'&&t==='TXT'));
client.mailData={domain:'example.com',mx:'Primary MX',spf:'Primary SPF',dmarc:'Primary DMARC',warnings:[],records:{mx:['10 primary.example.com.'],spf:['v=spf1 -all'],txt:[],dmarc:[]}};
vm.runInContext('savedAudit=null;renderMail(mailData)',client);
assert.match(client.report(),/Complete Standard Records/);
const called=[];
client.fetch=async(url,options)=>{
 assert.equal(new URL(url).searchParams.get('mode'),'mail-subdomains');called.push(...JSON.parse(options.body).hosts);return Response.json(mailBatch);
};
vm.runInContext('savedAudit={domain:"example.com",hosts:["example.com","jira.example.com","empty.example.com","broken.example.com"]}',client);
await vm.runInContext('extendMailCheck(mailData,lookupSequence)',client);
assert.deepEqual(called,['jira.example.com','empty.example.com','broken.example.com']);
const mailReport=client.report();
assert.ok(mailReport.indexOf('PRIMARY DOMAIN')<mailReport.indexOf('SUBDOMAIN MAIL RECORDS'));
assert.match(mailReport,/Complete: 3 of 3/);assert.match(mailReport,/SPF TXT/);assert.match(mailReport,/verification=abc/);assert.match(mailReport,/INCOMPLETE CHECKS/);assert.match(mailReport,/broken.example.com MX: SERVFAIL/);
assert.doesNotMatch(mailReport,/empty.example.com/);assert.match(mailReport,/Inheritance is not evaluated/);
const callsBefore=called.length;
vm.runInContext('savedAudit={domain:"other.example",hosts:["mail.other.example"]}',client);
await vm.runInContext('extendMailCheck({...mailData,subdomains:undefined},lookupSequence)',client);
assert.equal(called.length,callsBefore);
console.log('PASS: discovered-only subdomain mail scope, bounded/deduplicated batches, primary-first report, SPF/TXT/MX, direct DMARC, hidden empty results, visible failures, and scan/domain gate.');
