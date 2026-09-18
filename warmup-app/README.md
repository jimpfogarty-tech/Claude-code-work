# Warm-Up App

A seed-mailbox deliverability monitor and a sending-domain warm-up planner, for
email programs you own.

It signs a dedicated seed address up to each of your programs, then every day
records **where each message actually landed** — Primary, Promotions, Spam, or
nowhere at all — along with the receiving provider's own SPF/DKIM/DMARC verdicts.
Optionally it also opens the mail and browses the landing site.

---

## Read this before you rely on it

**Opening and clicking your own mail from a seed mailbox does not improve your
sending reputation.** That was the original premise for this tool and it does not
hold up. Two reasons:

1. **Reputation is scored against the sender, not the recipient.** Mailbox
   providers build a reputation for your sending domain and IP from aggregate
   behaviour across their entire user base — bounce rate, complaint rate,
   authentication, volume consistency, and how millions of real recipients react.
   One seed mailbox is a rounding error in that population.

2. **Automated engagement is filtered before it counts.** Clicks originating from
   a datacenter IP with a headless browser fingerprint look exactly like security
   scanners, and ESPs already strip them from engagement metrics. Best case the
   signal is discarded; worse case the seed address gets classified as a bot.

So the tool is built around the two things that *do* work:

| Command | What it gives you |
|---------|-------------------|
| `warmup daily` | Hard evidence of where your mail lands, per program, per day, with auth results. Nothing else gives you this at the campaign level. |
| `warmup rampplan` | The volume ramp, audience sequencing, and quality gates that actually build sending reputation. |

The open/click layer (`engagement.enabled`) is still here and works. Treat it as
realistic mailbox activity and rendering verification, not as a reputation lever.

---

## Setup

### 1. Create a dedicated seed mailbox

Use a **new** Gmail account, not your primary. A seed mailbox with no other
traffic gives clean measurement, and you will not be burying real mail under
marketing volume.

On that account:
- Turn on 2-Step Verification.
- Create an **App Password** at <https://myaccount.google.com/apppasswords>.
- Enable IMAP under *Settings → Forwarding and POP/IMAP*.

### 2. Install

```bash
cd warmup-app
pip install -r requirements.txt
python -m playwright install chromium
```

If your environment already ships a Chromium that Playwright did not download,
point at it instead:

```bash
export WARMUP_CHROMIUM_PATH=/path/to/chrome
```

### 3. Configure

```bash
cp .env.example .env          # fill in the seed address and app password
cp config/sites.example.yml config/sites.yml
```

Edit `config/sites.yml` with your programs. The `senders` list is what the daily
sweep matches on, so it must contain the real `From:` domains — including ESP
subdomains like `email.yourbrand.com`. If you get an empty report, this is almost
always why.

Then set the engagement allowlist in `config/settings.yml`:

```yaml
engagement:
  allowed_domains:
    - yourbrand.com
    - email.yourbrand.com     # your ESP's click-tracking domain
```

This is a **hard, default-deny scope guard**. A link is followed only if its host
is on the list, and the final URL is re-checked after redirects — so a
click-tracking link that redirects to a third-party affiliate destination is
abandoned without interaction. An empty list disables clicking entirely.

### 4. Verify

```bash
python -m warmup.cli doctor
```

Checks config, credentials, IMAP connectivity, and that every expected folder
exists.

---

## Usage

```bash
python -m warmup.cli signup      # subscribe the seed address at each site
python -m warmup.cli confirm     # complete double opt-in
python -m warmup.cli sweep       # record where today's mail landed
python -m warmup.cli engage      # sweep, then open + click through new mail
python -m warmup.cli report      # render the placement report
python -m warmup.cli daily       # sweep + engage + report (what CI runs)

python -m warmup.cli rampplan 480000 --out -    # ramp for a 480k list
```

`signup` handles the common footer-bar and modal forms. Anything behind a CAPTCHA
is reported for manual signup with a screenshot — CAPTCHAs are never solved.

---

## How placement is detected

Gmail's tabs are not IMAP folders; they only exist as search-time categories. So
placement is resolved by running Gmail search expressions through the `X-GM-RAW`
IMAP extension and seeing which bucket a message turns up in:

| Bucket | Query |
|--------|-------|
| Spam | `[Gmail]/Spam` folder |
| Trash | `[Gmail]/Trash` folder |
| Promotions / Updates / Social / Forums | `INBOX` + `category:<name>` |
| Primary | `INBOX`, by elimination |
| Archived | `[Gmail]/All Mail` + `-in:inbox -in:spam -in:trash` |

Buckets resolve in that order and the first match wins, so a Promotions message
is not double-counted as generic inbox. Every fetch uses `BODY.PEEK`, so a sweep
never marks mail read — that only happens as a deliberate act in the engagement
step.

Set `mailbox.use_gmail_categories: false` for non-Gmail providers.

---

## Scheduled runs

`.github/workflows/warmup-daily.yml` runs the sweep daily at 14:00 UTC.

Add two repository secrets:
- `WARMUP_IMAP_USER`
- `WARMUP_IMAP_PASSWORD`

Placement history is carried between runs by a rolling `actions/cache` key, and
each day's report is committed to `warmup-app/reports/` so you get a readable
day-over-day diff in git.

CI runs with `--no-engage` by default, because GitHub's runners are datacenter
IPs and engagement from them is filtered anyway. Placement measurement — the part
worth having — is unaffected. Set the repo variable `WARMUP_ENGAGE=true`, or use
the workflow-dispatch input, to enable it.

---

## What actually moves reputation

`warmup rampplan <list_size>` generates the plan. The short version:

- **Get authentication right before day 1.** SPF, DKIM on an aligned domain,
  DMARC at `p=none` with `rua` reporting, matching forward/reverse DNS, TLS, and
  one-click unsubscribe (`List-Unsubscribe` + `List-Unsubscribe-Post`). Bulk
  senders to Gmail and Yahoo are required to have all of it.
- **Suppress the unengaged before you start.** Recipients who have not opened or
  clicked in a year are the single largest driver of spam placement.
- **Ramp volume gradually, most-engaged audience first,** widening only while the
  quality gates hold.
- **Hold at any gate breach.** Bounces under 2%, complaints under 0.10% (Gmail's
  published ceiling is 0.30%), delivery above 95%.
- **Keep cadence steady.** Volume spikes and long silences both read as
  compromise signals.
- **Watch Google Postmaster Tools and Microsoft SNDS.** Verify the domain in
  Postmaster Tools before day 1 so the ramp has a baseline.

---

## Development

```bash
pip install -r requirements-dev.txt
python -m pytest tests/ -q
```

The suite covers header parsing, placement resolution, the ramp generator, the
allowlist, link selection, and the sweep — using a fake mailbox, so no
credentials or network are needed.

## Layout

```
warmup/
  cli.py          entry point and command wiring
  config.py       settings.yml / sites.yml / credentials
  mailbox.py      IMAP access, Gmail search extensions
  placement.py    bucket definitions and resolution order
  authcheck.py    SPF/DKIM/DMARC and sending-IP extraction
  sweep.py        the daily placement sweep
  signup.py       newsletter signup automation
  confirm.py      double opt-in handling
  engage.py       open, click, and browse
  browser.py      shared Playwright helpers and the allowlist
  report.py       placement report rendering
  rampplan.py     sending-domain warm-up ramp
  store.py        SQLite persistence
```
