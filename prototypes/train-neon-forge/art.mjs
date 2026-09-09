let serial = 0;
export function icon(name, size = 22) {
  const paths = {
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    flame: '<path d="M13 2c2 6-5 7-2 11 2 0 3-2 3-4 8 7 3 13-2 13S2 17 5 11c0 4 2 4 3 3-2-5 5-7 5-12Z"/>',
    gym: '<path d="m7 7 10 10M2 8l6-6M4 12l8-8m0 16 8-8m-4 10 6-6"/>',
    gem: '<path d="m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="m13 6-5 7h4l-1 5 5-8h-4l1-4Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4m-4 3v6m-4 0h8"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
    shop: '<path d="m4 8 2-5h12l2 5v3a3 3 0 0 1-4 2 3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-4-2V8Zm1 6v7h14v-7M9 21v-6h6v6"/>',
    sound: '<path d="m3 9 4 0 5-5v16l-5-5H3V9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    reset: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.bolt}</svg>`;
}
export function art(kind = 'bell', cls = '') {
  const id = `art${serial++}`;
  const defs = `<defs>
    <linearGradient id="${id}metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9e2ed"/><stop offset=".24" stop-color="#667181"/><stop offset=".5" stop-color="#222632"/><stop offset=".75" stop-color="#484854"/><stop offset="1" stop-color="#11131c"/></linearGradient>
    <linearGradient id="${id}lime" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#f1ffb8"/><stop offset=".45" stop-color="#c9ff4e"/><stop offset="1" stop-color="#4e8210"/></linearGradient>
    <linearGradient id="${id}purple" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ebd6ff"/><stop offset=".45" stop-color="#b389ff"/><stop offset="1" stop-color="#542ec0"/></linearGradient>
    <linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff3b7"/><stop offset=".45" stop-color="#ffd268"/><stop offset="1" stop-color="#ad6418"/></linearGradient>
    <radialGradient id="${id}halo"><stop stop-color="#bdff4b" stop-opacity=".28"/><stop offset="1" stop-color="#bdff4b" stop-opacity="0"/></radialGradient>
    <filter id="${id}shadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="18" stdDeviation="12" flood-opacity=".6"/></filter>
    <filter id="${id}glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>`;
  const paint = name => `url(#${id}${name})`;
  const bell = `<ellipse cx="190" cy="310" rx="100" ry="16" fill="#000" opacity=".5"/>
    <g class="floating-object" filter="${paint('shadow')}" transform="rotate(-18 190 175)">
    <path d="M137 144V99c0-65 108-65 108 0v45" fill="none" stroke="#181d27" stroke-width="30"/>
    <path d="M137 139V98c0-57 108-57 108 0v41" fill="none" stroke="${paint('metal')}" stroke-width="23"/>
    <path d="M141 95c0-48 94-48 99 0" fill="none" stroke="#d5dde8" stroke-opacity=".6" stroke-width="3"/>
    <path d="M134 123Q102 146 104 207q0 62 43 73h87q44-12 44-73 0-60-35-84Z" fill="${paint('metal')}" stroke="#727d8b" stroke-width="1.5"/>
    <path d="M119 157q-12 43 0 75" fill="none" stroke="#c8d6e6" stroke-opacity=".5" stroke-width="4"/>
    <path d="M136 124q50 19 108 0" fill="none" stroke="${paint('lime')}" stroke-width="9"/>
    <path d="M137 267h104" stroke="#bbf84e" stroke-width="5"/>
    <path d="m192 150-33 52h27l-9 42 45-60h-30l10-34Z" fill="#caff54" opacity=".8" filter="${paint('glow')}"/>
    <path d="m192 150-33 52h27l-9 42 45-60h-30l10-34Z" fill="${paint('lime')}"/>
    <path d="M158 142h67" stroke="#eaffb4" stroke-opacity=".5"/>
    </g>`;
  const gem = `<g class="floating-object" filter="${paint('shadow')}">
    <path d="m190 38 79 87-15 108-64 73-66-73-14-108Z" fill="${paint('purple')}"/>
    <path d="m190 38-32 106 32 162 36-162Z" fill="#d2b0ff"/>
    <path d="m110 125 48 19 32-106Zm159 0-43 19 28 89Z" fill="#8a53e7"/>
    <path d="m158 144 32 162-66-73Z" fill="#6d3daf"/>
    <path d="m190 38 36 106-36 162 64-73 15-108Z" fill="#be8aff" opacity=".45"/>
    <path d="m190 38-32 106 32 162m-80-181 48 19 68 0 43-19" fill="none" stroke="#efd7ff" stroke-opacity=".8" stroke-width="2"/>
    <path d="m148 108 9-32m67 101-12 53" stroke="white" stroke-width="5" stroke-linecap="round"/>
    </g>`;
  const chest = `<g class="floating-object" filter="${paint('shadow')}">
    <path d="m82 159 110 29 107-29v107l-107 41-110-41Z" fill="${paint('metal')}" stroke="#6f6288" stroke-width="2"/>
    <path d="m192 188 107-29v107l-107 41Z" fill="#242135"/>
    <path d="m82 159 110 29 107-29-18-68-90-28-91 28Z" fill="${paint('purple')}"/>
    <path d="m82 159 110 29v-75l-92-22Zm110-46 107-22-18 68-89 29Z" fill="#6f43a1" opacity=".5"/>
    <path d="m82 174 110 32 107-32M192 206v101" stroke="${paint('gold')}" stroke-width="10"/>
    <path d="m113 169 0 106m152-106v110" stroke="${paint('gold')}" stroke-width="12"/>
    <path d="m178 191 28 0v41l-14 12-14-12Z" fill="${paint('gold')}" stroke="#ffefb1"/>
    <path d="m195 202-9 14h8l-2 10 10-15h-8Z" fill="#7d4e24"/>
    <path d="m88 158 104 31 102-31" stroke="#d4ff86" stroke-width="4"/>
    </g>`;
  const medal = `<g class="floating-object" filter="${paint('shadow')}">
    <path d="m114 43 47 0 33 89-48 29Z" fill="#9561e4"/><path d="m218 43 49 0-38 118-48-29Z" fill="#c3a0ff"/>
    <path d="m190 105 82 48v96l-82 48-82-48v-96Z" fill="${paint('gold')}" stroke="#ffe8a2" stroke-width="4"/>
    <path d="m190 126 63 36v74l-63 37-63-37v-74Z" fill="#986328" stroke="#f7c462" stroke-width="2"/>
    <path d="m191 146-32 52h29l-8 43 43-61h-30l8-34Z" fill="${paint('gold')}"/>
    </g>`;
  return `<svg class="art ${cls}" viewBox="0 0 380 350" fill="none" aria-hidden="true">${defs}<ellipse cx="190" cy="175" rx="180" ry="165" fill="${paint('halo')}"/>${{ bell, gem, chest, medal }[kind] || bell}</svg>`;
}
