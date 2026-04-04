/**
 * API client service for backend communication
 */

import {
  Observation,
  CurrentConditions,
  StationInfo,
  Theme,
  DisplaySettings,
  TimeSeriesData,
  LoginRequest,
  LoginResponse,
  AuthUser,
  HealthStatus,
  WxSummary,
  TempestForecastResponse,
} from "../types";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

class ApiClient {
  private token: string | null = null;
  private readonly deviceKeyStorageName = "wf_device_key";

  constructor() {
    // Load token from localStorage
    this.token = localStorage.getItem("auth_token");
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("auth_token", token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("auth_token");
  }

  private getHeaders(includeAuth = true): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "X-Device-Key": this.getOrCreateDeviceKey(),
    };

    if (includeAuth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private getOrCreateDeviceKey(): string {
    const existing = localStorage.getItem(this.deviceKeyStorageName);
    if (existing) {
      return existing;
    }

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `wf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(this.deviceKeyStorageName, generated);
    return generated;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    includeAuth = true
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: this.getHeaders(includeAuth),
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        throw new Error("Unauthorized - please log in again");
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>(
      "POST",
      "/auth/login",
      credentials,
      false
    );
    this.setToken(response.access_token);
    return response;
  }

  async getCurrentUser(): Promise<AuthUser> {
    return this.request<AuthUser>("GET", "/auth/me");
  }

  async logout(): Promise<void> {
    await this.request<void>("POST", "/auth/logout");
    this.clearToken();
  }

  async refreshToken(): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>("POST", "/auth/refresh");
    this.setToken(response.access_token);
    return response;
  }

  // Station endpoints
  async getStationInfo(): Promise<StationInfo | null> {
    return this.request<StationInfo | null>("GET", "/station/info");
  }

  async getLatestObservation(): Promise<Observation | null> {
    return this.request<Observation | null>("GET", "/station/latest-observation");
  }

  async getCurrentConditions(): Promise<CurrentConditions | null> {
    return this.request<CurrentConditions | null>("GET", "/station/current-conditions");
  }

  async getObservationStats(hours = 24): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "GET",
      `/station/observations/stats?hours=${hours}`
    );
  }

  async getWxSummary(): Promise<WxSummary> {
    return this.request<WxSummary>("GET", "/station/wx-summary", undefined, false);
  }

  // Configuration endpoints
  async getConfigStatus(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/config/status");
  }

  async getDisplaySettings(): Promise<DisplaySettings> {
    return this.request<DisplaySettings>("GET", "/config/display");
  }

  async updateDisplaySettings(settings: Partial<DisplaySettings>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "POST",
      "/config/display",
      settings
    );
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "POST",
      "/config/password",
      {
        current_password: currentPassword,
        new_password: newPassword,
      }
    );
  }

  async changeUsername(currentPassword: string, newUsername: string): Promise<Record<string, unknown>> {
    const response = await this.request<Record<string, unknown>>(
      "POST",
      "/config/username",
      {
        current_password: currentPassword,
        new_username: newUsername,
      }
    );

    const accessToken = response.access_token;
    if (typeof accessToken === "string" && accessToken) {
      this.setToken(accessToken);
    }

    return response;
  }

  async getStationConfig(): Promise<StationInfo> {
    return this.request<StationInfo>("GET", "/config/station");
  }

  async updateStationConfig(config: Partial<StationInfo>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "POST",
      "/config/station",
      config
    );
  }

  async listApiKeys(): Promise<{
    api_keys: Array<{
      service: string;
      is_configured: boolean;
      is_valid: boolean;
      last_verified: string | null;
    }>;
  }> {
    return this.request("GET", "/config/api-keys");
  }

  async configureApiKey(payload: {
    service: string;
    key: string;
    secret?: string | null;
  }): Promise<Record<string, unknown>> {
    return this.request("POST", "/config/api-keys", payload);
  }

  async deleteApiKey(service: string): Promise<Record<string, unknown>> {
    return this.request("DELETE", `/config/api-keys/${service}`);
  }

  // History endpoints
  async getTemperatureHistory(
    hours = 24,
    granularity: "1min" | "5min" | "hourly" | "daily" = "1min"
  ): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(
      "GET",
      `/history/data/temperature?hours=${hours}&granularity=${granularity}`
    );
  }

  async getHumidityHistory(
    hours = 24,
    granularity: "1min" | "5min" | "hourly" | "daily" = "1min"
  ): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(
      "GET",
      `/history/data/humidity?hours=${hours}&granularity=${granularity}`
    );
  }

  async getPressureHistory(
    hours = 24,
    granularity: "1min" | "5min" | "hourly" | "daily" = "1min"
  ): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(
      "GET",
      `/history/data/pressure?hours=${hours}&granularity=${granularity}`
    );
  }

  async getWindSpeedHistory(
    hours = 24,
    granularity: "1min" | "5min" | "hourly" | "daily" = "1min"
  ): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(
      "GET",
      `/history/data/wind-speed?hours=${hours}&granularity=${granularity}`
    );
  }

  async getRainfallHistory(
    hours = 24,
    granularity: "1min" | "5min" | "hourly" | "daily" = "1min"
  ): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(
      "GET",
      `/history/data/rainfall?hours=${hours}&granularity=${granularity}`
    );
  }

  async getSolarRadiationHistory(
    hours = 24,
    granularity: "1min" | "5min" | "hourly" | "daily" = "1min"
  ): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(
      "GET",
      `/history/data/solar-radiation?hours=${hours}&granularity=${granularity}`
    );
  }

  // Theme endpoints
  async listThemes(): Promise<Theme[]> {
    return this.request<Theme[]>("GET", "/themes/list");
  }

  async getBuiltInThemes(): Promise<Theme[]> {
    return this.request<Theme[]>("GET", "/themes/builtin");
  }

  async getTheme(themeId: string | number): Promise<Theme> {
    return this.request<Theme>("GET", `/themes/${themeId}`);
  }

  async createTheme(
    name: string,
    config: Record<string, unknown>
  ): Promise<Theme> {
    return this.request<Theme>("POST", "/themes/custom", { name, config });
  }

  async updateTheme(
    themeId: number,
    name: string,
    config: Record<string, unknown>
  ): Promise<Theme> {
    return this.request<Theme>(
      "PUT",
      `/themes/${themeId}`,
      { name, config }
    );
  }

  async deleteTheme(themeId: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "DELETE",
      `/themes/${themeId}`
    );
  }

  // System endpoints
  async getSystemInfo(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/system/info", undefined, false);
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return this.request<HealthStatus>("GET", "/system/health", undefined, false);
  }

  async getDiagnostics(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/system/diagnostics");
  }

  async getVersion(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/system/version", undefined, false);
  }

  async checkForUpdates(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/system/updates/check");
  }

  async installLatestUpdate(forceReinstall = false): Promise<Record<string, unknown>> {
    const suffix = forceReinstall ? "?force=true" : "";
    return this.request<Record<string, unknown>>("POST", `/system/updates/install${suffix}`);
  }

  async getServicesStatus(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/system/services-status");
  }

  async getActiveAlerts(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/system/alerts");
  }

  // Forecast endpoints
  async getSagerForecast(): Promise<any> {
    return this.request<any>("GET", "/forecast/sager", undefined, false);
  }

  async getTempestForecast(): Promise<TempestForecastResponse> {
    return this.request<TempestForecastResponse>("GET", "/forecast/tempest", undefined, false);
  }

  async getZambrettiForecast(): Promise<any> {
    return this.request<any>("GET", "/forecast/zambretti", undefined, false);
  }

  async getAstronomicalData(): Promise<any> {
    return this.request<any>("GET", "/forecast/astronomical", undefined, false);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
