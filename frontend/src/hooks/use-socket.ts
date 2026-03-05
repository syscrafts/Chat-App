"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

type UseSocketResult = {
  socket: Socket | null;
  connected: boolean;
};

export function useSocket(): UseSocketResult {
  const { userId, isLoaded } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      setConnected(false);
      setSocket((prev) => {
        if (prev) {
          prev.disconnect();
        }

        return null;
      });

      return;
    }

    const baseUrl = "http://localhost:5000";

    console.log(`[Socket], ${baseUrl}, ${userId}`);

    const socketInstance: Socket = io(baseUrl, {
      auth: { userId }, // backend is going to read the userId
      withCredentials: true,
      transports: ["websocket"],
    });

    setSocket(socketInstance);

    const handleConnect = () => {
      console.log(`[Socket], ${socketInstance.id}`);

      setConnected(true);
    };

    const handleDisConnect = (reason: any) => {
      console.log(`[Socket], ${socketInstance.id}, ${reason}`);
      setConnected(false);
    };

    const handleConnectError = (err: any) => {
      console.error(err);
    };

    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisConnect);
    socketInstance.on("connect_error", handleConnectError);

    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisConnect);
      socketInstance.off("connect_error", handleConnectError);
      socketInstance.disconnect();
      setConnected(false);
      setSocket(null);
    };
  }, [userId, isLoaded]);

  return { socket, connected };
}
