/**
 * Navigation component
 */

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../services/api";
import { wsService } from "../services/websocket";
import DataExportModal from "./DataExportModal";
import "./Navigation.css";

const HOVER_TRIGGER_HEIGHT = 100;
const MOBILE_BREAKPOINT = 768;
const INACTIVITY_TIMEOUT_MS = 5000;

export default function Navigation() {
  const { username, logout, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const inactivityTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const isMenuVisibleRef = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connected, setConnected] = useState(() => wsService.isConnected());
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState("Weather");
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT);

  useEffect(() => {
    isMenuVisibleRef.current = isMenuVisible;
  }, [isMenuVisible]);

  useEffect(() => {
    const navOffset = isMobile || isMenuVisible ? "60px" : "0px";
    document.documentElement.style.setProperty("--nav-offset", navOffset);

    return () => {
      document.documentElement.style.setProperty("--nav-offset", "60px");
    };
  }, [isMobile, isMenuVisible]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile) {
        setIsMenuVisible(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsMenuVisible(true);
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      return;
    }

    setIsMenuVisible(false);

    const clearInactivityTimeout = () => {
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
    };

    const startInactivityTimeout = () => {
      clearInactivityTimeout();
      inactivityTimeoutRef.current = window.setTimeout(() => {
        setIsMenuVisible(false);
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientY <= HOVER_TRIGGER_HEIGHT) {
        setIsMenuVisible(true);
        startInactivityTimeout();
        return;
      }

      if (isMenuVisibleRef.current) {
        startInactivityTimeout();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (navRef.current && navRef.current.contains(event.target as Node)) {
        setIsMenuVisible(true);
        clearInactivityTimeout();
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (navRef.current && !navRef.current.contains(event.relatedTarget as Node | null)) {
        startInactivityTimeout();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      clearInactivityTimeout();
    };
  }, [isMobile]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setConnected(wsService.isConnected());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const loadStationName = async () => {
      try {
        const station = await apiClient.getStationInfo();
        if (!active) return;
        const name = station?.name?.trim();
        if (name) {
          setDashboardName(name);
        }
      } catch {
        // Keep fallback label when station config is unavailable.
      }
    };

    loadStationName();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;
  const navClassName = isMobile || isMenuVisible ? "navigation" : "navigation hidden";

  return (
    <nav ref={navRef} className={navClassName}>
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <span className="logo-icon">🌤️</span>
          <span className="logo-text">{dashboardName} Dashboard</span>
        </Link>

        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          ☰
        </button>

        <ul className={`nav-menu ${mobileMenuOpen ? "open" : ""}`}>
          <li>
            <Link
              to="/"
              className={`nav-link ${isActive("/") ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
          </li>

          <li>
            <Link
              to="/analytics"
              className={`nav-link ${isActive("/analytics") ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Analytics
            </Link>
          </li>

          {isAdmin && (
            <li>
              <Link
                to="/settings"
                className={`nav-link ${isActive("/settings") ? "active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Settings
              </Link>
            </li>
          )}

          <li className="nav-separator"></li>

          <li>
            <span className={`nav-connection-status ${connected ? "connected" : "disconnected"}`}>
              {connected ? "● Connected" : "○ Disconnected"}
            </span>
          </li>

          <li>
            <button
              className="nav-export-btn"
              onClick={() => {
                setMobileMenuOpen(false);
                setExportModalOpen(true);
              }}
              title="Export weather data"
            >
              ⬇ Export
            </button>
          </li>

          <li>
            <a
              className="nav-support-link"
              href="https://ko-fi.com/michaelbeatty9142002"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              Support on Ko-fi ☕
            </a>
          </li>

          <li className="nav-separator"></li>

          {isAuthenticated ? (
            <>
              <li className="nav-user">
                <span className="username">{username}</span>
              </li>

              <li>
                <button className="logout-link" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            </>
          ) : (
            <li>
              <Link
                to="/login"
                className="nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin Login
              </Link>
            </li>
          )}
        </ul>
      </div>

      <DataExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />
    </nav>
  );
}
