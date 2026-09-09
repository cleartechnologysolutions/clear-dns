const DNS_ENDPOINT = "https://cloudflare-dns.com/dns-query";

const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"];

const STANDARD_HOSTS = [
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
];

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
      dmarc: dmarc ? [dmarc] : [],
    },
  };
}

function answerValues(response) {
  return (response.Answer || []).map((record) => ({
    ttl: record.TTL || 0,
    value: record.data || "",
  }));
}

async function safeLookup(name, type) {
  try {
    const response = await lookupDns(name, type);
    return {
      status: response.StatusText,
      answers: answerValues(response),
    };
  } catch (error) {
    return {
      status: "ERROR",
      answers: [],
      error: error.message || "Lookup failed.",
    };
  }
}

async function standardScan(domain) {
  const rootChecks = DNS_TYPES.map(async (type) => ({
    name: domain,
    type,
    ...(await safeLookup(domain, type)),
  }));

  const hostChecks = STANDARD_HOSTS.flatMap((host) => {
    const name = `${host}.${domain}`;
    return ["A", "CNAME"].map(async (type) => ({
      name,
      type,
      ...(await safeLookup(name, type)),
    }));
  });

  const dmarcCheck = async () => ({
    name: `_dmarc.${domain}`,
    type: "TXT",
    ...(await safeLookup(`_dmarc.${domain}`, "TXT")),
  });

  const dkimChecks = DKIM_SELECTORS.map(async (selector) => {
    const name = `${selector}._domainkey.${domain}`;
    return {
      name,
      type: "TXT",
      ...(await safeLookup(name, "TXT")),
    };
  });

  const checks = await Promise.all([...rootChecks, ...hostChecks, dmarcCheck(), ...dkimChecks]);
  const found = checks.filter((check) => check.answers.length);

  return {
    domain,
    checked: checks.length,
    found: found.length,
    checks,
  };
}

async function lookupDns(name, type) {
  const query = new URL(DNS_ENDPOINT);
  query.searchParams.set("name", name);
  query.searchParams.set("type", type);

  const response = await fetch(query, {
    headers: {
      accept: "application/dns-json",
      "user-agent": "ClearDNS/1.0",
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

    if (mode === "audit") {
      return Response.json(await standardScan(domain), { headers: noStoreHeaders("application/json") });
    }

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
  <title>Clear DNS | Clear Technology Solutions</title>
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
        <div class="mark">CTS</div>
        <div>
          <p class="brand-title">Clear Technology Solutions</p>
          <p class="brand-subtitle">Clear DNS</p>
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
            <button type="button" class="secondary" id="audit">Standard scan</button>
            <button type="button" class="secondary" id="all">All common records</button>
            <button type="button" class="secondary" id="mail">Mail check</button>
            <button type="button" class="secondary" id="copy">Copy results</button>
          </div>
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
    const allButton = document.getElementById("all");
    const mailButton = document.getElementById("mail");
    const copyButton = document.getElementById("copy");
    const statusBox = document.getElementById("status");
    const resultTitle = document.getElementById("result-title");
    const results = document.getElementById("results");
    let lastText = "";

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
      const chunks = [];
      const text = [];
      for (const [type, response] of Object.entries(data)) {
        const answers = response.Answer || [];
        if (!answers.length) {
          chunks.push('<article class="record"><div class="record-top"><span>' + escapeText(type) + '</span><span>' + escapeText(response.StatusText || response.Status) + '</span></div><pre class="record-data">No records found</pre></article>');
          text.push(type + ": No records found");
          continue;
        }
        for (const record of answers) {
          chunks.push(recordHtml(type, record, response.StatusText));
          text.push(type + " " + record.data);
        }
      }
      results.innerHTML = chunks.join("");
      lastText = text.join("\\n");
    }

    function renderMail(data) {
      resultTitle.textContent = "Mail check";
      const warnings = data.warnings.length
        ? data.warnings.map((warning) => '<div class="pill warning"><strong>' + escapeText(warning) + '</strong></div>').join("")
        : '<div class="pill"><strong>No obvious mail DNS warnings.</strong><span>Still worth checking the exact records when troubleshooting.</span></div>';

      results.innerHTML =
        '<div class="summary">' +
        '<div class="pill"><strong>' + escapeText(data.mx) + '</strong><span>MX</span></div>' +
        '<div class="pill"><strong>' + escapeText(data.spf) + '</strong><span>SPF</span></div>' +
        '<div class="pill"><strong>' + escapeText(data.dmarc) + '</strong><span>DMARC</span></div>' +
        warnings +
        '<article class="record"><div class="record-top"><span>Records</span><span>Mail DNS</span></div><pre class="record-data">' + escapeText(JSON.stringify(data.records, null, 2)) + '</pre></article>' +
        '</div>';

      lastText = JSON.stringify(data, null, 2);
    }

    function formatAnswers(answers) {
      if (!answers.length) return "No records found";
      return answers.map((answer) => {
        const ttl = answer.ttl ? "TTL " + answer.ttl + "  " : "";
        return ttl + answer.value;
      }).join("\\n");
    }

    function renderAudit(data) {
      resultTitle.textContent = "Standard scan";
      const chunks = [
        '<div class="pill"><strong>' + escapeText(data.found + " of " + data.checked + " checks found records") + '</strong><span>' + escapeText(data.domain) + '</span></div>'
      ];
      const text = [data.domain + " standard DNS scan", data.found + " of " + data.checked + " checks found records", ""];

      for (const check of data.checks) {
        chunks.push(
          '<article class="record">' +
          '<div class="record-top"><span>' + escapeText(check.name) + '</span><span>' + escapeText(check.type + " " + check.status) + '</span></div>' +
          '<pre class="record-data">' + escapeText(formatAnswers(check.answers)) + '</pre>' +
          '</article>'
        );
        text.push(check.name + " " + check.type + " " + check.status);
        text.push(formatAnswers(check.answers));
        text.push("");
      }

      results.innerHTML = chunks.join("");
      lastText = text.join("\\n");
    }

    async function runLookup(mode = "single") {
      const domain = cleanDomain(domainInput.value);
      if (!domain) {
        setStatus("Enter a domain first.");
        return;
      }

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
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Lookup failed.");
      }

      if (mode === "audit") renderAudit(data);
      else if (mode === "all") renderAll(data);
      else if (mode === "mail") renderMail(data);
      else renderSingle(typeInput.value, data);

      setStatus("Done.");
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
