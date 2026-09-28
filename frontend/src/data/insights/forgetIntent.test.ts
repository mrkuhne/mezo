import { isForgetRequest } from '@/data/insights/forgetIntent'

// The exact positive and trap sets of the backend ForgetIntentTest — the two must agree.
test.each([
  'Ezt ne jegyezd meg.', 'Az Annásat inkább ne jegyezd meg.', 'NE JEGYEZD MEG', 'kérlek ne jegyezd meg ezt',
  'felejtsd el ezt', 'Felejtsd el, amit mondtam.', 'felejtsd el amit írtam Annáról', 'Felejtsd el az előzőt!',
  'Kérlek, felejtsd el!', 'felejtsd el', 'ezt ne mentsd', 'Ezt inkább ne tárold.', 'ne tárold el',
  'felejtsd el mindent erről',
])('a forget request: %s', (text) => {
  expect(isForgetRequest(text)).toBe(true)
})

test.each([
  'Felejtsd el a tervet, csináljunk újat.', 'Felejtsd el ezt a tervet', 'Ne felejtsd el, hogy holnap edzés.',
  'Ne felejtsd el, amit mondtam.', 'Jegyezd meg, hogy szeretem a kávét.', 'Elfelejtettem bevenni a vitamint.',
  'Mentsd el ezt a receptet.', 'Nem baj, ha nem jegyzed meg.', '', '   ',
])('not a forget request: "%s"', (text) => {
  expect(isForgetRequest(text)).toBe(false)
})
