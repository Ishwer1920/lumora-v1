import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchFeed } from "@/lib/feed";
import type { FeedPost } from "@/components/PostCard";
import { PostCard, PostSkeleton } from "@/components/PostCard";
import { AppLayout } from "@/components/AppLayout";
import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <AppLayout>
      <Feed />
    </AppLayout>
  );
}

type SuggestedUser = { id: string; username: string; display_name: string | null; avatar_url: string | null };

function Feed() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const [suggested, setSuggested] = useState<SuggestedUser[]>([]);

  const load = async (before?: string) => {
    const data = await fetchFeed({ before, viewerId: user?.id ?? null, limit: 8 });
    return data;
  };

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setDone(false);
    load().then((d) => {
      setPosts(d);
      if (d.length < 8) setDone(true);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authLoading, user?.id]);

  useEffect(() => {
    supabase.from("profiles").select("id,username,display_name,avatar_url").limit(6).then(({ data }) => {
      const list = (data as SuggestedUser[] | null) ?? [];
      setSuggested(user ? list.filter((u) => u.id !== user.id).slice(0, 5) : list.slice(0, 5));
    });
  }, [user?.id]);

  useEffect(() => {
    const el = sentinel.current; if (!el || done) return;
    const io = new IntersectionObserver(async (ents) => {
      if (ents[0].isIntersecting && !loadingMore && posts.length > 0) {
        setLoadingMore(true);
        const last = posts[posts.length - 1].created_at;
        const more = await load(last);
        setPosts((p) => [...p, ...more]);
        if (more.length < 8) setDone(true);
        setLoadingMore(false);
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [posts, done, loadingMore]);

  // realtime: prepend new posts
  useEffect(() => {
    const ch = supabase
      .channel("feed-new")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const id = (payload.new as { id: string }).id;
        const data = await fetchFeed({ viewerId: user?.id ?? null, limit: 1 });
        const fresh = data.find((p) => p.id === id);
        if (fresh) setPosts((cur) => (cur.some((p) => p.id === id) ? cur : [fresh, ...cur]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 md:py-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
      <div className="max-w-xl w-full mx-auto lg:mx-0 space-y-5">
        {!user && (
          <div className="glass rounded-3xl p-5 flex items-center gap-4">
            <span className="h-10 w-10 rounded-2xl gradient-brand grid place-items-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Welcome to Lumora</div>
              <div className="text-sm text-muted-foreground">Create an account to post, like and follow.</div>
            </div>
            <Link to="/register" className="px-4 py-2 rounded-full gradient-brand text-primary-foreground text-sm font-medium">
              Join
            </Link>
          </div>
        )}

        {loading && [...Array(3)].map((_, i) => <PostSkeleton key={i} />)}

        {!loading && posts.length === 0 && (
          <div className="glass rounded-3xl p-10 text-center">
            <h2 className="text-xl font-semibold mb-1">It's quiet here</h2>
            <p className="text-muted-foreground text-sm">Be the first to share something.</p>
          </div>
        )}

        {posts.map((p) => (
          <PostCard key={p.id} post={p} onDelete={(id) => setPosts((c) => c.filter((x) => x.id !== id))} />
        ))}

        <div ref={sentinel} />
        {loadingMore && <PostSkeleton />}
        {done && posts.length > 0 && (
          <div className="text-center text-xs text-muted-foreground py-6">You're all caught up ✨</div>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-5">
          <div className="glass rounded-3xl p-5">
            <h3 className="font-semibold mb-3">Suggested for you</h3>
            <div className="space-y-3">
              {suggested.map((s) => (
                <Link key={s.id} to="/u/$username" params={{ username: s.username }} className="flex items-center gap-3 group">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={s.avatar_url ?? undefined} />
                    <AvatarFallback>{s.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate group-hover:underline">{s.username}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.display_name ?? "New on Lumora"}</div>
                  </div>
                </Link>
              ))}
              {suggested.length === 0 && <div className="text-xs text-muted-foreground">No suggestions yet</div>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-3">© Lumora · share your light</p>
        </div>
      </aside>
    </div>
  );
}
