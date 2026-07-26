// Aggiornamento del Service Worker a ogni caricamento.
//
// Con skipWaiting + clientsClaim il nuovo SW prende il controllo subito, ma la
// tab già aperta continua a usare il bundle JS vecchio: al primo cambio pagina
// i lazy chunk non esistono più e la navigazione fallisce. Il reload su
// `controllerchange` risolve la discrepanza.
//
// File esterno e non inline: la CSP usa `script-src 'self'` senza
// 'unsafe-inline', quindi uno script inline verrebbe bloccato.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => {
      r.update();
    });
  });
}
