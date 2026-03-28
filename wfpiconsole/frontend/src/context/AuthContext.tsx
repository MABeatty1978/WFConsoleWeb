/**
 * React Context for authentication state
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { apiClient } from "../services/api";

export interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider component for authentication state
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        setError(null);
        const user = await apiClient.getCurrentUser();
        setUsername(user.username);
        setIsAdmin(user.role === "admin");
        setIsAuthenticated(true);
      } catch (err) {
        setIsAuthenticated(false);
        setUsername(null);
        setIsAdmin(false);
        // Not an error if not authenticated - just means need to log in
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.login(username, password);
      // Token is stored by apiClient
      setUsername(username);
      setIsAuthenticated(true);
      // Try to get user role
      try {
        const user = await apiClient.getCurrentUser();
        setIsAdmin(user.role === "admin");
      } catch {
        setIsAdmin(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.logout();
      setIsAuthenticated(false);
      setUsername(null);
      setIsAdmin(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    username,
    loading,
    error,
    login,
    logout,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use authentication context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
