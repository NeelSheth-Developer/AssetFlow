"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useTheme();

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);

  const handleSignOut = () => {
    logout();
    router.push("/login");
    toast("Signed out successfully");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account preferences
        </p>
      </div>

      {/* Profile Section */}
      <div className="glass-heavy rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <div className="glass-light rounded-lg px-3 py-2 text-sm">
              {user?.name ?? "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="glass-light rounded-lg px-3 py-2 text-sm">
              {user?.email ?? "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <div>
              <Badge variant="secondary" className="text-xs">
                {user?.role?.replace("_", " ") ?? "—"}
              </Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Department</Label>
            <div>
              <Badge variant="outline" className="text-xs">
                {user?.department?.name ?? user?.designation ?? "—"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="glass-heavy rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Choose your preferred theme
        </p>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl p-4 border transition-all cursor-pointer",
              theme === "light"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="h-5 w-5" />
            <span className="text-xs font-medium">Light</span>
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl p-4 border transition-all cursor-pointer",
              theme === "dark"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
            )}
          >
            <Moon className="h-5 w-5" />
            <span className="text-xs font-medium">Dark</span>
          </button>
          <button
            onClick={() => setTheme("system")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl p-4 border transition-all cursor-pointer",
              theme === "system"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
            )}
          >
            <Monitor className="h-5 w-5" />
            <span className="text-xs font-medium">System</span>
          </button>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="glass-heavy rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Receive email alerts for important updates
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={(checked) => {
                setEmailNotifications(checked);
                toast(checked ? "Email notifications enabled" : "Email notifications disabled");
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">In-App Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Show notifications within the app
              </p>
            </div>
            <Switch
              checked={inAppNotifications}
              onCheckedChange={(checked) => {
                setInAppNotifications(checked);
                toast(checked ? "In-app notifications enabled" : "In-app notifications disabled");
              }}
            />
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="glass-heavy rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-destructive">Sign Out</h2>
            <p className="text-sm text-muted-foreground">
              Sign out of your account on this device
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
