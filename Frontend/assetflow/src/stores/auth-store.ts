import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (data: { name: string; email: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      loading: false,

      login: async (email: string, password: string) => {
        const res = await authApi.login(email, password) as { success: boolean; data: { user: AuthUser } };
        if (res.success && res.data?.user) {
          set({ user: res.data.user, isAuthenticated: true });
          return true;
        }
        throw new Error("Login failed");
      },

      signup: async (data) => {
        const res = await authApi.signup(data) as { success: boolean; data: { user: AuthUser } };
        if (res.success && res.data?.user) {
          set({ user: res.data.user, isAuthenticated: true });
          return true;
        }
        throw new Error("Signup failed");
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore — clear local state regardless
        }
        set({ user: null, isAuthenticated: false });
        if (typeof window !== "undefined") {
          localStorage.removeItem("assetflow-auth");
        }
      },

      fetchMe: async () => {
        try {
          set({ loading: true });
          const res = await authApi.me() as { success: boolean; data: { user: AuthUser } };
          if (res.success && res.data?.user) {
            set({ user: res.data.user, isAuthenticated: true, loading: false });
            return;
          }
          set({ user: null, isAuthenticated: false, loading: false });
        } catch {
          set({ user: null, isAuthenticated: false, loading: false });
        }
      },
    }),
    { name: "assetflow-auth" }
  )
);
