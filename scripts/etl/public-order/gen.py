"""
Builds data/protests/public-order.json from the probe's text.

    python3 scripts/etl/public-order/gen.py

Every figure is read by an explicit rule: a table row matched by its label and
a value taken by its column position, with the row's own printed total checked
where the table prints one, or a sentence quoted from an article. Review the
diff by hand before committing; `npm run test:public-order` then checks every
quote against the source text and every part-whole sum.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from ncrb import *

OUT=os.path.join(ROOT,'data','protests','public-order.json')
SRC={}      # id -> metadata
SERIES=[]; BREAK=[]; EPIS=[]

def publisher(doc):
    if doc.startswith('ncrb'): return 'National Crime Records Bureau'
    if doc.startswith('mha:'): return 'Ministry of Home Affairs'
    if doc.startswith('ls:'): return 'Lok Sabha'
    if doc.startswith('rs:'): return 'Rajya Sabha'
    if doc.startswith('prs:'): return 'PRS Legislative Research'
    if doc.startswith('rights:hrw'): return 'Human Rights Watch'
    return None

def src(doc, publisher_=None, kind=None, tier=None, title=None):
    x=[d for d in json.load(open(PROBE))['documents'] if d['id']==doc][0]
    if doc not in SRC:
        k = kind or ('official' if doc.startswith(('ncrb','mha')) else 'parliament' if doc.startswith(('ls:','rs:')) else 'analysis' if doc.startswith('prs') else 'rights' if doc.startswith('rights') else 'press')
        t = tier or (1 if k in ('official','parliament') else 3)
        SRC[doc]={'publisher': publisher_ or publisher(doc) or x['what'].split('(')[-1].rstrip(')'), 'title': title or x['what'], 'url': x['url'], 'kind': k, 'tier': t}
    return doc

def pt(x, v, doc, quote, loc=None, who=None):
    assert quote, (x, v, doc)
    p={'x':x,'v':v,'src':src(doc),'quote':quote}
    if loc: p['loc']=loc
    if who: p['who']=who
    return p

def series(id_, title, unit, definition, caveat, points):
    points=sorted(points, key=lambda p:p['x'])
    SERIES.append({'id':id_,'title':title,'unit':unit,'definition':definition,'caveat':caveat,'points':points})

def from12(pat, rate=False, join_next=False, loc='Table 1.2'):
    g=table12(pat, rate=rate, join_next=join_next)
    return [pt(y, v, doc, q, loc=f'{loc}, Crime in India {doc.split(":")[1]}') for y,(v,doc,q) in sorted(g.items())]

# ── I. Rioting, all India ──────────────────────────────────────────────
long_run=[]
for y in range(2004, 2014):
    q=rowq('ncrb:2014:1953-2014', 5, rf'^\s*\d+\s+{y}\s+\*\s+\d')
    tk=toks(q)  # Sl, year, unlawful(*), riots, ...
    # row: "<sl> <year> * <riots> <cbt> ..." -> riots is the token after '*'
    parts=q.split(' ')
    v=int(parts[parts.index('*')+1])
    long_run.append(pt(y, v, 'ncrb:2014:1953-2014', q, loc='Incidence of cognizable crimes (IPC) 1953–2014, column 16 (Riots)'))
recent=from12(r'^\s*\d+\s+(Rioting|Riots)\s+\d')
# 2014 is in both the long-run table and the 2016 volume; they must agree
lr2014=rowq('ncrb:2014:1953-2014', 5, r'^\s*\d+\s+2014\s+\d')
assert ' 66042 ' in f' {lr2014} ' and [p for p in recent if p['x']==2014][0]['v']==66042
series('riots-total','Rioting cases registered','cases','Cases registered under the rioting sections of the IPC (147–151) and, from 1 July 2024, the BNS, all India.',
 'Registered cases, not riots: registration practice varies by state and year.', long_run+recent)
series('riots-rate','Rioting cases per lakh population','per lakh','NCRB crime rate for rioting: cases per 1,00,000 population.','Uses NCRB population estimates, which are revised between volumes.', from12(r'^\s*\d+\s+(Rioting|Riots)\s+\d', rate=True))
series('unlawful-assembly','Unlawful assembly cases','cases','Cases under sections 143–145 IPC (BNS 189), all India.','2014 is from the 2016 volume.', from12(r'Unlawful Assembly\s+\d'))

MOT=[('riots-communal','Communal/religious',r'Communal/Religious',False),('riots-sectarian','Sectarian',r'Sectarian\s+\d',False),
 ('riots-industrial','Industrial',r'Industrial\s+\d',False),('riots-political','Political',r'\bPolitical\b\s+\d',False),
 ('riots-caste','Caste conflict',r'Caste Conflict',False),('riots-agrarian','Agrarian',r'\bAgrarian\b',False),
 ('riots-students','Students',r'\bStudents\b',False),('riots-vigilante','Vigilantes',r'Vigilants',False),
 ('riots-money','Money dispute',r'Money Dispute',False),('riots-water','Water dispute',r'Water Dispute',False),
 ('riots-land','Land/property dispute',r'Land/Property',False),('riots-family','Family dispute',r'Family Disputes',False),
 ('riots-enmity','Enmity/rivalry',r'Enmity/Rivalry',False),('riots-electricity','Electricity/power supply dispute',r'Electricity/Power',False),
 ('riots-aandolan','During an agitation (andolan/morcha)',r'Aandolan',False),('riots-attacks-police','Attacks on police or government servants',r'Rioting/Attacks on Police',True),
 ('riots-other','Other or not stated',r'Other Riot',False),('riots-sudden','Sudden quarrel or provocation',r'Sudden Quarrel',False),
 ('riots-ethnic','Ethnic or community groups clash',r'Ethnic or Community',True)]
for id_,label,pat,jn in MOT:
    pts=from12(pat, join_next=jn)
    series(id_, f'Rioting cases: {label}', 'cases', f'Rioting cases the police recorded under the motive head "{label}".',
      'Motive as recorded by the police. The list of heads grew from eight to seventeen in 2017; heads are not comparable across that change.', pts)

# ── III. Damage to public property ─────────────────────────────────────
PD={'ncrb:2016:full':(52,[2014,2015,2016]),'ncrb:2017:v1':(32,[2015,2016,2017]),'ncrb:2018:v1':(36,[2016,2017,2018]),
    'ncrb:2022:v1':(38,[2020,2021,2022]),'ncrb:2023:v1':(38,[2021,2022,2023]),'ncrb:2024:v1':(37,[2022,2023,2024])}
got={}
for doc,(pg,yrs) in PD.items():
    q=rowq(doc,pg,r'Damage to Public Property')
    # Values follow the Act's name; "1984" in the name is not a value.
    after=re.sub(r'^,?\s*1984\s*','',q.split('Property Act',1)[1].strip())
    tk=after.split(' ')
    vals=[val(tk[i]) for i in (0,2,4)]
    for y,v in zip(yrs,vals):
        if y in got and got[y][0]!=v: print('PDPP DISAGREE',y,got[y][0],v)
        got[y]=(v,doc,q)
series('pdpp','Cases under the Prevention of Damage to Public Property Act, 1984','cases','Cases registered under the 1984 Act, all India (Table 1.3, special and local laws).',
 'Prosecutions begun, not damage done; the Act is invoked in protests and also in ordinary vandalism.',
 [pt(y,v,doc,q,loc=f'Table 1.3, Crime in India {doc.split(":")[1]}') for y,(v,doc,q) in sorted(got.items())])

# ── State-wise rioting, 2024 (Table 1A.4, rioting total columns) ───────
t=page('ncrb:2024:v1',86)
st_rows=[]
for l in t.split('\n'):
    m=re.match(r'^\s*\d+\s+([A-Za-z&.\- ]+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s',l)
    if m:
        name=m.group(1).strip() or 'D&N Haveli and Daman & Diu'  # the one name NCRB wraps above and below its row
        ipc,bns,tot,vic=map(int,m.group(2,3,4,5)); rate=float(m.group(6))
        assert ipc+bns==tot, (name, ipc, bns, tot)
        st_rows.append((name,tot,vic,rate,norm(l)))
tot_line=rowq('ncrb:2024:v1',86,r'TOTAL STATE\(S\)')
loc='Table 1A.4 (rioting, total of heads a–r), Crime in India 2024'
mk=lambda rows: [dict(label=n, **pt(0, v, 'ncrb:2024:v1', q, loc=loc)) for n,v,q in rows]
def strip_x(rows):
    for r in rows: r.pop('x',None)
    return rows
BREAK.append({'id':'riots-states-2024','title':'Rioting cases by state or UT, 2024','period':'2024','unit':'cases',
  'definition':'Rioting cases registered in 2024 under the IPC (to 30 June) and the BNS (from 1 July), by state.',
  'caveat':'States and union territories; together they add to the all-India total of 30,348.',
  'rows':strip_x(mk([(n,tot,q) for n,tot,vic,rate,q in st_rows]))})
BREAK.append({'id':'riots-rate-states-2024','title':'Rioting rate by state, 2024','period':'2024','unit':'per lakh',
  'definition':'Rioting cases per lakh population, 2024, as NCRB computes it.','caveat':'A few cases move a small state a long way.',
  'rows':strip_x(mk([(n,rate,q) for n,tot,vic,rate,q in st_rows if tot>0]))})
BREAK.append({'id':'riot-victims-states-2024','title':'Victims of rioting by state, 2024','period':'2024','unit':'victims',
  'definition':'Victims recorded in rioting cases, 2024, by state.','caveat':'Victims named in cases; includes people hurt but not killed.',
  'rows':strip_x(mk([(n,vic,q) for n,tot,vic,rate,q in st_rows]))})
assert sum(r[1] for r in st_rows)==30348, 'states and UTs do not add to the all-India 2024 total'

# ── IV. Police and civilians (Volume 3, Chapter 16B) ───────────────────
# Column order is read off each year's own header and checked by the row sum.
POL_COLS={
  2017:['ne','terror','lwe','border','raids','mobs','criminals','own-weapon','accidents','total'],
  2018:['ne','terror','lwe','border','raids','mobs','criminals','own-weapon','accidents','total'],
  2022:['ne','terror','lwe','border','mobs','criminals','own-weapon','accidents','total'],
}
POL_SRC={2017:('ncrb:2017:v3',114,115),2018:('ncrb:2018:v3',114,115),2022:('ncrb:2022:v3',128,129)}
CIV_COLS=['insurgents-firing','insurgents-bomb','dacoits','riots-firing','riots-lathi','riots-mobs','accidental-ops','border','other','total']
CIV_SRC={2017:('ncrb:2017:v3',116,117),2018:('ncrb:2018:v3',116,117),2022:('ncrb:2022:v3',130,131)}
pol={k:[] for k in ['police-killed','police-injured','police-killed-mobs','police-injured-mobs']}
civ={k:[] for k in ['civ-killed-riots-firing','civ-killed-riots-lathi','civ-killed-riots-mobs','civ-injured-riots-firing','civ-injured-riots-lathi','civ-injured-riots-mobs','civ-killed-police-ops']}
police_cause_2022=None
def allindia(doc,pg):
    return rowq(doc,pg,r'TOTAL \(?ALL INDIA\)?')
for y,(doc,pk,pi) in POL_SRC.items():
    try:
        for kind,pg in (('killed',pk),('injured',pi)):
            q=allindia(doc,pg); vals=[int(x) for x in toks(q)]; cols=POL_COLS[y]
            assert len(vals)==len(cols), (y,kind,q)
            d=dict(zip(cols,vals)); assert sum(v for k,v in d.items() if k!='total')==d['total'], (y,kind,d)
            tbl='16B.2' if kind=='killed' else '16B.3'
            loc=f'Table {tbl}, Crime in India {y}, Volume 3'
            pol[f'police-{kind}'].append(pt(y,d['total'],doc,q,loc=loc))
            pol[f'police-{kind}-mobs'].append(pt(y,d['mobs'],doc,q,loc=loc+' (column: by riotous mobs)'))
            if y==2022 and kind=='killed': police_cause_2022=(d,q,doc,loc)
    except KeyError as e: print('POLICE MISSING',y,e)
for y,(doc,pk,pi) in CIV_SRC.items():
    try:
        for kind,pg in (('killed',pk),('injured',pi)):
            q=allindia(doc,pg); vals=[int(x) for x in toks(q)]
            assert len(vals)==len(CIV_COLS), (y,kind,q)
            d=dict(zip(CIV_COLS,vals)); assert sum(v for k,v in d.items() if k!='total')==d['total'], (y,kind,d)
            loc=f'Table 16B.{4 if kind=="killed" else 5}, Crime in India {y}, Volume 3'
            for c in ('riots-firing','riots-lathi','riots-mobs'):
                civ[f'civ-{kind}-{c}'].append(pt(y,d[c],doc,q,loc=loc+f' (during riots: {c[6:]})'))
            if kind=='killed': civ['civ-killed-police-ops'].append(pt(y,d['total'],doc,q,loc=loc))
    except KeyError as e: print('CIV MISSING',y,e)
DEF={'police-killed':('Police personnel killed on duty','State police personnel killed on duty, all causes (Table 16B.2).'),
     'police-injured':('Police personnel injured on duty','State police personnel injured on duty, all causes (Table 16B.3).'),
     'police-killed-mobs':('Police killed by riotous mobs','Police personnel killed on duty by riotous mobs.'),
     'police-injured-mobs':('Police injured by riotous mobs','Police personnel injured on duty by riotous mobs.'),
     'civ-killed-riots-firing':('Civilians killed in police firing during riots',''),'civ-killed-riots-lathi':('Civilians killed in lathi-charges during riots',''),
     'civ-killed-riots-mobs':('Civilians killed by riotous mobs',''),'civ-injured-riots-firing':('Civilians injured in police firing during riots',''),
     'civ-injured-riots-lathi':('Civilians injured in lathi-charges during riots',''),'civ-injured-riots-mobs':('Civilians injured by riotous mobs',''),
     'civ-killed-police-ops':('Civilians killed during police operations, all causes','')}
for k,pts in list(pol.items())+list(civ.items()):
    t,dfn=DEF[k]
    series(k,t,'people',dfn or t+', as recorded by NCRB (Table 16B.4/16B.5).','From 2022 NCRB counts "all uniform police personnel"; earlier tables say "state police personnel".',pts)
if police_cause_2022:
    d,q,doc,loc=police_cause_2022
    LBL={'ne':'North-east insurgents','terror':'Terrorists/extremists','lwe':'Left-wing extremists','border':'Border firing','mobs':'Riotous mobs','criminals':'Criminals, gangsters, dacoits','own-weapon':'Accidentally, own weapon','accidents':'Accidents'}
    BREAK.append({'id':'police-killed-cause-2022','title':'Police killed on duty by cause, 2022','period':'2022','unit':'people',
      'definition':'All uniform police personnel killed on duty in 2022, by cause (Table 16B.2).','caveat':'Causes as NCRB classifies them.',
      'rows':[{'label':LBL[k],'v':v,'src':src(doc),'quote':q,'loc':loc} for k,v in d.items() if k!='total']})

# ── Quotes from running text ───────────────────────────────────────────
def snip(doc, pat, occ=0):
    """The sentence (within one page) that contains the match, normalised: a verbatim quote."""
    for p in DOCS[doc]['kept']:
        t=norm(p['text'])
        ms=list(re.finditer(pat,t))
        if len(ms)>occ:
            m=ms[occ]
            i=t.rfind('. ',0,m.start())
            a=max(0 if i<0 else i+2, m.start()-260, 0)
            b=t.find('. ',m.end()); b=len(t) if b<0 else b+1
            b=min(b, m.end()+260)
            return t[a:b].strip()
    raise KeyError((doc,pat))

# ── V. Communal incidents, Home Ministry ───────────────────────────────
RTI='press:wire-amp-communal-rti'
SRC_META={RTI:('The Wire (PTI), reporting the Home Ministry\'s RTI reply','Over 1,600 killed in communal clashes between 2004 and 2017, says RTI reply','press',2)}
mha={'mha-communal-incidents':[],'mha-communal-killed':[],'mha-communal-injured':[]}
rti_years={2004:r'in 2004, there were 677 cases',2005:r'In 2005, 779 cases',2006:r'in 2006, there were 698 cases',2007:r'In 2007, 761 cases',
  2008:r'In 2008, the most number of incidents',2009:r'The year 2009 witnessed',2013:r'As many as 823 such cases',2014:r'in 2014, 644 cases',
  2015:r'In 2015, 751 cases',2016:r'While in 2016, 703 cases',2017:r'in 2017, 822 cases'}
RTI_VALS={2004:(677,134,2132),2005:(779,124,2062),2006:(698,133,2170),2007:(761,99,2227),2008:(943,167,2350),2009:(849,125,2461),2013:(823,133,2269),2014:(644,95,1921),2015:(751,97,2264),2016:(703,86,2321),2017:(822,111,2384)}
for y,pat in rti_years.items():
    q=snip(RTI,pat)
    if y==2008: q=snip(RTI,r'In 2008, the most number of incidents took place and 943 cases were reported\. The year also saw the highest number of people losing their lives to violence \(167\)\. About 2,350 people were injured in 2008')
    inc,k,inj=RTI_VALS[y]
    for key,v in (('incidents',inc),('killed',k),('injured',inj)):
        mha[f'mha-communal-{key}'].append(pt(y,v,RTI,q,who='Ministry of Home Affairs (RTI reply, January 2019)'))
# 2010-2012 from the ministry's own annexure, laid in the Lok Sabha
q=rowq('mha:ls-6502-2013',3,r'^\s*Total\s+\d')
tk=[int(x) for x in toks(q)]
assert tk[:9]==[701,116,2138,580,91,1899,668,94,2117], tk
for i,y in enumerate((2010,2011,2012)):
    for j,key in enumerate(('incidents','killed','injured')):
        mha[f'mha-communal-{key}'].append(pt(y,tk[i*3+j],'mha:ls-6502-2013',q,loc='Annexure to Lok Sabha unstarred question 6502, 7 May 2013, Total row'))
MDEF={'incidents':'Communal incidents','killed':'People killed in communal incidents','injured':'People injured in communal incidents'}
for key in ('incidents','killed','injured'):
    series(f'mha-communal-{key}', MDEF[key]+', Home Ministry count','incidents' if key=='incidents' else 'people',
      f'{MDEF[key]} reported by states to the Ministry of Home Affairs.',
      '2010–2012 from the ministry\'s own annexure laid in the Lok Sabha; other years from its RTI reply as reported by PTI. The RTI reply and the 2010–2012 annexure agree where both exist. 2008 injuries are given as "about 2,350".', mha[f'mha-communal-{key}'])

# ── J&K stone pelting ──────────────────────────────────────────────────
KD='press:kd-stone-2019'
SRC_META[KD]=('Kashmir Despatch, reporting the Home Ministry\'s RTI reply','2019 recorded most number of stone pelting incidents in J&K','press',2)
q1=snip(KD,r'In the years 2017 and 2018, the number of stone pelting incidents stood at 1,412 and 1,458')
q2=snip(KD,r'as many as 1,996 such incidents had been reported')
series('jk-stone-pelting','Stone-pelting incidents in Jammu & Kashmir','incidents','Incidents of stone pelting in J&K, as the Home Ministry gave them in reply to an RTI application.',
  '2019 covers 1 January to 30 November.', [pt(2017,1412,KD,q1,who='Ministry of Home Affairs (RTI reply)'),pt(2018,1458,KD,q1,who='Ministry of Home Affairs (RTI reply)'),pt(2019,1996,KD,q2,who='Ministry of Home Affairs (RTI reply), to 30 November')])

# ── Police Commemoration Day ───────────────────────────────────────────
com=[]
com.append(pt(2020,264,'press:organiser-commemoration-2020',snip('press:organiser-commemoration-2020',r'in the last one year, 264 personnel'),who='Home Minister Amit Shah, 21 October 2020'))
com.append(pt(2021,377,'press:orissapost-commemoration-2021',snip('press:orissapost-commemoration-2021',r'a total of 377 policemen'),who='Intelligence Bureau Director Arvind Kumar, 21 October 2021'))
com.append(pt(2024,216,'press:tribune-commemoration-216',snip('press:tribune-commemoration-216',r'with 216 of them in the last year'),who='Home Minister Amit Shah, 21 October 2024'))
for doc in ('press:indianawaaz-commemoration-2023','press:gk-commemoration-2023','press:arunachal-commemoration-188-p'):
    try:
        com.append(pt(2023,188,doc,snip(doc,r'\b188\b'),who='Home Minister Amit Shah, 21 October 2023')); break
    except KeyError: pass
series('commemoration','Police killed in the line of duty, as announced on Police Commemoration Day','people',
  'The figure announced each 21 October for the preceding year (to 31 August), state police and central armed police forces together.',
  'Announced, not tabulated; the 2021 figure was given by the Intelligence Bureau Director without its period. Not comparable with NCRB\'s state police count.', com)

# ── Police firing on rioters, 2016 (the Bureau's older table) ──────────
q=rowq('ncrb:2016:full',585,r'^\s*1\s+Riots\s+\d')  # first "Riots" row is under POLICE FIRING
tk=[int(x) for x in toks(q)]
assert tk==[74,62,57,308,0,633], tk
FIRING_LOC='Table 16B.1 (police firing, event: riots), Crime in India 2016'
firing_occ=[pt(2016,74,'ncrb:2016:full',q,loc=FIRING_LOC)]
firing_civ=[pt(2016,57,'ncrb:2016:full',q,loc=FIRING_LOC)]
for s in SERIES:
    if s['id']=='mha-communal-injured':
        s['caveat']+=' The years add to the reply\'s 14-year totals for incidents (10,399) and deaths (1,605); injuries add to 30,715 against its 30,723 because 2008 is given only as "about 2,350".'

# ── VI. Episodes ───────────────────────────────────────────────────────
def cite(doc, v, pat, who=None, occ=0, **kw):
    try:
        quote=snip(doc,pat,occ)   # first: a source enters the register only with a quote
        c={'v':v,'src':src(doc),'quote':quote}
        if who: c['who']=who
        c.update(kw); return c
    except KeyError as e:
        print('  EPISODE QUOTE MISSING', doc, pat); return None
def ep(**e):
    e={k:v for k,v in e.items() if v is not None}
    EPIS.append(e)

ep(id='gujjar-2008', name='Gujjar quota agitation', state='Rajasthan', start='2008-05-23', kind='agitation',
   summary='Police fired on protesters blocking roads and railway lines for Scheduled Tribe status, at Bayana and Sikandra; the agitation spread across eastern Rajasthan.',
   deaths=cite('press:aj-gujjar',37,r'left 37 people dead',who='news agencies, 25 May 2008'),
   loss=(lambda c: dict(c, what='railway property damaged, per the Ministry of Railways in the Lok Sabha') if c else None)(cite('ls:68296',788,r'788',who='Ministry of Railways, Lok Sabha') if 'ls:68296' in DOCS else None))
ep(id='kandhamal-2008', name='Kandhamal violence', state='Odisha', start='2008-08-24', kind='communal',
   summary='Attacks on Christians after the killing of a Hindu leader; houses and churches burned across the district.',
   deaths=cite('press:csw-kandhamal',38,r'Government figures put the death toll at 38',who='Government of Odisha'),
   disputes=['Local monitoring groups put deaths at 90 or more and estimate 5,600 houses and 300 churches and places of worship destroyed (CSW).'])
ep(id='assam-2012', name='Bodo–Muslim clashes in lower Assam', state='Assam', start='2012-07-20', kind='ethnic',
   summary='Clashes between Bodos and Muslim settlers in Kokrajhar, Chirang and Dhubri; one of India\'s largest displacements of the period.',
   deaths=cite('press:outlook-assam-2012',57,r'has left 57 confirmed dead',who='as of 30 July 2012'),
   displaced=cite('press:outlook-assam-2012',400000,r'more than 400,000 displaced',who='as of 30 July 2012'),
   disputes=['An early count: Outlook, 30 July 2012, ten days into the violence. Of the 57, six died in police firing.'])
ep(id='muzaffarnagar-2013', name='Muzaffarnagar and Shamli riots', state='Uttar Pradesh', start='2013-08-27', kind='communal',
   summary='Communal violence in western Uttar Pradesh in August–September 2013; tens of thousands fled to relief camps.',
   deaths=cite('press:maktoob-muzaffarnagar',64,r'took 64 lives',who='official count, as reviewed by Maktoob'),
   displaced=cite('press:maktoob-muzaffarnagar',60000,r'About 60,000 people',who='Maktoob'))
ep(id='patidar-2015', name='Patidar quota agitation', state='Gujarat', start='2015-08-25', kind='agitation',
   summary='Violence after a rally in Ahmedabad demanding OBC status for Patidars; curfew in several cities and the army deployed.',
   deaths=cite('press:govnow-patidar',8,r'death toll in Patel quota stir rises to 8',who='as of 27 August 2015'),
   disputes=['The Quint counts 14 people who died during the agitation between 2015 and 2017.'] if 'press:quint-patidar-14' in DOCS and re.search(r'\b14\b', norm(DOCS['press:quint-patidar-14']['kept'][0]['text'])) else None)
ep(id='jat-2016', name='Jat quota agitation', state='Haryana', start='2016-02-07', kind='agitation',
   summary='Roads and railways blockaded, police stations attacked and shops, schools and vehicles burned across Rohtak and neighbouring districts. The Prakash Singh committee found "twenty rioters and ten others were killed".',
   injured=cite('press:wire-amp-prakash-singh',208,r'208 persons \(including 70 security personnel\) were injured',who='Prakash Singh committee report'),
   policeInjured=cite('press:wire-amp-prakash-singh',70,r'208 persons \(including 70 security personnel\) were injured',who='Prakash Singh committee report (security personnel)'),
   firs=cite('press:wire-amp-prakash-singh',1500,r'More than 1,500 criminal cases were registered',who='Prakash Singh committee report'),
   disputes=['The committee recorded about 2,000 shops set ablaze, 371 vehicles damaged or burned, and arson in 30 schools and colleges.'])
ep(id='dera-2017', name='Violence after the Dera Sacha Sauda verdict', state='Haryana', start='2017-08-25', kind='religious-sect',
   summary='Followers of Gurmeet Ram Rahim Singh rioted in Panchkula and elsewhere after his conviction for rape; the High Court ordered Dera property attached to pay for the damage.',
   deaths=cite('press:wire-amp-dera-report',38,r'which left 38 dead',who='Haryana government report to the Centre'),
   injured=cite('press:scroll-dera',250,r'More than 250 have been injured',who='first-day reports'),
   disputes=['First-day reports gave 30 dead (Scroll, 25 August 2017).'])
ep(id='bandh-2018', name='Bharat Bandh against the SC/ST Act ruling', state='Several states', start='2018-04-02', kind='caste',
   summary='Dalit organisations\' nationwide shutdown against a Supreme Court ruling on arrests under the SC/ST (Prevention of Atrocities) Act; deaths in Madhya Pradesh, Uttar Pradesh and Rajasthan.',
   deaths=cite('press:scroll-bandh-2018',9,r'Nine killed',who='as reported on 2 April 2018'))
ep(id='caa-up-2019', name='Anti-CAA protests in Uttar Pradesh', state='Uttar Pradesh', start='2019-12-19', kind='agitation',
   summary='Protests against the Citizenship (Amendment) Act turned violent across the state on 20–21 December; the state issued recovery notices for damage, later withdrawn before the Supreme Court.',
   deaths=cite('press:scroll-caa-hc-953529',22,r'22 people killed',who='Uttar Pradesh government, to the Allahabad High Court'),
   disputes=['The Wire listed 25 people killed in anti-CAA protests nationwide by 23 December 2019.','Uttar Pradesh withdrew 274 recovery notices and was directed by the Supreme Court to refund recoveries (Scroll, February 2022).'])
ep(id='delhi-2020', name='North-east Delhi riots', state='Delhi', start='2020-02-23', kind='communal',
   summary='Communal violence between 23 and 26 February 2020 between supporters and opponents of the Citizenship (Amendment) Act.',
   deaths=cite('press:scroll-delhi-541',53,r'The violence claimed 53 lives',who='Delhi Police affidavit, as reported'),
   disputes=['The Delhi Police list of the dead names 52 civilians and one policeman, head constable Ratan Lal (The Wire).','Of 541 FIRs for damage to property, 23 concerned public property and 518 private property (Delhi Police affidavit).'])
ep(id='bengaluru-2020', name='DJ Halli and KG Halli violence', state='Karnataka', start='2020-08-11', kind='communal',
   summary='A mob attacked two police stations in Bengaluru over a social media post; police opened fire.',
   deaths=cite('press:hitavada-bengaluru-2020',3,r'3 killed in police firing',who='police'),
   loss=(lambda c: dict(c, what='compensation claimed before the High Court\'s claims commissioner, not an assessed loss') if c else None)(cite('press:dh-djhalli-claims',4.49,r'4\.49 crore',who='claims before the claims commissioner') if 'press:dh-djhalli-claims' in DOCS else None))
ep(id='redfort-2021', name='Republic Day tractor rally', state='Delhi', start='2021-01-26', kind='agitation',
   summary='Farmers protesting the farm laws broke from agreed routes; clashes at ITO and the Red Fort.',
   policeInjured=cite('press:tribune-redfort-394',394,r'394 personnel',who='Delhi Police') if 'press:tribune-redfort-394' in DOCS else None)
ep(id='lakhimpur-2021', name='Lakhimpur Kheri killings', state='Uttar Pradesh', start='2021-10-03', kind='agitation',
   summary='Vehicles in a convoy linked to a Union minister ran into protesting farmers at Tikunia; four farmers, a journalist, two BJP workers and a driver died.',
   deaths=cite('press:caravan-lakhimpur',8,r'Eight killed',who='as reported') if 'press:caravan-lakhimpur' in DOCS else None)
ep(id='agnipath-2022', name='Protests against the Agnipath scheme', state='Several states', start='2022-06-15', kind='agitation',
   summary='Protests against the new military recruitment scheme; trains set on fire in Bihar, Telangana and elsewhere. 2,132 trains were cancelled between 15 and 23 June.',
   loss=(lambda c: dict(c, what='railway assets damaged, per the Railways Minister in the Rajya Sabha') if c else None)(cite('press:scroll-agnipath',259.44,r'The Railways suffered losses worth Rs 259\.44 crore',who='Railways Minister Ashwini Vaishnaw, Rajya Sabha')))
ep(id='manipur-2023', name='Ethnic violence in Manipur', state='Manipur', start='2023-05-03', kind='ethnic',
   summary='Violence between Meitei and Kuki-Zo communities from May 2023; President\'s Rule from February 2025.',
   deaths=cite('press:siasat-manipur-260',260,r'260 people have died',who='Home Minister Amit Shah, Lok Sabha, April 2025'),
   disputes=['The Home Minister gave 152 deaths in August 2023 (Anadolu).'])
ep(id='nuh-2023', name='Nuh violence', state='Haryana', start='2023-07-31', kind='communal',
   summary='Clashes during a religious procession in Nuh spread to Gurugram and other districts.',
   deaths=cite('press:dtnext-nuh',6,r'6 dead, 116 people arrested',who='Chief Minister Manohar Lal Khattar'),
   arrests=cite('press:tribune-nuh-393',393,r'393 held, 160 FIRs',who='Haryana Police, state-wide, mid-August 2023'),
   firs=cite('press:tribune-nuh-393',160,r'393 held, 160 FIRs',who='Haryana Police, state-wide, mid-August 2023'))
ep(id='haldwani-2024', name='Banbhoolpura, Haldwani', state='Uttarakhand', start='2024-02-08', kind='communal',
   summary='Violence after the demolition of a mosque and madrasa; a police station was attacked and police opened fire.',
   deaths=cite('press:aj-haldwani',6,r'has killed six people',who='as reported'),
   policeInjured=cite('press:aj-haldwani',100,r'more than 100 police personnel were injured',who='as reported'))
ep(id='sambhal-2024', name='Sambhal mosque survey violence', state='Uttar Pradesh', start='2024-11-24', kind='communal',
   summary='Clashes during a court-ordered survey of the Shahi Jama Masjid.',
   deaths=cite('press:bt-sambhal',4,r'At least four people lost their lives',who='as reported'),
   policeInjured=cite('press:fpj-sambhal-panel',28,r'28 police personnel were injured',who='state judicial commission'),
   disputes=['The Wire reported five deaths against an official four.'])
ep(id='murshidabad-2025', name='Waqf Act protests in Murshidabad', state='West Bengal', start='2025-04-11', kind='communal',
   summary='Protests against the Waqf (Amendment) Act turned violent in Dhuliyan, Samserganj and Suti; central forces deployed on the High Court\'s order.',
   deaths=cite('press:bs-murshidabad',3,r'resulting in three deaths',who='police, via ANI'),
   arrests=cite('press:bs-murshidabad',150,r'the arrest of at least 150 people',who='police, via ANI'))
ep(id='leh-2025', name='Ladakh statehood protest', state='Ladakh', start='2025-09-24', kind='agitation',
   summary='A protest for statehood and Sixth Schedule protection turned violent in Leh; the BJP office was set on fire and police opened fire.',
   deaths=cite('press:gk-ladakh',4,r'At least four persons were killed and 59 others injured',who='as reported, 24 September 2025'),
   injured=cite('press:gk-ladakh',59,r'At least four persons were killed and 59 others injured',who='as reported, 24 September 2025'))
for e in EPIS:
    for k in list(e):
        if e[k] is None: del e[k]
EPIS[:]=[e for e in EPIS]
for e in EPIS:
    if e['id']=='agnipath-2022': e['summary']='Protests against the new military recruitment scheme; trains and stations attacked and set on fire. 2,132 trains were cancelled between 15 and 23 June.'
if firing_occ:
    series('firing-riots-occasions','Occasions police opened fire to control riots','occasions','Occasions on which police resorted to firing during riots (NCRB Table 16B.1, published to 2016).','Discontinued in this form after 2016.', firing_occ)
    series('firing-riots-civ-killed','Civilians killed when police fired on rioters','people','Civilians killed when police resorted to firing during riots.','Discontinued in this form after 2016.', firing_civ)

PUB={'press:scroll':'Scroll','press:wire':'The Wire','press:aa-':'Anadolu Agency','press:siasat':'Siasat (PTI)','press:dtnext':'DT Next','press:livelaw':'LiveLaw',
 'press:gk-':'Greater Kashmir','press:excelsior':'Daily Excelsior','press:dh-':'Deccan Herald','press:maktoob':'Maktoob Media','press:quint':'The Quint',
 'press:kd-':'Kashmir Despatch','press:tribune':'The Tribune','press:factly':'Factly','press:factchecker':'FactChecker','press:sabrang':'Sabrang India',
 'press:tnm':'The News Minute','press:bt-':'Business Today','press:sabrang':'Sabrang India','press:csw':'Christian Solidarity Worldwide','press:arabnews':'Arab News',
 'press:aj-':'Al Jazeera','press:outlook':'Outlook','press:fpj':'Free Press Journal','press:govnow':'Governance Now','press:bs-':'Business Standard',
 'press:hitavada':'The Hitavada (PTI)','press:organiser':'Organiser','press:orissapost':'Orissa Post','press:arunachal':'Arunachal Times','press:indianawaaz':'Indian Awaaz',
 'press:caravan':'The Caravan','press:indiaspend':'IndiaSpend','press:oneindia':'OneIndia (PTI)','press:indiatv':'India TV','press:statesman':'The Statesman',
 'press:hrw':'Human Rights Watch','rights:hrw':'Human Rights Watch'}
for doc,m in SRC.items():
    for k,v in PUB.items():
        if doc.startswith(k): m['publisher']=v; break
    if doc in SRC_META: m['publisher'],m['title'],m['kind'],m['tier']=SRC_META[doc]
    if doc.startswith('ncrb'): m['title']=m['title'].replace(' (OpenCity mirror)',' (OpenCity mirror of the NCRB PDF)')
# Press reports of a minister's written reply or an official filing are tier 2
TIER2={'press:scroll-agnipath','press:siasat-manipur-260','press:scroll-caa-hc-953529','press:tribune-commemoration-216','press:organiser-commemoration-2020','press:fpj-sambhal-panel','press:wire-amp-dera-report','press:wire-amp-prakash-singh','press:scroll-delhi-541'}
for d in TIER2:
    if d in SRC: SRC[d]['tier']=2

out={'accessed':'2026-10-13','sources':dict(sorted(SRC.items())),'series':SERIES,'breakdowns':BREAK,'episodes':EPIS}
json.dump(out, open(OUT,'w'), indent=1, ensure_ascii=False)
print('wrote', OUT, len(SERIES),'series', len(BREAK),'breakdowns', len(EPIS),'episodes', len(SRC),'sources')

# ── Communal rioting, 2018-2020, from the Home Ministry's answer (NCRB's table) ──
q=rowq('mha:ls-1544-2022',[p['page'] for p in DOCS['mha:ls-1544-2022']['kept'] if 'TOTAL (ALL INDIA)' in p['text']][0],r'TOTAL \(ALL INDIA\)')
tk=[int(x) for x in re.findall(r'\b\d+\b', q.split('TOTAL (ALL INDIA)')[1])[:18]]
# columns per year: CR CCS CON PAR PCS PCV
assert tk[0]==512 and tk[12]==857, tk
LOC='Annexure to Lok Sabha unstarred question 1544, 26 July 2022 (source: Crime in India)'
by=lambda i: {2018:tk[i],2019:tk[6+i],2020:tk[12+i]}
for s in SERIES:
    if s['id']=='riots-communal':
        s['points'].append(pt(2019,by(0)[2019],'mha:ls-1544-2022',q,loc=LOC,who='NCRB, as laid in the Lok Sabha'))
        s['points'].sort(key=lambda p:p['x'])
series('communal-riot-arrested','Persons arrested for communal or religious rioting','people','Persons arrested under the communal/religious rioting head, all India.','From NCRB\'s table as laid in Parliament.',[pt(y,v,'mha:ls-1544-2022',q,loc=LOC) for y,v in by(3).items()])
series('communal-riot-convicted','Persons convicted of communal or religious rioting','people','Persons convicted under the communal/religious rioting head in the year, all India.','Convictions in a year mostly concern cases from earlier years.',[pt(y,v,'mha:ls-1544-2022',q,loc=LOC) for y,v in by(5).items()])

for s in SERIES:
    if s['id']=='riots-total':
        s['caveat']+=' 2019 is left blank: secondary reports of NCRB\'s figure disagree (45,985 in The Wire; 46,209 in Factly) and the 2019 volume has not been read.'

# ── Police firing and lathi-charge in 2016, by event (Table 16B.1) ─────
t=page('ncrb:2016:full',585)
fire=t.split('POLICE LATHI')[0]
rows=[]
for ev in ('Riots','Self Defence','To Effect Arrest','Against Others'):
    q=norm([l for l in fire.split('\n') if re.match(rf'^\s*\d\s+{ev}\s+\d',l)][0]); tk=[int(x) for x in toks(q)]
    rows.append((ev,tk,q))
tot=norm([l for l in fire.split('\n') if re.match(r'^\s*TOTAL\s+\d',l)][0]); ttk=[int(x) for x in toks(tot)]
assert [sum(r[1][i] for r in rows) for i in range(6)]==ttk, (rows,ttk)
BREAK.append({'id':'firing-2016-civ-killed','title':'Civilians killed when police opened fire, 2016, by occasion','period':'2016','unit':'people',
  'definition':'Civilians killed in police firing in 2016, by the event NCRB records the firing was resorted to for (Table 16B.1).',
  'caveat':'NCRB stopped publishing this table in this form after 2016.',
  'rows':[{'label':{'Riots':'To control riots','Self Defence':'In self-defence','To Effect Arrest':'To make an arrest','Against Others':'Other'}[ev],'v':tk[2],'src':src('ncrb:2016:full'),'quote':q,'loc':'Table 16B.1, Crime in India 2016'} for ev,tk,q in rows]})
SERIES[:]=[s for s in SERIES if s['id'] not in ('firing-riots-occasions','firing-riots-civ-killed')]

out={'accessed':'2026-10-13','sources':dict(sorted(SRC.items())),'series':SERIES,'breakdowns':BREAK,'episodes':EPIS}
json.dump(out, open(OUT,'w'), indent=1, ensure_ascii=False)
print('rewrote', len(SERIES),'series', len(BREAK),'breakdowns', len(EPIS),'episodes', len(SRC),'sources')

# ── The Bengal anti-CAA protests: railway losses before the Calcutta High Court ──
for doc in ('press:fpj-bengal-railways-84','press:bt-bengal-railways-84'):
    if doc in DOCS:
        c=cite(doc,84,r'Rs ?84 ?crore|Rs84 ?cr',who='Indian Railways, reports filed before the Calcutta High Court')
        if c:
            EPIS.append({'id':'caa-bengal-2019','name':'Anti-CAA protests in West Bengal','state':'West Bengal','start':'2019-12-13','kind':'agitation',
              'summary':'Stations, trains and tracks attacked across West Bengal from 13 to 15 December 2019 during protests against the Citizenship (Amendment) Act.',
              'loss':dict(c, what='railway property, per the railways\' reports to the Calcutta High Court'),
              'disputes':['The Railway Board chairman gave a preliminary estimate of Rs 80 crore (Scroll).'] if 'press:scroll-railways-80' in DOCS else []})
            EPIS.sort(key=lambda e:e['start'])
            break
out={'accessed':'2026-10-13','sources':dict(sorted(SRC.items())),'series':SERIES,'breakdowns':BREAK,'episodes':EPIS}
json.dump(out, open(OUT,'w'), indent=1, ensure_ascii=False)
print('final', len(SERIES),'series', len(BREAK),'breakdowns', len(EPIS),'episodes', len(SRC),'sources')
