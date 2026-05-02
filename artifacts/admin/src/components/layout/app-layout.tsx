import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Menu } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center h-12 px-4 border-b bg-card shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-sm">
              A
            </div>
            <span className="font-serif font-bold text-base tracking-tight">
              AURA
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
