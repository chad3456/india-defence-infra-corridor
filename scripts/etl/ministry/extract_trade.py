"""
India's monthly trade, read out of the Commerce Ministry's own releases.

    python3 scripts/etl/ministry/extract_trade.py

Reads data/ministry/commerce-docs.json (the pinned releases' text) and writes
data/ministry/trade.json: every figure each release states for a month or a
fiscal year-to-date, with the release it came from and a verbatim quote of
the table block it was read from. A month is usually stated twice — in its own
release, and a year later as the comparison column — and both are kept, so the
first estimate and the revision can be told apart.

Rules, all explicit:
  * Table 1 "Trade during <Month YYYY>" and Table 2 "Trade during April-<Month>
    YYYY-YY": rows Merchandise / Services / Total Trade, each Exports and
    Imports, and Total Trade Balance ("Overall Trade" in releases up to 2023); column one is the period named, column
    two the same period a year earlier.
  * A table is kept only if Total = Merchandise + Services for exports and
    imports, and Balance = Total exports - Total imports, each within 0.03.
"""
import json, os, re, html, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
IN = os.path.join(ROOT, 'data', 'ministry', 'commerce-docs.json')
OUT = os.path.join(ROOT, 'data', 'ministry', 'trade.json')
MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

def norm(s):
    s = html.unescape(s)
    s = re.sub(r'[‘’′]', "'", s); s = re.sub(r'[“”]', '"', s); s = re.sub(r'[–—−]', '-', s)
    return re.sub(r'\s+', ' ', s.replace(' ', ' ')).strip()

def month_key(name, year):
    m = MONTHS.index(name.lower()[:3] and [x for x in MONTHS if x.startswith(name.lower()[:3])][0]) + 1
    return f'{int(year):04d}-{m:02d}'

NUM = r'(-?\d+(?:\.\d+)?)'

TITLE = re.compile(r'Table\s*\d\s*:\s*Trade (excluding Petroleum and Gems & Jewellery )?during\s+(?:FY\s*(\d{4})\s*-\s*(\d{2})\s*\(April\s*-\s*March\)|April\s*-\s*([A-Za-z]+)\s+(\d{4})(?:\s*-\s*\d{2})?|([A-Za-z]+)\s+(\d{4}))', re.I)

def parse_title(m):
    """(kind, period, previous period) from a table title."""
    if m.group(2):                                   # FY 2025-26 (April-March)
        fy0 = int(m.group(2)); return 'ytd', f'FY{fy0}-{str(fy0+1)[2:]}:Apr-Mar', f'FY{fy0-1}-{str(fy0)[2:]}:Apr-Mar'
    if m.group(4):                                   # April-<Month> YYYY: the fiscal year that began in April YYYY
        fy0 = int(m.group(5)); thr = m.group(4)[:3].title()
        if thr.lower() in ('jan','feb','mar') and not re.search(r'\d{4}\s*-\s*\d{2}', m.group(0)): fy0 -= 1
        return 'ytd', f'FY{fy0}-{str(fy0+1)[2:]}:Apr-{thr}', f'FY{fy0-1}-{str(fy0)[2:]}:Apr-{thr}'
    period = month_key(m.group(6), m.group(7))
    return 'month', period, f'{int(period[:4]) - 1:04d}{period[4:]}'

CORE_ROWS = [(r'Non-\s*petroleum\s+exports', 'nonpetro-exports'), (r'Non-\s*petroleum\s+imports', 'nonpetro-imports'),
             (r'Non-petroleum\s*&\s*Non[- ]Gems\s*&\s*Jewellery\s+exports', 'core-exports'), (r'Non-petroleum\s*&\s*Non[- ]Gems\s*&\s*Jewellery\s+imports', 'core-imports')]

def tables(doc):
    """Yield (kind, period, prev_period, rows, excluding?, title) for each trade table."""
    text = '\n'.join(doc['pages'])
    for m in TITLE.finditer(text):
        kind, period, prev = parse_title(m)
        start = m.end()
        end = text.find('Table', start)
        block = text[start:end if end > 0 else start + 2500][:2500]
        rows = {}
        if m.group(1):
            for ln in block.split('\n'):
                for pat, key in CORE_ROWS:
                    mm = re.search(r'^\s*' + pat + r'\s+' + NUM + r'\s+' + NUM + r'\s*$', ln, re.I)
                    if mm: rows[(key, '')] = (float(mm.group(1)), float(mm.group(2)), ln)
            yield kind, period, prev, rows, True, m.group(0)
            continue
        cat = None
        for ln in block.split('\n'):
            l = ln.strip()
            if re.match(r'^Merchandise\b', l): cat = 'merch'
            elif re.match(r'^Services(?!\s*\))', l): cat = 'services'   # not "Services) *", the end of the total's label
            elif re.match(r'^(?:Total|Overall)\s+Trade', l) or re.match(r'^\(Merchandise', l): cat = 'total'   # "Overall Trade" until 2023
            mm = re.search(r'\b(Exports|Imports|Trade Balance)\s+' + NUM + r'\s+' + NUM + r'\s*$', l)
            if mm and cat:
                meas = {'Exports': 'exports', 'Imports': 'imports', 'Trade Balance': 'balance'}[mm.group(1)]
                rows[(cat, meas)] = (float(mm.group(2)), float(mm.group(3)), ln)
            if len(rows) >= 7: break
        yield kind, period, prev, rows, False, m.group(0)

# Releases before the tables (commerce.nic.in, 2000-2016) state the figures in
# sentences, in US$ million: "Exports during March 2012 were valued at US $
# 28684.67 million", and "...exports for the period April-March 2011-12 was
# US $ 303719.27 million". Merchandise only. The sentence names the flow, the
# period and the figure together, so nothing is inferred from position.
MON = r'(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?'
USD = r'US\s?\$\s?([\d,]+(?:\.\d+)?)\s*(million|billion)'
MONTH_SENT = re.compile(r'\b(Exports|Imports)\s+(?:during|in|for)\s+(?:the\s+month\s+of\s+)?' + MON + r',?\s+(\d{4})\s+(?:were|was|are|is)\s+(?:valued\s+at\s+|estimated\s+(?:at|to\s+be)\s+)?' + USD, re.I)
CUM_SENT = re.compile(r'\b(exports|imports)\s+(?:for|during|in)\s+(?:the\s+period\s+)?April\s*-\s*' + MON + r',?\s+(\d{4})\s*-\s*(\d{2,4})\s+(?:was|were|is|are)\s+(?:valued\s+at\s+|estimated\s+(?:at|to\s+be)\s+)?' + USD, re.I)

# The word before "exports"/"imports" decides which flow a sentence is about.
# "Oil imports during May 2011 were valued at..." is a component, not the total;
# "Non-oil imports" is the ministry's imports-excluding-petroleum. Only words that
# leave the sentence about the whole merchandise flow are accepted as the total;
# anything unrecognised is refused rather than guessed.
TOTAL_LEAD = {'', 's', 'of', 'the', 'merchandise', 'total', 'overall', 'cumulative', 'india', 'delhi', 'imports', 'exports', 'and'}
NONPETRO_LEAD = {'non-oil', 'non-petroleum', 'non-pol'}

def flow_series(text, start, flow):
    """The series a sentence's flow belongs to, from the word before it, or None to refuse it."""
    lead = re.findall(r"([A-Za-z][A-Za-z-]*)\W*$", text[max(0, start - 30):start])
    w = lead[0].lower() if lead else ''
    if w in NONPETRO_LEAD: return f'nonpetro-{flow.lower()}'
    if w in TOTAL_LEAD: return f'merch-{flow.lower()}'
    return None

def sentence_obs(d):
    text = norm('\n'.join(d['pages']))
    out = []
    for m in MONTH_SENT.finditer(text):
        flow, mon, yr, val, unit = m.groups()
        series = flow_series(text, m.start(), flow)
        if not series: continue
        q = text[max(0, m.start()):m.end()]
        out.append({'series': series, 'kind': 'month', 'period': month_key(mon, yr), 'v': float(val.replace(',', '')), 'unit': f'US$ {unit.lower()}', 'quote': q})
    for m in CUM_SENT.finditer(text):
        flow, mon, y0, y1, val, unit = m.groups()
        series = flow_series(text, m.start(), flow)
        if not series: continue
        thr = mon[:3].title()
        out.append({'series': series, 'kind': 'ytd', 'period': f'FY{y0}-{y1[-2:]}:Apr-{thr}', 'v': float(val.replace(',', '')), 'unit': f'US$ {unit.lower()}', 'quote': text[m.start():m.end()]})
    return out

def consistent(rows):
    need = [('merch','exports'),('merch','imports'),('services','exports'),('services','imports'),('total','exports'),('total','imports'),('total','balance')]
    if not all(k in rows for k in need): return False, 'missing rows'
    for col in (0, 1):
        for meas in ('exports', 'imports'):
            if abs(rows[('merch',meas)][col] + rows[('services',meas)][col] - rows[('total',meas)][col]) > 0.031: return False, f'{meas} col{col} does not add'
        if abs(rows[('total','exports')][col] - rows[('total','imports')][col] - rows[('total','balance')][col]) > 0.031: return False, f'balance col{col}'
    return True, ''

def main():
    docs = json.load(open(IN))['docs']
    obs, sources, rejected = [], {}, []
    for d in docs:
        if not d.get('ok'): continue
        for kind, period, prev, rows, excl, head in tables(d):
            ok, why = (len(rows) == 4, 'core rows missing') if excl else consistent(rows)
            if not ok: rejected.append({'doc': d['id'], 'table': head, 'why': why}); continue
            sources[d['id']] = {k: d.get(k) for k in ('title', 'url', 'published', 'file', 'sha256')}
            # The quote for each category is its own block of lines, joined: label and both values.
            for (cat, meas), (cur, pre, line) in rows.items():
                q = norm(line)
                for per, v, role in ((period, cur, 'current'), (prev, pre, 'year-earlier')):
                    obs.append({'series': cat if excl else f'{cat}-{meas}', 'kind': kind, 'period': per, 'v': v, 'src': d['id'], 'quote': q, 'table': norm(head), 'role': role, 'released': d.get('published')})
        if d['id'].startswith('nic-'):
            got = sentence_obs(d)
            if got: sources[d['id']] = {k: d.get(k) for k in ('title', 'url', 'published', 'file', 'sha256')}
            for o in got:
                o.update({'src': d['id'], 'table': 'stated in the release text', 'role': 'current', 'released': d.get('published')})
                if o['unit'] == 'US$ billion': del o['unit']
                obs.append(o)
    obs.sort(key=lambda o: (o['series'], o['period'], o['released'] or ''))
    json.dump({'source': 'Department of Commerce, monthly press releases on India\'s foreign trade', 'unit': 'US$ billion', 'observations': obs, 'sources': sources, 'rejected': rejected}, open(OUT, 'w'), indent=1, ensure_ascii=False)
    months = sorted({o['period'] for o in obs if o['kind'] == 'month'})
    print(f'{len(obs)} observations from {len(sources)} releases; months {months[:1]}..{months[-1:]} ({len(months)}); {len(rejected)} tables rejected')
    for r in rejected[:10]: print('  rejected', r)

if __name__ == '__main__':
    main()
