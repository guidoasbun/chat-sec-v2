import * as signalR from "@microsoft/signalr";

// Module-Level variable - one connection per browser tab
let connection: signalR.HubConnection | null = null;

export function getConnection(userId: string): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(
        `http://localhost:5257/hubs/chat?userId=${encodeURIComponent(userId)}`,
      )
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
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
  if (connection) {
    await connection.stop();
    connection = null;
  }
}
