"""Assemble uveg-mezo-teljes.html — the WHOLE Mezo section in one clickable world (mezo-me75u.9).

Base: the approved csapatfal world `uveg-uzenofal.html` (wall, team, rooms, posts, U8a deep pages),
untouched. Added on top:
  * U8 (Mezo I) screens verbatim — CSS scoped under `.u8` (src/uveg-mezo-teljes-u8.css, made by
    scope-css.py from the U8 prototype), views as a module (src/uveg-mezo-teljes-u8.js);
  * U9 (Mezo II) screens in the csapatfal material (src/uveg-mezo-teljes-u9.{css,js});
  * the shared 3D sprite (t-*) the U8/U9 views use.
The base render() asks `window.MZX` first; everything else stays the csapatfal's own.
Run from docs/design_2.0/prototypes:  python3 src/splice-mezo-teljes.py
"""
import re

base = open('uveg-uzenofal.html').read()
sprite = open('../../../frontend/src/shared/ui/clay/titanium-icons.svg').read()
u8css = open('src/uveg-mezo-teljes-u8.css').read()
u9css = open('src/uveg-mezo-teljes-u9.css').read()
js = open('src/uveg-mezo-teljes-u8.js').read() + open('src/uveg-mezo-teljes-u9.js').read()
notes = open('src/uveg-mezo-teljes-notes.html').read()

def once(s, old, new):
    assert s.count(old) >= 1, old[:80]
    return s.replace(old, new, 1)

s = base
s = re.sub(r'<title>.*?</title>', '<title>Mezo · a teljes szekció · Üveg (U8 + U9 + csapatfal)</title>', s, count=1)
s = once(s, '</style>', '\n/* ══ U8 · Mezo I — a uveg-mezo.html kitje, a .u8 alá zárva ══ */\n' + u8css + '\n' + u9css + '\n</style>')
s = once(s, '<div class="stage">', sprite + '\n<div class="stage">')
s = once(s, '<div class="scroll" id="scroll"></div>', '<div class="scroll" id="scroll"></div>\n    <div id="dock"></div>')
s = re.sub(r'<aside class="notes">.*?</aside>', lambda m: notes.strip(), s, count=1, flags=re.S)
# the router asks the Mezo registry first; the D3 „közös kép” Rólad stays reachable as #rolad-terv
s = once(s, "const html=r==='csapat'?", "const html=window.MZX&&MZX.has(r)?MZX.view(r,id,st):r==='rolad-terv'?rolad():r==='csapat'?")
s = once(s, "$('#scroll').innerHTML=html;", "$('#scroll').innerHTML=html;$('#dock').innerHTML='';$('#phone').classList.remove('nofab');if(window.MZX&&MZX.has(r))MZX.after(r,id);")
tab_line = re.search(r"document\.querySelectorAll\('\.tb'\)\.forEach\(t=>t\.classList\.toggle\('on',t\.dataset\.tab===\((.*)\)\)\);", s)
assert tab_line, 'tab line'
s = s.replace(tab_line.group(0), "document.querySelectorAll('.tb').forEach(t=>t.classList.toggle('on',t.dataset.tab===((window.MZX&&MZX.tab(r))||(" + tab_line.group(1) + "))));", 1)
s = once(s, '</body>', '<script type="module">\n' + js + '\n</script>\n</body>')
open('uveg-mezo-teljes.html', 'w').write(s)
print('uveg-mezo-teljes.html', len(s.splitlines()), 'lines')
