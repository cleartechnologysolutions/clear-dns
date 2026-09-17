# DNS Tools

DNS lookup, Standard Records, common port check, and domain info tool.

Deploy command:

```bash
npx wrangler deploy
```

No database, R2 bucket, or bindings are required.

Build 10 expands Standard Records to 100 common hostnames, checking A, AAAA
and CNAME for each. This is a curated practical list, not a measured popularity
ranking. It covers web, mail, Microsoft enrollment, identity, remote access,
files, backups, monitoring, development, DNS and support names. All previous
names remain included. Root records, DMARC, and DKIM selector checks remain.
Only successful DNS answers of the requested record type are included.

The 313 standard DNS checks run automatically across eight API requests, at most
40 DNS queries per request and six concurrent queries. The results are
combined into the existing text report. Unresolved checks and empty record
sections are hidden.

Standard Records also searches crt.sh certificate history automatically.
Discovered hostnames are deduplicated and scoped to the entered domain, then
checked for current A, AAAA and CNAME records. Already-completed checks are
not repeated. Additional answers are marked [crt.sh] in the same report.
Wildcard certificates are not expanded into guessed hostnames.

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
The page will read DNS Tools with Build 10 beneath it.

Run the mocked DNS and browser-script checks with: node test.mjs
