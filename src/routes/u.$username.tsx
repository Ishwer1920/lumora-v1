import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchFeed } from "@/lib/feed";
import type { FeedPost } from "@/components/PostCard";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, Loader2, Pencil, Globe } from "lucide-react";

export const Route = createFileRoute("/u/$username")({
  component: ProfilePage,
});

type Profile = {
  id: string; username: string; display_name: string | null;
  bio: string | null; avatar_url: string | null; website: string | null;
};

function ProfilePage() {
  const { username } = Route.useParams();
  const { user, profile: me, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [iFollow, setIFollow] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url,website")
      .eq("username", username).maybeSingle();
    if (!prof) { setProfile(null); setLoading(false); return; }
    setProfile(prof as Profile);

    const [{ count: f1 }, { count: f2 }, fol, p] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", prof.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", prof.id),
      user
        ? supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", prof.id).maybeSingle()
        : Promise.resolve({ data: null }),
      fetchFeed({ userId: prof.id, viewerId: user?.id ?? null, limit: 30 }),
    ]);
    setFollowers(f1 ?? 0);
    setFollowing(f2 ?? 0);
    setIFollow(!!fol.data);
    setPosts(p);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [username, user?.id]);

  const toggleFollow = async () => {
    if (!user) { navigate({ to: "/login" }); return; }
    if (!profile) return;
    if (iFollow) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
      setIFollow(false); setFollowers((n) => n - 1);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
      setIFollow(true); setFollowers((n) => n + 1);
      await supabase.from("notifications").insert({
        user_id: profile.id, actor_id: user.id, type: "follow",
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl p-6 animate-pulse space-y-6">
          <div className="flex gap-6 items-center">
            <div className="h-24 w-24 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 bg-muted rounded" />
              <div className="h-3 w-64 bg-muted rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => <div key={i} className="aspect-square bg-muted rounded-xl" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md p-10 text-center glass rounded-3xl mt-10">
          <h2 className="text-xl font-semibold">User not found</h2>
        </div>
      </AppLayout>
    );
  }

  const isMe = me?.id === profile.id;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-6 md:py-10 space-y-8">
        <header className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="relative">
            <span className="absolute -inset-1 rounded-full gradient-brand blur opacity-60" />
            <Avatar className="relative h-28 w-28 ring-4 ring-background">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-3xl">{profile.username.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 text-center sm:text-left space-y-3">
            <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-start">
              <h1 className="text-2xl font-bold">{profile.username}</h1>
              {isMe ? (
                <Button variant="outline" onClick={() => setEditOpen(true)} className="rounded-full">
                  <Pencil className="h-4 w-4 mr-1.5" /> Edit profile
                </Button>
              ) : (
                <Button
                  onClick={toggleFollow}
                  className={`rounded-full ${iFollow ? "" : "gradient-brand text-primary-foreground"}`}
                  variant={iFollow ? "outline" : "default"}
                >
                  {iFollow ? "Following" : "Follow"}
                </Button>
              )}
            </div>
            <div className="flex gap-6 justify-center sm:justify-start text-sm">
              <span><strong>{posts.length}</strong> posts</span>
              <span><strong>{followers}</strong> followers</span>
              <span><strong>{following}</strong> following</span>
            </div>
            <div className="space-y-1">
              {profile.display_name && <div className="font-semibold">{profile.display_name}</div>}
              {profile.bio && <p className="text-sm whitespace-pre-wrap max-w-prose">{profile.bio}</p>}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noreferrer noopener" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-1 md:gap-3">
          {posts.map((p) => (
            <Link key={p.id} to="/p/$id" params={{ id: p.id }} className="relative aspect-square overflow-hidden rounded-xl group">
              <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            </Link>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
            {isMe ? "Share your first post to get started." : "No posts yet."}
          </div>
        )}
      </div>

      {isMe && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={profile}
          onSaved={async (updated) => {
            setProfile(updated);
            await refreshProfile();
            if (updated.username !== profile.username) {
              navigate({ to: "/u/$username", params: { username: updated.username } });
            }
          }}
        />
      )}
    </AppLayout>
  );
}

function EditProfileDialog({
  open, onOpenChange, profile, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; profile: Profile; onSaved: (p: Profile) => void;
}) {
  const { user } = useAuth();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUsername(profile.username);
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setWebsite(profile.website ?? "");
      setAvatarUrl(profile.avatar_url);
    }
  }, [open, profile]);

  const uploadAvatar = async (f: File) => {
    if (!user) return;
    if (!f.type.startsWith("image/")) { toast.error("Image only"); return; }
    if (f.size > 4 * 1024 * 1024) { toast.error("Max 4MB"); return; }
    setBusy(true);
    const ext = f.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, f, { upsert: true, contentType: f.type });
    if (error) { toast.error(error.message); setBusy(false); return; }
    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    setBusy(false);
  };

  const save = async () => {
    if (!user) return;
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { toast.error("Username: 3–20 letters/numbers/_"); return; }
    setBusy(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        username: u,
        display_name: displayName.trim() || null,
        bio: bio.trim().slice(0, 280) || null,
        website: website.trim() || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id,username,display_name,bio,avatar_url,website")
      .maybeSingle();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    onOpenChange(false);
    if (data) onSaved(data as Profile);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback>{username.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Camera className="h-4 w-4 mr-2" /> Change photo
            </Button>
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Display name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Website</label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gradient-brand text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
