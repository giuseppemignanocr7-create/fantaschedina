// Force unregister ALL service workers and clear ALL caches on every load.
//
// The old SW precached JS bundles with quiz code that used answerIndex
// from the client. NetworkFirst for JS in the new workbox config only
// works AFTER the new SW takes control — but the old SW serves stale
// JS before that happens. Unregistering everything and hard-reloading
// guarantees the freshest bundle is fetched from the network.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async function (regs) {
    var hadSW = regs.length > 0;
    for (var i = 0; i < regs.length; i++) {
      await regs[i].unregister();
    }
    if ('caches' in window) {
      var keys = await caches.keys();
      for (var j = 0; j < keys.length; j++) {
        await caches.delete(keys[j]);
      }
    }
    if (hadSW) {
      window.location.reload();
    }
  });
}
