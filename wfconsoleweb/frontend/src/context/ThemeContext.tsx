/**
 * React Context for theme management
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Theme } from "../types";
import { apiClient } from "../services/api";

export interface ThemeContextType {
  currentTheme: Theme | null;
  themes: Theme[];
  loading: boolean;
  error: string | null;
  switchTheme: (themeName: string) => void;
  createCustomTheme: (theme: Partial<Theme>) => Promise<void>;
  deleteCustomTheme: (themeId: number) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const FALLBACK_THEME: Theme = {
  id: 0,
  name: "Dark Minimalist",
  is_builtin: true,
  is_enabled: true,
  config: {
    name: "Dark Minimalist",
    colors: {
      primary: "#1e293b",
      secondary: "#64748b",
      accent: "#0ea5e9",
      background: "#0f172a",
      surface: "#1e293b",
      text: "#f1f5f9",
      text_secondary: "#cbd5e1",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    fonts: {
      family: "'Inter', 'Segoe UI', sans-serif",
      sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24 },
      weights: { light: 300, normal: 400, semibold: 600, bold: 700 },
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borders: { radius: 8, width: 1, style: "solid" },
    shadows: {
      sm: "0 1px 2px 0 rgba(0,0,0,0.05)",
      md: "0 4px 6px -1px rgba(0,0,0,0.1)",
      lg: "0 10px 15px -3px rgba(0,0,0,0.1)",
    },
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

/**
 * Provider component for theme state
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load themes on mount
  useEffect(() => {
    const loadThemes = async () => {
      try {
        setLoading(true);
        setError(null);

        // /themes/list already includes built-in + custom themes.
        const listed = await apiClient.listThemes();
        const allThemes = listed.length > 0 ? listed : await apiClient.getBuiltInThemes();
        setThemes(allThemes);

        // Load current theme from localStorage or use first available.
        const savedThemeName = (localStorage.getItem("theme") || "").toLowerCase();
        const theme = allThemes.find((t) => t.name.toLowerCase() === savedThemeName) || allThemes[0];
        if (theme) {
          setCurrentTheme(theme);
          applyTheme(theme);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load themes");
        // Fall back to built-in defaults so UI stays usable.
        setThemes([FALLBACK_THEME]);
        setCurrentTheme(FALLBACK_THEME);
        applyTheme(FALLBACK_THEME);
      } finally {
        setLoading(false);
      }
    };

    loadThemes();
  }, []);

  const switchTheme = useCallback((themeName: string) => {
    const theme = themes.find((t) => t.name === themeName);
    if (theme) {
      setCurrentTheme(theme);
      localStorage.setItem("theme", themeName);
      applyTheme(theme);
    }
  }, [themes]);

  const createCustomTheme = useCallback(async (theme: Partial<Theme>) => {
    try {
      setError(null);
      const created = await apiClient.createTheme(
        theme.name || "Custom Theme",
        (theme.config as unknown as Record<string, unknown>) || (FALLBACK_THEME.config as unknown as Record<string, unknown>)
      );
      setThemes((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create theme");
      throw err;
    }
  }, []);

  const deleteCustomTheme = useCallback(async (themeId: number) => {
    try {
      setError(null);
      await apiClient.deleteTheme(themeId);
      const deletedTheme = themes.find((t) => t.id === themeId);
      setThemes((prev) => prev.filter((t) => t.id !== themeId));
      if (deletedTheme && currentTheme?.id === deletedTheme.id) {
        switchTheme(FALLBACK_THEME.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete theme");
      throw err;
    }
  }, [currentTheme, switchTheme, themes]);

  const value: ThemeContextType = {
    currentTheme,
    themes,
    loading,
    error,
    switchTheme,
    createCustomTheme,
    deleteCustomTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to use theme context
 */
export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return context;
}

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const colors = theme.config?.colors;

  if (!colors) {
    return;
  }

  // Set CSS custom properties
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key.replace(/_/g, "-")}`, value);
  });

  root.style.setProperty("--font-scale", "1");
  root.style.setProperty("--corner-radius", `${theme.config?.borders?.radius ?? 8}px`);
}
