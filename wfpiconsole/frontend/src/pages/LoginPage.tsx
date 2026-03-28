/**
 * Login page component
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated, error: authError } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    try {
      setIsLoading(true);
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <h1>Weather Dashboard</h1>
          <p className="subtitle">WFConsoleWeb</p>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                <p>⚠ {error}</p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="login-info">
            <p>Default credentials are set during installation.</p>
            <p>Contact your system administrator for access.</p>
          </div>
        </div>

        <div className="login-footer">
          <p>
            WFConsoleWeb • Built with
            <span className="heart"> ❤ </span>
            • <a href="https://ko-fi.com" target="_blank" rel="noopener noreferrer">Support on Ko-fi</a>
          </p>
        </div>
      </div>
    </div>
  );
}
