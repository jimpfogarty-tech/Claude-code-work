"""Sanity-check the DXLG comps before delivery."""
import sys
import statistics
sys.path.insert(0, "/home/user/Claude-code-work/scripts")
from build_dxlg_comps import DATA, PEERS


def pe(price, eps):
    return price / eps if eps > 0 else None


def ev_ebitda(ev, eb):
    return ev / eb if eb > 0 else None


print(f"{'Ticker':<6} {'Rev':>7} {'Gr':>6} {'GM':>6} {'EB-M':>6} {'FCF-M':>6} | {'MktCap':>7} {'EV':>7} {'EV/Rev':>7} {'EV/EB':>7} {'P/E':>7}")
print("-" * 105)
for _name, t in PEERS:
    d = DATA[t]
    gm = d["gross_profit"] / d["revenue"]
    ebm = d["adj_ebitda"] / d["revenue"]
    fcfm = d["fcf"] / d["revenue"]
    mc = d["share_price"] * d["shares"]
    ev = mc + d["net_debt"]
    evr = ev / d["revenue"]
    eveb = ev_ebitda(ev, d["adj_ebitda"])
    pe_val = pe(d["share_price"], d["eps"])
    eveb_s = f"{eveb:>6.1f}x" if eveb else "   n/m "
    pe_s = f"{pe_val:>6.1f}x" if pe_val else "   n/m "
    print(f"{t:<6} {d['revenue']:>7,} {d['growth']*100:>5.1f}% {gm*100:>5.1f}% {ebm*100:>5.1f}% {fcfm*100:>5.1f}% | {mc:>7,.0f} {ev:>7,.0f} {evr:>6.2f}x {eveb_s} {pe_s}")

# Peer-set stats (excluding subject DXLG so we can compare it cleanly)
peer_tickers = [t for _n, t in PEERS if t != "DXLG"]


def stat(values, fmt):
    values = [v for v in values if v is not None]
    if not values:
        return "—"
    q = statistics.quantiles(values, n=4)
    return (f"Max={fmt.format(max(values))}  75={fmt.format(q[2])}  "
            f"Med={fmt.format(statistics.median(values))}  "
            f"25={fmt.format(q[0])}  Min={fmt.format(min(values))}")


growths = [DATA[t]["growth"] for t in peer_tickers]
gms = [DATA[t]["gross_profit"]/DATA[t]["revenue"] for t in peer_tickers]
ebms = [DATA[t]["adj_ebitda"]/DATA[t]["revenue"] for t in peer_tickers]
fcfms = [DATA[t]["fcf"]/DATA[t]["revenue"] for t in peer_tickers]
ev_revs = [(DATA[t]["share_price"]*DATA[t]["shares"] + DATA[t]["net_debt"])/DATA[t]["revenue"] for t in peer_tickers]
ev_ebs = [ev_ebitda(DATA[t]["share_price"]*DATA[t]["shares"]+DATA[t]["net_debt"], DATA[t]["adj_ebitda"]) for t in peer_tickers]
pes = [pe(DATA[t]["share_price"], DATA[t]["eps"]) for t in peer_tickers]

print()
print("PEER stats (excluding DXLG):")
print(f"  Rev Growth   {stat(growths, '{:.1%}')}")
print(f"  Gross Margin {stat(gms, '{:.1%}')}")
print(f"  EBITDA Mgn   {stat(ebms, '{:.1%}')}")
print(f"  FCF Margin   {stat(fcfms, '{:.1%}')}")
print(f"  EV/Rev       {stat(ev_revs, '{:.2f}x')}")
print(f"  EV/EBITDA    {stat(ev_ebs, '{:.1f}x')}")
print(f"  P/E          {stat(pes, '{:.1f}x')}")

# DXLG positioning
d = DATA["DXLG"]
mc = d["share_price"]*d["shares"]
ev = mc + d["net_debt"]
print()
print("DXLG vs peer median:")
print(f"  Rev Growth    {d['growth']*100:>+6.1f}%  vs  {statistics.median(growths)*100:>+6.1f}%")
print(f"  Gross Margin  {d['gross_profit']/d['revenue']*100:>6.1f}%  vs  {statistics.median(gms)*100:>6.1f}%")
print(f"  EBITDA Mgn    {d['adj_ebitda']/d['revenue']*100:>6.1f}%  vs  {statistics.median(ebms)*100:>6.1f}%")
print(f"  FCF Margin    {d['fcf']/d['revenue']*100:>6.1f}%  vs  {statistics.median(fcfms)*100:>6.1f}%")
print(f"  EV/Rev        {ev/d['revenue']:>6.2f}x  vs  {statistics.median(ev_revs):>6.2f}x")
print(f"  EV/EBITDA     {ev/d['adj_ebitda']:>6.1f}x  vs  {statistics.median([v for v in ev_ebs if v]):>6.1f}x")
print(f"  P/E           {d['share_price']/d['eps']:>6.1f}x  vs  {statistics.median([v for v in pes if v]):>6.1f}x")

# Sanity checks
print()
print("Sanity checks:")
fails = 0
for _n, t in PEERS:
    d = DATA[t]
    gm = d["gross_profit"]/d["revenue"]
    ebm = d["adj_ebitda"]/d["revenue"]
    if d["adj_ebitda"] > 0 and gm < ebm:
        print(f"  FAIL: {t} GM ({gm:.1%}) < EBITDA-M ({ebm:.1%})")
        fails += 1
    ev = d["share_price"]*d["shares"] + d["net_debt"]
    evr = ev/d["revenue"]
    if not (0.05 <= evr <= 5):
        print(f"  FAIL: {t} EV/Revenue ({evr:.2f}x) outside reasonable retail range 0.05-5x")
        fails += 1
if fails == 0:
    print("  All GM>=EBITDA-M (for positive-EBITDA peers).")
    print("  All EV/Revenue multiples in reasonable retail range.")
