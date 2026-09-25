// ============================================================
// Mezo · swAutoReload — a telepített PWA ne fusson tovább egy régi kóddal egy új szerver ellen.
//
// A `registerType: 'autoUpdate'` service worker (vite.config.ts) az új verziót csendben
// telepíti és átveszi az irányítást (skipWaiting + clientsClaim), de a már futó lap a RÉGI
// JS-t futtatja tovább, amíg valaki újra nem tölti. Egy drót-szerződés váltásakor (v2.331.0:
// az észrevétel-bizonyíték szövegből strukturált elem lett) a régi kód az új választ nem
// érti, és a Mai fül hibakártyára esik — az „Újrapróbálom” ezen nem segít, mert ugyanazt a
// régi kódot rendereli újra.
//
// Ezért: (1) amikor egy ÚJ worker veszi át a lapot, egyszer újratöltünk; (2) amikor a
// telefonon előtérbe jön az app (iOS a háttérből folytatott PWA-t nem navigálja újra, így
// frissítést sem keres), rákérdezünk a frissítésre.
// ============================================================

export function installSwAutoReload(win: Window = window): void {
  const sw = win.navigator.serviceWorker
  if (!sw) return
  // Az ELSŐ telepítéskor (még nincs vezérlő) a clientsClaim is `controllerchange`-et lő —
  // az nem verzióváltás, ott nincs mit újratölteni.
  const hadController = sw.controller != null
  let reloading = false
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    win.location.reload()
  })
  win.document.addEventListener('visibilitychange', () => {
    if (win.document.visibilityState !== 'visible') return
    void sw.getRegistration().then((reg) => reg?.update()).catch(() => {})
  })
}
