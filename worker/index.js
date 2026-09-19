import { connect } from "cloudflare:sockets";

const DNS_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const RDAP_BOOTSTRAP_ENDPOINT = "https://data.iana.org/rdap/dns.json";
const CRT_ENDPOINT = "https://crt.sh/";
const MAX_CERTIFICATE_NAMES = 1000;

const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"];

const ORIGINAL_HOSTS = [
  "www",
  "mail",
  "autodiscover",
  "autoconfig",
  "smtp",
  "imap",
  "pop",
  "vpn",
  "remote",
  "portal",
  "owa",
  "webmail",
  "connect",
  "ftp",
  "web",
  "cpanel",
  "m",
  "test",
  "blog",
  "pop3",
  "dev",
  "secure",
  "api",
  "admin",
  "whm",
  "forum",
  "app",
  "shop",
  "store",
  "support",
  "server",
  "news",
  "staging",
  "host",
  "beta",
  "crm",
  "en",
  "mx1",
  "sso",
  "status",
  "billing",
  "docs",
  "chat",
  "video",
  "cloud",
  "sql",
  "login",
  "uat",
  "db",
  "www1",
  "www2",
  "exchange",
  "enterpriseenrollment",
  "enterpriseregistration",
  "mail1",
  "mail2",
  "mx",
  "mx2",
  "mx3",
  "smtp1",
  "smtp2",
  "ns",
  "ns1",
  "ns2",
  "ns3",
  "dns",
  "dns1",
  "dns2",
  "intranet",
  "extranet",
  "internal",
  "adfs",
  "sts",
  "auth",
  "accounts",
  "id",
  "identity",
  "rdp",
  "rdweb",
  "rdgateway",
  "rdsgateway",
  "terminal",
  "citrix",
  "gateway",
  "firewall",
  "fw",
  "files",
  "file",
  "download",
  "downloads",
  "sftp",
  "backup",
  "nas",
  "monitor",
  "monitoring",
  "grafana",
  "jenkins",
  "git",
  "gitlab",
  "helpdesk",
];

// These are hostname guesses, not evidence that a company uses a vendor.
// Preserve earlier coverage and deduplicate names shared by categories.
const HOST_GROUPS = {
  mail: "email mx smtp pop imap webmail mail3 mx4 smtp3 pop2 imaps smtps relay mailrelay inbound outbound inbound-mail outbound-mail mailgw mailgateway antispam spam spamfilter quarantine mimecast proofpoint barracuda spf dkim dmarc mta mta-sts autodiscover autoconfig lists listserv newsletter newsletters emailtracking tracking click links sendgrid mailgun postmark mandrill amazonses sendinblue brevo mailchimp",
  environments: "app apps api api2 api-v2 graphql rest ws websocket dev development stage staging test testing qa uat prod production beta demo sandbox preview preprod acceptance integration lab labs playground pilot poc review canary api.dev api.staging api.test dev.api staging.api test.api dev.www staging.www test.www",
  development: "git github gitlab bitbucket code source repos repository svn hg ci cd build builds jenkins bamboo teamcity travis circleci drone argo argocd pipelines devops artifacts artifactory nexus packages npm pypi nuget maven registry docker harbor containers k8s kubernetes rancher openshift portainer sonar sonarqube sentry bugs bugzilla redmine youtrack jira confluence atlassian crucible fisheye gerrit gitea forgejo",
  identity: "login auth sso identity accounts account id ids idp adfs sts saml oauth oauth2 oidc openid signon signin okta auth0 onelogin ping pingidentity duo keycloak ldap directory password passwords reset myaccount signup register registration mfa verify access accessmanager authentik vault secrets cyberark beyondtrust teleport pam",
  management: "portal secure gateway gw admin panel manage management manager monitor monitoring dashboard dashboards console control controlpanel cockpit webadmin adminportal plesk whm cpanel directadmin webmin whmcs",
  public: "blog news media press newsroom events event calendar podcasts podcast videos tv live stream streaming radio webinar webinars about contact partners partner partnerportal customers customer members member my home landing mobile touch welcome community forum forums discuss discourse groups wiki kb knowledge knowledgebase learn learning training academy education university docs documentation developers developer careers jobs recruitment recruiting talent volunteers",
  commerce: "shop store cart pay payments payment checkout billing invoice invoices subscriptions subscribe orders order ecommerce commerce pos marketplace catalog catalogue products sales salesforce salesforcehr crm dynamics dynamics365 hubspot zoho pipedrive freshsales sugarcrm insightly netsuite oracle sap erp odoo magento shopify woocommerce bigcommerce stripe paypal braintree adyen square chargebee recurly zuora",
  support: "support help helpdesk servicedesk service-desk service services tickets ticket ticketing zendesk freshdesk freshservice intercom helpscout desk service-now servicenow remedy connectwise autotask halo halopsa kaseya nable n-central ninja ninjaone atera syncro rmm screenconnect bomgar rescue teamviewer splashtop anydesk supportportal assist assistance feedback status statuspage incident incidents uptime",
  departments: "hr finance legal marketing accounting payroll benefits employees employee staff people peopleops personnel workday bamboohr adp paychex paylocity ukg kronos gusto rippling successfactors recruiting greenhouse lever smartrecruiters icims taleo ashby procurement purchasing expenses expense travel concur coupa suppliers vendor vendors sourcing operations ops facilities safety security compliance privacy trust contracts docusign hellosign adobe esign signature signatures board executive investor investors ir",
  collaboration: "slack teams meet meetings meeting zoom webex skype lync sip lyncext meetext dialin voice voip phone phones pbx asterisk freepbx 3cx ringcentral talk chat mattermost rocket rocketchat matrix element jabber xmpp jitsi bluejeans gotomeeting mural miro notion trello asana monday clickup airtable smartsheet basecamp wrike todo tasks projects project planner sharepoint onedrive share drive dropbox box nextcloud owncloud seafile onlyoffice collabora workspace office office365 o365 microsoft365 m365 outlook exchange online webapps intranet extranet yammer viva intune mdm enrollment enroll enterpriseenrollment enterpriseregistration companyportal endpoint jamf kandji mosyle meraki workspaceone airwatch mobileiron ivanti sccm wsus updates update patches",
  assets: "cdn cdn1 cdn2 static static1 static2 assets asset img images image media download downloads upload uploads content resources public storage objects s3 bucket buckets backup backups restore archive archives files file ftp sftp ftps tftp rsync mirror mirrors repository dist releases release install installer software binaries packages fonts js css video audio thumbnails photos pictures gallery cache",
  infrastructure: "cloud aws azure gcp google amazon digitalocean linode vultr rackspace cloudflare fastly akamai incapsula imperva edge origin origin-www origin-api direct lb loadbalancer proxy proxy1 proxy2 reverseproxy nginx haproxy traefik varnish gateway gw vpn1 vpn2 sslvpn vpnportal wireguard openvpn globalprotect fortigate fortinet sonicwall checkpoint paloalto zscaler prisma sdwan bastion jump jumphost jumpbox ssh remoteaccess vdi horizon vmware vcenter esxi proxmox hyperv nutanix xen citrix storefront netscaler director virtual appsremote rd rdweb rds rdp remote desktop desktops terminal terminalserver ts tsweb ts1 ts2 rdgateway rdsgateway dhcp ntp time radius nac ise clearpass ipam netbox dc dc1 dc2 ad active-directory domaincontroller ns4 ns5 dns3 dns4 bind powerdns resolver dnsadmin dnsmanager nslookup whois",
  observability: "metrics prometheus grafana alertmanager alerts alert kibana elastic elasticsearch opensearch log logs logging logstash graylog splunk datadog newrelic appdynamics dynatrace apm tracing traces jaeger zipkin otel opentelemetry honeycomb sumologic loki nagios zabbix icinga prtg cacti observium librenms checkmk opmanager solarwinds uptime kuma health healthcheck heartbeat sensu telegraf influx influxdb chronograf kapacitor stats statistics analytics matomo piwik plausible umami clarity hotjar segment mixpanel amplitude metabase superset tableau powerbi bi reports reporting report looker redash qlik geckoboard",
  data: "db database databases sql mysql mariadb postgres postgresql pg pgadmin pma phpmyadmin adminer mssql mongo mongodb redis memcached couchdb couchbase cassandra clickhouse cockroachdb timescale timescaledb influxdb neo4j orientdb snowflake databricks redshift bigquery data warehouse lake lakehouse kafka rabbitmq activemq queue mq nats pulsar zookeeper consul etcd minio ceph swift hdfs hadoop spark airflow prefect dagster nifi flink jupyter notebook notebooks rstudio ml ai llm ollama inference models model mlflow kubeflow h2o feast vector search solr sphinx typesense meilisearch algolia elasticsearch",
  regional: "us usa uk eu europe au australia ca canada de fr es it nl ie jp cn in apac emea na latam en eng www3 www4 www5 web1 web2 server1 server2 host1 host2 east west central us-east us-west eu-west eu-central ap-south ap-southeast",
};
const STANDARD_HOSTS = [...new Set([
  ...ORIGINAL_HOSTS,
  ...Object.values(HOST_GROUPS).flatMap(names => names.split(" ")),
])];

const DKIM_SELECTORS = ["selector1", "selector2", "google", "default"];

const TYPE_CODES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257,
};

const STATUS_TEXT = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeName(value) {
  let name = String(value || "").trim().toLowerCase();
  name = name.replace(/^https?:\/\//, "");
  name = name.split("/")[0] || name;
  name = name.replace(/^\.+|\.+$/g, "");

  if (!name || name.length > 253) return "";
  if (!/^[a-z0-9._-]+$/.test(name)) return "";
  if (!name.includes(".")) return "";

  return name;
}

function normalizeType(value) {
  const type = String(value || "A").trim().toUpperCase();
  return TYPE_CODES[type] ? type : "A";
}

function textRecords(records) {
  return records
    .filter((record) => record.type === TYPE_CODES.TXT)
    .map((record) => String(record.data || "").replace(/^"|"$/g, "").replaceAll('" "', ""));
}

function summarizeMail(domain, results) {
  const mx = results.MX?.Answer || [];
  const txt = textRecords(results.TXT?.Answer || []);
  const dmarcTxt = textRecords(results.DMARC?.Answer || []);
  const spf = txt.filter((record) => record.toLowerCase().startsWith("v=spf1"));
  const dmarc = dmarcTxt.find((record) => record.toLowerCase().startsWith("v=dmarc1"));
  const mxSummary = mx.length ? `${mx.length} MX record${mx.length === 1 ? "" : "s"} found` : "No MX records found";
  const spfSummary = spf.length === 1 ? "SPF found" : spf.length > 1 ? "Multiple SPF records found" : "No SPF record found";
  let dmarcSummary = "No DMARC record found";

  if (dmarc) {
    const policy = dmarc.match(/;\s*p=([^;\s]+)/i)?.[1] || "unknown";
    dmarcSummary = `DMARC found, policy is ${policy}`;
  }

  const warnings = [];
  if (!mx.length) warnings.push("No MX records. This domain may not receive mail.");
  if (!spf.length) warnings.push("No SPF record.");
  if (spf.length > 1) warnings.push("More than one SPF record. That can break SPF.");
  if (!dmarc) warnings.push("No DMARC record.");
  if (dmarc && /;\s*p=none/i.test(dmarc)) warnings.push("DMARC policy is p=none.");

  return {
    domain,
    mx: mxSummary,
    spf: spfSummary,
    dmarc: dmarcSummary,
    warnings,
    records: {
      mx: mx.map((record) => record.data),
      spf,
      txt,
      dmarc: dmarc ? [dmarc] : [],
    },
  };
}

function answerValues(response, type) {
  if (response.Status !== 0) return [];
  // Resolver responses may contain both aliases and addresses. Keep the
  // requested type so a CNAME-only answer is not displayed as an A/AAAA record.
  return (response.Answer || []).filter(record => record.type === TYPE_CODES[type]).map((record) => ({
    ttl: record.TTL || 0,
    value: record.data || "",
  }));
}

async function safeLookup(name, type) {
  try {
    const response = await lookupDns(name, type);
    return {
      status: response.StatusText,
      answers: answerValues(response, type),
    };
  } catch (error) {
    return {
      status: "ERROR",
      answers: [],
      error: error.message || "Lookup failed.",
    };
  }
}

async function runDnsTasks(batch) {
  const checks = new Array(batch.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, batch.length) }, async () => {
    while (next < batch.length) {
      const index = next++;
      const task = batch[index];
      checks[index] = { ...task, ...(await safeLookup(task.name, task.type)) };
    }
  }));
  return checks;
}

function isDomainHostname(name, domain) {
  return typeof name === "string" && name.length <= 253 &&
    (name === domain || name.endsWith("." + domain)) &&
    name.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function certificateNames(rows, domain) {
  if (!Array.isArray(rows)) throw new Error("crt.sh returned an unexpected response.");
  const names = new Set();
  const patterns = new Set();
  let limited = false;
  for (const row of rows) {
    // Keep wildcard certificate patterns as history without inventing hosts.
    for (const field of [row?.name_value, row?.common_name]) {
      if (typeof field !== "string") continue;
      for (const value of field.split(/\r?\n/)) {
        const name = value.trim().toLowerCase().replace(/\.$/, "");
        if (name.startsWith("*.") && isDomainHostname(name.slice(2), domain)) {
          if (patterns.has(name)) continue;
          if (names.size + patterns.size >= MAX_CERTIFICATE_NAMES) { limited = true; continue; }
          patterns.add(name);
          continue;
        }
        if (!isDomainHostname(name, domain) || names.has(name)) continue;
        if (names.size + patterns.size >= MAX_CERTIFICATE_NAMES) { limited = true; continue; }
        names.add(name);
      }
    }
  }
  return { names: [...names].sort(), patterns: [...patterns].sort(), limited };
}

async function discoverCertificateNames(domain) {
  if (!isDomainHostname(domain, domain)) throw new Error("Enter a domain hostname for crt.sh.");
  const url = new URL(CRT_ENDPOINT);
  url.searchParams.set("q", "%." + domain);
  url.searchParams.set("output", "json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      redirect: "manual",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("crt.sh returned HTTP " + response.status + ".");
    }
    // Bound external input before JSON parsing on the Worker.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("crt.sh response is too large for this lookup.");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const result = certificateNames(JSON.parse(text), domain);
    return { domain, ...result, source: "crt.sh" };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("crt.sh timed out. Standard Records are still available.");
    if (error instanceof SyntaxError) throw new Error("crt.sh did not return valid JSON.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function standardScan(domain, offset = 0) {
  const tasks = [
    ...DNS_TYPES.map(type => ({ name: domain, type })),
    ...STANDARD_HOSTS.flatMap(host => ["A", "AAAA", "CNAME"].map(type => ({ name: `${host}.${domain}`, type }))),
    { name: `_dmarc.${domain}`, type: "TXT" },
    ...DKIM_SELECTORS.map(selector => ({ name: `${selector}._domainkey.${domain}`, type: "TXT" })),
  ];
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= tasks.length) {
    throw new Error("Invalid Standard Records offset.");
  }
  // Each browser request stays below the Free plan's 50-subrequest ceiling.
  const batch = tasks.slice(offset, offset + 40);
  const checks = await runDnsTasks(batch);
  return {
    domain,
    checked: checks.length,
    found: checks.filter(check => check.answers.length).length,
    checks,
    total: tasks.length,
    hostCount: STANDARD_HOSTS.length,
    wildcardScopes: [...new Set([domain, ...STANDARD_HOSTS.filter(host => host.includes(".")).map(host => host.slice(host.indexOf(".") + 1) + "." + domain)])],
    nextOffset: offset + batch.length < tasks.length ? offset + batch.length : null,
  };
}

function findEntityName(entities = [], role) {
  const entity = entities.find((item) => (item.roles || []).includes(role));
  const vcard = entity?.vcardArray?.[1] || [];
  const org = vcard.find((item) => item[0] === "org")?.[3];
  const fn = vcard.find((item) => item[0] === "fn")?.[3];
  return Array.isArray(org) ? org.filter(Boolean).join(" ") : org || fn || "";
}

function findEvent(events = [], action) {
  return events.find((event) => event.eventAction === action)?.eventDate || "";
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/rdap+json, application/json",
      "user-agent": "DNSTools/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function rdapLookup(domain) {
  const tld = domain.split(".").pop();
  const errors = [];

  try {
    const bootstrap = await fetchJson(RDAP_BOOTSTRAP_ENDPOINT);
    const service = (bootstrap.services || []).find(([tlds]) => tlds.includes(tld));

    if (service) {
      for (const baseUrl of service[1]) {
        try {
          return await fetchJson(`${baseUrl.replace(/\/$/, "")}/domain/${encodeURIComponent(domain)}`);
        } catch (error) {
          errors.push(`${baseUrl}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    errors.push(`IANA bootstrap: ${error.message}`);
  }

  const fallbackUrls = [
    `https://rdap.verisign.com/${encodeURIComponent(tld)}/v1/domain/${encodeURIComponent(domain)}`,
    `https://rdap.publicinterestregistry.org/rdap/domain/${encodeURIComponent(domain)}`,
  ];

  for (const url of fallbackUrls) {
    try {
      return await fetchJson(url);
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  return { error: errors.join("; ") || "RDAP lookup failed." };
}

function rdapContacts(entities, depth=0, parent="") {
  if(depth>5||!Array.isArray(entities))return [];
  const text=v=>Array.isArray(v)?v.map(text).filter(Boolean).join(", "):typeof v==="string"?v:"";
  return entities.slice(0,100).flatMap(entity=>{
    const properties=Array.isArray(entity.vcardArray?.[1])?entity.vcardArray[1]:[];
    const values=name=>properties.filter(p=>p[0]===name).map(p=>name==="adr"?(p[1]?.label||text(p[3])):text(p[3])).filter(Boolean);
    const name=values("fn").join("; "),organization=values("org").join("; ");
    return [{roles:entity.roles||[],handle:entity.handle||"",parent,name,organization,
      email:values("email"),phone:values("tel"),address:values("adr"),url:values("url"),
      remarks:(entity.remarks||[]).flatMap(r=>r.description||[]).filter(v=>typeof v==="string")},
      ...rdapContacts(entity.entities,depth+1,name||organization||entity.handle||parent)];
  }).slice(0,100);
}

async function domainInfo(domain) {
  const [rdapResult, ds, dnskey, ns] = await Promise.all([
    rdapLookup(domain),
    safeLookup(domain, "DS"),
    safeLookup(domain, "DNSKEY"),
    safeLookup(domain, "NS"),
  ]);

  const rdapNameservers = (rdapResult.nameservers || [])
    .map((server) => server.ldhName || server.unicodeName)
    .filter(Boolean);
  const dnsNameservers = ns.answers.map((answer) => answer.value.replace(/\.$/, ""));
  const nameservers = rdapNameservers.length ? rdapNameservers : dnsNameservers;

  const registrar = findEntityName(rdapResult.entities || [], "registrar");
  const registrant = findEntityName(rdapResult.entities || [], "registrant");
  const dsValues = ds.answers.map((answer) => answer.value);
  const dnskeyValues = dnskey.answers.map((answer) => answer.value);

  return {
    domain,
    registrar: registrar || "Unknown",
    registrant: registrant || "Redacted or unavailable",
    created: findEvent(rdapResult.events || [], "registration") || "Unknown",
    updated: findEvent(rdapResult.events || [], "last changed") || "Unknown",
    expires: findEvent(rdapResult.events || [], "expiration") || "Unknown",
    status: rdapResult.status || [],
    nameservers,
    dnssec: dsValues.length ? "DS record found" : dnskeyValues.length ? "DNSKEY found, no DS seen" : "No DS/DNSKEY records found",
    ds: dsValues,
    dnskeyCount: dnskeyValues.length,
    rdapError: rdapResult.error || "",
    contacts: rdapContacts(rdapResult.entities),
  };
}

function publicWebAddress(ip) {
  if (ip.includes(":")) return /^[23][0-9a-f]{3}:/i.test(ip) && !/^2001:(db8|0):/i.test(ip);
  const p=ip.split(".").map(Number);
  return p.length===4 && p.every(n=>Number.isInteger(n)&&n>=0&&n<=255) &&
    ![0,10,127].includes(p[0]) && p[0]<224 &&
    !(p[0]===169&&p[1]===254) && !(p[0]===172&&p[1]>=16&&p[1]<=31) &&
    !(p[0]===192&&(p[1]===168||p[1]===0)) && !(p[0]===100&&p[1]>=64&&p[1]<=127) &&
    !(p[0]===198&&(p[1]===18||p[1]===19));
}

async function checkWebPort(hostname, port, address) {
  const url=(port===443?"https://":"http://")+hostname+"/";
  const started=Date.now();
  const controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),4500);
  try {
    const response=await fetch(url,{method:"HEAD",redirect:"manual",signal:controller.signal});
    await response.body?.cancel();
    return {hostname,port,url,status:"OPEN",detail:"HTTP "+response.status,ms:Date.now()-started};
  } catch {} finally {clearTimeout(deadline);}
  // An invalid certificate or non-HTTP service can still have an open TCP port.
  let socket,timer;
  try {
    socket=connect({hostname:address,port});
    socket.closed.catch(()=>{});
    await Promise.race([socket.opened,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Timeout")),2500);})]);
    return {hostname,port,url,status:"OPEN",detail:"TCP connected; web response/TLS not verified",ms:Date.now()-started};
  } catch {return {hostname,port,status:"UNCONFIRMED",detail:"No response, filtered, or restricted from Cloudflare"};}
  finally {clearTimeout(timer);if(socket)await socket.close().catch(()=>{});}
}
async function checkWebHost(hostname) {
  // Safety lookup only for the selected discovered host, never the guess list.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try {
    const answers=await Promise.all(["A","AAAA"].map(async type=>{
      const r=await fetch(DNS_ENDPOINT+"?name="+encodeURIComponent(hostname)+"&type="+type,{headers:{accept:"application/dns-json"},signal:controller.signal});
      if(!r.ok)throw Error("DNS safety check failed");
      const data=await r.json();if(![0,3].includes(data.Status))throw Error("DNS safety check failed");
      return (data.Answer||[]).filter(a=>[1,28].includes(a.type)).map(a=>a.data);
    }));
    const ips=answers.flat();
    if(!ips.length||ips.some(ip=>!publicWebAddress(ip)))throw Error("No public-only address available");
    return await Promise.all([80,443].map(port=>checkWebPort(hostname,port,ips[0])));
  } catch {return [80,443].map(port=>({hostname,port,status:"UNCONFIRMED",detail:"DNS unavailable or private/special address"}));}
  finally {clearTimeout(timer);}
}

async function lookupDns(name, type) {
  const query = new URL(DNS_ENDPOINT);
  query.searchParams.set("name", name);
  query.searchParams.set("type", type);

  const response = await fetch(query, {
    headers: {
      accept: "application/dns-json",
      "user-agent": "DNSTools/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`DNS lookup failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  data.StatusText = STATUS_TEXT[data.Status] || `Code ${data.Status}`;
  return data;
}

async function apiResponse(request) {
  const url = new URL(request.url);
  const domain = normalizeName(url.searchParams.get("name"));
  const mode = String(url.searchParams.get("mode") || "single").toLowerCase();
  const type = normalizeType(url.searchParams.get("type"));

  if (!domain) {
    return Response.json({ error: "Enter a valid domain name." }, { status: 400 });
  }

  try {
    if (mode === "all") {
      const entries = await Promise.all(
        DNS_TYPES.map(async (recordType) => [recordType, await lookupDns(domain, recordType)])
      );
      return Response.json(Object.fromEntries(entries), { headers: noStoreHeaders("application/json") });
    }

    if (mode === "mail") {
      const [mx, txt, dmarc] = await Promise.all([
        lookupDns(domain, "MX"),
        lookupDns(domain, "TXT"),
        lookupDns(`_dmarc.${domain}`, "TXT"),
      ]);

      return Response.json(
        summarizeMail(domain, { MX: mx, TXT: txt, DMARC: dmarc }),
        { headers: noStoreHeaders("application/json") }
      );
    }

    if (mode === "mail-subdomains") {
      if(request.method!=="POST")return Response.json({error:"Use POST with discovered subdomains."},{status:405});
      const raw=await request.text();if(raw.length>4096)return Response.json({error:"Batch too large."},{status:400});
      let hosts;try{hosts=JSON.parse(raw).hosts;}catch{return Response.json({error:"Invalid JSON."},{status:400});}
      if(!Array.isArray(hosts)||!hosts.length||hosts.length>12||!hosts.every(host=>host!==domain&&isDomainHostname(host,domain)))return Response.json({error:"Invalid discovered subdomains."},{status:400});
      const tasks=[...new Set(hosts)].flatMap(host=>[
        {name:host,type:"MX",host},{name:host,type:"TXT",host},{name:"_dmarc."+host,type:"TXT",host}
      ]);
      return Response.json({checks:await runDnsTasks(tasks)},{headers:noStoreHeaders("application/json")});
    }

    if (mode === "audit") {
      const offset = Number(url.searchParams.get("offset") || 0);
      return Response.json(await standardScan(domain, offset), { headers: noStoreHeaders("application/json") });
    }

    if (mode === "crt") {
      return Response.json(await discoverCertificateNames(domain), { headers: noStoreHeaders("application/json") });
    }

    if (mode === "wildcard") {
      if (request.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
      const scopes = (await request.json()).scopes;
      if (!Array.isArray(scopes) || !scopes.length || scopes.length > 4 ||
          !scopes.every(scope => typeof scope === "string" && isDomainHostname(scope, domain) && scope.length <= 210)) {
        return Response.json({ error: "Invalid wildcard scopes." }, { status: 400 });
      }
      const profiles = [];
      for (const scope of new Set(scopes)) {
        const tasks = Array.from({ length: 3 }, () => "wcprobe-" + crypto.randomUUID().replaceAll("-", "") + "." + scope)
          .flatMap(name => ["A", "AAAA", "CNAME"].map(type => ({ name, type })));
        const checks = await runDnsTasks(tasks);
        const values = {};
        const incomplete = checks.some(check => !["NOERROR", "NXDOMAIN"].includes(check.status));
        for (const type of ["A", "AAAA", "CNAME"]) {
          const samples = checks.filter(check => check.type === type);
          // A failed AAAA probe must not invalidate three successful A probes.
          if (samples.every(check => check.status === "NOERROR" && check.answers.length)) {
            values[type] = [...new Set(samples.flatMap(check => check.answers.map(answer => answer.value.toLowerCase().replace(/\.$/, ""))))];
          }
        }
        profiles.push({ scope, values, incomplete });
      }
      return Response.json({ profiles }, { headers: noStoreHeaders("application/json") });
    }

    if (mode === "crt-records") {
      if (request.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
      const tasks = (await request.json()).tasks;
      if (!Array.isArray(tasks) || !tasks.length || tasks.length > 40 ||
          !tasks.every(task => task && isDomainHostname(task.name, domain) &&
            ["A", "AAAA", "CNAME"].includes(task.type))) {
        return Response.json({ error: "Invalid certificate DNS checks." }, { status: 400 });
      }
      const unique = [...new Map(tasks.map(task =>
        [task.name + "|" + task.type, { name: task.name, type: task.type, source: "crt.sh" }]
      )).values()];
      const checks = await runDnsTasks(unique);
      return Response.json({ checks }, { headers: noStoreHeaders("application/json") });
    }

    if (mode === "domain") {
      return Response.json(await domainInfo(domain), { headers: noStoreHeaders("application/json") });
    }

    if (mode === "web") {
      if(request.method!=="POST")return Response.json({error:"Run Standard Records first."},{status:405});
      const raw=await request.text();if(raw.length>4096)return Response.json({error:"Batch too large."},{status:400});
      const hosts=JSON.parse(raw).hosts;
      if(!Array.isArray(hosts)||!hosts.length||hosts.length>4||!hosts.every(host=>isDomainHostname(host,domain)))return Response.json({error:"Invalid discovered hostnames."},{status:400});
      const results=[];
      // Two hosts / four connections at a time; small requests fit Worker limits.
      const unique=[...new Set(hosts)];
      for(let i=0;i<unique.length;i+=2)results.push(...(await Promise.all(unique.slice(i,i+2).map(checkWebHost))).flat());
      return Response.json({domain,results},{headers:noStoreHeaders("application/json")});
    }
    if(mode==="ports")return Response.json({error:"Common ports was replaced by Check web ports after Standard Records."},{status:410});

    return Response.json(await lookupDns(domain, type), { headers: noStoreHeaders("application/json") });
  } catch (error) {
    return Response.json({ error: error.message || "DNS lookup failed." }, { status: 502 });
  }
}

function noStoreHeaders(contentType) {
  return {
    "content-type": `${contentType}; charset=utf-8`,
    "cache-control": "no-store",
  };
}

function pageResponse() {
  const typeOptions = DNS_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DNS Tools</title>
  <meta name="description" content="DNS lookup and mail health checker.">
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #07111d;
      color: #f8fafc;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top right, rgba(34, 211, 238, 0.16), transparent 34rem),
        linear-gradient(180deg, #07111d 0%, #0b1625 100%);
    }
    button:disabled { opacity: .45; cursor: not-allowed; }
    .web-prerequisite { padding: 12px; border-left: 3px solid #22d3ee; background: #102333; color: #d6edf5; font-size: 13px; line-height: 1.65; }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 20px 0 48px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      border: 1px solid rgba(103, 232, 249, 0.22);
      border-radius: 8px;
      background: #0d1a29;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border: 1px solid rgba(165, 243, 252, 0.72);
      border-radius: 8px;
      background: rgba(34, 211, 238, 0.15);
      color: white;
      font-weight: 900;
      letter-spacing: 0.08em;
      box-shadow: inset 0 0 24px rgba(103, 232, 249, 0.12);
    }
    .brand-title {
      margin: 0;
      font-size: 18px;
      line-height: 1.1;
      font-weight: 900;
    }
    .brand-subtitle {
      margin: 4px 0 0;
      color: rgba(207, 250, 254, 0.82);
      font-size: 14px;
      font-weight: 600;
    }
    .layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    .panel {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
    }
    .side {
      padding: 20px;
    }
    h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1;
    }
    .side p {
      margin: 14px 0 0;
      color: #cbd5e1;
      font-size: 15px;
      line-height: 1.65;
    }
    label {
      display: block;
      margin: 22px 0 8px;
      color: #e0f2fe;
      font-size: 13px;
      font-weight: 900;
    }
    input, select {
      width: 100%;
      min-height: 48px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      padding: 12px;
      background: #080e1d;
      color: #fff;
      font: inherit;
      font-weight: 800;
      outline: none;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 110px;
      gap: 10px;
    }
    .actions {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    button {
      min-height: 46px;
      border: 0;
      border-radius: 8px;
      padding: 12px 14px;
      background: #22d3ee;
      color: #06111f;
      cursor: pointer;
      font: inherit;
      font-weight: 900;
    }
    button.secondary {
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(2, 6, 23, 0.35);
      color: #f8fafc;
    }
    .status {
      margin-top: 18px;
      color: #a5f3fc;
      font-size: 13px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }
    .result {
      min-height: 620px;
      overflow: hidden;
    }
    .result-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .result-title {
      margin: 0;
      color: #a5f3fc;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .record-list {
      display: grid;
      gap: 12px;
      max-height: 560px;
      overflow: auto;
      padding: 20px;
    }
    .record {
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(2, 6, 23, 0.35);
    }
    .record-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #93c5fd;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .record-data {
      margin: 10px 0 0;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      color: #f8fafc;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 14px;
      line-height: 1.45;
    }
    .console-output {
      margin: 0;
      min-height: 520px;
      overflow: auto;
      white-space: pre;
      color: #dbeafe;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.55;
    }
    .console-wrap {
      padding: 16px;
      border: 1px solid rgba(103, 232, 249, 0.18);
      border-radius: 8px;
      background: rgba(2, 6, 23, 0.48);
    }
    .empty {
      display: grid;
      place-items: center;
      min-height: 320px;
      border: 1px dashed rgba(148, 163, 184, 0.3);
      border-radius: 8px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.6;
    }
    .summary {
      display: grid;
      gap: 12px;
    }
    .pill {
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(2, 6, 23, 0.35);
    }
    .pill strong {
      display: block;
      color: #f8fafc;
      overflow-wrap: anywhere;
    }
    .pill span {
      display: block;
      margin-top: 5px;
      color: #94a3b8;
      font-size: 13px;
    }
    .warning {
      border-color: rgba(251, 191, 36, 0.45);
      color: #fde68a;
    }
    @media (max-width: 880px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .row {
        grid-template-columns: 1fr;
      }
      header {
        align-items: flex-start;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">
        <div>
          <p class="brand-title">DNS Tools</p>
          <p class="brand-subtitle">Build 16</p>
        </div>
      </div>
    </header>

    <section class="layout">
      <aside class="panel side">
        <h1>DNS lookup</h1>
        <p>Check common DNS records, TXT records, MX, DMARC, and basic mail health from one simple page.</p>

        <form id="lookup-form">
          <label for="domain">Domain</label>
          <input id="domain" name="domain" autocomplete="off" spellcheck="false" placeholder="example.com">

          <label for="type">Record type</label>
          <div class="row">
            <select id="type" name="type">${typeOptions}</select>
            <button type="submit">Lookup</button>
          </div>

          <div class="actions">
            <button type="button" class="secondary" id="audit">Standard Records</button>
            <button type="button" class="secondary" id="ports" disabled aria-describedby="web-prerequisite" title="Run Standard Records and wait for it to finish">Check web ports</button>
            <button type="button" class="secondary" id="domain-info">Domain info</button>
            <button type="button" class="secondary" id="all">All common records</button>
            <button type="button" class="secondary" id="mail">Mail check</button>
            <button type="button" class="secondary" id="copy">Copy results</button>
          </div>
          <p id="web-prerequisite" role="status" aria-live="polite" class="web-prerequisite"><strong>Step 1:</strong> Run Standard Records and wait for the scan to finish.<br><strong>Step 2:</strong> Check web ports will unlock automatically.</p>
        </form>

        <div class="status" id="status">Ready.</div>
      </aside>

      <section class="panel result">
        <div class="result-head">
          <p class="result-title" id="result-title">Results</p>
        </div>
        <div class="record-list" id="results">
          <div class="empty">Enter a domain and run a lookup.</div>
        </div>
      </section>
    </section>
  </main>

  <script>
    const form = document.getElementById("lookup-form");
    const domainInput = document.getElementById("domain");
    const typeInput = document.getElementById("type");
    const auditButton = document.getElementById("audit");
    const portsButton = document.getElementById("ports");
    const domainInfoButton = document.getElementById("domain-info");
    const allButton = document.getElementById("all");
    const mailButton = document.getElementById("mail");
    const copyButton = document.getElementById("copy");
    const statusBox = document.getElementById("status");
    const resultTitle = document.getElementById("result-title");
    const results = document.getElementById("results");
    let lastText = "";
    let lookupSequence = 0;
    let showWildcards = false;
    let currentAudit = null;
    let savedAudit = null, discoveredWebHosts = [], webBusy = false, auditRunning = false;
    function updateWebButton(){
      const ready=!!savedAudit&&cleanDomain(domainInput.value).toLowerCase()===savedAudit.domain;
      portsButton.disabled=webBusy||auditRunning||!ready;
      const hint=document.getElementById("web-prerequisite");
      if(auditRunning){hint.textContent="Scan in progress: The results appearing now are partial. Wait for Standard Records to finish; Check web ports will unlock automatically.";}
      else if(webBusy){hint.textContent="Step 2 in progress: Checking ports 80 and 443 on the discovered hostnames.";}
      else if(ready){hint.textContent="Step 1 complete. Ready for step 2: Click Check web ports to check ports 80 and 443 on "+savedAudit.hosts.length+" discovered hostnames.";}
      else{hint.textContent="Step 1: Run Standard Records and wait for the scan to finish. Step 2: Check web ports will unlock automatically.";}
      portsButton.title=hint.textContent;
    }
    domainInput.addEventListener("input",updateWebButton);

    results.addEventListener("change", event => {
      if (event.target.id !== "show-wildcards" || !currentAudit) return;
      showWildcards = event.target.checked;
      renderAudit(currentAudit);
    });

    const params = new URLSearchParams(location.search);
    if (params.get("domain")) {
      domainInput.value = params.get("domain");
    }

    function cleanDomain(value) {
      return value.trim().replace(/^https?:\\/\\//i, "").split("/")[0].replace(/^\\.+|\\.+$/g, "");
    }

    function escapeText(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
    }

    function setStatus(message) {
      statusBox.textContent = message;
    }

    function recordHtml(type, record, statusText) {
      const ttl = record.TTL ? "TTL " + record.TTL : statusText || "";
      return '<article class="record"><div class="record-top"><span>' + escapeText(type) + '</span><span>' + escapeText(ttl) + '</span></div><pre class="record-data">' + escapeText(record.data || "") + '</pre></article>';
    }

    function renderSingle(type, data) {
      const answers = data.Answer || [];
      resultTitle.textContent = type + " records";
      if (!answers.length) {
        results.innerHTML = '<div class="empty">No ' + escapeText(type) + ' records found.<br>Status: ' + escapeText(data.StatusText || data.Status) + '</div>';
        lastText = "No " + type + " records found.";
        return;
      }

      results.innerHTML = answers.map((record) => recordHtml(type, record, data.StatusText)).join("");
      lastText = answers.map((record) => type + " " + record.data).join("\\n");
    }

    function renderAll(data) {
      resultTitle.textContent = "All common records";
      const lines = [
        "DNS COMMON RECORDS",
        "Record types: A, AAAA, CNAME, MX, TXT, NS, SOA, CAA",
        ""
      ];

      for (const [type, response] of Object.entries(data)) {
        const answers = response.Answer || [];
        if (!answers.length) continue;
        lines.push(type + " RECORDS");
        lines.push("-".repeat(type.length + 8));

        for (const record of answers) {
          const ttl = record.TTL ? ("TTL " + String(record.TTL)).padEnd(10, " ") : "".padEnd(10, " ");
          lines.push(ttl + record.data);
        }

        lines.push("");
      }

      lastText = lines.join("\\n");
      results.innerHTML = '<div class="console-wrap"><pre class="console-output">' + escapeText(lastText) + '</pre></div>';
    }

    function renderMail(data) {
      resultTitle.textContent="Mail check";
      const lines=["MAIL CHECK", "PRIMARY DOMAIN: "+data.domain, "", data.mx, data.spf, data.dmarc, ""];
      for(const warning of data.warnings)lines.push("NOTE: "+warning);
      for(const [title,records] of [["MX",data.records.mx],["SPF",data.records.spf],["TXT",data.records.txt||[]],["DMARC",data.records.dmarc]]){
        if(!records.length)continue;
        lines.push("",title+" RECORDS","-".repeat(title.length+8),...records);
      }
      lines.push("", "SUBDOMAIN MAIL RECORDS", "----------------------");
      const sub=data.subdomains;
      if(!sub){lines.push("Complete Standard Records to include subdomain mail records. Then click Mail check again.");}
      else {
        lines.push((sub.complete?"Complete: ":"Scanning — partial results: ")+sub.checked+" of "+sub.total+" discovered subdomains checked.","");
        const hosts=[...new Set(sub.checks.map(c=>c.host))];
        let found=0;
        for(const host of hosts){
          const checks=sub.checks.filter(c=>c.host===host),positive=checks.filter(c=>c.answers.length);
          if(!positive.length)continue;
          found++;lines.push(host,"-".repeat(host.length));
          for(const c of positive)for(const answer of c.answers){
            const label=c.name.startsWith("_dmarc.")?"DMARC TXT":c.type==="TXT"&&answer.value.replaceAll('"', '').trim().toLowerCase().startsWith("v=spf1")?"SPF TXT":c.type;
            lines.push(c.name+"  "+label+"  TTL "+answer.ttl+"  "+answer.value);
          }
          lines.push("");
        }
        if(!found)lines.push(sub.complete?"No subdomain MX/TXT/DMARC answers found in completed checks.":"No matching records found yet.");
        const errors=sub.checks.filter(c=>!["NOERROR","NXDOMAIN"].includes(c.status));
        if(errors.length){lines.push("", "INCOMPLETE CHECKS");for(const c of errors)lines.push(c.name+" "+c.type+": "+c.status);}
        lines.push("", "Only discovered subdomains are checked; the Standard Records discovery scan is not repeated.","No direct DMARC record does not necessarily mean no policy: an organizational-domain policy may apply. Inheritance is not evaluated here.");
      }
      lastText=lines.join("\\n");
      results.innerHTML='<div class="console-wrap"><pre class="console-output">'+escapeText(lastText)+'</pre></div>';
    }

    async function extendMailCheck(data,sequence){
      if(!savedAudit||savedAudit.domain!==data.domain){renderMail(data);return;}
      const hosts=[...new Set(savedAudit.hosts)].filter(host=>host!==data.domain);
      data.subdomains={total:hosts.length,checked:0,checks:[],complete:false};
      renderMail(data);
      for(let i=0;i<hosts.length;i+=12){
        if(sequence!==lookupSequence)return;
        const batch=hosts.slice(i,i+12);
        setStatus("Primary domain complete. Checking subdomain mail records: "+i+" of "+hosts.length+"...");
        const api=new URL("/api/lookup",location.origin);api.searchParams.set("mode","mail-subdomains");api.searchParams.set("name",data.domain);
        try {
          const response=await fetch(api,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({hosts:batch})});
          const result=await response.json();if(!response.ok)throw Error(result.error||"Subdomain mail lookup failed");
          data.subdomains.checks.push(...result.checks);
        }catch{
          data.subdomains.checks.push(...batch.flatMap(host=>[{host,name:host,type:"MX",status:"ERROR",answers:[]},{host,name:host,type:"TXT",status:"ERROR",answers:[]},{host,name:"_dmarc."+host,type:"TXT",status:"ERROR",answers:[]}]));
        }
        if(sequence!==lookupSequence)return;
        data.subdomains.checked+=batch.length;renderMail(data);
      }
      data.subdomains.complete=true;renderMail(data);
    }

    function formatAnswers(answers) {
      if (!answers.length) return "No records found";
      return answers.map((answer) => {
        const ttl = answer.ttl ? "TTL " + answer.ttl + "  " : "";
        return ttl + answer.value;
      }).join("\\n");
    }

    function renderAudit(data) {
      currentAudit = data;
      resultTitle.textContent = auditRunning ? "Standard Records — scan in progress (partial results)" : "Standard Records";
      const resolved = data.checks.filter(check => check.answers.length);
      const names = new Map();
      for (const check of data.checks) {
        if (!["A", "AAAA", "CNAME"].includes(check.type)) continue;
        if (!names.has(check.name)) names.set(check.name, []);
        names.get(check.name).push(check);
      }
      const uncertain = new Set();
      const certificateNames = new Set(data.certificateNames || []);
      for (const [name, checks] of names) {
        if (name === data.domain || name === "www." + data.domain || certificateNames.has(name) ||
            checks.some(check => check.source === "crt.sh")) continue;
        const scope = name.slice(name.indexOf(".") + 1);
        const profile = (data.wildcards || []).find(item => item.scope === scope);
        // Wait until all types have been attempted. An unrelated failed type
        // does not exempt a matching positive answer; a distinct answer does.
        if (!profile || checks.length !== 3) continue;
        const positive = checks.filter(check => check.answers.length);
        if (positive.length && positive.every(check => check.answers.every(answer =>
            (profile.values[check.type] || []).includes(answer.value.toLowerCase().replace(/\\.$/, ""))))) {
          uncertain.add(name);
        }
      }
      const found = resolved.filter(check => !uncertain.has(check.name));
      discoveredWebHosts=[...new Set(found.filter(c=>["A","AAAA","CNAME"].includes(c.type)&&!c.name.includes("*")&&!c.name.includes("_")).map(c=>c.name))].sort();
      const likely = resolved.filter(check => uncertain.has(check.name));
      const byType = {};
      for (const check of found) {
        byType[check.type] = byType[check.type] || [];
        byType[check.type].push(check);
      }

      const lines = [
        "DNS STANDARD RECORDS",
        auditRunning ? "SCAN IN PROGRESS — PARTIAL RESULTS. Wait for the full scan before checking web ports." : "SCAN COMPLETE — Check web ports is ready.",
        "Domain: " + data.domain,
        "Scope:  " + data.hostCount + " service/vendor hostnames + root/mail records + crt.sh discovery",
        "Found:  " + data.found + " of " + data.checked + " checks",
        "Visible: " + found.length + " resolved checks; " + uncertain.size + " likely wildcard names " + (showWildcards ? "shown separately" : "hidden"),
        ""
      ];
      const wildcards = data.wildcards || [];
      const detected = wildcards.filter(item => Object.keys(item.values).length);
      if (detected.length) {
        lines.push("WILDCARD DNS DETECTED");
        for (const item of detected) lines.push("*." + item.scope + ": " + Object.entries(item.values).map(([type, values]) => type + " " + values.join(", ")).join("; "));
        lines.push("Matching names are uncertain: explicit records can share these answers.");
        lines.push("Always retained: root (@), www, and crt.sh discoveries (certificate-only entries listed separately).", "");
      } else if (wildcards.some(item => !item.incomplete)) lines.push("No wildcard answers detected in completed probes.", "");
      if (data.wildcardIncomplete || wildcards.some(item => item.incomplete)) {
        lines.push("Wildcard detection incomplete. Confirmed record types are filtered; unverified types remain visible.", "");
      }
      if (data.crtNote) lines.push(data.crtNote, "");
      const failures = data.checks.filter(check => !["NOERROR", "NXDOMAIN"].includes(check.status)).length;
      if (failures) lines.push(failures + " DNS checks could not be completed.", "");
      if (!found.length) lines.push(likely.length ? "All resolved names currently shown by this scan are likely wildcard matches." : "No resolved records found.");

      function section(title, types) {
        if (!types.some(type => (byType[type] || []).length)) return;
        lines.push(title);
        lines.push("-".repeat(title.length));

        for (const type of types) {
          const checks = byType[type] || [];
          for (const check of checks) {
            for (const answer of check.answers) {
              const left = (check.name + " " + check.type).padEnd(48, " ");
              const ttl = answer.ttl ? ("TTL " + String(answer.ttl)).padEnd(10, " ") : "".padEnd(10, " ");
              lines.push(left + ttl + answer.value + (check.source === "crt.sh" ? "  [crt.sh]" : ""));
            }
          }
        }

        lines.push("");
      }

      section("A / AAAA RECORDS", ["A", "AAAA"]);
      section("CNAME RECORDS", ["CNAME"]);
      section("MX RECORDS", ["MX"]);
      section("TXT / AUTH RECORDS", ["TXT"]);
      section("NS / SOA / CAA RECORDS", ["NS", "SOA", "CAA"]);

      const resolvedNames = new Set(resolved.map(check => check.name));
      const historyNames = [...certificateNames].filter(name => !resolvedNames.has(name));
      const patterns = data.certificatePatterns || [];
      if (historyNames.length || patterns.length) {
        lines.push("CERTIFICATE HISTORY — NO CURRENT DNS ANSWER", "------------------------------------------");
        for (const name of historyNames) {
          const checks = names.get(name) || [];
          const state = checks.length < 3 ? "DNS not yet checked" :
            checks.some(check => !["NOERROR", "NXDOMAIN"].includes(check.status)) ? "DNS check incomplete" :
            "No current A/AAAA/CNAME answer";
          lines.push(name + "  [crt.sh] " + state);
        }
        for (const pattern of patterns) lines.push(pattern + "  [crt.sh] Wildcard certificate pattern; not a specific host");
        lines.push("Certificate history does not establish a current DNS record or active service.", "");
      }

      if (showWildcards && likely.length) {
        lines.push("LIKELY WILDCARD RESULTS — UNCERTAIN", "-----------------------------------");
        for (const check of likely) for (const answer of check.answers) {
          lines.push((check.name + " " + check.type).padEnd(48, " ") +
            ("TTL " + answer.ttl).padEnd(10, " ") + answer.value +
            "  [uncertain: wildcard match]" + (check.source === "crt.sh" ? " [crt.sh]" : ""));
        }
      }

      lastText = lines.join("\\n");
      results.innerHTML = (likely.length ? '<label style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><input id="show-wildcards" type="checkbox" style="width:auto"' +
        (showWildcards ? ' checked' : '') + '>Show likely wildcard results (' + uncertain.size + ' names)</label>' : '') +
        '<div class="console-wrap"><pre class="console-output">' + escapeText(lastText) + '</pre></div>';
    }

    async function probeWildcards(data, scopes, sequence) {
      data.wildcards = data.wildcards || [];
      data.wildcardAttempted = data.wildcardAttempted || [];
      const pending = [...new Set(scopes)].filter(scope => !data.wildcardAttempted.includes(scope));
      const room = Math.max(0, 100 - data.wildcardAttempted.length);
      const eligible = pending.filter(scope => scope.length <= 210).slice(0, room);
      if (eligible.length < pending.length) data.wildcardIncomplete = true;
      for (let offset = 0; offset < eligible.length; offset += 4) {
        if (sequence !== lookupSequence) return;
        const batch = eligible.slice(offset, offset + 4);
        data.wildcardAttempted.push(...batch);
        setStatus("Checking wildcard DNS: " + data.wildcardAttempted.length + " scopes...");
        const api = new URL("/api/lookup", location.origin);
        api.searchParams.set("name", data.domain);
        api.searchParams.set("mode", "wildcard");
        try {
          const response = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scopes: batch }) });
          if (!response.ok) throw new Error("Wildcard check failed.");
          const result = await response.json();
          if (sequence !== lookupSequence) return;
          data.wildcards.push(...result.profiles);
        } catch (error) {
          data.wildcardIncomplete = true;
        }
      }
    }

    function renderWeb(data) {
      resultTitle.textContent="Web ports · 80 / 443";
      const opened=data.results.filter(r=>r.status==="OPEN");
      const lines=["DNS WEB PORTS", "Domain: "+data.domain,"Hosts checked: "+data.checked+" of "+data.total,"Open endpoints: "+opened.length,"", "OPEN WEBSITES", "-------------"];
      if(!opened.length)lines.push("No open endpoints confirmed yet.");
      for(const r of opened)lines.push(r.url+"  "+r.detail);
      lines.push("", "UNCONFIRMED", "-----------");
      for(const r of data.results.filter(r=>r.status!=="OPEN"))lines.push(r.hostname+":"+r.port+"  "+r.detail);
      lines.push("", "Only resolved hostnames retained by Standard Records are checked. Hidden wildcard matches are excluded.","Redirects are not followed. HTTP errors still confirm a responding web service.","Unconfirmed does not mean closed; TLS errors, filtering or Cloudflare restrictions can prevent confirmation.");
      lastText=lines.join("\\n");
      let html=escapeText(lastText);
      for(const r of opened){const safe=escapeText(r.url);html=html.replace(safe+'  ', '<a href="'+safe+'" target="_blank" rel="noopener noreferrer">'+safe+'</a>  ');}
      results.innerHTML='<div class="console-wrap"><pre class="console-output">'+html+'</pre></div>';
    }
    async function runWebCheck(){
      if(webBusy)return;
      if(!savedAudit||cleanDomain(domainInput.value).toLowerCase()!==savedAudit.domain){setStatus("Run Standard Records for this domain first.");return;}
      const hosts=savedAudit.hosts.slice(),sequence=++lookupSequence;
      const data={domain:savedAudit.domain,total:hosts.length,checked:0,results:[]};
      webBusy=true;updateWebButton();renderWeb(data);
      try {
        for(let i=0;i<hosts.length;i+=4){
          if(sequence!==lookupSequence)return;
          const batch=hosts.slice(i,i+4);
          setStatus("Checking web ports: "+i+" of "+hosts.length+" discovered hosts...");
          const api=new URL("/api/lookup",location.origin);api.searchParams.set("mode","web");api.searchParams.set("name",data.domain);
          try {
            const response=await fetch(api,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({hosts:batch})});
            const result=await response.json();if(!response.ok)throw Error(result.error||"Web check failed");
            data.results.push(...result.results);
          }catch {data.results.push(...batch.flatMap(hostname=>[80,443].map(port=>({hostname,port,status:"UNCONFIRMED",detail:"Batch failed; retry web check"}))));}
          if(sequence!==lookupSequence)return;
          data.checked+=batch.length;renderWeb(data);
        }
        setStatus(hosts.length?"Web check complete. Standard Records were not rescanned.":"No resolved hostnames available in this scan.");
      }finally{webBusy=false;updateWebButton();}
    }

    function renderDomainInfo(data) {
      resultTitle.textContent = "Domain info";
      const lines = [
        "DNS DOMAIN INFO",
        "Domain:     " + data.domain,
        "Registrar:  " + data.registrar,
        "Registrant: " + data.registrant,
        "Created:    " + data.created,
        "Updated:    " + data.updated,
        "Expires:    " + data.expires,
        "DNSSEC:     " + data.dnssec,
        ""
      ];

      lines.push("STATUS");
      lines.push("------");
      if (data.status && data.status.length) {
        for (const status of data.status) lines.push(status);
      } else {
        lines.push("Unknown");
      }

      lines.push("");
      lines.push("NAMESERVERS");
      lines.push("-----------");
      if (data.nameservers && data.nameservers.length) {
        for (const server of data.nameservers) lines.push(server);
      } else {
        lines.push("Unknown");
      }

      lines.push("");
      lines.push("DS RECORDS");
      lines.push("----------");
      if (data.ds && data.ds.length) {
        for (const record of data.ds) lines.push(record);
      } else {
        lines.push("No DS records found");
      }

      if (data.rdapError) {
        lines.push("");
        lines.push("RDAP NOTE");
        lines.push("---------");
        lines.push(data.rdapError);
      }

      lines.push("", "WHOIS / RDAP CONTACTS", "---------------------");
      const roleNames={registrant:"Main / registrant",administrative:"Administrative",technical:"Technical",billing:"Billing",registrar:"Registrar",abuse:"Abuse"};
      const contacts=data.contacts||[];
      for(const contact of contacts){
        lines.push("",(contact.roles||[]).map(r=>roleNames[r]||r).join(" / ")||"Other contact");
        for(const [label,value] of [["Name",contact.name],["Organization",contact.organization],["Handle",contact.handle],["Associated with",contact.parent],["Email",(contact.email||[]).join("; ")],["Phone",(contact.phone||[]).join("; ")],["Address",(contact.address||[]).join("; ")],["Contact URL",(contact.url||[]).join("; ")]])if(value)lines.push(label+": "+value);
        for(const remark of contact.remarks||[])lines.push(remark);
        if(!contact.name&&!contact.organization&&!contact.email?.length&&!contact.phone?.length&&!contact.address?.length&&!contact.url?.length)lines.push("Contact details redacted or not published.");
      }
      for(const role of ["registrant","administrative","technical","billing"])if(!contacts.some(c=>(c.roles||[]).includes(role)))lines.push((roleNames[role])+": Not published or redacted.");
      lines.push("Public registry RDAP contacts only; privacy-protected details are not available.");

      lastText = lines.join("\\n");
      results.innerHTML = '<div class="console-wrap"><pre class="console-output">' + escapeText(lastText) + '</pre></div>';
    }

    async function runLookup(mode = "single") {
      const domain = cleanDomain(domainInput.value);
      if (!domain) {
        setStatus("Enter a domain first.");
        return;
      }
      const sequence = ++lookupSequence;
      currentAudit = null;
      auditRunning=mode==="audit";updateWebButton();
      if(mode==="audit"){savedAudit=null;discoveredWebHosts=[];updateWebButton();}
      showWildcards = false;

      const url = new URL(location.href);
      url.searchParams.set("domain", domain);
      history.replaceState(null, "", url);

      setStatus("Looking up " + domain + "...");
      results.innerHTML = '<div class="empty">Checking DNS...</div>';

      const api = new URL("/api/lookup", location.origin);
      api.searchParams.set("name", domain);
      api.searchParams.set("mode", mode);
      api.searchParams.set("type", typeInput.value);

      const response = await fetch(api);
      let data = await response.json();
      if (sequence !== lookupSequence) return;
      if (!response.ok) {
        throw new Error(data.error || "Lookup failed.");
      }

      if (mode === "audit") {
        await probeWildcards(data, data.wildcardScopes, sequence);
        if (sequence !== lookupSequence) return;
        renderAudit(data);
        while (data.nextOffset !== null && data.nextOffset !== undefined) {
          setStatus("Checking Standard Records: " + data.checked + " of " + data.total + "...");
          api.searchParams.set("offset", data.nextOffset);
          const nextResponse = await fetch(api);
          const batch = await nextResponse.json();
          if (sequence !== lookupSequence) return;
          if (!nextResponse.ok) throw new Error(batch.error || "Lookup failed.");
          data = {
            ...data,
            ...batch,
            checked: data.checked + batch.checked,
            found: data.found + batch.found,
            checks: data.checks.concat(batch.checks),
          };
          renderAudit(data);
        }
        // Show standard results immediately while the certificate search runs.
        renderAudit(data);
        setStatus("Searching crt.sh for additional hostnames...");
        try {
          const discoveryApi = new URL("/api/lookup", location.origin);
          discoveryApi.searchParams.set("name", domain);
          discoveryApi.searchParams.set("mode", "crt");
          const discoveryResponse = await fetch(discoveryApi);
          const discovery = await discoveryResponse.json();
          if (sequence !== lookupSequence) return;
          if (!discoveryResponse.ok) throw new Error(discovery.error || "Search failed.");
          // Retain certificate provenance even when the standard scan already
          // queried this name and no extra certificate DNS tasks are needed.
          data.certificateNames = discovery.names;
          data.certificatePatterns = discovery.patterns || [];
          const certified = new Set(discovery.names);
          data.checks = data.checks.map(check => certified.has(check.name) ? { ...check, source: "crt.sh" } : check);

          const existing = new Set(data.checks.map(check => check.name + "|" + check.type));
          const tasks = discovery.names.flatMap(name => ["A", "AAAA", "CNAME"].map(type => ({ name, type })))
            .filter(task => !existing.has(task.name + "|" + task.type));
          data.crtNote = "crt.sh: " + discovery.names.length + " certificate hostnames and " + data.certificatePatterns.length + " wildcard patterns discovered." +
            (discovery.limited ? " Limited to the first 1,000 unique certificate names/patterns." : "");
          renderAudit(data);
          discoveryApi.searchParams.set("mode", "crt-records");
          for (let offset = 0; offset < tasks.length; offset += 40) {
            setStatus("Verifying crt.sh names in DNS: " + offset + " of " + tasks.length + " checks...");
            const checksResponse = await fetch(discoveryApi, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tasks: tasks.slice(offset, offset + 40) }),
            });
            const batch = await checksResponse.json();
            if (sequence !== lookupSequence) return;
            if (!checksResponse.ok) throw new Error(batch.error || "DNS verification failed.");
            data.checks = data.checks.concat(batch.checks);
            data.checked += batch.checks.length;
            data.found += batch.checks.filter(check => check.answers.length).length;
            renderAudit(data);
          }
        } catch (error) {
          if (sequence !== lookupSequence) return;
          data.crtNote = "crt.sh discovery incomplete: " + (error.message || "Service unavailable.") +
            " Showing completed DNS checks.";
        }
      }

      if (mode === "audit") {auditRunning=false;renderAudit(data);savedAudit={domain:data.domain,hosts:discoveredWebHosts.slice()};updateWebButton();}
      else if (mode === "domain") renderDomainInfo(data);
      else if (mode === "all") renderAll(data);
      else if (mode === "mail") {await extendMailCheck(data,sequence);if(sequence!==lookupSequence)return;}
      else renderSingle(typeInput.value, data);

      setStatus(data.crtNote?.startsWith("crt.sh discovery incomplete") ? "Done. crt.sh discovery incomplete." : "Done.");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await runLookup("single");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
        results.innerHTML = '<div class="empty">Lookup failed.</div>';
      }
    });

    auditButton.addEventListener("click", async () => {
      try {
        await runLookup("audit");
      } catch (error) {
        auditRunning=false;updateWebButton();
        setStatus(error.message || "Lookup failed.");
      }
    });

    portsButton.addEventListener("click", async () => {
      try {
        await runWebCheck();
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    domainInfoButton.addEventListener("click", async () => {
      try {
        await runLookup("domain");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    allButton.addEventListener("click", async () => {
      try {
        await runLookup("all");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    mailButton.addEventListener("click", async () => {
      try {
        await runLookup("mail");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    copyButton.addEventListener("click", async () => {
      if (!lastText) {
        setStatus("Nothing to copy yet.");
        return;
      }
      try {
        await navigator.clipboard.writeText(lastText);
        setStatus("Copied results.");
      } catch {
        setStatus("Copy failed.");
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: noStoreHeaders("text/html"),
  });
}

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/lookup" || url.pathname === "/json") {
      return apiResponse(request);
    }

    return pageResponse();
  },
};
