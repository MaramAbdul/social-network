import "./globals.css";
import Header from "../components/Header";
import PresenceProvider from "../components/PresenceProvider";

export const metadata = { title: "SocialNet" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 text-slate-800 antialiased selection:bg-blue-200/50">
        {/* Decorative background */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.1) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-l from-blue-200/20 to-transparent rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-indigo-200/20 to-transparent rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        </div>

        <PresenceProvider>
          <Header />

          <main className="container relative py-8 space-y-8 max-w-4xl">
            <div className="space-y-6">{children}</div>
          </main>
        </PresenceProvider>

        <footer className="relative mt-16 border-t border-slate-200/60 bg-white/40 backdrop-blur-sm">
          <div className="container py-8">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-slate-600">
                <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Built with passion</span>
                <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse" />
              </div>
              <div className="text-xs text-slate-500 space-x-2">
                {/* Avoid hydration mismatch by rendering year on client, or keep static if you prefer */}
                <ClientYear /> <span>•</span>{" "}
                <span>Powered by Next.js + Go</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

// Small client component for dynamic year to avoid SSR/CSR mismatch
function ClientYear() {
  return (
    <span suppressHydrationWarning>© {new Date().getFullYear()} SocialNet</span>
  );
}
