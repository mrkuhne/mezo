# „Világos · élő" prototype — domain files

The owner-approved direction (2026-10-08) after six rejected rounds. What he said, in order:
the current glass app is playful/tamagotchi; pure clinical was "dry, boring, soulless"; the
decluttered glass "blends together — I don't understand what is where, where to look, where to
search", and he dislikes the old colour world and dark mode; the plain light version had the
right **structure and cleanliness** but looked "boring and stock"; **this** version ("better")
keeps that structure and adds character. Do not drift back toward any rejected round.

`klinikai-iranyok.html` is the shell (router, sprites, csepp, anatomy). `vilagos/kit.js` holds
the look and the helpers (`window.F`). Each domain is **one file**, `vilagos/<domain>.js`.
One agent owns one file; never edit the shell, the kit or another domain's file. If the kit
lacks something, add domain CSS through `register({css})` and say so in your report.

Open: `http://127.0.0.1:8731/klinikai-iranyok.html?v=N#e-<domain>-<route>[.<arg>]`
(server: `python3 -m http.server 8731 --bind 127.0.0.1` in `docs/design_2.0/prototypes/`; it
may already run and is shared — never kill it). `#j-<domain>-<route>` shows the living
prototype `elo/<domain>.html#<route>` in the same frame, so **keep the living route names**.

## Sources for content and parity (read these, in this order)

1. `vilagos/nap.js` and `vilagos/edzes.js` — the approved `mai` screens: the pattern to follow.
2. `vilagos/kit.js` — the helper signatures (short; read it fully).
3. **`csepp/<domain>.js`** — an earlier round's full port of your domain in a rejected look.
   It is your **content and parity source**: every route, variant, sheet, control, state and
   real-looking Hungarian record is already mapped there from the living prototype. Reuse the
   route names, args, data and interactions; **replace all of its layout and styling**.
4. `elo/<domain>.html` (the living prototype) and `docs/features/<feature>.md` when in doubt.

## The page skeleton (the whole point — every screen follows it)

1. **Title bar** — where am I: `page(domain,{title,sub,tab})`. Top tabs are the domain's
   pages. A sub-page uses `{title,sub,back:'route'}` instead of `tab` (back chevron, no tabs).
2. **One hero** — `hero({...})`: the state in one **verdict sentence** plus **one primary
   button**. At most one hero per screen (a second, `warn:true`, only when something needs a
   decision first). The hero wears the domain colour world.
3. **Numbered sections**, each a white card with a clear title: `sec(1,'Most következik')`
   then `card(...)`. Order them by what the user needs first: *what to do now* → *today's
   numbers* → *insight* → *log/history*. 3–5 sections per screen; anything deeper is a row
   that opens a sub-page or a sheet. Never dump everything on one screen.
4. **Bottom bar** — the five domains, always (the kit renders it).

Rules:
- **Wayfinding first.** A reader must see at a glance what the screen is, what the one
  important thing is, and what to tap next. If two things compete, demote one into a row.
- **Same anatomy every time:** time-ordered things are `step`s, lists are `row`s, numbers are
  `stat` tiles in a 2-column `grid`, choices are `seg`/`pills`. Don't invent new card shapes
  when one of these fits.
- **Colour = meaning.** Domain colour (`--dom`, automatic) on hero, primary button, active
  tab, section badges. State colours `var(--ok) / var(--warn) / var(--bad)` only for state.
  Category colours `var(--protein) / var(--carb) / var(--fat)` and `muscleColor(key)` are
  stable identities. No other colours; never hard-code a hex except through these tokens.
- **Character:** 3D Titanium/clay icons in their original colours (`I('t-…')`, `I('c-i-…')`)
  on steps, rows, stat tiles, section heads and as hero art; display font is automatic on
  titles and numerals (`.fh-big`, `.verdict`, stat `n`, `h2`). No emoji (only inside a team
  member's quoted line). No Boop creatures anywhere.
- **The csepp means the user's day** (`csepp('ok'|'warn'|'bad', fill, {s,val,label})`) — only
  where a screen shows the day's state. Other progress uses `ring()` or `bar()`.
- **The team** (Szunya, Mocor, Falat, Derű, Mezo) are sibling forms: `who('szunya')`,
  `msg('falat','szöveg','meta')`. The form is the sender, the text is the voice.
- **Light only.** No dark styles.
- **Behaviour frozen:** every control, state, field and sheet of the live screen stays
  (reverse parity with `csepp/<domain>.js`); you may regroup and reorder, never drop or
  invent. Out-of-scope taps get `{toast:'…'}`.
- Hungarian, real-looking content; plain, observational wording; no streaks as heroes.
- 320px wide must not overflow; motion only through `.rise` (the kit adds it) and the csepp.

## Kit (`const {…}=F`)

| Helper | Use |
|---|---|
| `page(d,{title,sub,tab\|back},inner,{foot,nonav,pad})` | whole screen; `foot` = a floating action bar html; `nonav:true` hides the bottom bar (full-screen flows) |
| `hero({lbl,verdict,sub,left,art,body,acts,warn,big},i)` | `left` = csepp/ring html; `art` = a 3D icon id shown large top-right; `body` = extra html; `acts` = buttons html |
| `sec(n,title,i)` · `card(inner,{cls,i,style})` · `head(icon,title,link,linkAct)` | numbered label · white card · card header |
| `step({time,icon,title,sub,right,now,on})` | time-ordered row; `now:true` highlights; `right` = button/pill html; `on` = action |
| `row({icon,left,title,sub,v,right,on})` | list row; `v` = value text; `on` makes it a button with a chevron |
| `stat({k,icon,n,unit,pct,s,sCls,c,on})` + `grid([...])` | number tiles; `c` = a colour token; `sCls` `'ok'\|'warn'` |
| `facts([[b,small],…])` · `bar(pct,c)` · `ring(pct,{s,c,val,label})` | fact strip · bar · ring |
| `seg([[label,action,on],…])` · `pills([[label,action,on,icon],…])` · `st(label,'q\|ok\|warn\|bad\|plan')` | segmented control · filter pills · status pill |
| `btn(label,action,'sm ghost')` · `lk(label,action)` | buttons (one primary per screen) · text link |
| `txt(html)` · `note(html)` · `empty(icon,text,actsHtml)` | body text · footnote · empty state |
| `who(key,size)` · `msg(key,text,meta)` · `TEAM` | team sibling forms |
| `csepp` · `mchp(key,'sm')` · `muscleColor(key)` · `I(id)` · `chev()` | from the shell |
| CSS classes | `.fh-big` big numeral · `.fh-in` input · `.fh-lab` field label · `.fh-pair` two tiles · `.fh-chips` · `.fh-mus` muscle row · `.fh-why` · `.fh-chart` (inline SVG: hairline grid `var(--hair)`, line `var(--dom)`, raw dots `var(--faint)`) · `.sets`-style tables: write domain CSS |

**Actions** (`action` everywhere): a route string `'log'` / `'meal.ebed'`, or an object
`{go:'route.arg'}`, `{sheet:'name',arg:'x'}`, `{toast:'…'}`, `{dom:'fuel'}`. Raw attributes
also work: `data-go`, `data-sheet` + `data-arg`, `data-close`, `data-toast`, `data-dom`.
`F.go(route)`, `F.toast(t)`, `F.openSheet(html)`, `F.closeSheet()` from code; `F.R`, `F.ARG`.

```js
(function(){
const {I,page,sec,card,head,hero,btn,lk,step,row,stat,grid,register}=F;
function mai(arg){ return page('fuel',{title:'Fuel',sub:'Szerda, október 7.',tab:'mai'},`…`); }
function meal(arg){ return page('fuel',{title:'Ebéd',sub:'Fuel · 13:00',back:'mai'},`…`); }
register('fuel',{title:'Fuel',
  tabs:[['Mai','mai'],['Kiegészítők','stack'],['Trendek','trendek'],['Konyha','konyha']],
  routes:{mai,meal,…},                 // `mai` is the domain's landing route (mandatory)
  sheets:{ energy:(arg)=>`<h2>…</h2>…` },
  after:(route,arg)=>{},               // optional (timers, focus)
  css:`.phone[data-v="feher"][data-d="fuel"] .x{…}`,
  notes:`<h2>Fuel</h2>…`               // Hungarian, owner-facing, everyday words, short
});
})();
```

Icons available: `grep -o 'id="t-[a-z-]*"\|id="c-i-[a-z]*"' klinikai-iranyok.html | sort -u`.

## Verification before hand-back (mandatory)

1. `node -e "new Function(require('fs').readFileSync('vilagos/<domain>.js','utf8'))"`.
2. Playwright (import from the absolute path `…/frontend/node_modules/@playwright/test` or
   `playwright`; ESM ignores `NODE_PATH`): open **every** route and variant at 390 and 320 px
   wide, **reloading per route** (hash-only navigation lets state bleed), open every sheet;
   fail on console/page errors, on `<use href>` ids missing from the document, and on
   horizontal overflow of `.scroll`. Save screenshots to the scratchpad and **look at** the
   main ones: check the skeleton reads top-to-bottom (title → one hero → numbered sections).
3. Report compactly: routes (all working), parity notes, what you regrouped, open questions.
