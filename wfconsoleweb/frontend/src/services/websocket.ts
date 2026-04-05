/**
 * WebSocket service for real-time observation streaming
 */

import { Observation } from "../types";

type MessageHandler = (data: unknown) => void;
type ObservationHandler = (obs: Observation) => void;

function resolveWebSocketUrl(): string {
  const configuredBase = process.env.REACT_APP_WS_URL?.trim();
  if (configuredBase) {
    return `${configuredBase.replace(/\/$/, "")}/ws/observations`;
  }

  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/observations`;
  }

  return "/ws/observations";
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectDelay = 3000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private observationHandlers: ObservationHandler[] = [];
  private heartbeatTimeout: NodeJS.Timeout | null = null;

  constructor(url?: string) {
    this.url = url || resolveWebSocketUrl();
  }

  /**
   * Connect to WebSocket server
   */
  connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error("Connection attempt already in progress"));
        return;
      }

      this.isConnecting = true;
      this.shouldReconnect = true;
      this.token = token || localStorage.getItem("auth_token");

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("WebSocket connected");
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this._startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => this._handleMessage(event.data);
        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("WebSocket disconnected");
          this._stopHeartbeat();
          this.ws = null;
          if (this.shouldReconnect) {
            this._attemptReconnect();
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this._stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  /**
   * Register handler for specific message type
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Register handler for observations
   */
  onObservation(handler: ObservationHandler): () => void {
    this.observationHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.observationHandlers.indexOf(handler);
      if (index > -1) {
        this.observationHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Send message to server
   */
  send(type: string, data?: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected");
      return;
    }

    const message = { type, data };
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Handle incoming message
   */
  private _handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const { type, data: payload } = message;

      // Handle observations specially
      if (type === "observation") {
        this.observationHandlers.forEach((handler) => {
          try {
            handler(payload as Observation);
          } catch (error) {
            console.error("Error in observation handler:", error);
          }
        });
      }

      // Handle generic message types
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(payload);
          } catch (error) {
            console.error(`Error in ${type} handler:`, error);
          }
        });
      }

      // Reset heartbeat on any message
      this._resetHeartbeat();
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }

  /**
   * Attempt to reconnect
   */
  private _attemptReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    this.reconnectAttempts++;
    const exponentialDelay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    const delay = Math.min(exponentialDelay, this.maxReconnectDelay);

    console.log(`Attempting reconnect (${this.reconnectAttempts}) in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.token ?? undefined).catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }

  /**
   * Start heartbeat/ping to keep connection alive
   */
  private _startHeartbeat(): void {
    this.heartbeatTimeout = setTimeout(() => {
      if (this.isConnected()) {
        this.send("ping", { timestamp: new Date().toISOString() });
        this._startHeartbeat();
      }
    }, 30000); // 30 second heartbeat
  }

  /**
   * Stop heartbeat
   */
  private _stopHeartbeat(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Reset heartbeat timer (reset on any message)
   */
  private _resetHeartbeat(): void {
    this._stopHeartbeat();
    if (this.isConnected()) {
      this._startHeartbeat();
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;
