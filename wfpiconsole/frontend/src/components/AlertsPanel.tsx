/**
 * Weather alerts panel
 */

import { useState, useEffect } from "react";
import { apiClient } from "../services/api";
import "./AlertsPanel.css";

interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: "low" | "moderate" | "high" | "critical";
  createdAt: number;
  expiresAt: number;
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getActiveAlerts();

        const rawAlerts = Array.isArray(response.active_alerts)
          ? response.active_alerts
          : [];

        const normalizedAlerts: WeatherAlert[] = rawAlerts.map((alert, index) => {
          const severityText = String(alert.severity ?? "moderate").toLowerCase();
          const severity =
            severityText === "minor" || severityText === "low"
              ? "low"
              : severityText === "moderate"
                ? "moderate"
                : severityText === "severe" || severityText === "high"
                  ? "high"
                  : "critical";

          const triggeredAt = Date.parse(String(alert.triggered_at ?? alert.triggeredAt ?? ""));
          const expiresAt = Date.parse(String(alert.expires_at ?? alert.cooldown_until ?? alert.expiresAt ?? ""));

          return {
            id: String(alert.alert_id ?? alert.id ?? `alert-${index}`),
            title: String(alert.name ?? alert.title ?? "Weather Alert"),
            description: String(alert.description ?? "Active weather alert in your area."),
            severity,
            createdAt: Number.isFinite(triggeredAt) ? Math.floor(triggeredAt / 1000) : Math.floor(Date.now() / 1000),
            expiresAt: Number.isFinite(expiresAt) ? Math.floor(expiresAt / 1000) : Math.floor(Date.now() / 1000) + 3600,
          };
        });

        setAlerts(normalizedAlerts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load alerts");
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="alerts-panel">
        <h3>Active Alerts</h3>
        <div className="alerts-loading">Loading alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alerts-panel">
        <h3>Active Alerts</h3>
        <div className="alerts-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="alerts-panel">
      <h3>Active Alerts {alerts.length > 0 && `(${alerts.length})`}</h3>
      
      {alerts.length === 0 ? (
        <div className="no-alerts">
          <p>✓ No active weather alerts</p>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <Alert key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

interface AlertProps {
  alert: WeatherAlert;
}

function Alert({ alert }: AlertProps) {
  const isExpired = Date.now() / 1000 > alert.expiresAt;
  const timeRemaining = Math.max(0, alert.expiresAt - Date.now() / 1000);
  const hoursRemaining = Math.floor(timeRemaining / 3600);
  const minutesRemaining = Math.floor((timeRemaining % 3600) / 60);

  return (
    <div className={`alert alert-${alert.severity} ${isExpired ? "expired" : ""}`}>
      <div className="alert-header">
        <h4>{alert.title}</h4>
        <span className={`severity-badge badge-${alert.severity}`}>
          {alert.severity.toUpperCase()}
        </span>
      </div>
      
      <p className="alert-description">{alert.description}</p>
      
      {!isExpired && (
        <p className="alert-expiry">
          Expires in {hoursRemaining}h {minutesRemaining}m
        </p>
      )}
    </div>
  );
}
