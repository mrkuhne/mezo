"""Scope a prototype stylesheet under one wrapper class (uveg-mezo-teljes, mezo-me75u.9).

Every selector S becomes `.W S`; a selector that starts at the sheet (`.sheet …`) becomes
`.sheet .W …` (sheet content is wrapped in `.W`); `body:not(.still) S` keeps its body part.
Chrome/frame rules (.phone .tabbar .fab .topbar :root html body .ntf .switcher) are dropped:
the host world owns the chrome. @keyframes pass through; @media recurses.
Usage: python3 scope-css.py WRAPPER < in.css > out.css
"""
import sys, re
W = '.' + sys.argv[1]
DROP = re.compile(r'^(:root|html|body(?!:not)|\.phone|\.tabbar|\.fab\b|\.topbar|\.ntf|\.switcher|\.tb\b|\.tb-|\.sw\b|\.aurora|\.stage|\.notes|\.toast|\.scrim|\.rbtn|\.orb\b|\.wordmark|\.sprite|#)')

def split_sel(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch == '(': depth += 1
        if ch == ')': depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur); cur = ''
        else:
            cur += ch
    out.append(cur)
    return [x.strip() for x in out if x.strip()]

def scope_sel(sel):
    m = re.match(r'^(body:not\(\.still\))\s+(.*)$', sel)
    if m:
        return m.group(1) + ' ' + scope_sel(m.group(2))
    if DROP.match(sel):
        return None
    if sel.startswith('.sheet'):
        rest = sel[len('.sheet'):]
        if rest[:1] in ('.', ':', '['):   # .sheet.on / .sheet:x — the element itself: drop
            return None
        return '.sheet ' + W + rest
    return W + ' ' + sel

def process(css):
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            out.append(css[i:]); break
        head = css[i:j]
        # comments before the selector
        comments = ''.join(re.findall(r'/\*.*?\*/', head, re.S))
        sel = re.sub(r'/\*.*?\*/', '', head, flags=re.S).strip()
        # find matching brace
        depth, k = 1, j + 1
        while depth and k < n:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        if comments: out.append(comments + '\n')
        if sel.startswith('@keyframes') or sel.startswith('@font-face'):
            out.append(sel + '{' + body + '}\n')
        elif sel.startswith('@media') or sel.startswith('@supports'):
            out.append(sel + '{' + process(body) + '}\n')
        elif sel:
            sels = [s for s in (scope_sel(x) for x in split_sel(sel)) if s]
            if sels:
                out.append(','.join(sels) + '{' + body + '}\n')
        i = k
    return ''.join(out)

sys.stdout.write(process(sys.stdin.read()))
