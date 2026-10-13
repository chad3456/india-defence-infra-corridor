"""NCRB series for the public-order section, read from the probe's text by explicit row and column rules."""
from lib import *

def toks(q):
    """Trailing value tokens of a table row: numbers and '-' placeholders, in order."""
    out=[]
    for t in reversed(q.split(' ')):
        if re.fullmatch(r'-|\d[\d,]*(\.\d+)?',t): out.append(t)
        else: break
    return list(reversed(out))

def rowq(doc,pg,pat,join_next=False):
    t=page(doc,pg); lines=t.split('\n')
    for i,l in enumerate(lines):
        if re.search(pat,l):
            q=norm(l)
            if join_next or len([x for x in toks(q) if x!='-'])<2:
                q=norm(l+' '+lines[i+1])
            return q
    raise KeyError((doc,pg,pat))

def val(tok):
    if tok=='-': return None
    return float(tok.replace(',','')) if '.' in tok else int(tok.replace(',',''))

# Table 1.2 layouts: which token holds which year's cases and rate
LAYOUT={
 'ncrb:2016:full':{'years':[2014,2015,2016],'cases':[0,2,4],'rate':[1,3,5]},
 'ncrb:2017:v1':{'years':[2015,2016,2017],'cases':[0,2,4],'rate':[1,3,5]},
 'ncrb:2018:v1':{'years':[2016,2017,2018],'cases':[0,2,4],'rate':[1,3,5]},
 'ncrb:2022:v1':{'years':[2020,2021,2022],'cases':[0,2,4],'rate':[1,3,5]},
 'ncrb:2023:v1':{'years':[2021,2022,2023],'cases':[0,2,4],'rate':[1,3,5]},
 'ncrb:2024:v1':{'years':[2022,2023,2024],'cases':[0,2,6],'rate':[1,3,7]},
}
PAGES={'ncrb:2016:full':[51],'ncrb:2017:v1':[29,30],'ncrb:2018:v1':[33,34],'ncrb:2022:v1':[35,36],'ncrb:2023:v1':[35,36],'ncrb:2024:v1':[34,35]}

def table12(pat, docs=None, rate=False, join_next=False):
    """{year: (value, doc, quote)} from every volume, latest volume winning; disagreements reported."""
    got={}; seen={}
    for doc in (docs or LAYOUT):
        lay=LAYOUT[doc]; q=None
        for pg in PAGES[doc]:
            try: q=rowq(doc,pg,pat,join_next); break
            except KeyError: pass
        if q is None: continue
        tk=toks(q)
        # Every row ends with a share column; tokens are aligned from the right,
        # so a row with missing early years (new heads) still maps correctly.
        need=9 if doc=='ncrb:2024:v1' else 7
        for y,ci,ri in zip(lay['years'],lay['cases'],lay['rate']):
            idx = ri if rate else ci
            # align from the right: share column is last
            off=len(tk)-need
            if idx+off<0: continue
            v=val(tk[idx+off])
            if v is None: continue
            seen.setdefault(y,[]).append((v,doc))
            got[y]=(v,doc,q)
    for y,l in seen.items():
        if len(set(v for v,_ in l))>1: print('  DISAGREE',pat,y,l)
    return got
