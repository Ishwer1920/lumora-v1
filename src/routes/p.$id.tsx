import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { fetchFeed } from "@/lib/feed";
import { PostCard, PostSkeleton, type FeedPost } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/p/$id")({
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // simplest: fetch a small batch then find. For v1 OK; for many posts we'd query single.
      const { data } = await supabase.from("posts").select("created_at").eq("id", id).maybeSingle();
      if (!data) { setLoading(false); return; }
      // fetch with offset around created_at: use feed but filter limit 1 by id via separate path
      const list = await fetchFeed({ before: new Date(new Date(data.created_at).getTime() + 1).toISOString(), limit: 1, viewerId: user?.id ?? null });
      setPost(list.find((p) => p.id === id) ?? null);
      setLoading(false);
    })();
  }, [id, user?.id]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl px-4 md:px-6 py-6">
        {loading && <PostSkeleton />}
        {!loading && !post && (
          <div className="glass rounded-3xl p-10 text-center text-muted-foreground">Post not found.</div>
        )}
        {post && <PostCard post={post} onDelete={() => navigate({ to: "/" })} />}
      </div>
    </AppLayout>
  );
}
