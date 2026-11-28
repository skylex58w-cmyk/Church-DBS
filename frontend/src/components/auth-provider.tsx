"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type AuthResponse = { token: string; tokenType: "Bearer"; expiresIn: string; refreshTokenExpiresIn: number };
type AuthContextValue = {
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const data = await apiRequest<AuthResponse>("/auth/refresh", { method: "POST" });
      setAccessToken(data.token);
    } catch {
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    accessToken,
    isLoading,
    isAuthenticated: Boolean(accessToken),
    login,
    logout,
  }), [accessToken, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
