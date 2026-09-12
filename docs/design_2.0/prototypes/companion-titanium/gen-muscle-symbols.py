# A body-map family: one stylised figure, the named muscle lit. Front view for what you see from
# the front, back view (spine groove) for the rest — so quad vs ham, or chest vs lats, differ.
FIG = ('<circle cx="32" cy="8.5" r="5.4" fill="url(#mg-body)"/>'
       '<path d="M25 15h14l6 3 2.4 11-5 1.2-2.4-7 .8 12-2 10H25.2l-2-10 .8-12-2.4 7-5-1.2L19 18Z" fill="url(#mg-body)"/>'
       '<path d="M18.4 19.6 14 22l-3 12.4 4.2 1.2 3.2-11Z" fill="url(#mg-body)"/>'
       '<path d="M14.9 36.2 12.6 48l4.2 1.2 3.2-11.8Z" fill="url(#mg-body)"/>'
       '<path d="M45.6 19.6 50 22l3 12.4-4.2 1.2-3.2-11Z" fill="url(#mg-body)"/>'
       '<path d="M49.1 36.2 51.4 48l-4.2 1.2-3.2-11.8Z" fill="url(#mg-body)"/>'
       '<path d="M25 42h6.2l-.8 9.4.8 11.6h-6.2l-.8-11.6Z" fill="url(#mg-body)"/>'
       '<path d="M32.8 42H39l.8 9.4-.8 11.6h-6.2l-.8-11.6Z" fill="url(#mg-body)"/>')
SPINE = ('<path d="M32 16.5v25" stroke="#00000070" stroke-width="1.6" stroke-linecap="round"/>'
         '<path d="M27 19.6c1.4 2.8 2.8 4.4 4.6 5.4M37 19.6c-1.4 2.8-2.8 4.4-4.6 5.4" fill="none" stroke="#00000055" stroke-width="1.3" stroke-linecap="round"/>')

def blob(cx, cy, rx, ry, rot=0):
    t = f' transform="rotate({rot} {cx} {cy})"' if rot else ''
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"{t}/>'

def pair(cx, cy, rx, ry, rot=0):
    return blob(cx, cy, rx, ry, rot) + blob(64 - cx, cy, rx, ry, -rot)

MUSCLES = [
 ('chest-upper', 'chest', 'front', blob(32, 19.5, 8.6, 2.4)),
 ('chest-mid', 'chest', 'front', blob(32, 23.5, 9.2, 2.8)),
 ('chest-lower', 'chest', 'front', blob(32, 27.5, 8.2, 2.4)),
 ('traps', 'back', 'back', blob(32, 16.8, 9.4, 2.6) + pair(25, 18.6, 3.4, 2)),
 ('back-wide', 'back', 'back', pair(26, 25, 4, 6.6, 12)),
 ('back-mid', 'back', 'back', blob(32, 26, 7.6, 4)),
 ('back-lower', 'back', 'back', blob(32, 35.5, 6.4, 3.4)),
 ('shoulder-front', 'shoulder', 'front', pair(22.6, 19.4, 3.6, 3.2)),
 ('shoulder-side', 'shoulder', 'front', pair(19.4, 21.4, 3.2, 3.8, 18)),
 ('shoulder-rear', 'shoulder', 'back', pair(21.4, 20.6, 3.4, 3.2, -12)),
 ('biceps-long', 'arm', 'front', pair(16.6, 26, 2.6, 4.2, 14)),
 ('biceps-short', 'arm', 'front', pair(15.6, 31, 2.6, 3.6, 14)),
 ('biceps-brachialis', 'arm', 'front', pair(14.6, 35.6, 2.4, 3, 14)),
 ('triceps-long', 'arm', 'back', pair(17.4, 25.4, 2.6, 4.2, 14)),
 ('triceps-lateral', 'arm', 'back', pair(16.2, 31, 2.6, 3.6, 14)),
 ('triceps-medial', 'arm', 'back', pair(15, 36, 2.4, 3, 14)),
 ('quad', 'leg', 'front', pair(27.8, 46.8, 3.2, 5.6)),
 ('ham', 'leg', 'back', pair(27.8, 47.6, 3, 5.2)),
 ('glute', 'leg', 'back', pair(28, 41.4, 3.8, 3.2)),
 ('calf', 'leg', 'back', pair(27.6, 57, 2.8, 4.2)),
 ('core', 'core', 'front', blob(32, 31, 5.6, 3) + blob(32, 36.5, 5.2, 2.8) + blob(32, 41, 4.6, 2.4)),
]

GRADS = {
 'mg-body': [('#8b8799', 0), ('#3b3d4e', .55), ('#23252f', 1)],
 'mg-chest': [('#ffd9cf', 0), ('#e08a7c', .5), ('#9a5147', 1)],
 'mg-back': [('#d6f4ff', 0), ('#78cfe7', .5), ('#376b80', 1)],
 'mg-shoulder': [('#eee0ff', 0), ('#bca6f1', .5), ('#5c5187', 1)],
 'mg-arm': [('#ffdce8', 0), ('#e79ab8', .5), ('#8a4a60', 1)],
 'mg-leg': [('#eaffc4', 0), ('#b3d97e', .5), ('#5c743f', 1)],
 'mg-core': [('#ffeec4', 0), ('#e0bd8a', .5), ('#856640', 1)],
}

out = []
for name, stops in GRADS.items():
    s = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for c, o in stops)
    out.append(f'<linearGradient id="{name}" x1="0" y1="0" x2=".6" y2="1">{s}</linearGradient>')

for key, region, view, lit in MUSCLES:
    body = FIG + (SPINE if view == 'back' else '')
    out.append(
        f'<symbol id="i-m-{key}" viewBox="0 0 64 64">'
        f'<g transform="translate(32 33) scale(.92) translate(-32 -33)">'
        f'<g filter="url(#shadow)" opacity=".5">{body}</g>'
        f'<g fill="url(#mg-{region})" stroke="#ffffff70" stroke-width=".5">{lit}</g>'
        f'</g></symbol>')
print(''.join(out))
