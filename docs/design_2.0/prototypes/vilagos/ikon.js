/* ikon.js — the Folyadék icon family ("Folyadék-jel", owner's choice 2026-10-08).
   Every icon is an outlined glyph in the domain colour, half-filled with the domain liquid: the same
   idea as the rest of the UI (everything is a level that fills). Replaces the dark Titanium 3D sprite
   (t-*, drawn for a dark ground) and the few clay icons used in chrome.
   GLY[name]=[closed outline path(s) that hold the liquid, detail strokes, fill mode]
     fill mode: undefined = half liquid (wave) · 'full' · 'half' (left half, rating stars) · 'none'
   64×64 box, keep 5 px clear. Colours come from CSS on the instance: --ic (line, default --dom) and
   --ic2 (liquid, default --dom2); on a liquid/coloured ground set both to white.
   window.IKON_SET('c'|'0') switches new/old for comparison; review sheet: #w-nap-ikonok */
(function(){
const F=window.F,NS='http://www.w3.org/2000/svg';
const sprite=document.querySelector('symbol[id^="t-"]').closest('svg');
const C=(x,y,r)=>`M${x} ${y-r}A${r} ${r} 0 1 1 ${x-.1} ${y-r}Z`;
const RR=(x,y,w,h,r)=>`M${x+r} ${y}H${x+w-r}A${r} ${r} 0 0 1 ${x+w} ${y+r}V${y+h-r}A${r} ${r} 0 0 1 ${x+w-r} ${y+h}H${x+r}A${r} ${r} 0 0 1 ${x} ${y+h-r}V${y+r}A${r} ${r} 0 0 1 ${x+r} ${y}Z`;
const O=C(32,32,24), STAR='M32 6L40 23L58 25L45 38L48 56L32 47L16 56L19 38L6 25L24 23Z', DROP='M32 6C41 19 50 28 50 39A18 18 0 0 1 14 39C14 28 23 19 32 6Z',
 MOON='M46 41A21 21 0 1 1 25 11A17 17 0 0 0 46 41Z', BELL='M32 8C42 8 47 16 47 26C47 38 53 42 55 46H9C11 42 17 38 17 26C17 16 22 8 32 8Z',
 PILL='M38.5 9.5A11.5 11.5 0 0 1 54.5 25.5L25.5 54.5A11.5 11.5 0 0 1 9.5 38.5Z', SHIELD='M32 6L54 14V30C54 44 44 53 32 58C20 53 10 44 10 30V14Z',
 CLIP=RR(10,12,44,44,4), DUMB='M8 24A4 4 0 0 1 12 20H16A4 4 0 0 1 20 24V28H44V24A4 4 0 0 1 48 20H52A4 4 0 0 1 56 24V40A4 4 0 0 1 52 44H48A4 4 0 0 1 44 40V36H20V40A4 4 0 0 1 16 44H12A4 4 0 0 1 8 40Z',
 ARM='M6 40C14 36 20 36 24 38C26 32 32 28 38 30L34 16C32 10 36 6 42 6H46C50 6 52 9 52 13L56 40C58 50 50 58 38 58H6Z';
const GLY={
 /* day & sleep */
 dawn:['M12 44A20 20 0 0 1 52 44Z','M5 44H59M32 10V16M12 22L16 26M52 22L48 26M18 53H46'],
 sun:[C(32,32,12),'M32 6V12M32 52V58M6 32H12M52 32H58M13.5 13.5L18 18M46 46L50.5 50.5M50.5 13.5L46 18M18 46L13.5 50.5'],
 moon:[MOON,'M46 12V20M42 16H50'], sleep:[MOON,'M40 10H50L40 22H50'],
 clock:[O,'M32 18V32L41 38'], history:[O,'M32 20V32H42M3 24L9 33L17 26'],
 calendar:[RR(8,13,48,42,5),'M8 25H56M20 7V17M44 7V17M19 36H25M39 36H45M19 45H25'],
 day:['M6 36H26C26 44 6 44 6 36Z M38 36H58C58 44 38 44 38 36Z','M32 8V54M22 54H42M14 16H50M16 16V36M48 16V36'],
 candle:['M22 30H42V56H22Z M32 6C36 12 38 16 32 22C26 16 28 12 32 6Z','M32 30V25'],
 breath:['','M6 22H36A7 7 0 1 0 29 15M6 34H48A7 7 0 1 1 41 41M6 46H24'],
 /* training */
 dumbbell:[DUMB,'M3 28V36M61 28V36'],
 addex:['M6 22A3 3 0 0 1 9 19H12A3 3 0 0 1 15 22V26H33V22A3 3 0 0 1 36 19H39A3 3 0 0 1 42 22V36A3 3 0 0 1 39 39H36A3 3 0 0 1 33 36V32H15V36A3 3 0 0 1 12 39H9A3 3 0 0 1 6 36Z','M48 44V58M41 51H55'],
 kettle:[C(32,40,18),'M22 25L19 13C18 9 21 6 25 6H39C43 6 46 9 45 13L42 25'],
 muscle:[ARM,'M38 30C42 32 44 36 44 41M37 17H50'], soreness:[ARM,'M38 30C42 32 44 36 44 41M37 17H50M16 6L11 14H19L14 22'],
 run:['M7 46C7 40 13 39 17 29L29 34C33 41 44 40 52 43C57 44.5 57 50 54 50H11C8 50 7 48.5 7 46Z','M21 31L25 37M3 24H11M2 33H8'],
 steps:['M20 8C27 8 29 18 27 26C26 31 16 31 14 26C11 18 13 8 20 8Z M44 24C51 24 53 34 51 42C50 47 40 47 38 42C35 34 37 24 44 24Z','M15 36C17 40 25 40 26 36M39 52C41 56 49 56 50 52'],
 volley:[O,'M32 8C28 20 30 30 40 38M9 26C20 24 30 28 36 36M22 54C22 44 28 37 40 38C48 39 53 36 55 30'],
 football:[O,'M32 22L41 29L37.5 40H26.5L23 29ZM32 8V22M41 29L54 24M37.5 40L45 52M26.5 40L19 52M23 29L10 24'],
 basket:[O,'M8 32H56M32 8V56M15 15C24 24 24 40 15 49M49 15C40 24 40 40 49 49'],
 tennis:[C(24,26,17)+' '+C(51,13,6),'M36 38L57 59M12 22L28 38M19 13L37 31M11 31L29 13M18 38L36 20'],
 bike:[C(16,43,11)+' '+C(48,43,11),'M16 43L26 24H42L48 43M26 24L34 43H16M38 15H45L42 24'],
 swim:[C(44,20,6),'M4 46Q11 40 18 46T32 46T46 46T60 46M4 56Q11 50 18 56T32 56T46 56T60 56M12 37L26 24L38 35'],
 hike:['M18 8H32V30L50 38C56 41 56 50 52 50H14C12 50 12 46 12 44Z','M10 57H56M24 18H32M24 26H32'],
 trx:['M12 40H24L18 53Z M40 40H52L46 53Z','M32 6L18 40M32 6L46 40'],
 crossfit:[C(20,42,12)+' '+C(44,42,12),'M20 30V6M44 30V6'],
 peak:['M4 54L24 18L34 34L42 24L60 54Z','M18 29L24 34L29 27'],
 motivation:['M6 56L30 22L54 56Z','M30 22V6H44L40 11L44 16H30'],
 jump:['','M12 56H52M32 46V12M19 25L32 12L45 25'],
 sprint:['M28 14L58 32L28 50L34 32Z','M4 20H22M4 32H16M4 44H22'],
 core:['M20 8H44C50 8 52 14 50 22L46 50C45 55 40 58 32 58S19 55 18 50L14 22C12 14 14 8 20 8Z','M32 10V56M16 26H48M18 41H46'],
 juggle:[C(14,37,7)+' '+C(32,15,7)+' '+C(50,37,7),'M14 54C20 59 44 59 50 54'],
 stretch:[C(32,12,6),'M10 16L32 27L54 16M32 27V42L20 58M32 42L44 58'],
 whistle:['M6 20H42A16 16 0 1 1 27 39L6 31Z',C(42,35,5)+'M14 20V13M30 12L33 6M40 10L45 5'],
 target:[O,C(32,32,12)+'M32 32L55 9M46 9H55V18'],
 hold:['','M8 24H56M8 40H56'],
 record:[C(32,41,15),'M22 6L27 27M42 6L37 27M25 41L30 46L39 36'],
 play:[O,'M27 22L43 32L27 42Z'], skip:[O,'M15 49L49 15'],
 repeat:['','M12 28A20 20 0 0 1 48 20L52 24M52 12V24H40M52 36A20 20 0 0 1 16 44L12 40M12 52V40H24'],
 swap:['','M10 22H52L42 12M54 42H12L22 52'],
 other:[C(14,32,6)+' '+C(32,32,6)+' '+C(50,32,6),''],
 rested:[RR(6,20,46,24,4),'M58 28V36M16 28V36M25 28V36M34 28V36'],
 pain:['M32 6L38 20L52 12L46 27L60 32L46 37L52 52L38 44L32 58L26 44L12 52L18 37L4 32L18 27L12 12L26 20Z',''],
 bandage:[PILL,'M22 30L34 42M30 22L42 34'],
 kimelo:[SHIELD,'M23 41C23 30 30 23 41 23C41 34 34 41 23 41Z'],
 /* food */
 bowl:['M7 30H57C57 44 47 54 32 54S7 44 7 30Z','M22 21C19 16 25 14 22 9M34 21C31 16 37 14 34 9M44 21C42 17 46 15 44 12'],
 pot:['M12 26H52V46A8 8 0 0 1 44 54H20A8 8 0 0 1 12 46Z','M4 32H12M52 32H60M10 18H54M32 18V12'],
 plate:[C(32,32,22),C(32,32,12)],
 hunger:[C(32,32,16),'M6 12V52M2 12V24A4 4 0 0 0 10 24V12M58 52V12C52 16 52 30 58 32'],
 craving:[O,C(32,32,8)+'M16 22L19 25M44 14L46 18M48 36L52 37M22 46L25 48'],
 meat:['M10 30C10 16 24 8 38 10C50 12 58 22 54 34C50 48 34 56 22 52C14 49 10 40 10 30Z',C(36,30,6)],
 protein:['M24 8C36 8 45 17 45 28C45 37 39 41 37 43L45 51A4 4 0 1 1 40 56L32 47C28 49 22 49 16 44C8 37 9 24 14 16C16 12 20 8 24 8Z','M21 20C24 17 29 18 31 21'],
 carb:['M12 27C10 14 54 14 52 27C52 31 49 32 49 35V52H15V35C15 32 12 31 12 27Z','M24 38V46M32 38V46M40 38V46'],
 avocado:['M32 7C40 7 43 17 46 27C50 41 44 56 32 56S14 41 18 27C21 17 24 7 32 7Z',C(32,38.5,7.5)],
 fat:['M26 6H38V18C46 22 48 28 48 36V52A4 4 0 0 1 44 56H20A4 4 0 0 1 16 52V36C16 28 18 22 26 18Z','M23 12H41'],
 fiber:['M10 54C10 28 28 10 54 10C54 36 36 54 10 54Z','M10 54L38 26M24 40V28M24 40H36'],
 sprout:['M32 34C32 22 22 16 10 16C10 28 20 34 32 34Z M32 26C32 16 40 8 54 8C54 20 46 26 32 26Z','M32 26V58M20 58H44'],
 harvest:['M32 12C38 16 38 22 32 26C26 22 26 16 32 12Z M20 26C27 26 31 30 31 37C24 37 20 33 20 26Z M44 26C37 26 33 30 33 37C40 37 44 33 44 26Z','M32 26V58M32 50C26 50 22 47 20 42M32 50C38 50 42 47 44 42'],
 water:[DROP,'M23 40C23 45 26 48 30 49'], glucose:[DROP,'M22 42L28 36L33 42L42 32'],
 sugar:['M32 8L54 20V44L32 56L10 44V20Z','M10 20L32 32L54 20M32 32V56'],
 salt:['M22 22H42L46 52A4 4 0 0 1 42 56H22A4 4 0 0 1 18 52Z','M22 22C22 10 42 10 42 22M28 15V16M36 15V16'],
 snack:['M32 20C40 12 56 18 54 34C52 48 44 58 32 54C20 58 12 48 10 34C8 18 24 12 32 20Z','M32 20C32 14 34 10 38 7'],
 ultra:['M14 8H50L46 14L50 20V50L46 56H18L14 50V20L18 14Z','M24 30H40M24 38H40'],
 processing:['M8 54V28L24 38V28L40 38V12H52V54Z','M18 46H22M32 46H36'],
 macro:[O,'M32 32V8M32 32L52 45M32 32L12 45'],
 micro:[C(20,22,8)+' '+C(46,28,6)+' '+C(30,49,9),'M28 24L40 27M23 30L27 41'],
 portion:['M10 30H54L50 54H14Z','M6 22H58M32 22V30M26 43A6 6 0 0 1 38 43'],
 chef:['M18 34C8 34 6 20 16 18C18 8 32 6 36 14C44 8 56 14 52 26C56 30 52 36 46 34V48H18Z','M18 56H46'],
 supps:[PILL,'M24 24L40 40'], syringe:['M22 30L38 14L50 26L34 42Z','M34 10L54 30M44 20L52 12M28 36L10 54M30 22L34 26M26 26L30 30'],
 flask:['M26 6H38V24L54 50A4 4 0 0 1 50 56H14A4 4 0 0 1 10 50L26 24Z','M22 6H42'],
 digestion:['M26 6V16C26 20 23 22 19 24C10 29 8 42 15 50C23 59 40 58 48 50C54 44 55 34 50 28C47 24 41 23 37 26C34 28 34 24 34 20V6Z','M48 50C52 55 56 55 59 52M22 36C24 32 28 31 31 33'],
 ill:['M26 12A6 6 0 0 1 38 12V36A12 12 0 1 1 26 36Z','M32 22V44M44 14H50M44 22H50'],
 /* body & mind */
 weight:[RR(9,10,46,44,8),'M21 26A11 11 0 0 1 43 26Z M32 26L36 19'],
 heart:['M32 54C12 40 6 30 8 21C10 12 22 8 32 19C42 8 54 12 56 21C58 30 52 40 32 54Z','M17 22C18 18 21 17 24 18'],
 mood:[O,'M22 36C26 44 38 44 42 36M23 25V26M41 25V26'],
 brain:['M30 8C22 6 16 12 17 18C10 20 8 28 12 34C8 40 12 50 20 50C22 56 30 56 30 50Z M34 8C42 6 48 12 47 18C54 20 56 28 52 34C56 40 52 50 44 50C42 56 34 56 34 50Z','M21 27C25 27 27 29 29 33M43 27C39 27 37 29 35 33'],
 eye:['M4 32C14 16 50 16 60 32C50 48 14 48 4 32Z',C(32,32,8)],
 flame:['M32 5C36 16 48 22 48 38A16 16 0 0 1 16 38C16 30 21 27 23 21C27 25 30 18 32 5Z','M32 36C36 41 37 45 32 50C27 45 28 41 32 36Z'],
 bolt:['M37 5L13 36H29L26 59L51 27H35Z',''],
 shield:[SHIELD,'M22 31L29 38L42 24'],
 /* records & notes */
 journal:['M14 8H46A5 5 0 0 1 51 13V51A5 5 0 0 1 46 56H14Z','M22 8V56M30 20H42M30 29H42'],
 book:['M6 14C16 10 26 12 32 18C38 12 48 10 58 14V50C48 46 38 48 32 54C26 48 16 46 6 50Z','M32 18V54'],
 scroll:['M14 8H50V50A6 6 0 0 1 44 56H20A6 6 0 0 1 14 50Z','M22 20H42M22 29H42M22 38H34'],
 note:['M12 8H52V40L38 56H12Z','M52 40H38V56M22 22H42M22 31H36'],
 source:['M14 6H38L50 18V58H14Z','M38 6V18H50M22 30H42M22 39H42M22 48H34'],
 protocol:[CLIP,'M24 8H40V16H24ZM20 28H22M28 28H44M20 38H22M28 38H44M20 47H22M28 47H38'],
 checkin:[CLIP,'M24 8H40V16H24ZM21 36L29 44L43 28'],
 tick:[O,'M21 32L29 40L44 24'], info:[O,'M32 29V45M32 20V21'], quick:[O,'M32 20V44M20 32H44'],
 template:[RR(6,10,52,44,4),'M6 24H58M24 24V54'], card:[RR(10,8,44,48,4),'M32 22L35 29L42 30L37 35L38 42L32 39L26 42L27 35L22 30L29 29Z'],
 album:[RR(6,12,52,40,4),'M6 44L22 30L34 42L42 34L58 46M44 22V23'],
 camera:['M12 20H20L24 13H40L44 20H52A5 5 0 0 1 57 25V46A5 5 0 0 1 52 51H12A5 5 0 0 1 7 46V25A5 5 0 0 1 12 20Z',C(32,35,9)],
 pencil:['M42 8L56 22L22 56H8V42Z','M36 14L50 28'], eraser:['M36 10L56 30L34 52H20L8 40Z','M22 24L42 44M14 57H56'],
 trash:['M14 18H50L46 54A4 4 0 0 1 42 58H22A4 4 0 0 1 18 54Z','M8 18H56M24 18V10H40V18M26 28V46M38 28V46'],
 scissors:[C(14,46,8)+' '+C(14,18,8),'M21 22L58 48M21 42L58 16'],
 /* insight & data */
 pattern:[C(14,47,7)+' '+C(32,15,7)+' '+C(50,43,7),'M18 41L28 21M37 20L47 37M21 48L43 45'],
 graph:[C(32,32,8),'M32 24V9M39 36L53 46M25 36L11 46M32 5V6M56 48V49M8 48V49'],
 spark:['M26 10L31 27L48 32L31 37L26 54L21 37L4 32L21 27Z M50 6L52 13L59 15L52 17L50 24L48 17L41 15L48 13Z',''],
 bulb:['M32 6A18 18 0 0 1 44 37V44H20V37A18 18 0 0 1 32 6Z','M22 51H42M26 58H38'],
 lens:[C(27,27,21),'M42 42L58 58'], diagnose:[C(27,27,21),'M42 42L58 58M14 28H21L25 20L30 34L33 28H40'],
 trend:['','M8 8V56H56M16 44L28 32L36 40L52 20'], up:['','M6 46L24 28L34 38L56 14M42 14H56V28'], down:['','M6 18L24 36L34 26L56 50M42 50H56V36'],
 compare:['M10 26H26V56H10Z M38 10H54V56H38Z',''],
 radar:[O,'M32 32L50 18M32 20A12 12 0 1 0 44 32M41 41V42'],
 grid:[RR(8,8,20,20,3)+' '+RR(36,8,20,20,3)+' '+RR(8,36,20,20,3)+' '+RR(36,36,20,20,3),''],
 stack:['M32 8L56 20L32 32L8 20Z','M8 32L32 44L56 32M8 44L32 56L56 44'],
 layers:[RR(8,10,48,14,4),'M10 34H54M10 44H54M10 54H54'],
 signal:[C(32,28,6),'M32 34V57M20 16A16 16 0 0 0 20 40M44 16A16 16 0 0 1 44 40M12 8A26 26 0 0 0 12 48M52 8A26 26 0 0 1 52 48'],
 cowave:['','M6 26C13 12 21 12 28 26S44 40 58 20M6 42C13 28 21 28 28 42S44 56 58 36'],
 compass:[O,'M40 24L36 36L24 40L28 28Z'],
 orb:[C(32,30,22),'M20 24C23 18 28 16 33 16M18 59H46'],
 gem:['M18 10H46L58 26L32 56L6 26Z','M6 26H58M24 10L20 26L32 56L44 26L40 10'],
 ring:[C(32,32,22),C(32,32,10)],
 /* rewards */
 star:[STAR,'','full'], 'star-half':[STAR,'','half'], 'star-empty':[STAR,'','none'],
 score:[O,'M32 18L35.5 27L45 28L38 34.5L40 44L32 39L24 44L26 34.5L19 28L28.5 27Z'],
 coin:[O,'M32 18V46M38 24C32 20 26 22 26 27C26 34 38 30 38 37C38 42 32 44 26 40'],
 quest:['M16 10H50L42 22L50 34H16Z','M16 6V58'], flag:['M14 10C24 4 34 16 50 10V34C34 40 24 28 14 34Z','M14 6V58'],
 'thumb-up':['M22 28L32 8C38 8 40 14 38 20L36 26H50C55 26 57 30 56 34L52 50C51 54 48 56 44 56H22Z','M8 28H16V56H8Z'],
 'thumb-down':['M22 36L32 56C38 56 40 50 38 44L36 38H50C55 38 57 34 56 30L52 14C51 10 48 8 44 8H22Z','M8 8H16V36H8Z'],
 /* people & talk */
 people:['M6 54C6 43 13 38 22 38S38 43 38 54Z',C(22,23,9)+C(43,27,7)+'M44 40C52 40 58 45 58 54H45'],
 person:['M12 56C12 43 20 37 32 37S52 43 52 56Z',C(32,20,11)],
 council:['M8 44C8 36 56 36 56 44V52H8Z',C(16,24,6)+C(32,18,6)+C(48,24,6)],
 chat:['M12 10H52A6 6 0 0 1 58 16V38A6 6 0 0 1 52 44H28L16 55V44H12A6 6 0 0 1 6 38V16A6 6 0 0 1 12 10Z','M20 24H44M20 33H36'],
 send:['M6 28L58 6L44 58L30 38Z','M30 38L58 6'], mic:['M32 5A9 9 0 0 1 41 14V28A9 9 0 0 1 23 28V14A9 9 0 0 1 32 5Z','M14 28A18 18 0 0 0 50 28M32 46V58M22 58H42'],
 bell:[BELL,'M26 53A6 6 0 0 0 38 53M32 3V8'], mute:[BELL,'M8 6L56 58'],
 /* system */
 gear:['M27 5H37L39 13L46 17L54 14L59 23L53 29V35L59 41L54 50L46 47L39 51L37 59H27L25 51L18 47L10 50L5 41L11 35V29L5 23L10 14L18 17L25 13Z',C(32,32,9)],
 key:[C(22,34,14),'M34 30H58M48 30V40M56 30V38'], link:['','M27 37L37 27M30 20L36 14A10 10 0 0 1 50 28L44 34M34 44L28 50A10 10 0 0 1 14 36L20 30'],
 chain:['','M24 20H18A12 12 0 0 0 18 44H24M40 20H46A12 12 0 0 1 46 44H40M22 32H42'],
 pin:['M32 6A18 18 0 0 1 50 24C50 38 32 58 32 58S14 38 14 24A18 18 0 0 1 32 6Z',C(32,24,7)],
 anchor:[C(32,12,6),'M32 18V56M20 28H44M10 38C10 50 22 56 32 56S54 50 54 38'],
 travel:[RR(6,20,52,34,4),'M24 20V12H40V20M20 20V54M44 20V54'],
 exit:['M10 8H36V56H10Z','M44 32H58M52 24L58 32L52 40M28 32V33'],
 palette:['M32 8C46 8 58 18 58 30C58 40 50 42 44 42H38C34 42 33 46 35 49C37 53 35 56 30 56C16 56 6 46 6 32S18 8 32 8Z','M20 26V27M30 18V19M42 20V21M17 38V39']};
const defs=document.createElementNS(NS,'defs');sprite.appendChild(defs);
defs.innerHTML=`<clipPath id="tc-lv"><path d="M-2 37Q6 32 14 37T30 37T46 37T66 37V70H-2Z"/></clipPath><clipPath id="tc-hx"><path d="M0 0H32V64H0Z"/></clipPath>`;
const LINE='fill="none" style="stroke:var(--ic,var(--dom))" stroke-linejoin="round" stroke-linecap="round"';
const gsym=(k,[p,x,m])=>`<symbol id="tc-${k}" viewBox="0 0 64 64">${p?`<path d="${p}" style="fill:${m==='none'?'transparent':'var(--icf,color-mix(in srgb,var(--ic,var(--dom)) 11%,#fff))'}"/>${m==='none'?'':m==='full'?`<path d="${p}" style="fill:var(--ic2,var(--dom2))"/>`:`<g clip-path="url(#tc-${m==='half'?'hx':'lv'})"><path d="${p}" style="fill:var(--ic2,var(--dom2))"/></g>`}<path d="${p}" ${LINE} stroke-width="4"/>`:''}${x?`<path d="${x}" ${LINE} stroke-width="${p?3.6:4.4}"/>`:''}</symbol>`;
const tmp=document.createElement('div');tmp.innerHTML=`<svg xmlns="${NS}">${Object.entries(GLY).map(([k,v])=>gsym(k,v)).join('')}</svg>`;[...tmp.firstChild.childNodes].forEach(n=>sprite.appendChild(n));
const HAS=id=>!!document.getElementById(id);
/* the clay icons still used in chrome and a few rows */
const CMAP={ertesites:'bell',beallitas:'gear',emberek:'people',tanyer:'plate',edzes:'dumbbell',nap:'sun',mezo:'orb',retegek:'layers',sport:'volley',fuel:'bowl',
 'life-konyha':'chef','life-penzugyek':'coin','life-szemlelet':'eye','life-tudatossag':'breath','life-produktivitas':'checkin','life-tanulas':'book','life-kapcsolatok':'people','life-regeneracio':'sleep'};
const variant=(o,m)=>{if(m!=='c')return o;const k=o.startsWith('c-i-')?CMAP[o.slice(4)]:o.startsWith('t-')?o.slice(2):null;return k&&HAS('tc-'+k)?'tc-'+k:o};
let MODE='c';try{MODE=localStorage.getItem('mezo-ikon2')||'c'}catch(e){}
if(!/^[0c]$/.test(MODE))MODE='c';
function swap(){document.querySelectorAll('use').forEach(u=>{if(u.closest('[data-fixic]')||u.closest('symbol'))return;const h=u.getAttribute('href');if(!h)return;const o=u.dataset.o||h.slice(1);if(!/^(t-|c-i-)/.test(o))return;u.dataset.o=o;const w=variant(o,MODE);u.closest('svg').classList.toggle('jel',w!==o);if(h!=='#'+w)u.setAttribute('href','#'+w)});tubes();marks()}
/* the small mark at the top of a vial turns white when the liquid reaches it */
function marks(){document.querySelectorAll('.k2-tube,.phone[data-d="en"] .t').forEach(t=>{const em=t.querySelector(':scope>em')||(t.previousElementSibling&&t.previousElementSibling.tagName==='EM'?t.previousElementSibling:null);if(!em||!em.textContent.trim())return;
  const l=t.querySelector(':scope>.l'),i=t.querySelector(':scope>i');const p=parseFloat(l?getComputedStyle(l).getPropertyValue('--p'):i?i.style.height:'');if(!(p>0))return;
  const tr=t.getBoundingClientRect(),er=em.getBoundingClientRect();if(!er.height||!tr.height)return;const top=tr.bottom-tr.height*p/100,st=top<er.top-5?'onliq':top<er.bottom+1?'edge':'';if((em.dataset.lq||'')!==st){em.dataset.lq=st;em.classList.toggle('onliq',st==='onliq');em.classList.toggle('edge',st==='edge')}})}
/* a glyph standing in a vial is drawn twice: in the vial's colour, and in white clipped to the liquid — readable at any level */
function tubes(){document.querySelectorAll('.k2-tube>svg.jel,.phone[data-d="en"] .t>svg.jel').forEach(s=>{const t=s.parentElement;if(t.querySelector(':scope>.jw'))return;
  const l=t.querySelector(':scope>.l'),i=t.querySelector(':scope>i');const p=l?getComputedStyle(l).getPropertyValue('--p').trim():i?i.style.height:'';if(!p)return;
  const cs=getComputedStyle(s),w=document.createElement('span');w.className='jw';w.dataset.fixic='1';w.style.clipPath=`inset(calc(100% - ${p}) 0 0 0)`;
  const c=s.cloneNode(true);c.style.cssText=`position:absolute;left:${cs.left};bottom:${cs.bottom};width:${cs.width};height:${cs.height};transform:${cs.transform};margin:0`;w.appendChild(c);t.appendChild(w)})}
function apply(){document.documentElement.dataset.ikon=MODE;swap();document.querySelectorAll('#ikseg button').forEach(b=>b.classList.toggle('on',b.dataset.ik===MODE))}
let busy=false;new MutationObserver(()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{busy=false;swap()})}).observe(document.body,{childList:true,subtree:true});
window.IKON_SET=m=>{MODE=m;try{localStorage.setItem('mezo-ikon2',m)}catch(e){}apply()};
window.IKON_MISSING=()=>[...document.querySelectorAll('symbol[id^="t-"]')].map(s=>s.id.slice(2)).filter(k=>!GLY[k]);
document.addEventListener('click',e=>{const b=e.target.closest('[data-ik]');if(b)IKON_SET(b.dataset.ik)});
const top=document.querySelector('.top');if(top){const s=document.createElement('div');s.className='seg';s.id='ikseg';s.setAttribute('aria-label','Ikonok');
  s.innerHTML=`<button data-ik="c">Új ikonok</button><button data-ik="0">Régi ikonok</button>`;top.appendChild(s)}
const Q='.phone.foly[data-s="elo"]',H='html[data-ikon="c"] ';
const BUB=`${Q} .fb,${Q} .fh-step .si,${Q} .fh-row .si,${Q} .fh-h .tile,${Q} .fm-bh .si`.split(',');
const st=document.createElement('style');st.textContent=`
${H}${Q} svg.ic.jel{filter:none!important}
${BUB.map(s=>H+s+' svg.ic.jel').join(',')}{width:62%;height:62%}
${BUB.map(s=>H+s+'::after').join(',')}{display:none}
${BUB.map(s=>H+s).join(',')}{background:color-mix(in srgb,var(--c,var(--dom)) 8%,#fff);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c,var(--dom)) 16%,#fff)}
${H}${Q} .fb{--ic:var(--c);--ic2:color-mix(in srgb,var(--c) 45%,#fff)}
${H}${Q} .k2-tube>svg.ic.jel,${H}${Q}[data-d="en"] .t>svg.ic.jel{--ic:color-mix(in srgb,var(--c) 78%,var(--ink));--ic2:transparent;--icf:transparent}
${H}${Q} .fb svg.ic.jel{min-width:calc(var(--s)*.6);min-height:calc(var(--s)*.6);flex:none}
${H}${Q} .fh-pill.on svg.ic.jel,${H}${Q} .fh-seg .on svg.ic.jel{--ic:#fff;--ic2:rgba(255,255,255,.4);--icf:transparent}
em.edge{color:var(--ink)!important;font-weight:700;text-shadow:0 0 3px #fff,0 0 2px #fff,0 0 1px #fff;z-index:4}
em.onliq{color:#fff!important;text-shadow:0 0 3px rgba(10,42,60,.45),0 1px 1px rgba(10,42,60,.3);z-index:4}
${H}${Q}[data-d="en"] .c.nd .t>svg.ic.jel{--ic:color-mix(in srgb,var(--c) 55%,var(--ink));opacity:1!important}
.jw{position:absolute;inset:0;pointer-events:none;z-index:3}.jw svg.ic{--ic:#fff!important;--ic2:rgba(255,255,255,.32)!important;--icf:transparent;filter:none!important}
html[data-ikon="0"] .jw{display:none}
${H}${Q} .fh-hero .fh-acts svg.ic.jel,${H}${Q} .btn.pri svg.ic.jel{--ic:#fff;--ic2:rgba(255,255,255,.5);--icf:transparent}
#ikseg{margin-top:6px}
.ikg{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 6px;padding:16px 10px}.ikg div{display:grid;justify-items:center;gap:5px;font-size:10.5px;color:var(--sub);text-align:center;line-height:1.15}`;document.head.appendChild(st);
/* "Új ikonok" review sheet (owner OK needed before they go into the shared sprite) */
if(window.FREG&&FREG.nap){const G=[['Nap és alvás','dawn sun moon sleep clock history calendar day candle breath'],
 ['Edzés','dumbbell addex kettle muscle soreness run steps volley football basket tennis bike swim hike trx crossfit peak motivation jump sprint core juggle stretch whistle target hold record play skip repeat swap other rested pain bandage kimelo'],
 ['Étkezés','bowl pot plate hunger craving meat protein carb avocado fat fiber sprout harvest water glucose sugar salt snack ultra processing macro micro portion chef supps syringe flask digestion ill'],
 ['Test és fej','weight heart mood brain eye flame bolt shield'],
 ['Napló és jegyzet','journal book scroll note source protocol checkin tick info quick template card album camera pencil eraser trash scissors'],
 ['Minta és adat','pattern graph spark bulb lens diagnose trend up down compare radar grid stack layers signal cowave compass orb gem ring'],
 ['Jutalom','star star-half star-empty score coin quest flag thumb-up thumb-down'],
 ['Emberek és rendszer','people person council chat send mic bell mute gear key link chain pin anchor travel exit palette']];
 FREG.nap.routes.ikonok=()=>F.page('nap',{title:'Új ikonok',sub:Object.keys(GLY).length+' jel · Folyadék-készlet',back:'mai'},
  G.map(([t,l],i)=>F.sec(i+1,t)+F.card(`<div class="ikg">${l.split(' ').map(k=>`<div><span class="fb" style="--s:46px;--c:var(--dom)"><svg class="ic td"><use href="#t-${k}"/></svg></span>${k}</div>`).join('')}</div>`)).join(''))}
apply();
})();
