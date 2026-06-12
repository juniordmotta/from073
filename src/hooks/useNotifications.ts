import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: any;
  created_at: string;
  read?: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase
        .from("notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notification_reads" as any)
        .select("notification_id")
        .eq("user_id", user.id),
    ]);
    const readSet = new Set((reads as any[] | null)?.map((r) => r.notification_id) || []);
    const list = ((notifs as any[]) || []).map((n) => ({ ...n, read: readSet.has(n.id) }));
    setNotifications(list);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("notifications-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const markAsRead = async (id: string) => {
    if (!user?.id) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from("notification_reads" as any).upsert({ user_id: user.id, notification_id: id });
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notification_reads" as any)
      .upsert(unread.map((n) => ({ user_id: user.id, notification_id: n.id })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh: load };
}
