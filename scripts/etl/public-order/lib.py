"""
Reading the probe's text: pages, table rows and their trailing values.

Used by gen.py, which writes data/protests/public-order.json. Every quote these
helpers return is a verbatim, whitespace-normalised run of the source's text, so
the test can find it again.
"""
import json,re,html
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','..'))
PROBE=os.path.join(ROOT,'data','protests','public-order-probe.json')
d=json.load(open(PROBE))
DOCS={x['id']:x for x in d['documents'] if x.get('ok')}
def norm(s):
    s=html.unescape(s)
    s=re.sub(r'[‘’′]',"'",s); s=re.sub(r'[“”]','"',s); s=re.sub(r'[–—−]','-',s)
    return re.sub(r'\s+',' ',s.replace(' ',' ')).strip()
def page(doc,pg):
    for p in DOCS[doc]['kept']:
        if p['page']==pg: return p['text']
    raise KeyError((doc,pg))
def row(doc,pg,pat,occ=0):
    """The first line on the page matching pat, normalised: the quote."""
    t=page(doc,pg)
    hits=[l for l in t.split('\n') if re.search(pat,l)]
    if len(hits)<=occ: raise KeyError((doc,pg,pat,len(hits)))
    return norm(hits[occ])
def nums(q):
    return [float(x.replace(',','')) if '.' in x else int(x.replace(',','')) for x in re.findall(r'(?<![\w.])-?\d[\d,]*(?:\.\d+)?(?![\w])',q)]
def findpage(doc,pat):
    return [p['page'] for p in DOCS[doc]['kept'] if re.search(pat,p['text'])]
