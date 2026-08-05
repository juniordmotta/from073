// Força a aplicação da versão mais recente: aplica update do service worker
// (se houver), limpa caches do app e recarrega sem cache.
export async function hardReloadApp() {
  try {
    if (typeof window.__applyAppUpdate === "function") {
      try {
        window.__applyAppUpdate();
      } catch {
        /* segue com a limpeza */
      }
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(
        regs
          .filter((r) => {
            const url = r.active?.scriptURL || "";
            // Preserva workers de mensageria (push), remove apenas o app shell.
            return url.endsWith("/sw.js") || url.endsWith("/service-worker.js");
          })
          .map((r) => r.unregister())
      );
    }
  } catch {
    /* ignora e recarrega mesmo assim */
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString());
  window.location.replace(url.toString());
}
