"use client";

import DirectChatPanel from "@/components/chat/direct-chat-panel";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSocket } from "@/hooks/use-socket";
import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ChatUser } from "@/types/chat";
import { useAuth } from "@clerk/nextjs";
import { MessageSquare, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function Chat() {
  const { getToken } = useAuth();
  const { connected, socket } = useSocket();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoadingUsers(true);

      try {
        const res = await apiGet<ChatUser[]>(apiClient, "/api/chat/users");

        if (!isMounted) return;
        const finalRes = res.map((row) => ({
          id: Number(row.id),
          displayName: row.displayName ?? null,
          handle: row.handle ?? null,
          avatarUrl: row.avatarUrl ?? null,
        }));
        setUsers(finalRes);

        if (res.length > 0 && activeUserId === null) {
          setActiveUserId(res[0].id);
        }
      } catch (err) {
        console.log(err);
      } finally {
        setLoadingUsers(false);
      }
    }
    load();

    return () => {
      isMounted = false;
    };
  }, [getToken]);

  useEffect(() => {
    if (!socket) return;

    function handlePresense(payload: { onlineUserIds?: number[] }) {
      const list = payload?.onlineUserIds ?? [];
      setOnlineUserIds(list);
    }

    socket.on("presence:update", handlePresense);

    return () => {
      socket.off("presence:update", handlePresense);
    };
  }, [socket]);

  const activeUser =
    activeUserId !== null
      ? users.find((u) => u.id === activeUserId) ?? null
      : null;

  const onlineCount = users.filter((u) => onlineUserIds.includes(u.id)).length;

  console.log(onlineCount, "usersCount");

  return (
    <div className="max-auto max-w-6xl flex w-full flex-col gap-4 py-6 md:flex-row md:gap-6">
      <aside className="w-full shrink-0 md:w-72">
        <Card className="h-full border-border/70 bg-card md:sticky md:top-24">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm text-foreground">
                Direct Messages
              </CardTitle>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {onlineCount} Online - {users.length} total
            </p>
          </CardHeader>
          <CardContent className="flex max-h-[calc(100vh-12rem)] flex-col gap-1 overflow-y-auto">
            {loadingUsers && (
              <p className="text-muted-foreground">Loading users...</p>
            )}

            {!loadingUsers &&
              users.map((user) => {
                const isOnline = onlineUserIds.includes(user.id);
                const isActive = activeUserId === user.id;

                const label =
                  user.handle && user.handle !== ""
                    ? `@${user.handle}`
                    : user.displayName ?? "User";

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setActiveUserId(user.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs transition-colors duration-150",
                      isActive
                        ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                        : "text-muted-foreground hover:bg-card/90"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      {user.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={label} />
                      )}
                    </Avatar>
                    <div className="min-w-0 flex flex-1 flex-col">
                      <span className="truncate text-[12px] font-medium text-foreground">
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-[12px]",
                          isOnline ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </button>
                );
              })}
          </CardContent>
        </Card>
      </aside>

      <main className="min-h-[calc(100vh-8rem)] flex-1 md:min-h-auto">
        {activeUserId && activeUser ? (
          <DirectChatPanel
            otherUserId={activeUserId}
            otherUser={activeUser}
            socket={socket}
            connected={connected}
          />
        ) : (
          <Card className="flex h-full items-center justify-center border-border/70 bg-card">
            <CardContent className="text-center">
              <Users className="mx-auto mb-3 w-12 h-12 opacity-55 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select a user to start chatting...
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default Chat;
