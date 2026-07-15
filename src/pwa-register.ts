// PWA registration: notify the app when a new version is ready and let the
// user decide when to apply it. Also exposes a global update trigger.
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

declare global {
  interface Window {
    __applyAppUpdate?: () => void;
  }
}

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
      // Notify UI — user chooses when to reload.
      window.dispatchEvent(new CustomEvent("pwa:update-ready"));
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);
    },
  });

  window.__applyAppUpdate = () => updateSW(true);

  let reloaded = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}
