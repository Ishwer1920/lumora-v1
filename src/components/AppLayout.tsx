import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Search, PlusSquare, Bell, User, Moon, Sun, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreatePostDialog } from "./CreatePostDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const NAV = [
  { to: "/", icon: Home, label: "Feed" },
  { to: "/explore", icon: Search, label: "Explore" },
  { to: "/notifications", icon: Bell, label: "Alerts", needsAuth: true },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [composeOpen, setComposeOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const handleCreate = () => {
    if (!user) { navigate({ to: "/login" }); return; }
    setComposeOpen(true);
  };

  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="min-h-screen w-full">
      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-40 glass-strong">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 tap">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg text-gradient">Lumora</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {user ? (
              <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sign out">
                <LogOut className="h-5 w-5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate({ to: "/login" })}>Login</Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex sticky top-0 h-screen w-64 lg:w-72 flex-col p-4 gap-2 border-r border-border/60">
          <Link to="/" className="flex items-center gap-2 px-3 py-3 tap">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold text-gradient">Lumora</span>
          </Link>
          <nav className="flex flex-col gap-1 mt-2">
            {NAV.map((n) => {
              const active = isActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative flex items-center gap-3 px-3 py-3 rounded-2xl tap transition-colors ${
                    active ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <n.icon className="h-5 w-5" />
                  <span className="text-base">{n.label}</span>
                  {n.to === "/notifications" && unread > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center text-xs font-bold text-primary-foreground gradient-brand rounded-full min-w-5 h-5 px-1.5">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              onClick={handleCreate}
              className="flex items-center gap-3 px-3 py-3 rounded-2xl tap transition-colors hover:bg-muted text-left"
            >
              <PlusSquare className="h-5 w-5" />
              <span className="text-base">Create</span>
            </button>
            {profile && (
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl tap transition-colors ${
                  path.startsWith("/u/") ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted"
                }`}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback>{profile.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-base truncate">Profile</span>
              </Link>
            )}
          </nav>

          <div className="mt-auto flex flex-col gap-2">
            <Button variant="ghost" className="justify-start gap-3 h-11 rounded-2xl" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </Button>
            {user ? (
              <Button variant="ghost" className="justify-start gap-3 h-11 rounded-2xl" onClick={() => signOut()}>
                <LogOut className="h-5 w-5" /> Sign out
              </Button>
            ) : (
              <Button className="gradient-brand text-primary-foreground h-11 rounded-2xl" onClick={() => navigate({ to: "/login" })}>
                Sign in
              </Button>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
          {NAV.slice(0, 2).map((n) => {
            const active = isActive(n.to);
            return (
              <Link key={n.to} to={n.to} className="flex items-center justify-center tap relative">
                <n.icon className={`h-6 w-6 ${active ? "text-primary" : "text-muted-foreground"}`} />
                {active && <motion.span layoutId="bn" className="absolute top-1 h-1 w-8 rounded-full gradient-brand" />}
              </Link>
            );
          })}
          <button onClick={handleCreate} className="flex items-center justify-center tap">
            <span className="h-11 w-11 rounded-2xl gradient-brand grid place-items-center shadow-glass">
              <PlusSquare className="h-6 w-6 text-primary-foreground" />
            </span>
          </button>
          <Link to="/notifications" className="flex items-center justify-center tap relative">
            <Bell className={`h-6 w-6 ${isActive("/notifications") ? "text-primary" : "text-muted-foreground"}`} />
            {unread > 0 && (
              <span className="absolute top-2 right-1/2 translate-x-5 inline-flex items-center justify-center text-[10px] font-bold text-primary-foreground gradient-brand rounded-full min-w-4 h-4 px-1">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link
            to={profile ? "/u/$username" : "/login"}
            params={profile ? { username: profile.username } : (undefined as never)}
            className="flex items-center justify-center tap"
          >
            {profile ? (
              <Avatar className="h-7 w-7 ring-2 ring-border">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback>{profile.username.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-6 w-6 text-muted-foreground" />
            )}
          </Link>
        </div>
      </nav>

      <CreatePostDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}
