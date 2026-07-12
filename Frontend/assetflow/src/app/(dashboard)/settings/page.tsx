"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Lock, User, Mail, Building2, Shield } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { authApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, boolean>>({});

  const handleSignOut = () => {
    logout();
    router.push("/login");
    toast("Signed out successfully");
  };

  async function handleChangePassword() {
    const errors: Record<string, boolean> = {};
    if (!currentPassword) errors.current = true;
    if (!newPassword) errors.new = true;
    else if (newPassword.length < 8) errors.newLength = true;
    if (!confirmPassword) errors.confirm = true;
    else if (newPassword !== confirmPassword) errors.mismatch = true;
    setPwErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.mismatch) toast.error("Passwords do not match");
      else if (errors.newLength) toast.error("New password must be at least 8 characters");
      else toast.error("Fill all required fields");
      return;
    }

    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwErrors({});
    } catch (e: any) {
      toast.error(e.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">View your account details and manage your password</p>
      </div>

      {/* Profile Info */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Account Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><User className="size-3" />Name</Label>
            <div className="bg-muted/50 rounded-lg px-3 py-2.5 text-sm font-medium">{user?.name ?? "—"}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="size-3" />Email</Label>
            <div className="bg-muted/50 rounded-lg px-3 py-2.5 text-sm font-medium">{user?.email ?? "—"}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="size-3" />Role</Label>
            <div className="flex items-center">
              <Badge variant="secondary" className="text-xs">{user?.role?.replace(/_/g, " ") ?? "—"}</Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="size-3" />Department</Label>
            <div className="flex items-center">
              <Badge variant="outline" className="text-xs">{user?.department?.name ?? "Not assigned"}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <p className="text-sm text-muted-foreground">Update your password. Other active sessions will be revoked.</p>
        <div className="grid gap-4 max-w-sm">
          <div className="grid gap-1.5">
            <Label>Current Password <span className="text-destructive">*</span></Label>
            <Input
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setPwErrors({}); }}
              className={cn(pwErrors.current && "border-destructive")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>New Password <span className="text-destructive">*</span></Label>
            <Input
              type="password"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPwErrors({}); }}
              className={cn((pwErrors.new || pwErrors.newLength) && "border-destructive")}
            />
            {pwErrors.newLength && <p className="text-xs text-destructive">Minimum 8 characters</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Confirm New Password <span className="text-destructive">*</span></Label>
            <Input
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwErrors({}); }}
              className={cn((pwErrors.confirm || pwErrors.mismatch) && "border-destructive")}
            />
            {pwErrors.mismatch && <p className="text-xs text-destructive">Passwords do not match</p>}
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="px-4 py-2 rounded-lg w-fit"
          >
            {changingPassword && <Loader2 className="size-4 animate-spin mr-2" />}
            <Lock className="size-4 mr-2" />
            Change Password
          </Button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-destructive">Sign Out</h2>
            <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
          </div>
          <Button variant="destructive" onClick={handleSignOut} className="px-4 py-2 rounded-lg">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
