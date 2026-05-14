import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, UserPlus, Bell } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";

type Notif = {
  id: string;
  type: "like" | "comment" | "follow";
  read: boolean;
  created_at: string;
  post_id: string | null;
  actor: { username: string; avatar_url: string | null } | null;
};

export const Route = createFileRoute("/notifications")({
  component: NotifPage,
});

function NotifPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,type,read,created_at,post_id, actor:profiles!notifications_actor_id_fkey(username,avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems((data as unknown as Notif[]) ?? []);
      setLoading(false);
      // mark read
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    };
    load();
    const ch = supabase
      .channel("notif-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, authLoading, navigate]);

  const Icon = ({ t }: { t: Notif["type"] }) =>
    t === "like" ? <Heart className="h-4 w-4 text-primary" /> :
    t === "comment" ? <MessageCircle className="h-4 w-4 text-primary" /> :
    <UserPlus className="h-4 w-4 text-primary" />;

  const text = (n: Notif) =>
    n.type === "like" ? "liked your post" : n.type === "comment" ? "commented on your post" : "started following you";

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 md:px-6 py-4 md:py-8 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>

        {loading && [...Array(5)].map((_, i) => (
          <div key={i} className="glass rounded-2xl h-16 animate-pulse" />
        ))}

        {!loading && items.length === 0 && (
          <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
            You have no notifications yet.
          </div>
        )}

        <ul className="space-y-2">
          {items.map((n) => {
            const Wrapper: React.ElementType = n.post_id ? Link : "div";
            const wrapperProps = n.post_id
              ? { to: "/p/$id", params: { id: n.post_id } }
              : n.actor
              ? { to: "/u/$username", params: { username: n.actor.username } } as const
              : {};
            return (
              <li key={n.id}>
                <Wrapper
                  {...(wrapperProps as object)}
                  className={`flex items-center gap-3 p-3 rounded-2xl glass ${!n.read ? "ring-1 ring-primary/30" : ""}`}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={n.actor?.avatar_url ?? undefined} />
                      <AvatarFallback>{n.actor?.username.slice(0, 1).toUpperCase() ?? "?"}</AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background grid place-items-center border">
                      <Icon t={n.type} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-semibold">{n.actor?.username ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{text(n)}</span>
                    <div className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(n.created_at))} ago</div>
                  </div>
                </Wrapper>
              </li>
            );
          })}
        </ul>

        {!user && <Button onClick={() => navigate({ to: "/login" })}>Sign in</Button>}
      </div>
    </AppLayout>
  );
}
