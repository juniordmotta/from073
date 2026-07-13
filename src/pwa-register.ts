// Force the app to always run the latest deployed version.
// - On new service worker available, activate it immediately and reload.
// - On controller change, reload once so the page uses the new assets.
import { registerSW } from "virtual:pwa-register";

const host = window.location.hostname;
const isPreview =
  host.startsWith("id-preview--") ||
  host.startsWith("preview--") ||
  host === "lovableproject.com" ||
  host.endsWith(".lovableproject.com") ||
  host === "lovableproject-dev.com" ||
  host.endsWith(".lovableproject-dev.com") ||
  host === "beta.lovable.dev" ||
  host.endsWith(".beta.lovable.dev");

const inIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const swOff = new URLSearchParams(window.location.search).get("sw") === "off";

if (!import.meta.env.PROD || isPreview || inIframe || swOff) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
      });
    });
  }
} else {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // A new version is waiting: activate it and reload the page.
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Periodically check for updates so long-lived tabs also refresh.
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);
    },
  });

  // When the active SW changes (new version took control), reload once
  // so the page loads the freshest HTML and hashed assets.
  let reloaded = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}
