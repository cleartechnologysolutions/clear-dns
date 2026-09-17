import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Exercise the Worker API and its delivered client script with mocked DNS.
const source = readFileSync(new URL("./worker/index.js", import.meta.url), "utf8")
  .replace('import { connect } from "cloudflare:sockets";', "")
  .replace("export default {", "globalThis.worker = {");
let queries = [], active = 0, peak = 0;
let crtFailure = 0, crtCalls = 0;
const certificateRows = [
  { name_value: "WWW.example.com\nextra.example.com\nv6.example.com\nretired.example.com", common_name: "extra.example.com" },
  { name_value: "extra.example.com\n*.example.com\n*.wild.example.com\noutside.test\nexample.com.attacker.test\n<img>.example.com" },
  { name_value: "www.example.com.\nextra.example.com" },
  ...Array.from({ length: 15 }, (_, i) => ({ name_value: "cert" + i + ".example.com" })),
];
const server = vm.createContext({
  URL, Response, Request, AbortController, TextDecoder, setTimeout, clearTimeout,
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
assert.match(html, /Build 11/);
assert.doesNotMatch(html, /Clear Technology Solutions|Clear DNS|CLEAR DNS|>CTS</);
assert.doesNotMatch(html, /Standard scan|STANDARD SCAN/);

const elements = new Map();
const batches = [];
const client = vm.createContext({
  URL, URLSearchParams,
  location: { href: "https://dns.example/", origin: "https://dns.example", search: "" },
  history: { replaceState() {} },
  document: { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "", textContent: "", addEventListener() {} });
    return elements.get(id);
  }},
  fetch: async (url, options) => {
    const before = queries.length;
    const response = await worker.fetch(new Request(url, options));
    batches.push(queries.length - before);
    return response;
  },
});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1] +
  "\nglobalThis.run = runLookup; globalThis.report = () => lastText;", client);
elements.get("domain").value = "example.com";
elements.get("type").value = "A";
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
assert.match(report, /v6.example.com AAAA.*2001:db8::1.*\[crt.sh\]/);
assert.doesNotMatch(report, /^retired\.example\.com|^mail\.example\.com|NOT FOUND|No records found|MX RECORDS/m);
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
assert.equal(elements.get("status").textContent, "Done. crt.sh discovery incomplete.");
assert.doesNotMatch(client.report(), /retired.example.com|NOT FOUND/);
crtFailure = 302;
const redirected = await worker.fetch(new Request("https://dns.example/api/lookup?name=example.com&mode=crt"));
assert.equal(redirected.status, 502);
assert.match((await redirected.json()).error, /crt.sh returned HTTP 302/);
await client.run("all");
assert.doesNotMatch(client.report(), /MX RECORDS|No records found/);
console.log("PASS: requested host coverage; bounded DNS batches; crt.sh parsing, deduplication and domain filtering; live-answer-only report including IPv6; input limits; provider failure preserves standard results.");
