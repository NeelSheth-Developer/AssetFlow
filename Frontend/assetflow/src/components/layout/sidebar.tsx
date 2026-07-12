"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Package,
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  Calendar,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Activity,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Package,
  ArrowLeftRight,
  Calendar,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Activity,
};

const MAIN_ITEMS = NAV_ITEMS.slice(0, 3);
const MANAGEMENT_ITEMS = NAV_ITEMS.slice(3);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleSignOut = () => {
    logout();
    router.push("/login");
    toast("Signed out successfully");
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-[260px] glass-medium flex flex-col">
      {/* Logo - clickable */}
      <Link href="/" className="flex h-16 items-center gap-2 border-b border-border/30 px-5 cursor-pointer hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
        <Package className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">AssetFlow</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* MAIN group */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">
            Main
          </p>
          {MAIN_ITEMS.map((item) => {
            const Icon = iconMap[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-white/20 dark:hover:bg-white/5 hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                )}
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* MANAGEMENT group */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">
            Management
          </p>
          {MANAGEMENT_ITEMS.map((item) => {
            const Icon = iconMap[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-white/20 dark:hover:bg-white/5 hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                )}
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Sign Out button */}
      <div className="px-3 pb-2">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* User card with dropdown */}
      <div className="border-t border-border/30 px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-1 hover:bg-white/20 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {user?.role?.replace("_", " ")}
              </Badge>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
