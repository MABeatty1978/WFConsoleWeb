/**
 * Navigation component
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../services/api";
import { wsService } from "../services/websocket";
import DataExportModal from "./DataExportModal";
import "./Navigation.css";

export default function Navigation() {
  const { username, logout, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connected, setConnected] = useState(() => wsService.isConnected());
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState("Weather");

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

  return (
    <nav className="navigation">
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
