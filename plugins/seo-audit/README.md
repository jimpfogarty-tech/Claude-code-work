# seo-audit

A Claude Code plugin that audits a **live URL** for on-page SEO and enriches
the findings with **SimilarWeb** keyword, SERP, and traffic data.

## What it checks

On-page (from the page's HTML, standard-library Python — no install):

- Title tag (presence + length)
- Meta description (presence + length)
- Indexability (`robots` meta + `X-Robots-Tag`, HTTPS, canonical)
- Headings (H1 count + full outline)
- Image `alt` coverage
- `hreflang`, `lang`, viewport, charset
- Open Graph & Twitter Card tags
- JSON-LD structured data types
- Internal vs. external link counts
- Estimated word count
- A pre-computed, severity-tagged `issues` list

Off-page (when the SimilarWeb MCP tools are connected): top keywords, SERP
competitors, popular landing pages, and organic traffic share for the domain.

## Usage

Slash command:

```
/seo-audit https://example.com us
```

Or just ask: *"Run an SEO audit on example.com."* The `seo-audit` skill
activates automatically.

Run the analyzer directly:

```bash
python3 plugins/seo-audit/scripts/audit.py https://example.com
```

## Install (as a marketplace plugin)

This repo doubles as a plugin marketplace (`.claude-plugin/marketplace.json`):

```
/plugin marketplace add jimpfogarty-tech/claude-code-work
/plugin install seo-audit@claude-code-work-marketplace
```

## Caveats

- One URL per run.
- The analyzer reads server-returned HTML only — it does **not** run
  JavaScript, so client-side-rendered content won't be seen.
- SimilarWeb calls consume credits; enrichment is skipped when the tools
  aren't available.
