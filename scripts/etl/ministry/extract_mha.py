"""
What the Home Ministry's monthly reports say, read out of the reports themselves.

    python3 scripts/etl/ministry/extract_mha.py

Reads data/ministry/mha-docs.json (the pinned reports' text) and writes
data/ministry/mha.json. The reports are prose — a numbered list of what the
ministry did in the month — so nothing here is a statistical series the
ministry publishes. What can be read exactly:

  * items: each report's numbered paragraphs, with the opening words of each
    kept verbatim, so "items reported" is a count anyone can redo by hand.
  * themes: which subjects each item mentions, by the keyword rules in THEMES.
    An item can carry several themes or none. The rules are printed on the page.
  * bills: every Bill named in an item about Presidential assent.
  * uapa: every item invoking the Unlawful Activities (Prevention) Act.
  * amounts: every rupee figure stated in crore or lakh, with the words around it.
    Amounts are of different kinds (sanctioned, released, recommended, project
    cost) and are listed, never summed.
  * counts: figures the reports state in a repeated form — Protected Area
    Permits granted, OCI cards issued.

Only the English text is read: most reports carry a Hindi version after (or
before) the English, and some older ones render Hindi in a legacy font that
extracts as Latin-letter noise. A line counts as English when it has no
Devanagari and at least one common English word in it.

Every quote is a run of the report's whitespace-normalised text; lib/ministry.ts
re-finds each one in the document before anything is drawn.
"""
import json, os, re, html

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
IN = os.path.join(ROOT, 'data', 'ministry', 'mha-docs.json')
OUT = os.path.join(ROOT, 'data', 'ministry', 'mha.json')
MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

def norm(s):
    s = html.unescape(s)
    s = re.sub(r'[‘’′]', "'", s); s = re.sub(r'[“”]', '"', s); s = re.sub(r'[–—−]', '-', s)
    return re.sub(r'\s+', ' ', s.replace(' ', ' ')).strip()

def month_of(title):
    m = re.search(r'(' + '|'.join(MONTHS) + r')\W*,?\s*(\d{4})', title, re.I)
    return f'{m.group(2)}-{MONTHS.index(m.group(1).lower()) + 1:02d}' if m else None

STOP = set('the of and to in was were has have been for on by with under is are at from as a an this which during month meeting held ministry home affairs india government state states union'.split())
DEVANAGARI = re.compile(r'[ऀ-ॿ]')

def english(line):
    if DEVANAGARI.search(line): return False
    words = re.findall(r'[A-Za-z]+', line.lower())
    return any(w in STOP for w in words) or bool(re.match(r'\s*\(?[ivx]+[.)]', line)) or len(words) <= 3

# "3." as printed; "3:", "3," or "3   The" where a scan's text layer misread the full stop.
ITEM = re.compile(r'^\s*(\d{1,2})(?:\s*[.):,;]\s+(?=[^\s\d.,])|\s*[.)]\s+(?=\d+\S*\s+[A-Za-z])|\s{2,}(?=[A-Z]))')

def items(text):
    """The report's top-level numbered paragraphs, in order; the first may be unnumbered."""
    lines = [l for l in text.split('\n') if english(l)]
    heads = []                                # (index into lines, number)
    expect = 1
    for i, l in enumerate(lines):
        m = ITEM.match(l)
        if not m: continue
        n = int(m.group(1))
        # One number may be skipped: a scan misreads "2." as "Z". That paragraph
        # is then read with the one before it, and the count is still the last number.
        if expect <= n <= expect + 1 or (expect == 1 and n == 3):
            heads.append((i, n)); expect = n + 1
    if not heads: return []
    out = []
    if heads[0][1] > 1:                      # an unnumbered first item, after the report's heading
        body = norm(' '.join(lines[:heads[0][0]]))
        first = re.split(r'(?:during|for) the month of [A-Za-z]+,? ?\d{4}\.?', body, maxsplit=1, flags=re.I)
        if len(first) == 2 and len(first[1].strip()) > 20: out.append((1, first[1].strip()))
        else: out.append((1, ''))
    for k, (i, n) in enumerate(heads):
        j = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        body = norm(' '.join(lines[i:j]))
        body = re.split(r'\s\*{3,}', body)[0]  # the "****" that closes the English part
        out.append((n, body))
    return out

# Keyword rules. Matched case-insensitively on an item's English text, as whole words.
THEMES = [
    ('legislation', 'Bills, Acts, rules and notifications', r'assent\w*|Bills?|Ordinance|Rules,? \d{4}|Regulations?|Gazette|notifi\w+|Amendment'),
    ('security', 'Terrorism, insurgency and internal security', r'terror\w*|UAPA|Unlawful (?:Activities|Association)|NIA|insurgen\w*|militan\w*|infiltrat\w*|security review'),
    ('lwe', 'Left-wing extremism', r'Left[- ]Wing Extremism|LWE|Naxal\w*|Maoist\w*'),
    ('disaster', 'Disaster management and relief', r'disasters?|NDRF|SDRF|NDMA|NIDM|floods?|cyclones?|earthquakes?|droughts?|landslides?|calamit\w+|heat ?waves?|Fire Services?|Civil Defence'),
    ('border', 'Borders and border forces', r'borders?|BSF|ITBP|SSB|Sashastra Seema|Assam Rifles|Vibrant Villages?|Land Ports?|LPAI|fencing|ICPs?'),
    ('police', 'Police, central forces and criminal law', r'police|CAPFs?|CRPF|CISF|NSG|medals?|gallantry|forensic\w*|criminal laws?|BNSS?|BSA|prisons?|NATGRID|ICJS|CCTNS'),
    ('cyber-narcotics', 'Cyber crime and narcotics', r'cyber\w*|I4C|narcotics?|drugs?|NCB|cocaine|heroin|NDPS'),
    ('citizenship', 'Citizenship, visas and foreigners', r'OCI|citizenship|visas?|e-?Visa|foreigners?|immigration|FCRA|Protected Area Permits?|CAA|refugees?'),
    ('jk-ne', 'Jammu & Kashmir, Ladakh and the North East', r'Jammu|Kashmir|Ladakh|Manipur|Nagaland|Mizoram|Tripura|Meghalaya|Arunachal|Sikkim|North[- ]?East\w*|Bodo\w*|Assam'),
    ('centre-state', 'Union Territories and Centre-State relations', r'Zonal Councils?|Inter-State Council|Union Territor\w+|UTs?|Puducherry|Andaman|Lakshadweep|Chandigarh|Dadra|Daman'),
    ('language-census', 'Official language and the census', r'Official Language|Rajbhasha|Hindi|Census|Registrar General'),
]
THEME_RX = [(k, re.compile(r'\b(?:' + rx + r')\b', re.I)) for k, _, rx in THEMES]

AMOUNT = re.compile(r'(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d+)?)\s*(lakh crores?|lakh|crores?|Cr\b\.?)', re.I)
BILL = re.compile(r"((?:The |the )?[A-Z][A-Za-z&'(),. -]{4,280}?\bBill,?\s*(?:No\.?\s*\d+\s*of\s*)?\d{4})")
COUNTS = [
    ('pap', 'Protected Area Permit applications granted', re.compile(r'([\d,]+)\s+Protected Area Permit \(PAP\) applications were granted', re.I)),
    ('uapa-sanction', 'Accused persons for whom prosecution sanction was accorded under UAPA', re.compile(r'sanction for prosecution[^.]{0,80}?against\s+([\d,]+)\s+accused[^.]{0,120}?(?:Unlawful Activities|UAPA)', re.I)),
    ('oci', 'OCI cards issued', re.compile(r'([\d,]{4,})\s+(?:Overseas Citizen(?:s|ship)? (?:of )?India \(OCI\)|OCI) [Cc]ards?\b(?!\s+in lieu)', re.I)),
]

def window(text, a, b, before=140, after=90):
    """A quote around text[a:b], cut to whole words, as a run of the normalised text."""
    s, e = max(0, a - before), min(len(text), b + after)
    while 0 < s < a and text[s - 1] != ' ': s += 1
    while b < e < len(text) and text[e] != ' ': e -= 1
    return text[s:e].strip()

def num(s): return float(s.replace(',', ''))

def main():
    docs = [d for d in json.load(open(IN))['docs'] if d.get('ok')]
    reports, item_rows, bills, uapa, amounts, counts, rejected_amounts = [], [], [], [], [], [], []
    for d in docs:
        month = month_of(d['title'])
        text = '\n'.join(d['pages'])
        its = items(text) if month else []
        reports.append({'src': d['id'], 'month': month, 'items': max((n for n, _ in its), default=0), 'ocr': bool(d.get('ocr')),
                        'chars': len(norm(text)), 'readable': len(its) > 0})
        for n, body in its:
            if not body:
                item_rows.append({'src': d['id'], 'month': month, 'n': n, 'quote': '', 'themes': []}); continue
            themes = [k for k, rx in THEME_RX if rx.search(body)]
            item_rows.append({'src': d['id'], 'month': month, 'n': n, 'quote': body[:160].rsplit(' ', 1)[0] if len(body) > 160 else body, 'themes': themes})
            if re.search(r'\bassent', body, re.I):
                seen = set()
                for m in BILL.finditer(body):
                    name = re.sub(r'^(?:[ivx]+[.)]|\(?[ivx]+\)|\d+[.)])\s*', '', m.group(1).strip(' ,-')).strip()
                    name = re.sub(r'^.*?\b(?:On \d{1,2}\.\d{1,2}\.\d{2,4}\s*-\s*|assented to (?:the )?(?:following bills?[^-:]*[-:]\s*)?)', '', name, flags=re.I).strip()
                    name = re.sub(r'^.*\((?:[ivx]+|\d+)\)\s*', '', name).strip()   # the last list marker, "(ii) "
                    name = re.sub(r"^.*\b(?:assent(?:ed)?(?: to)?|namely,?|viz\.?)\s+", '', name, flags=re.I).strip()   # "...has given his assent to The ..."
                    name = re.sub(r'^T h e ', '', name)                        # a scan's letter-spaced "The"
                    key = name.lower()
                    # A name starts as a title does; "Amendment) Bill, 2022" is a fragment of one.
                    if len(name) < 12 or key in seen or not re.match(r'(?:The |the )?[A-Z]', name) or re.match(r"(?:the )?Hon'?ble|President", name) or not re.search(r'Bill', name): continue
                    seen.add(key)
                    bills.append({'src': d['id'], 'month': month, 'name': name, 'quote': name})
            if re.search(r'Unlawful Activities \(Prevention\)|\bUAPA\b', body):
                kind = 'prosecution sanctioned' if re.search(r'sanction for prosecution', body, re.I) \
                    else 'individuals designated terrorists' if re.search(r'''as (?:an? |the )?(?:designated )?['"]?terrorists?|designated terrorists?|individual terrorists?''', body, re.I) \
                    else 'ban extended' if re.search(r'further period|extend', body, re.I) \
                    else 'declared unlawful' if re.search(r'unlawful association', body, re.I) else 'other'
                uapa.append({'src': d['id'], 'month': month, 'kind': kind, 'quote': body[:260].rsplit(' ', 1)[0] if len(body) > 260 else body,
                             'theme': [k for k, rx in THEME_RX if rx.search(body)]})
            for m in AMOUNT.finditer(body):
                if not re.fullmatch(r'\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d+)?', m.group(1)):
                    rejected_amounts.append({'src': d['id'], 'month': month, 'printed': m.group(0).strip(), 'why': 'digits not grouped as a number is printed'}); continue
                unit = m.group(2).lower()
                unit = 'lakh crore' if unit.startswith('lakh crore') else 'lakh' if unit.startswith('lakh') else 'crore'
                amounts.append({'src': d['id'], 'month': month, 'v': num(m.group(1)), 'printed': m.group(0).strip(), 'unit': unit,
                                'quote': window(body, m.start(), m.end()), 'themes': [k for k, rx in THEME_RX if rx.search(body)]})
            for key, label, rx in COUNTS:
                for m in rx.finditer(body):
                    counts.append({'series': key, 'src': d['id'], 'month': month, 'v': num(m.group(1)), 'quote': window(body, m.start(), m.end(), 60, 60)})
    # Every quote must be a run of its report's text. A paragraph read across a
    # dropped line (Hindi, or scan noise) is cut back to the part that is; a
    # figure whose words are not found whole is not kept.
    full = {d['id']: norm('\n'.join(d['pages'])) for d in docs}
    def prefix(q, t):
        words = q.split(' ')
        while words and ' '.join(words) not in t: words.pop()
        return ' '.join(words) if len(words) >= 4 else ''
    for r in item_rows + uapa:
        if r['quote'] and r['quote'] not in full[r['src']]: r['quote'] = prefix(r['quote'], full[r['src']])
    rejected = rejected_amounts + [dict(r, why='quote not found whole in the report') for r in bills + amounts + counts if r['quote'] not in full[r['src']]]
    bills = [r for r in bills if r['quote'] in full[r['src']]]
    amounts = [r for r in amounts if r['quote'] in full[r['src']]]
    counts = [r for r in counts if r['quote'] in full[r['src']]]
    # One figure per series and month: the report for that month states it once.
    seen = set(); counts = [c for c in counts if not ((c['series'], c['month']) in seen or seen.add((c['series'], c['month'])))]
    out = {
        'source': 'Ministry of Home Affairs, Monthly Major Achievements (https://www.mha.gov.in/en/commoncontent/monthly-major-achievements-mha)',
        'themes': [{'id': k, 'label': l, 'rule': rx} for k, l, rx in THEMES],
        'counts': [{'id': k, 'label': l} for k, l, _ in COUNTS],
        'reports': sorted(reports, key=lambda r: r['month'] or ''),
        'items': item_rows, 'bills': bills, 'uapa': uapa, 'amounts': amounts, 'stated': counts, 'rejected': rejected,
    }
    json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False)
    readable = [r for r in reports if r['readable']]
    print(f'{len(reports)} reports, {len(readable)} with items read, {len(item_rows)} items, {len(bills)} bills, {len(uapa)} UAPA items, {len(amounts)} amounts, {len(counts)} stated counts, {len(rejected)} rejected')
    for r in reports:
        if not r['readable']: print('  unread:', r['month'], r['src'], r['chars'], 'chars', 'ocr' if r['ocr'] else '')

if __name__ == '__main__':
    main()
