import { readFileSync } from 'node:fs'

test('a team-feed CSS-szekció létezik és kiegyensúlyozott', () => {
  const css = readFileSync('src/features/insights/boop-world.css', 'utf8')
  for (const cls of ['.tf-cast', '.tf-poster', '.tf-post', '.tf-acts', '.tf-day', '.tf-matwell'])
    expect(css).toContain(cls)
  expect((css.match(/\{/g) ?? []).length).toBe((css.match(/\}/g) ?? []).length)
})

test('nincs második üveg-recept: a team-feed szekció nem definiál backdrop-filtert', () => {
  const css = readFileSync('src/features/insights/boop-world.css', 'utf8')
  const section = css.slice(css.indexOf('team-feed (mezo-a9bo7.7)'))
  expect(section).not.toMatch(/backdrop-filter/)
})
