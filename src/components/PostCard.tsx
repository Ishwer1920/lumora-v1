import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FeedPost = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  location: string | null;
  created_at: string;
  author: { username: string; display_name: string | null; avatar_url: string | null };
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user: { username: string; avatar_url: string | null };
};

export function PostCard({ post, onDelete }: { post: FeedPost; onDelete?: (id: string) => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [saved, setSaved] = useState(post.saved_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [comments, setComments] = useState(post.comments_count);
  const [showComments, setShowComments] = useState(false);
  const [list, setList] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [floatHeart, setFloatHeart] = useState(0);
  const lastTap = useRef(0);

  const toggleLike = async () => {
    if (!user) { toast("Sign in to like"); return; }
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    if (next) {
      const { error } = await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
      if (error) { setLiked(false); setLikes((n) => n - 1); return; }
      if (post.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.user_id, actor_id: user.id, type: "like", post_id: post.id,
        });
      }
    } else {
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    }
  };

  const toggleSave = async () => {
    if (!user) { toast("Sign in to save"); return; }
    const next = !saved;
    setSaved(next);
    if (next) await supabase.from("saves").insert({ user_id: user.id, post_id: post.id });
    else await supabase.from("saves").delete().eq("user_id", user.id).eq("post_id", post.id);
  };

  const handleImageTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!liked) toggleLike();
      setFloatHeart((n) => n + 1);
    }
    lastTap.current = now;
  };

  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "Lumora post" });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id,content,created_at, user:profiles!comments_user_id_fkey(username,avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(50);
    setList((data as unknown as Comment[]) ?? []);
  };

  useEffect(() => { if (showComments) loadComments(); }, [showComments]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const content = text.trim().slice(0, 500);
    setText("");
    const { error } = await supabase.from("comments").insert({
      post_id: post.id, user_id: user.id, content,
    });
    if (error) { toast.error("Could not comment"); return; }
    setComments((n) => n + 1);
    if (post.user_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: post.user_id, actor_id: user.id, type: "comment", post_id: post.id,
      });
    }
    loadComments();
  };

  const removePost = async () => {
    if (!user || user.id !== post.user_id) return;
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) { toast.error("Could not delete"); return; }
    toast.success("Post deleted");
    onDelete?.(post.id);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl overflow-hidden shadow-soft"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <Link to="/u/$username" params={{ username: post.author.username }}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatar_url ?? undefined} />
            <AvatarFallback>{post.author.username.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to="/u/$username"
            params={{ username: post.author.username }}
            className="font-semibold text-sm hover:underline"
          >
            {post.author.username}
          </Link>
          {post.location && <div className="text-xs text-muted-foreground truncate">{post.location}</div>}
        </div>
        {user?.id === post.user_id && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={removePost} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="relative w-full bg-muted aspect-square select-none" onClick={handleImageTap}>
        <img
          src={post.image_url}
          alt={post.caption ?? "Post image"}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <AnimatePresence>
          {Array.from({ length: floatHeart }).slice(-1).map((_, i) => (
            <motion.div
              key={floatHeart + i}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.4, 1.1], opacity: [0, 1, 0] }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0 grid place-items-center pointer-events-none"
            >
              <Heart className="h-24 w-24 text-white drop-shadow-2xl fill-white" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="px-4 py-3 flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggleLike} className="tap">
          <motion.span animate={{ scale: liked ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.3 }}>
            <Heart className={`h-6 w-6 ${liked ? "fill-primary text-primary" : ""}`} />
          </motion.span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setShowComments((v) => !v)}>
          <MessageCircle className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" onClick={share}>
          <Share2 className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleSave} className="ml-auto">
          <Bookmark className={`h-6 w-6 ${saved ? "fill-foreground" : ""}`} />
        </Button>
      </div>

      <div className="px-4 pb-4 space-y-1">
        <div className="text-sm font-semibold">{likes.toLocaleString()} likes</div>
        {post.caption && (
          <p className="text-sm">
            <Link to="/u/$username" params={{ username: post.author.username }} className="font-semibold mr-2 hover:underline">
              {post.author.username}
            </Link>
            <span className="whitespace-pre-wrap">{post.caption}</span>
          </p>
        )}
        {comments > 0 && (
          <button onClick={() => setShowComments((v) => !v)} className="text-xs text-muted-foreground">
            {showComments ? "Hide" : `View all ${comments}`} comments
          </button>
        )}
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground pt-1">
          {formatDistanceToNowStrict(new Date(post.created_at))} ago
        </div>

        <AnimatePresence initial={false}>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-3 max-h-72 overflow-y-auto">
                {list.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={c.user.avatar_url ?? undefined} />
                      <AvatarFallback>{c.user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <span className="font-semibold mr-2">{c.user.username}</span>
                      <span>{c.content}</span>
                    </div>
                  </div>
                ))}
                {list.length === 0 && (
                  <div className="text-xs text-muted-foreground">Be the first to comment</div>
                )}
              </div>
              {user && (
                <form onSubmit={submitComment} className="flex gap-2 pt-3">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Add a comment…"
                    maxLength={500}
                  />
                  <Button type="submit" disabled={!text.trim()} className="gradient-brand text-primary-foreground">
                    Post
                  </Button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export function PostSkeleton() {
  return (
    <div className="glass rounded-3xl overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <div className="h-3 w-32 rounded bg-muted" />
      </div>
      <div className="aspect-square w-full bg-muted" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-20 bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    </div>
  );
}
