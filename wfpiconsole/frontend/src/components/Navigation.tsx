/**
 * Navigation component
 */

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navigation.css";

export default function Navigation() {
  const { username, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <span className="logo-icon">🌤️</span>
          <span className="logo-text">Weather Dashboard</span>
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

          <li>
            <Link
              to="/settings"
              className={`nav-link ${isActive("/settings") ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Settings
            </Link>
          </li>

          <li className="nav-separator"></li>

          <li className="nav-user">
            <span className="username">{username}</span>
          </li>

          <li>
            <button className="logout-link" onClick={handleLogout}>
              Logout
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
