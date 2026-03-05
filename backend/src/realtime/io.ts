import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getUserFromClerk } from "../modules/users/user.service.js";
import { createDirectMessage } from "../modules/chat/chat.service.js";

let io: Server | null = null;

const onlineUsers = new Map<number, Set<string>>();

function addOnlineUser(rawUserId: unknown, socketId: string) {
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0) return;

  const existing = onlineUsers.get(userId);

  if (existing) {
    existing.add(socketId);
  } else {
    onlineUsers.set(userId, new Set([socketId]));
  }
}

function removeOnlineUser(rawUserId: unknown, socketId: string) {
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0) return;

  const existing = onlineUsers.get(userId);

  if (!existing) return;

  existing.delete(socketId);

  if (existing.size === 0) {
    onlineUsers.delete(userId);
  }
}

function getOnlineUserIds(): number[] {
  return Array.from(onlineUsers.keys());
}

function broadcasePresence() {
  io?.emit("presence:update", {
    onlineUserIds: getOnlineUserIds(),
  });
}

export function initIo(httpServer: HttpServer) {
  if (io) return io; //safeguard -> only create once;

  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:4000",
      credentials: true,
    },
  });

  io.on("connection", async (socket) => {
    console.log(`[io connection]------> ${socket.id}`);

    try {
      const clerkUserId = socket.handshake.auth?.userId;

      if (!clerkUserId || typeof clerkUserId !== "string") {
        console.log(`[Missing clerk user id]------> ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      const profile = await getUserFromClerk(clerkUserId);
      const rawLocalUserId = profile.user.id;
      const localUserId = Number(rawLocalUserId);
      const displayName = profile.user.displayName ?? null;
      const handle = profile.user.handle ?? null;

      if (!Number.isFinite(localUserId) || localUserId <= 0) {
        console.log(`[Invalid user id]------> ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      (socket.data as {
        userId: number;
        displayName: string | null;
        handle: string | null;
      }) = {
        userId: localUserId,
        displayName,
        handle,
      };

      //  Join noti room

      const notiRoom = `notifications:user:${localUserId}`;
      socket.join(notiRoom);

      // join DM room (create room)
      const dmRoom = `dm:user:${localUserId}`;
      socket.join(dmRoom);

      socket.on("dm:send", async (payload: unknown) => {
        try {
          const data = payload as {
            recipientUserId?: number;
            body?: string;
            imageUrl?: string;
          };

          const senderUserId = (socket.data as { userId?: number }).userId;
          if (!senderUserId) return;

          const recipientUserId = Number(data?.recipientUserId);
          if (!Number.isFinite(recipientUserId) || recipientUserId <= 0) {
            return;
          }

          //NO self DM
          if (senderUserId === recipientUserId) {
            return;
          }

          console.log(`dm:send`, senderUserId, recipientUserId);

          const message = await createDirectMessage({
            senderUserId,
            recipientUserId,
            body: data?.body ?? "",
            imageUrl: data?.imageUrl ?? null,
          });

          const senderRoom = `dm:user:${senderUserId}`;
          const recipientRoom = `dm:user:${recipientUserId}`;

          io?.to(senderRoom).to(recipientRoom).emit("dm:message", message);
        } catch (err) {
          console.error(err);
        }
      });

      socket.on("dm:typing", (payload: unknown) => {
        const data = payload as {
          recipientUserId?: number;
          isTyping?: boolean;
        };

        const senderUserId = (socket.data as { userId?: number }).userId;
        if (!senderUserId) return;

        const recipientUserId = Number(data?.recipientUserId);
        if (!Number.isFinite(recipientUserId) || recipientUserId <= 0) {
          return;
        }

        const recipientRoom = `dm:user:${recipientUserId}`;

        io?.to(recipientRoom).emit("dm:typing", {
          senderUserId,
          recipientRoom,
          isTyping: !!data?.isTyping,
        });
      });

      addOnlineUser(localUserId, socket.id);
      broadcasePresence();
    } catch (err) {
      console.log(`[Error while socket connection]------> ${err}`);
      socket.disconnect(true);
    }
  });
}

export function getIo() {
  return io;
}
