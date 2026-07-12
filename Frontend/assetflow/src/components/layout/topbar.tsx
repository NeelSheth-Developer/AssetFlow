"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useNotificationStore } from "@/stores/notification-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotificationStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const currentPage =
    NAV_ITEMS.find((item) => pathname.startsWith(item.href))
      ?.label ?? "Dashboard";

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = () => {
    logout();
    router.push("/login");
    toast("Signed out successfully");
  };

  const latestNotifications = notifications.slice(0, 5);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-14 flex items-center justify-between px-6 transition-all duration-200",
        scrolled && "glass-medium border-b border-border/30"
      )}
    >
      {/* Left — Breadcrumb + platform tagline */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">AssetFlow</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-medium">{currentPage}</span>
        </div>
        <span className="hidden md:inline text-[11px] text-muted-foreground/60 italic">
          — Enterprise Asset & Resource Management
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={(e) => { e.preventDefault(); markAllAsRead(); toast("All marked as read"); }}
                  className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {latestNotifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              latestNotifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className="flex items-start gap-3 px-3 py-2.5 cursor-pointer"
                >
                  <div className="mt-1.5 shrink-0">
                    {!notification.read ? (
                      <span className="block h-2 w-2 rounded-full bg-primary" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", !notification.read && "font-medium")}>{notification.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{notification.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {(() => { try { const d = new Date(notification.createdAt); if (isNaN(d.getTime())) return ""; return formatDistanceToNow(d, { addSuffix: true }); } catch { return ""; } })()}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <Link href="/activity" className="flex w-full items-center justify-center py-1 text-sm text-primary font-medium">View all</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
            {initials}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
