/**
 * Data export component
 */

import React, { useState } from "react";
import { useDataExport } from "../hooks/useAdvanced";
import "./DataExportModal.css";

interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DataExportModal({ isOpen, onClose }: DataExportModalProps) {
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const { exportToJSON, exportToCSV, exporting, error } = useDataExport();
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setMessage(null);

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        setMessage("❌ Start date must be before end date");
        return;
      }

      if (exportFormat === "json") {
        await exportToJSON(start, end);
      } else {
        await exportToCSV(start, end);
      }

      setMessage("✓ Export completed successfully!");
      setTimeout(() => {
        setMessage(null);
        onClose();
      }, 2000);
    } catch (err) {
      setMessage(err instanceof Error ? `❌ ${err.message}` : "❌ Export failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Export Weather Data</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          {message && <div className={`message ${message.startsWith("✓") ? "success" : "error"}`}>{message}</div>}

          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={exporting}
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={exporting}
            />
          </div>

          <div className="form-group">
            <label>Export Format</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="json"
                  checked={exportFormat === "json"}
                  onChange={(e) => setExportFormat(e.target.value as "json" | "csv")}
                  disabled={exporting}
                />
                JSON (Complete data structure)
              </label>
              <label>
                <input
                  type="radio"
                  value="csv"
                  checked={exportFormat === "csv"}
                  onChange={(e) => setExportFormat(e.target.value as "json" | "csv")}
                  disabled={exporting}
                />
                CSV (Spreadsheet compatible)
              </label>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="info-box">
            <p>
              <strong>Exported metrics:</strong> Temperature, Humidity, Pressure, Wind Speed, Rainfall, Solar Radiation
            </p>
            <p>Data will be aggregated hourly from your selected date range.</p>
          </div>
        </div>

        <footer className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button className="export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : `Export as ${exportFormat.toUpperCase()}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
