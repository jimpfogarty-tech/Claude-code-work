"""Sanity-check the comps: compute what the Excel formulas will produce."""
import sys
sys.path.insert(0, "/home/user/Claude-code-work/scripts")
from build_nvda_comps import DATA, PEERS

print(f"{'Ticker':<8} {'Rev':>10} {'Growth':>8} {'GM':>7} {'EBITDA-M':>9} {'FCF-M':>8} | {'MktCap':>10} {'EV':>10} {'EV/Rev':>8} {'EV/EBITDA':>10} {'P/E':>8}")
print("-" * 130)

for _name, t in PEERS:
    d = DATA[t]
    gm = d["gross_profit"] / d["revenue"]
    ebm = d["adj_ebitda"] / d["revenue"]
    fcfm = d["fcf"] / d["revenue"]
    mc = d["share_price"] * d["shares"]
    ev = mc + d["net_debt"]
    ev_rev = ev / d["revenue"]
    ev_ebitda = ev / d["adj_ebitda"] if d["adj_ebitda"] else None
    pe = d["share_price"] / d["eps"] if d["eps"] > 0 else None
    pe_str = f"{pe:>7.1f}x" if pe else "    N/A "
    ev_ebitda_str = f"{ev_ebitda:>8.1f}x" if ev_ebitda else "   N/A  "
    print(f"{t:<8} {d['revenue']:>10,} {d['growth']*100:>7.1f}% {gm*100:>6.1f}% {ebm*100:>8.1f}% {fcfm*100:>7.1f}% | {mc:>10,} {ev:>10,} {ev_rev:>7.1f}x {ev_ebitda_str} {pe_str}")

print()
# Stats on the multiples
import statistics
def stats(values, name, fmt):
    values = [v for v in values if v is not None]
    print(f"  {name:<20} Max={fmt.format(max(values))}  75th={fmt.format(statistics.quantiles(values, n=4)[2])}  Med={fmt.format(statistics.median(values))}  25th={fmt.format(statistics.quantiles(values, n=4)[0])}  Min={fmt.format(min(values))}")

ev_revs = [(d["share_price"] * d["shares"] + d["net_debt"]) / d["revenue"] for _n, t in PEERS for d in [DATA[t]]]
ev_ebitdas = [(d["share_price"] * d["shares"] + d["net_debt"]) / d["adj_ebitda"] for _n, t in PEERS for d in [DATA[t]] if d["adj_ebitda"]]
pes = [d["share_price"] / d["eps"] for _n, t in PEERS for d in [DATA[t]] if d["eps"] > 0]
growths = [d["growth"] for _n, t in PEERS for d in [DATA[t]]]
gms = [d["gross_profit"] / d["revenue"] for _n, t in PEERS for d in [DATA[t]]]
ebms = [d["adj_ebitda"] / d["revenue"] for _n, t in PEERS for d in [DATA[t]]]

print()
print("Statistics across peer set:")
stats(growths, "Revenue Growth", "{:.1%}")
stats(gms, "Gross Margin", "{:.1%}")
stats(ebms, "EBITDA Margin", "{:.1%}")
stats(ev_revs, "EV/Revenue", "{:.1f}x")
stats(ev_ebitdas, "EV/EBITDA", "{:.1f}x")
stats(pes, "P/E", "{:.1f}x")

print()
print("NVDA positioning:")
nvda = DATA["NVDA"]
nvda_ev = nvda["share_price"] * nvda["shares"] + nvda["net_debt"]
nvda_ev_rev = nvda_ev / nvda["revenue"]
nvda_ev_ebitda = nvda_ev / nvda["adj_ebitda"]
nvda_pe = nvda["share_price"] / nvda["eps"]
print(f"  NVDA EV/Rev:     {nvda_ev_rev:.1f}x  vs median {statistics.median(ev_revs):.1f}x  ({'+' if nvda_ev_rev > statistics.median(ev_revs) else '-'}{abs(nvda_ev_rev - statistics.median(ev_revs)):.1f}x)")
print(f"  NVDA EV/EBITDA:  {nvda_ev_ebitda:.1f}x  vs median {statistics.median(ev_ebitdas):.1f}x  ({'+' if nvda_ev_ebitda > statistics.median(ev_ebitdas) else '-'}{abs(nvda_ev_ebitda - statistics.median(ev_ebitdas)):.1f}x)")
print(f"  NVDA P/E:        {nvda_pe:.1f}x  vs median {statistics.median(pes):.1f}x  ({'+' if nvda_pe > statistics.median(pes) else '-'}{abs(nvda_pe - statistics.median(pes)):.1f}x)")

# Sanity checks per the skill
print()
print("Sanity checks:")
fails = 0
for _n, t in PEERS:
    d = DATA[t]
    gm = d["gross_profit"] / d["revenue"]
    ebm = d["adj_ebitda"] / d["revenue"]
    if not (gm >= ebm):
        print(f"  FAIL: {t} GM ({gm:.1%}) < EBITDA-M ({ebm:.1%}) — should be GM >= EBITDA-M")
        fails += 1
    # EV/Revenue reasonable range 0.5-30x for semis
    ev = d["share_price"] * d["shares"] + d["net_debt"]
    evr = ev / d["revenue"]
    if not (0.3 <= evr <= 35):
        print(f"  FAIL: {t} EV/Revenue ({evr:.1f}x) outside reasonable range 0.3-35x")
        fails += 1
if fails == 0:
    print("  All margin tests pass (GM >= EBITDA-M).")
    print("  All EV/Revenue multiples in reasonable range.")
