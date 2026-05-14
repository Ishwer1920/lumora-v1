import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) navigate({ to: "/" }); }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Enter email and password"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!remember) {
      // session is local-storage by default; nothing extra to do for v1
    }
    toast.success("Welcome back");
    navigate({ to: "/" });
  };

  const reset = async () => {
    if (!email) { toast("Enter your email first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Reset link sent if the email exists");
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <form onSubmit={submit} className="glass-strong rounded-3xl p-8 w-full max-w-md space-y-5 shadow-glass">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl gradient-brand grid place-items-center">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">Welcome to Lumora</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} /> Remember me
          </label>
          <button type="button" onClick={reset} className="text-sm text-primary hover:underline">Forgot?</button>
        </div>
        <Button type="submit" disabled={busy} className="w-full h-11 rounded-2xl gradient-brand text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          New here? <Link to="/register" className="text-primary font-medium hover:underline">Create account</Link>
        </p>
      </form>
    </div>
  );
}
