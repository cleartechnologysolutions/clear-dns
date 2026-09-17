# DNS Tools

DNS lookup, Standard Records, common port check, and domain info tool.

Deploy command:

```bash
npx wrangler deploy
```

No database, R2 bucket, or bindings are required.

Build 11 expands Standard Records to 914 unique hostnames, checking A, AAAA
and CNAME for each. This is a curated practical list, not a measured popularity
ranking. It covers mail, development environments, source control and CI,
identity providers, management consoles, public sites, commerce, help desks,
departments, collaboration, assets, infrastructure, observability, data services
and regional names. Vendors include Jira, Confluence, Zendesk, Slack, Salesforce,
Okta, Workday, Microsoft 365, ServiceNow, ConnectWise, Datadog and many more.
Salesforce and HR are separate guesses; salesforcehr is also included.
All previous
names remain included. Root records, DMARC, and DKIM selector checks remain.
Only successful DNS answers of the requested record type are included.

The 2,755 standard DNS checks run automatically across 69 API requests, at most
40 DNS queries per request and six concurrent queries. The results are
combined into the existing text report, updated after every completed batch.
The progress message shows how many checks have completed; the expanded scan
takes longer than the old 100-name list. Unresolved checks and empty record
sections are hidden.

Standard Records also searches crt.sh certificate history automatically.
Discovered hostnames are deduplicated and scoped to the entered domain, then
checked for current A, AAAA and CNAME records. Already-completed checks are
not repeated. Additional answers are marked [crt.sh] in the same report.
Wildcard certificates are not expanded into guessed hostnames.

This is DNS discovery, not a zone-file transfer or a complete inventory.
Vendor guesses do not establish that an organization uses that vendor.
Certificate history is not a complete inventory of DNS records. Old certificate
names without current DNS answers are hidden. A crt.sh failure leaves standard
results visible with a short status message. The provider request times out
after 15 seconds and has an 8 MiB response cap; discovery checks at most 1,000
unique hostnames, with an explicit note when that hostname limit is reached.
Additional DNS checks run in batches of at most 40, with six at a time.
Wildcard DNS can produce answers for arbitrary names; a DNS answer alone is
not proof that a website or service exists at that name.

Upload the ZIP contents to your existing DNS repository and commit.
Leave the Build command empty; keep the Deploy command above.
The page will read DNS Tools with Build 11 beneath it.

Run the mocked DNS and browser-script checks with: node test.mjs
