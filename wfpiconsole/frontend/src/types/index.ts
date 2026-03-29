/**
 * Frontend TypeScript types matching backend API responses
 */

export interface Observation {
  timestamp: string;
  packet_type?: string | null;
  device_id: string | null;
  temp_c: number | null;
  humidity: number | null;
  pressure_mb: number | null;
  wind_speed_mps: number | null;
  wind_gust_mps: number | null;
  wind_direction_deg: number | null;
  rainfall_mm: number | null;
  solar_radiation_wm2: number | null;
  uv_index: number | null;
  lightning_strike_count: number | null;
  lightning_strike_last_distance_km: number | null;
  battery_voltage: number | null;
  signal_strength: number | null;
}

export interface CurrentConditions {
  temperature_c: number | null;
  temperature_f: number | null;
  feels_like_c: number | null;
  feels_like_f: number | null;
  humidity: number | null;
  pressure_mb: number | null;
  wind_speed_mps: number | null;
  wind_speed_mph: number | null;
  wind_gust_mps: number | null;
  wind_gust_mph: number | null;
  wind_direction_deg: number | null;
  wind_direction_cardinal: string;
  rainfall_mm: number | null;
  rainfall_in: number | null;
  solar_radiation_wm2: number | null;
  uv_index: number | null;
  uv_risk_level: string;
  lightning_distance_km: number | null;
  battery_status: string;
  signal_strength: number | null;
  observation_timestamp: string;
}

export interface StationInfo {
  station_id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  device_id: string | null;
  hub_sn: string | null;
  connection_type: string;
}

export interface Theme {
  id: number;
  name: string;
  is_builtin: boolean;
  is_enabled: boolean;
  config: ThemeConfig;
  created_at: string;
  updated_at: string;
}

export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    text_secondary: string;
    success: string;
    warning: string;
    error: string;
  };
  fonts: {
    family: string;
    sizes: Record<string, number>;
    weights: Record<string, number>;
  };
  spacing: Record<string, number>;
  borders: {
    radius: number;
    width: number;
    style: string;
  };
  shadows: Record<string, string>;
}

export interface DisplaySettings {
  temperature_unit: "C" | "F";
  wind_speed_unit: "m/s" | "mph" | "kph" | "knots";
  pressure_unit: "mb" | "inHg" | "hPa";
  current_theme: string;
  panels_per_row: number;
  feels_like_threshold_cold_c: number;
  feels_like_threshold_hot_c: number;
  data_granularity: "1min" | "5min" | "hourly";
  language: string;
}

export interface TimeSeriesData {
  metric: string;
  unit: string;
  data_points: DataPoint[];
  data_granularity: string;
  min_value: number | null;
  max_value: number | null;
  avg_value: number | null;
}

export interface DataPoint {
  timestamp: string;
  value: number | null;
}

export interface WeatherAlert {
  alert_id: string;
  name: string;
  triggered_at: string;
  cooldown_until: string;
}

export interface SystemStatus {
  platform: string;
  python_version: string;
  app_version: string;
  uptime_seconds: number;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "offline";
  database_ok: boolean;
  websocket_ok: boolean;
  timestamp: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthUser {
  username: string;
  created_at: string;
}

export interface WxSummary {
  today: {
    temp_min_c: number | null;
    temp_max_c: number | null;
    rain_mm: number;
    avg_wind_mps: number | null;
    max_gust_mps: number | null;
  };
  yesterday: {
    rain_mm: number;
  };
  month: {
    rain_mm: number;
  };
  year: {
    rain_mm: number;
  };
  current: {
    dew_point_c: number | null;
    rain_rate_mm_per_hour: number | null;
    temp_diff_24h_c: number | null;
    temp_trend_c: number | null;
  };
}
