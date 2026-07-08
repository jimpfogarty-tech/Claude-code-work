---
description: Audit a live URL for on-page SEO and enrich it with SimilarWeb data
argument-hint: <url> [country]
---

Run a full SEO audit for the URL: **$1**
Optional target country for keyword/traffic data: **$2** (default: `us`)

Follow the workflow in the `seo-audit` skill:

1. **On-page audit.** Run the analyzer and read its JSON report:

   ```bash
   python3 "${CLAUDE_PLUGIN_ROOT}/scripts/audit.py" "$1"
   ```

   If the report has `"fatal": true`, report the fetch error and stop.

2. **Off-page enrichment (SimilarWeb).** If the SimilarWeb MCP tools are
   available, pull keyword, SERP, and traffic context for the URL's domain
   using country `$2`. Skip gracefully if the tools or data aren't available.

3. **Report.** Present a prioritized summary: critical errors first, then
   warnings, then opportunities. For each issue give the concrete fix. Close
   with the SimilarWeb context (top keywords, SERP competitors, traffic) when
   available. Do not invent data — only report what the tools returned.
