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
  deleteCustomTheme: (themeName: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Built-in theme definitions
 */
const BUILT_IN_THEMES: Record<string, Theme> = {
  "dark-minimalist": {
    name: "dark-minimalist",
    description: "Dark minimalist design",
    colors: {
      primary: "#1e1e1e",
      secondary: "#2d2d2d",
      accent: "#00d4ff",
      background: "#0a0a0a",
      text: "#ffffff",
      chart_line: "#00d4ff",
      chart_area: "rgba(0, 212, 255, 0.1)",
    },
    fontScale: 1,
    cornerRadius: "4px",
  },
  "glass-morphism": {
    name: "glass-morphism",
    description: "Modern glass morphism design",
    colors: {
      primary: "rgba(255, 255, 255, 0.1)",
      secondary: "rgba(255, 255, 255, 0.2)",
      accent: "#64b5f6",
      background: "rgba(30, 30, 30, 0.8)",
      text: "#ffffff",
      chart_line: "#64b5f6",
      chart_area: "rgba(100, 181, 246, 0.2)",
    },
    fontScale: 1,
    cornerRadius: "20px",
  },
  "scientific-dashboard": {
    name: "scientific-dashboard",
    description: "Scientific instrument dashboard",
    colors: {
      primary: "#001a33",
      secondary: "#003366",
      accent: "#00ff99",
      background: "#000d1a",
      text: "#00ff99",
      chart_line: "#00ff99",
      chart_area: "rgba(0, 255, 153, 0.15)",
    },
    fontScale: 0.95,
    cornerRadius: "0px",
  },
  "weather-realistic": {
    name: "weather-realistic",
    description: "Realistic weather app design",
    colors: {
      primary: "#1976d2",
      secondary: "#1565c0",
      accent: "#ffd54f",
      background: "#0d47a1",
      text: "#ffffff",
      chart_line: "#ffd54f",
      chart_area: "rgba(255, 213, 79, 0.2)",
    },
    fontScale: 1,
    cornerRadius: "8px",
  },
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

        // Get built-in themes
        const builtIn = await apiClient.getBuiltInThemes();
        
        // Get custom themes
        const custom = await apiClient.listThemes();
        
        const allThemes = [...builtIn, ...custom];
        setThemes(allThemes);

        // Load current theme from localStorage or use default
        const savedThemeName = localStorage.getItem("theme") || "dark-minimalist";
        const theme = allThemes.find((t) => t.name === savedThemeName) || allThemes[0];
        if (theme) {
          setCurrentTheme(theme);
          applyTheme(theme);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load themes");
        // Fall back to default theme
        const defaultTheme = BUILT_IN_THEMES["dark-minimalist"];
        setCurrentTheme(defaultTheme);
        applyTheme(defaultTheme);
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
      const created = await apiClient.createTheme(theme);
      setThemes((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create theme");
      throw err;
    }
  }, []);

  const deleteCustomTheme = useCallback(async (themeName: string) => {
    try {
      setError(null);
      await apiClient.deleteTheme(themeName);
      setThemes((prev) => prev.filter((t) => t.name !== themeName));
      if (currentTheme?.name === themeName) {
        switchTheme("dark-minimalist");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete theme");
      throw err;
    }
  }, [currentTheme, switchTheme]);

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
  const colors = theme.colors;

  // Set CSS custom properties
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key.replace(/_/g, "-")}`, value);
  });

  root.style.setProperty("--font-scale", String(theme.fontScale));
  root.style.setProperty("--corner-radius", theme.cornerRadius);
}
