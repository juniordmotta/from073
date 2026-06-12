import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send } from "lucide-react";

interface EventRow {
  id: string;
  event_type: string;
  entity_name: string;
  details: any;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const EVENT_LABELS: Record<string, string> = {
  house_added: "Casa adicionada",
  house_deleted: "Casa excluída",
  house_moved: "Casa movida",
  house_status_changed: "Status da casa alterado",
  group_added: "Grupo adicionado",
};

function buildDefaults(ev: EventRow) {
  const label = EVENT_LABELS[ev.event_type] || ev.event_type;
  const title = `${label}: ${ev.entity_name}`;
  let message = "";
  switch (ev.event_type) {
    case "house_added":
      message = `A casa "${ev.entity_name}" foi adicionada ao catálogo.`;
      break;
    case "house_deleted":
      message = `A casa "${ev.entity_name}" foi removida do catálogo.`;
      break;
    case "house_moved":
      message = `A casa "${ev.entity_name}" foi movida entre grupos.`;
      break;
    case "house_status_changed":
      message = `O status da casa "${ev.entity_name}" foi atualizado (${ev.details?.action || ""}).`;
      break;
    case "group_added":
      message = `Um novo grupo "${ev.entity_name}" foi criado.`;
      break;
    default:
      message = label;
  }
  return { title, message };
}

export function NotificationCenterDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notification_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      setEvents((data as any[]) || []);
      setLoading(false);
    })();
  }, [open]);

  const pick = (ev: EventRow) => {
    setSelected(ev);
    const d = buildDefaults(ev);
    setTitle(d.title);
    setMessage(d.message);
  };

  const dispatch = async () => {
    if (!selected || !user?.id) return;
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("notifications" as any).insert({
      type: selected.event_type,
      title: title.trim(),
      message: message.trim(),
      metadata: { event_id: selected.id, ...selected.details, entity_name: selected.entity_name },
      created_by: user.id,
    });
    setSending(false);
    if (error) {
      toast.error("Erro ao disparar notificação");
      return;
    }
    toast.success("Notificação enviada a todos os usuários");
    setSelected(null);
    setTitle("");
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Central de Notificações</DialogTitle>
          <DialogDescription>
            Selecione um evento recente do catálogo para disparar uma notificação a todos os usuários.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-md">
            <div className="p-2 border-b text-xs font-medium text-muted-foreground">
              Últimos eventos
            </div>
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
              ) : events.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Sem eventos registrados.</div>
              ) : (
                <ul className="divide-y">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
                      className={`p-2 cursor-pointer hover:bg-accent/40 ${
                        selected?.id === ev.id ? "bg-accent" : ""
                      }`}
                      onClick={() => pick(ev)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          {EVENT_LABELS[ev.event_type] || ev.event_type}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{ev.entity_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(ev.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Título</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!selected}
                placeholder="Selecione um evento à esquerda"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Mensagem</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={!selected}
                rows={6}
                placeholder="Mensagem que todos os usuários verão"
              />
            </div>
            <Button onClick={dispatch} disabled={!selected || sending} className="w-full gap-2">
              <Send className="h-4 w-4" />
              {sending ? "Disparando..." : "Disparar notificação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
