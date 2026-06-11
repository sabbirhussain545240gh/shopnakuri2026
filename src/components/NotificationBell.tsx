import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  listMyNotifications,
  markNotificationsRead,
  type Notification,
} from "@/lib/notifications.functions";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "এইমাত্র";
  if (m < 60) return `${m} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ঘণ্টা আগে`;
  const d = Math.floor(h / 24);
  return `${d} দিন আগে`;
}

export function NotificationBell() {
  const fetchList = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchList();
      setItems(r.notifications);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const unread = items.filter((n) => !n.read_at).length;

  const handleMarkAll = async () => {
    try {
      await markRead({ data: {} });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "আপডেট করা যায়নি");
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="text-sm font-semibold">নোটিফিকেশন</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={handleMarkAll} className="h-7 text-xs">
              <Check className="h-3 w-3 mr-1" /> সব পড়া হয়েছে
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">কোনো নোটিফিকেশন নেই</div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={`p-3 text-sm ${n.read_at ? "" : "bg-accent/40"}`}>
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        n.kind === "success"
                          ? "bg-emerald-500"
                          : n.kind === "error"
                            ? "bg-destructive"
                            : "bg-primary"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
