export interface Panel {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  apiToken?: string;
  active: boolean;
  createdAt: string;
}

export interface ServerStatus {
  cpu: number;
  mem: { current: number; total: number };
  disk: { current: number; total: number };
  xray: { state: string; version: string };
  uptime: number;
  loads: number[];
  netIO: { up: number; down: number };
  netTraffic: { sent: number; recv: number };
  publicIP: { ipv4: string; ipv6: string };
}

export interface XUIClient {
  id: string;
  email: string;
  enable: boolean;
  expiryTime: number;
  totalGB: number;
  up: number;
  down: number;
  ipLimit: number;
}

export interface Inbound {
  id: number;
  port: number;
  protocol: string;
  remark: string;
  clients: XUIClient[];
  up: number;
  down: number;
  total: number;
  enable: boolean;
  expiryTime: number;
  streamSettings: string;
}
