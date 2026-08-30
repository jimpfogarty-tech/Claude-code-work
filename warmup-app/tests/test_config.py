import pytest

from warmup.config import ConfigError, Site, load_sites

VALID = """
sites:
  - key: brand
    name: Brand
    signup_url: https://brand.com
    senders: ["@email.brand.com"]
"""


def write(tmp_path, text):
    path = tmp_path / "sites.yml"
    path.write_text(text)
    return path


def test_loads_a_valid_file(tmp_path):
    sites = load_sites(write(tmp_path, VALID))
    assert len(sites) == 1
    assert sites[0].key == "brand"
    assert sites[0].senders == ("@email.brand.com",)


def test_missing_file_explains_the_fix(tmp_path):
    with pytest.raises(ConfigError, match="sites.example.yml"):
        load_sites(tmp_path / "nope.yml")


def test_missing_required_field_is_rejected(tmp_path):
    with pytest.raises(ConfigError, match="signup_url"):
        load_sites(write(tmp_path, "sites:\n  - key: a\n    name: A\n"))


def test_duplicate_keys_are_rejected(tmp_path):
    text = VALID + """
  - key: brand
    name: Brand Two
    signup_url: https://brand2.com
"""
    with pytest.raises(ConfigError, match="duplicate site key"):
        load_sites(write(tmp_path, text))


def test_empty_file_is_rejected(tmp_path):
    with pytest.raises(ConfigError, match="no sites"):
        load_sites(write(tmp_path, "sites: []\n"))


@pytest.mark.parametrize(
    "from_header,expected",
    [
        ("Brand <news@email.brand.com>", True),
        ("BRAND <NEWS@EMAIL.BRAND.COM>", True),
        ("Someone <hi@other.com>", False),
        ("", False),
    ],
)
def test_sender_matching(from_header, expected):
    site = Site(key="b", name="B", signup_url="https://b.com", senders=("@email.brand.com",))
    assert site.matches_sender(from_header) is expected


def test_site_with_no_senders_matches_nothing():
    site = Site(key="b", name="B", signup_url="https://b.com", senders=())
    assert site.matches_sender("anyone@anywhere.com") is False
