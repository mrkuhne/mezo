export const kitHu = {
  back: 'Vissza',
  close: 'Bezárás',
  cancel: 'Mégse',
  loading: 'Betöltés…',
  retry: 'Újra',
  clearSearch: 'Keresés törlése',
  decrease: (who: string) => `${who} csökkentése`,
  increase: (who: string) => `${who} növelése`,
  // The team by field (bible §6) and the quiet caption beside each name; keyed by member id (the Skeptic has no caption).
  members: { szunya: 'Alvás', mocor: 'Mozgás', falat: 'Étkezés', deru: 'Közérzet', mezo: 'Mezo', szk: 'Szkeptikus' },
  memberMeta: { szunya: 'pihenés', mocor: 'terhelés', falat: 'étrend', deru: 'hangulat', mezo: 'összkép' },
}
