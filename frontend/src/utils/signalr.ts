import * as signalR from "@microsoft/signalr";

// Module-Level variable - one connection per browser tab
let connection: signalR.HubConnection | null = null;

export function getConnection(userId: string): signalR.HubConnection {
  if (!connection) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5257";
    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${apiBase}/hubs/chat?userId=${encodeURIComponent(userId)}`)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();
  }
  return connection;
}

export async function startConnection(
  userId: string,
): Promise<signalR.HubConnection> {
  const conn = getConnection(userId);

  if (conn.state === signalR.HubConnectionState.Disconnected) {
    await conn.start();
    console.log("SignalR connected");
  }

  return conn;
}

export async function stopConnection(): Promise<void> {
  const conn = connection;
  connection = null; // Clear immediately so the next startConnection gets a fresh instance
  if (conn) {
    await conn.stop();
  }
}
