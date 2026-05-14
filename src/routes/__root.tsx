import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
  useRouter,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="glass rounded-3xl p-8 text-center max-w-md">
        <h1 className="text-6xl font-bold text-gradient">404</h1>
        <p className="mt-2 text-muted-foreground">This page doesn't exist.</p>
        <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-full gradient-brand text-primary-foreground font-medium">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="glass rounded-3xl p-8 text-center max-w-md">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="px-4 py-2 rounded-full gradient-brand text-primary-foreground"
          >
            Try again
          </button>
          <Link to="/" className="px-4 py-2 rounded-full glass">Home</Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Lumora — share your light" },
      { name: "description", content: "Lumora is a modern social platform for sharing photos, moments, and conversations." },
      { name: "theme-color", content: "#ec4899" },
      { property: "og:title", content: "Lumora — share your light" },
      { property: "og:description", content: "Lumora is a modern social platform for sharing photos, moments, and conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Lumora — share your light" },
      { name: "twitter:description", content: "Lumora is a modern social platform for sharing photos, moments, and conversations." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a67cf258-ba16-418d-8704-7209437170c3" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a67cf258-ba16-418d-8704-7209437170c3" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
