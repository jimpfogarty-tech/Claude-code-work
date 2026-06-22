#!/usr/bin/env python3
"""On-page SEO analyzer for a live URL.

Fetches a single URL and extracts the on-page signals that matter for SEO,
then emits a JSON report on stdout. Uses only the Python standard library so
it runs anywhere without an install step.

Usage:
    python3 audit.py <url> [--timeout SECONDS] [--user-agent UA]

Exit codes:
    0  report emitted (the report itself may still contain issues)
    2  the URL could not be fetched
"""

import argparse
import gzip
import json
import re
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

DEFAULT_UA = (
    "Mozilla/5.0 (compatible; seo-audit/0.1; +https://github.com/jimpfogarty-tech)"
)

# Recommended length bounds used to flag issues (characters).
TITLE_MIN, TITLE_MAX = 30, 60
DESC_MIN, DESC_MAX = 70, 160


class SEOParser(HTMLParser):
    """Collect the SEO-relevant bits of an HTML document in a single pass."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts = []
        self._in_title = False
        self.html_lang = None
        self.metas = []  # list of dicts of the tag's attributes
        self.links = []  # <link> tags
        self.headings = []  # (level, text)
        self._heading_level = None
        self._heading_buf = []
        self.images = []  # dicts with src/alt/has_alt
        self.anchors = []  # dicts with href/rel/text
        self._anchor_attrs = None
        self._anchor_buf = []
        self.jsonld = []  # raw JSON-LD strings
        self._in_jsonld = False
        self._jsonld_buf = []
        self.body_text_len = 0

    # -- tags ----------------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "html" and "lang" in a:
            self.html_lang = a["lang"].strip()
        elif tag == "meta":
            self.metas.append(a)
        elif tag == "link":
            self.links.append(a)
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._heading_level = int(tag[1])
            self._heading_buf = []
        elif tag == "img":
            self.images.append(
                {
                    "src": a.get("src", ""),
                    "alt": a.get("alt"),
                    "has_alt": "alt" in a,
                }
            )
        elif tag == "a" and "href" in a:
            self._anchor_attrs = a
            self._anchor_buf = []
        elif tag == "script" and a.get("type", "").lower() == "application/ld+json":
            self._in_jsonld = True
            self._jsonld_buf = []

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self._heading_level:
            text = " ".join("".join(self._heading_buf).split())
            self.headings.append((self._heading_level, text))
            self._heading_level = None
        elif tag == "a" and self._anchor_attrs is not None:
            text = " ".join("".join(self._anchor_buf).split())
            self.anchors.append(
                {
                    "href": self._anchor_attrs.get("href", ""),
                    "rel": self._anchor_attrs.get("rel", ""),
                    "text": text,
                }
            )
            self._anchor_attrs = None
        elif tag == "script" and self._in_jsonld:
            self.jsonld.append("".join(self._jsonld_buf).strip())
            self._in_jsonld = False

    def handle_data(self, data):
        if self._in_title:
            self.title_parts.append(data)
        if self._heading_level:
            self._heading_buf.append(data)
        if self._anchor_attrs is not None:
            self._anchor_buf.append(data)
        if self._in_jsonld:
            self._jsonld_buf.append(data)
        stripped = data.strip()
        if stripped:
            self.body_text_len += len(stripped)


def fetch(url, timeout, user_agent):
    """Return (final_url, status, headers, html_text)."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Encoding": "gzip, identity",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding", "").lower() == "gzip":
            raw = gzip.decompress(raw)
        charset = resp.headers.get_content_charset() or "utf-8"
        html = raw.decode(charset, errors="replace")
        return resp.geturl(), resp.status, dict(resp.headers), html


def meta_value(metas, *, name=None, prop=None):
    for m in metas:
        if name and m.get("name", "").lower() == name.lower():
            return m.get("content", "").strip()
        if prop and m.get("property", "").lower() == prop.lower():
            return m.get("content", "").strip()
    return None


def analyze(url, timeout, user_agent):
    final_url, status, headers, html = fetch(url, timeout, user_agent)
    p = SEOParser()
    p.feed(html)

    title = " ".join("".join(p.title_parts).split())
    description = meta_value(p.metas, name="description")
    robots = meta_value(p.metas, name="robots")
    viewport = meta_value(p.metas, name="viewport")
    charset = next(
        (m["charset"] for m in p.metas if "charset" in m), None
    )

    canonical = next(
        (
            l.get("href")
            for l in p.links
            if "canonical" in l.get("rel", "").lower()
        ),
        None,
    )
    hreflang = [
        {"lang": l.get("hreflang"), "href": l.get("href")}
        for l in p.links
        if l.get("hreflang")
    ]

    h1s = [t for lvl, t in p.headings if lvl == 1]
    images_missing_alt = [i for i in p.images if not i["has_alt"] or not (i["alt"] or "").strip()]

    parsed = urlparse(final_url)
    internal_links = external_links = 0
    for a in p.anchors:
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        netloc = urlparse(urljoin(final_url, href)).netloc
        if netloc == parsed.netloc or not netloc:
            internal_links += 1
        else:
            external_links += 1

    og = {
        k: meta_value(p.metas, prop=f"og:{k}")
        for k in ("title", "description", "image", "type", "url")
    }
    twitter = {
        k: meta_value(p.metas, name=f"twitter:{k}")
        for k in ("card", "title", "description", "image")
    }

    schema_types = []
    for block in p.jsonld:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            schema_types.append("(unparseable JSON-LD)")
            continue
        for obj in data if isinstance(data, list) else [data]:
            if isinstance(obj, dict) and obj.get("@type"):
                t = obj["@type"]
                schema_types.extend(t if isinstance(t, list) else [t])

    # ~5.5 chars per word is a rough English average.
    word_estimate = round(p.body_text_len / 5.5)

    report = {
        "requested_url": url,
        "final_url": final_url,
        "http_status": status,
        "redirected": url.rstrip("/") != final_url.rstrip("/"),
        "https": parsed.scheme == "https",
        "title": {
            "text": title or None,
            "length": len(title),
        },
        "meta_description": {
            "text": description,
            "length": len(description) if description else 0,
        },
        "html_lang": p.html_lang,
        "charset": charset,
        "viewport": viewport,
        "robots_meta": robots,
        "x_robots_tag": headers.get("X-Robots-Tag"),
        "canonical": canonical,
        "hreflang": hreflang,
        "headings": {
            "h1_count": len(h1s),
            "h1": h1s,
            "outline": [{"level": lvl, "text": t} for lvl, t in p.headings],
        },
        "images": {
            "total": len(p.images),
            "missing_alt": len(images_missing_alt),
        },
        "links": {
            "internal": internal_links,
            "external": external_links,
        },
        "open_graph": og,
        "twitter_card": twitter,
        "structured_data": sorted(set(schema_types)),
        "word_count_estimate": word_estimate,
        "issues": [],
    }
    report["issues"] = collect_issues(report)
    return report


def collect_issues(r):
    """Flag concrete, well-established on-page problems. Each item is
    {severity, check, detail}. Severity is error | warning | info."""
    issues = []

    def add(sev, check, detail):
        issues.append({"severity": sev, "check": check, "detail": detail})

    if not r["https"]:
        add("error", "https", "Page is not served over HTTPS.")

    t = r["title"]["text"]
    if not t:
        add("error", "title", "Missing <title> tag.")
    elif r["title"]["length"] > TITLE_MAX:
        add("warning", "title", f"Title is {r['title']['length']} chars (>{TITLE_MAX}); may truncate in SERPs.")
    elif r["title"]["length"] < TITLE_MIN:
        add("warning", "title", f"Title is {r['title']['length']} chars (<{TITLE_MIN}); likely too short.")

    d = r["meta_description"]["text"]
    if not d:
        add("warning", "meta_description", "Missing meta description.")
    elif r["meta_description"]["length"] > DESC_MAX:
        add("info", "meta_description", f"Meta description is {r['meta_description']['length']} chars (>{DESC_MAX}); may truncate.")
    elif r["meta_description"]["length"] < DESC_MIN:
        add("info", "meta_description", f"Meta description is {r['meta_description']['length']} chars (<{DESC_MIN}); consider expanding.")

    hc = r["headings"]["h1_count"]
    if hc == 0:
        add("warning", "h1", "No <h1> on the page.")
    elif hc > 1:
        add("info", "h1", f"{hc} <h1> tags found; a single H1 is conventional.")

    robots = (r["robots_meta"] or "") + " " + (r["x_robots_tag"] or "")
    if "noindex" in robots.lower():
        add("error", "indexability", "Page is marked noindex; it will be excluded from search.")

    if not r["canonical"]:
        add("info", "canonical", "No canonical link element; add one to consolidate duplicates.")

    if not r["viewport"]:
        add("warning", "viewport", "No viewport meta tag; page may not be mobile-friendly.")

    if not r["html_lang"]:
        add("info", "lang", "No lang attribute on <html>.")

    if r["images"]["total"] and r["images"]["missing_alt"]:
        add("warning", "alt_text", f"{r['images']['missing_alt']} of {r['images']['total']} images lack alt text.")

    if not any(v for v in r["open_graph"].values()):
        add("info", "open_graph", "No Open Graph tags; social shares may render poorly.")

    if not r["structured_data"]:
        add("info", "structured_data", "No JSON-LD structured data detected.")

    if r["word_count_estimate"] < 300:
        add("info", "content", f"Low on-page text (~{r['word_count_estimate']} words); thin content can underperform.")

    return issues


def main(argv=None):
    ap = argparse.ArgumentParser(description="On-page SEO analyzer for a live URL.")
    ap.add_argument("url", help="URL to audit (http/https)")
    ap.add_argument("--timeout", type=float, default=20.0, help="Request timeout in seconds")
    ap.add_argument("--user-agent", default=DEFAULT_UA, help="User-Agent header to send")
    args = ap.parse_args(argv)

    url = args.url
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url

    try:
        report = analyze(url, args.timeout, args.user_agent)
    except urllib.error.HTTPError as e:
        json.dump({"requested_url": url, "error": f"HTTP {e.code} {e.reason}", "fatal": True}, sys.stdout, indent=2)
        print()
        return 2
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        json.dump({"requested_url": url, "error": str(e), "fatal": True}, sys.stdout, indent=2)
        print()
        return 2

    json.dump(report, sys.stdout, indent=2, ensure_ascii=False)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
