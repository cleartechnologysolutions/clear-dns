# DNS Tools

## Build 17 — automatic scan and prominent progress

Entering a valid domain starts Standard Records after a 1.2-second typing pause.
Enter or leaving the changed field starts it immediately. An unchanged completed
domain does not automatically rescan; Standard Records remains available to rerun.
Domain query-string links also start automatically. Individual record type lookup
controls are removed. Progress and prerequisite messages sit above the results.
The progress bar measures the current phase; unknown-length phases such as crt.sh
search use an indeterminate bar. Completion fills the bar and unlocks web checks.
Other lookup actions are disabled during Standard Records to prevent accidental
interruption. Changing the domain supersedes the previous scan.

Validated in Chromium: automatic startup, duplicate-start prevention, removed
selector, progress placement, crt.sh completion gate, 100% completion, and mobile
width; existing network-mocked regressions passed. Live deployment not performed.

## Build 16 — subdomain mail records

Mail check always shows the primary domain MX/SPF/TXT/DMARC information first.
After Standard Records completes for the same domain, Mail check also reuses its
retained discovered hostnames (excluding root) and queries MX, TXT and direct
_dmarc TXT records. The subdomain section is appended after the primary results
and updates with progress. SPF TXT records are labeled. Empty subdomain results
are hidden, while failed DNS checks remain visible as incomplete.

Without a completed scan, a visible instruction says to finish Standard Records
and click Mail check again. This does not repeat discovery, crt.sh, wildcard
probes or A/AAAA/CNAME checks. Each request includes at most 12 hostnames / 36
queries, with six queries at once. Root/www/crt.sh wildcard exemptions remain
unchanged; hidden wildcard guesses and certificate-only history are excluded.

Direct DMARC absence is not labeled missing protection for subdomains: an
organizational-domain policy may apply. Policy inheritance is not evaluated.
The extended scan runs when Mail check is clicked after Standard Records; it
does not start automatically just because Standard Records finishes.

Regression tests cover domain gating, exact query types, deduplication, primary
results before subdomains, SPF labels, hidden empty results and visible failures.
No deployment changes or new services are required.

DNS lookup, Standard Records, discovered-host web port check, and domain info tool.

Deploy command:

```bash
npx wrangler deploy
```

No database, R2 bucket, or bindings are required.

Build 15 adds a visible two-step instruction: finish Standard Records before Check web ports unlocks. The instruction updates during scanning and when ready.

Build 14 replaces Common ports with Check web ports and adds public WHOIS/RDAP contacts.

Run Standard Records first. Check web ports then checks only its retained, resolved
A/AAAA/CNAME hostnames on 80 and 443. Hostnames are deduplicated; hidden wildcard
results and certificate-only history without current answers are excluded. Switching
to Domain info does not discard the saved scan; changing domains requires a scan
for the new domain. Reloading the page clears the saved scan.

The web check does not rerun the 914-name discovery or crt.sh. It does a safety DNS
lookup only for each selected hostname to exclude private/special-use addresses.
Requests run in batches of four hosts, at most two hosts concurrently. HTTP HEAD
uses manual redirects: even 301/403/404 confirms a web response on that port.
When HTTP/TLS fails, a bounded TCP connect is attempted against a validated IP.
TCP-only results are explicitly marked as not having verified HTTP/TLS. Successful
checks get clickable HTTP/HTTPS links in the text-style report. Failed checks say
UNCONFIRMED rather than falsely asserting CLOSED. Cloudflare networking restrictions
and remote filtering can prevent confirmation. Links open in a new tab.

Domain info ends with WHOIS / RDAP CONTACTS: published main/registrant, technical,
administrative, billing, registrar and nested abuse contacts. Includes names,
organizations, email, phone, postal address and contact URLs where available.
Redacted or unpublished contacts remain labeled unavailable; this does not bypass
registry privacy protection. Sources: https://www.rfc-editor.org/rfc/rfc9083.html
and https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/.

Deploy by replacing files in the existing GitHub repository. Keep the existing
Worker name in wrangler.json. No build command is needed; deploy remains
`npx wrangler deploy`. No new bindings, paid service or local collector is needed.
Validated with `node test.mjs` (mocked network); live deployment has not been tested.

Existing wildcard filtering and crt.sh behavior remains included.
Standard Records includes 914 unique hostnames checking A, AAAA
and CNAME for each. This is a curated practical list, not a measured popularity
ranking. It covers mail, development environments, source control and CI,
identity providers, management consoles, public sites, commerce, help desks,
departments, collaboration, assets, infrastructure, observability, data services
and regional names. Vendors include Jira, Confluence, Zendesk, Slack, Salesforce,
Okta, Workday, Microsoft 365, ServiceNow, ConnectWise, Datadog and many more.
Salesforce and HR are separate guesses; salesforcehr is also included.
All previous names remain included. Root records, DMARC, and DKIM selector checks remain.
Only successful DNS answers of the requested record type are included.

The 2,755 standard DNS checks run automatically across 69 API requests, at most
40 DNS queries per request and six concurrent queries. The results are
combined into the existing text report, updated after every completed batch.
The progress message shows how many checks have completed; the expanded scan
takes longer than the old 100-name list. Unresolved checks and empty record
sections are hidden for guessed names. Certificate discoveries are always listed.

Standard Records also searches crt.sh certificate history automatically.
Discovered hostnames are deduplicated and scoped to the entered domain, then
checked for current A, AAAA and CNAME records. Already-completed checks are
not repeated. All answers for certificate-discovered names are marked [crt.sh],
including overlaps already checked by Standard Records. These names are exempt
from wildcard filtering. Certificate names without DNS answers appear in a
separate history section with their lookup status. Wildcard certificate patterns
are also displayed as history, never expanded into guessed hosts or queried as hosts.

This is DNS discovery, not a zone-file transfer or a complete inventory.
Vendor guesses do not establish that an organization uses that vendor.
Certificate history is not a complete inventory of DNS records. Old certificate
names without current DNS answers remain visible as certificate history, not
as verified current DNS records. A crt.sh failure leaves standard
results visible with a short status message. The provider request times out
after 15 seconds and has an 8 MiB response cap; discovery checks at most 1,000
unique certificate names/patterns, with an explicit note when that limit is reached.
Additional DNS checks run in batches of at most 40, with six at a time.
Wildcard filtering:
- Three random hostnames are checked for A, AAAA and CNAME at each relevant
  parent in the built-in list. Certificate names are exempt and need no probes.
- A type is considered a wildcard candidate only if all three probes answer.
  Comparisons ignore TTL, CNAME case and a trailing dot. The observed address
  pool covers rotations seen during the probes; unseen rotations may stay visible.
- Names whose positive answers all match the observed pool are hidden by default.
  The domain apex (@), www, certificate names, and distinct addresses/aliases
  stay visible. A failed AAAA or CNAME lookup no longer exempts a matching A
  answer. Probe baselines are evaluated per type: three successful A probes
  still count if AAAA probing failed. Matching explicit records can be hidden too: this is a
  heuristic, not proof that a name does not exist.
- Use "Show likely wildcard results" to inspect uncertain matches in a separate
  text section. No new queries run when toggling, and Copy uses the visible report.
- Counts distinguish resolved checks from likely wildcard names. Random probes
  are excluded from record totals. Probe failures are reported; answers without
  a confirmed baseline for their type stay visible.
- Each probe request handles at most four parent scopes (36 queries), with at
  most six concurrent DNS lookups. Up to 100 parent scopes are tested per scan;
  untested/overlong scopes remain visible with an incomplete-detection notice.

Wildcard semantics depend on existing names and the closest enclosing domain:
https://www.rfc-editor.org/rfc/rfc4592.html
A DNS answer alone is not proof that a website or service exists at that name.

Upload the ZIP contents to your existing DNS repository and commit.
Leave the Build command empty; keep the Deploy command above.
The page will read DNS Tools with Build 13 beneath it.

Run the mocked DNS and browser-script checks with: node test.mjs
