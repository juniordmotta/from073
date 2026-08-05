import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { hardReloadApp } from "@/lib/hardReload";

export const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export const UpdateNotifier = () => {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = () => setReady(true);
    window.addEventListener("pwa:update-ready", handler);
    return () => window.removeEventListener("pwa:update-ready", handler);
  }, []);

  if (!ready || dismissed) return null;

  const apply = () => {
    void hardReloadApp();
  };


  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm animate-fade-in">
      <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-card shadow-lg p-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Atualização disponível
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Uma nova versão do Arb From 073 está pronta para ser aplicada.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={apply} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar agora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
            >
              Depois
            </Button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const AppVersionBadge = () => {
  const [updating, setUpdating] = useState(false);

  return (
    <span className="flex items-center gap-2">
      <span
        className="text-[10px] text-muted-foreground/70 font-mono select-none"
        title={`Versão ${APP_VERSION}`}
      >
        v{APP_VERSION}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-[10px] gap-1"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          void hardReloadApp();
        }}
      >
        <RefreshCw className={`h-3 w-3 ${updating ? "animate-spin" : ""}`} />
        {updating ? "Atualizando..." : "Atualizar agora"}
      </Button>
    </span>
  );
};

