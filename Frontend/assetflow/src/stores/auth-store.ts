import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/types";
import { currentUser } from "@/data/mock";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (data: { name: string; email: string; password: string; department: string; designation: string }) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: currentUser, // Default to logged in for demo
      isAuthenticated: true,
      login: async () => {
        // Mock login - always succeeds for demo
        set({ user: currentUser, isAuthenticated: true });
        return true;
      },
      signup: async () => {
        set({ user: currentUser, isAuthenticated: true });
        return true;
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('assetflow-auth');
        }
      },
    }),
    { name: "assetflow-auth" }
  )
);
