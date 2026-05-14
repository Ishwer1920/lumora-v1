import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) navigate({ to: "/" }); }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { toast.error("Username: 3–20 letters, numbers, underscore"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 chars"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: u, display_name: u },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <form onSubmit={submit} className="glass-strong rounded-3xl p-8 w-full max-w-md space-y-5 shadow-glass">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl gradient-brand grid place-items-center">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">Join Lumora</h1>
          <p className="text-sm text-muted-foreground">Create your account in seconds</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <Button type="submit" disabled={busy} className="w-full h-11 rounded-2xl gradient-brand text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
