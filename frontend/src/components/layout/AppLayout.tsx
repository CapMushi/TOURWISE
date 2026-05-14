import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ChatBot } from "@/components/ChatBot";
import { UsernameNudge } from "./UsernameNudge";
import { ThemeToggle } from "./ThemeToggle";

interface AppLayoutProps {
  children: ReactNode;
  userRole: "traveler" | "agent" | "admin";
}

export function AppLayout({ children, userRole }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar userRole={userRole} />
        <div className="flex-1 flex flex-col">
          <header className="h-16 flex items-center justify-between border-b border-border bg-glass/30 backdrop-blur-sm px-4 sm:px-6">
            <SidebarTrigger />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {userRole === "traveler" && <UsernameNudge />}
            {children}
          </main>
        </div>
        <ChatBot />
      </div>
    </SidebarProvider>
  );
}
