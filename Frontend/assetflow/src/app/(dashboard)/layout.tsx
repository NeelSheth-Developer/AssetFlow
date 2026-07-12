"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { useNotificationStore } from "@/stores/notification-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const loading = useAuthStore((s) => s.loading);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const [checked, setChecked] = useState(false);

  // On mount, try to rehydrate session from cookies (GET /auth/me)
  useEffect(() => {
    fetchMe().finally(() => setChecked(true));
  }, [fetchMe]);

  // Fetch notifications once authenticated
  useEffect(() => {
    if (checked && isAuthenticated) {
      fetchNotifications();
    }
  }, [checked, isAuthenticated, fetchNotifications]);

  // Once checked, redirect if not authenticated
  useEffect(() => {
    if (checked && !isAuthenticated) {
      router.push("/login");
    }
  }, [checked, isAuthenticated, router]);

  // Show nothing while checking auth
  if (!checked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main
        className={`min-h-screen transition-all duration-200 bg-gradient-to-br from-slate-50/80 via-sky-50/30 to-indigo-50/20 ${
          sidebarCollapsed ? "lg:ml-[64px]" : "lg:ml-[260px]"
        }`}
      >
        <Topbar />
        <div className="p-6">{children}</div>
      </main>
    </>
  );
}