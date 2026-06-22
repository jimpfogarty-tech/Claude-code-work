---
name: seo-audit
description: >
  Audit a live web page (URL) for on-page SEO and enrich the findings with
  SimilarWeb keyword, SERP, and traffic data. Use when the user asks to run an
  SEO audit, check a page's SEO, review meta tags / titles / headings / alt
  text / structured data for a URL, or compare a site's search performance
  against competitors.
---

# SEO Audit

Audit a live URL in two layers — **on-page** (what's in the HTML) and
**off-page** (how the domain performs in search, via SimilarWeb) — then deliver
a prioritized, fix-oriented report.

## When to use

Trigger on requests like "run an SEO audit on example.com", "check the SEO of
this page", "why isn't this page ranking", "review my meta tags", or "compare
our keywords to competitors".

## Workflow

### 1. On-page analysis (always)

Run the bundled analyzer. It fetches the URL and emits a JSON report covering
title, meta description, robots/indexability, canonical, hreflang, headings,
image alt coverage, Open Graph / Twitter cards, JSON-LD structured data,
internal/external link counts, an estimated word count, and a pre-computed
`issues` list.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/audit.py" "<url>"
```

Options: `--timeout SECONDS` (default 20), `--user-agent "<UA>"`.

- The script is **standard-library only** — no install step.
- If the JSON has `"fatal": true`, surface the `error` and stop (the page
  couldn't be fetched).
- The `issues` array is a starting point, not the whole story. Read the raw
  fields too and apply judgement (e.g. multiple H1s can be fine in HTML5
  sectioning; a `noindex` may be intentional on a staging page).

### 2. Off-page enrichment (SimilarWeb, when available)

If SimilarWeb MCP tools are present, pull search/traffic context for the
**registrable domain** of the audited URL. Useful tools:

- `get-keywords-seo-overview` — organic SEO snapshot for a keyword/domain.
- `get-websites-keywords-competitors-agg` — keyword overlap competitors.
- `get-websites-serp-players-agg` / `get-websites-serp-players` — who ranks
  for the domain's keyword set.
- `get-websites-landing-pages-agg` / `get-pages-popular-pages-agg` — top
  organic landing pages.
- `get-websites-traffic-and-engagement` and `get-websites-traffic-channels` —
  overall traffic and the share coming from organic search.
- `get-brands-top-keywords-agg` — the domain's strongest keywords.

Guidance:
- Default the country to `us` unless the user specifies one; pass the user's
  country to the tools that accept it.
- These calls consume SimilarWeb credits — make targeted calls, don't repeat
  queries for data already retrieved, and skip enrichment entirely if the
  tools aren't connected.
- If a tool returns no data or errors, note it and move on. **Never fabricate
  metrics** — report only what the tools actually returned.

### 3. Report

Deliver a concise, prioritized report:

1. **Header** — final URL, HTTP status, whether it redirected, HTTPS.
2. **Critical errors** (severity `error`) — e.g. missing title, `noindex`,
   non-HTTPS. Each with the concrete fix.
3. **Warnings** — e.g. missing/over-long meta description, missing H1, images
   without alt text, no viewport.
4. **Opportunities** (severity `info`) — canonical, structured data, Open
   Graph, thin content.
5. **Search performance** (SimilarWeb) — top keywords, SERP competitors, top
   landing pages, and organic traffic share, when available.

Keep it actionable: lead with what to change and why it matters, not a raw
field dump.

## Notes

- One URL per run. To audit several pages, run the analyzer once per URL.
- The analyzer reads only the HTML returned by the server; it does not execute
  JavaScript, so client-side-rendered content (and tags injected at runtime)
  won't be seen. Mention this caveat if a page looks suspiciously empty.
