import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, TrendingUp } from "lucide-react";
import { fetchFeed } from "@/lib/feed";
import type { FeedPost } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
});

type Profile = { id: string; username: string; display_name: string | null; avatar_url: string | null };

function ExplorePage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeed({ limit: 30, viewerId: user?.id ?? null }).then((d) => {
      setPosts(d); setLoading(false);
    });
  }, [user?.id]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setUsers([]); return; }
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(10);
      setUsers((data as Profile[] | null) ?? []);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      const tags = p.caption?.match(/#[\p{L}0-9_]+/gu) ?? [];
      tags.forEach((t) => counts.set(t.toLowerCase(), (counts.get(t.toLowerCase()) ?? 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [posts]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-4 md:py-8 space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, hashtags…"
            className="pl-10 h-12 rounded-2xl glass"
          />
        </div>

        {q.trim() && (
          <div className="glass rounded-3xl p-2">
            {users.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No users found</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {users.map((u) => (
                  <li key={u.id}>
                    <Link to="/u/$username" params={{ username: u.username }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatar_url ?? undefined} />
                        <AvatarFallback>{u.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{u.username}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.display_name ?? ""}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {trendingTags.length > 0 && (
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Trending</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map((t) => (
                <span key={t} className="px-3 py-1.5 rounded-full glass text-sm">{t}</span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1 md:gap-3">
          {loading && [...Array(9)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
          ))}
          {posts.map((p) => (
            <Link key={p.id} to="/p/$id" params={{ id: p.id }} className="relative aspect-square overflow-hidden rounded-xl group">
              <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            </Link>
          ))}
        </div>

        {!loading && posts.length === 0 && (
          <div className="glass rounded-3xl p-10 text-center text-muted-foreground">Nothing to explore yet.</div>
        )}
      </div>
    </AppLayout>
  );
}
