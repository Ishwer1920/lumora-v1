import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ImagePlus, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CreatePostDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);

  const reset = () => {
    setFile(null); setPreview(null); setCaption(""); setLocation("");
    setProgress(0); setBusy(false);
  };

  const pickFile = (f: File) => {
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user || !file) return;
    try {
      setBusy(true); setProgress(10);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      setProgress(30);
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, file, { cacheControl: "3600", contentType: file.type });
      if (upErr) throw upErr;
      setProgress(75);
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      const { error: insErr } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: pub.publicUrl,
        caption: caption.trim() || null,
        location: location.trim() || null,
      });
      if (insErr) throw insErr;
      setProgress(100);
      toast.success("Posted!");
      onOpenChange(false);
      onCreated?.();
      reset();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not post";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="text-lg">Create post</DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-4">
          {!preview ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault(); setDrag(false);
                const f = e.dataTransfer.files?.[0]; if (f) pickFile(f);
              }}
              className={`w-full aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 tap transition-colors ${
                drag ? "border-primary bg-accent" : "border-border hover:bg-muted"
              }`}
            >
              <ImagePlus className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click or drop an image</span>
              <span className="text-xs text-muted-foreground">PNG, JPG, WebP · up to 10MB</span>
            </button>
          ) : (
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-muted">
              <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-2 right-2 text-xs px-3 py-1.5 rounded-full glass-strong"
              >
                Change
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
          />

          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
            placeholder="Write a caption… use #hashtags"
            rows={3}
          />
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value.slice(0, 80))}
              placeholder="Add location"
              className="pl-9"
            />
          </div>

          {busy && <Progress value={progress} />}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={!file || busy} className="gradient-brand text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
