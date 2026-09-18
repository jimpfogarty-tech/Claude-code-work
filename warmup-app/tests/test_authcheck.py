import email

from warmup.authcheck import extract_sending_ip, parse_auth_results


def make(raw: str):
    return email.message_from_string(raw)


def test_parses_all_three_verdicts():
    msg = make(
        "Authentication-Results: mx.google.com;\n"
        "       dkim=pass header.i=@email.brand.com;\n"
        "       spf=pass (google.com: domain of bounce@email.brand.com designates"
        " 192.0.2.10 as permitted sender);\n"
        "       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=brand.com\n"
        "\nbody\n"
    )
    result = parse_auth_results(msg)
    assert (result.spf, result.dkim, result.dmarc) == ("pass", "pass", "pass")
    assert result.all_pass
    assert result.failures() == []


def test_reports_failures():
    msg = make(
        "Authentication-Results: mx.google.com; dkim=fail; spf=softfail; dmarc=fail\n\nbody\n"
    )
    result = parse_auth_results(msg)
    assert not result.all_pass
    assert set(result.failures()) == {"spf", "dkim", "dmarc"}


def test_missing_mechanism_counts_as_failure():
    msg = make("Authentication-Results: mx.google.com; spf=pass\n\nbody\n")
    result = parse_auth_results(msg)
    assert result.spf == "pass"
    assert result.dkim is None
    assert set(result.failures()) == {"dkim", "dmarc"}
    assert not result.all_pass


def test_arc_verdict_is_not_mistaken_for_dmarc_or_spf():
    # "arc=pass" contains neither "dmarc=" nor "spf=" as a delimited token, and
    # must not be scraped as one.
    msg = make("Authentication-Results: mx.google.com; arc=pass; dkim=fail\n\nbody\n")
    result = parse_auth_results(msg)
    assert result.dmarc is None
    assert result.spf is None
    assert result.dkim == "fail"


def test_uses_first_authentication_results_header():
    # The topmost header is stamped by the final receiving provider; that is the
    # verdict that decided placement.
    msg = make(
        "Authentication-Results: mx.google.com; spf=fail; dkim=fail; dmarc=fail\n"
        "Authentication-Results: relay.upstream.net; spf=pass; dkim=pass; dmarc=pass\n"
        "\nbody\n"
    )
    result = parse_auth_results(msg)
    assert (result.spf, result.dkim, result.dmarc) == ("fail", "fail", "fail")


def test_falls_back_to_received_spf():
    msg = make(
        "Authentication-Results: mx.google.com; dkim=pass; dmarc=pass\n"
        "Received-SPF: pass (google.com: domain of x designates 192.0.2.1 as permitted sender)\n"
        "\nbody\n"
    )
    assert parse_auth_results(msg).spf == "pass"


def test_bestguesspass_counts_as_passing():
    msg = make("Authentication-Results: mx.google.com; spf=bestguesspass; dkim=pass; dmarc=pass\n\nb\n")
    assert parse_auth_results(msg).all_pass


def test_sending_ip_prefers_earliest_public_hop():
    # Received headers are prepended, so the last one is the first hop and the
    # closest thing to the true sender.
    msg = make(
        "Received: from mx.google.com (mx.google.com [10.0.0.5])\n"
        "        by inbox.example.com; Tue, 4 Aug 2026 10:00:02 -0400\n"
        "Received: from relay.brand.com (relay.brand.com [64.233.160.23])\n"
        "        by mx.google.com; Tue, 4 Aug 2026 10:00:01 -0400\n"
        "\nbody\n"
    )
    assert extract_sending_ip(msg) == "64.233.160.23"


def test_sending_ip_skips_private_ranges():
    msg = make(
        "Received: from internal (internal [192.168.1.9]) by mx; Tue, 4 Aug 2026 10:00:00 -0400\n"
        "\nbody\n"
    )
    assert extract_sending_ip(msg) is None


def test_sending_ip_skips_reserved_documentation_ranges():
    # 198.51.100.0/24 is TEST-NET-2. Python's ipaddress treats reserved
    # documentation ranges as private, and a real sending IP is always routable,
    # so skipping them is correct rather than incidental.
    msg = make(
        "Received: from relay (relay [198.51.100.23]) by mx; Tue, 4 Aug 2026 10:00:00 -0400\n"
        "\nbody\n"
    )
    assert extract_sending_ip(msg) is None


def test_sending_ip_handles_ipv6():
    msg = make(
        "Received: from relay (relay [IPv6:2607:f8b0:4004:c07::1a])"
        " by mx; Tue, 4 Aug 2026 10:00:00 -0400\n"
        "\nbody\n"
    )
    assert extract_sending_ip(msg) == "2607:f8b0:4004:c07::1a"


def test_no_headers_is_safe():
    result = parse_auth_results(make("Subject: hi\n\nbody\n"))
    assert result == type(result)()
