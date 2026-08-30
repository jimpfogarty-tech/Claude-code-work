import email

from warmup.browser import host_allowed
from warmup.engage import choose_link, extract_links

ALLOWED = ["fullbeauty.com", "womanwithin.com"]


def test_exact_and_subdomain_match():
    assert host_allowed("https://fullbeauty.com/sale", ALLOWED)
    assert host_allowed("https://click.email.fullbeauty.com/x?y=1", ALLOWED)


def test_lookalike_domain_is_rejected():
    # The suffix check must respect a dot boundary, or these would slip through.
    assert not host_allowed("https://notfullbeauty.com/", ALLOWED)
    assert not host_allowed("https://fullbeauty.com.evil.net/", ALLOWED)


def test_unrelated_domain_is_rejected():
    assert not host_allowed("https://example.com/", ALLOWED)


def test_empty_allowlist_denies_everything():
    assert not host_allowed("https://fullbeauty.com/", [])


def test_malformed_url_is_rejected():
    assert not host_allowed("not a url", ALLOWED)
    assert not host_allowed("", ALLOWED)


def test_case_and_trailing_dot_are_normalised():
    assert host_allowed("https://WWW.FullBeauty.COM./x", ALLOWED)


HTML_EMAIL = """From: Brand <news@email.fullbeauty.com>
Subject: Sale
Content-Type: text/html; charset="utf-8"

<html><body>
<a href="https://click.email.fullbeauty.com/c/1">Shop the sale</a>
<a href="https://click.email.fullbeauty.com/c/1">Shop the sale (dupe)</a>
<a href="https://click.email.fullbeauty.com/unsubscribe?id=9">Unsubscribe</a>
<a href="https://partner-affiliate.example.com/deal">Partner offer</a>
<a href="mailto:help@fullbeauty.com">Email us</a>
</body></html>
"""


def parsed():
    return email.message_from_string(HTML_EMAIL)


def test_extract_links_dedupes_and_drops_non_http():
    links = extract_links(parsed())
    assert links == [
        "https://click.email.fullbeauty.com/c/1",
        "https://click.email.fullbeauty.com/unsubscribe?id=9",
        "https://partner-affiliate.example.com/deal",
    ]


def test_choose_link_skips_unsubscribe_and_offdomain():
    chosen = choose_link(extract_links(parsed()), ["unsubscribe"], ALLOWED)
    assert chosen == "https://click.email.fullbeauty.com/c/1"


def test_choose_link_returns_none_when_nothing_qualifies():
    assert choose_link(extract_links(parsed()), ["unsubscribe"], ["other.com"]) is None


def test_extract_links_on_plaintext_email():
    msg = email.message_from_string("Subject: x\n\njust text\n")
    assert extract_links(msg) == []
