"use client";

import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import {
  ChatUser,
  DirectMessage,
  mapDirectMessage,
  mapDirectMessagesResponse,
  RawDirectMessage,
} from "@/types/chat";
import { useAuth } from "@clerk/nextjs";
import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Lock, Send, Wifi, WifiOff } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { toast } from "sonner";
import ImageUploadButton from "./image-upload-button";
import { useE2E } from "@/hooks/use-e2e";
import {
  decryptMessage,
  encryptMessage,
  isEncryptedPayload,
  parseEncryptedPayload,
} from "@/lib/e2e-crypto";

type DirectChatPanelProps = {
  otherUserId: number;
  otherUser: ChatUser | null;
  socket: Socket | null;
  connected: boolean;
};

function DirectChatPanel(props: DirectChatPanelProps) {
  const { otherUser, otherUserId, socket, connected } = props;
  const { getToken } = useAuth();
  const { privateKey, ready: e2eReady, getRemotePublicKey } = useE2E();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [decryptedBodies, setDecryptedBodies] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [e2eStatus, setE2eStatus] = useState<"pending" | "active" | "unavailable">("pending");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, decryptedBodies]);

  //  Decrypt a single message body 
  async function tryDecrypt(
    msg: DirectMessage,
    theirPublicKey: CryptoKey
  ): Promise<string | null> {
    if (!privateKey || !msg.body) return null;
    if (!isEncryptedPayload(msg.body)) return msg.body; // plaintext fallback

    try {
      const payload = parseEncryptedPayload(msg.body);
      return await decryptMessage(payload, privateKey, theirPublicKey);
    } catch (err) {
      console.warn("[E2E] Decrypt failed for msg", msg.id, err);
      return "🔒 [Unable to decrypt]";
    }
  }

  // Decrypt all loaded messages
  async function decryptAll(msgs: DirectMessage[]) {
    if (!privateKey) return;

    const theirKey = await getRemotePublicKey(otherUserId);
    if (!theirKey) return;

    const entries = await Promise.all(
      msgs.map(async (m) => {
        const plain = await tryDecrypt(m, theirKey);
        return [m.id, plain ?? m.body ?? ""] as [number, string];
      })
    );

    setDecryptedBodies((prev) => ({
      ...prev,
      ...Object.fromEntries(entries),
    }));
  }

  // Load chat history 
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setMessages([]);
      setDecryptedBodies({});

      try {
        const res = await apiGet<DirectMessage[]>(
          apiClient,
          `/api/chat/conversations/${otherUserId}/messages`,
          { params: { limit: 100 } }
        );

        if (!isMounted) return;
        const mapped = mapDirectMessagesResponse(res);
        setMessages(mapped);

        // Check if recipient has a public key then, determine E2E status
        const theirKey = await getRemotePublicKey(otherUserId);
        setE2eStatus(theirKey ? "active" : "unavailable");

        if (theirKey) {
          await decryptAll(mapped);
        }
      } catch (err) {
        console.log(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (otherUserId && e2eReady) {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, [apiClient, otherUserId, e2eReady]);

  // Incoming realtime messages 
  useEffect(() => {
    if (!socket) return;

    async function handleMessage(payload: RawDirectMessage) {
      const mapped = mapDirectMessage(payload);

      if (
        mapped.senderUserId !== otherUserId &&
        mapped.recipientUserId !== otherUserId
      ) {
        return;
      }

      setMessages((prev) => [...prev, mapped]);

      // Decrypt incoming message
      if (privateKey && mapped.body && isEncryptedPayload(mapped.body)) {
        const theirKey = await getRemotePublicKey(otherUserId);
        if (theirKey) {
          try {
            const payload2 = parseEncryptedPayload(mapped.body);
            const plain = await decryptMessage(payload2, privateKey, theirKey);
            setDecryptedBodies((prev) => ({ ...prev, [mapped.id]: plain }));
          } catch {
            setDecryptedBodies((prev) => ({
              ...prev,
              [mapped.id]: "🔒 [Unable to decrypt]",
            }));
          }
        }
      } else if (mapped.body) {
        setDecryptedBodies((prev) => ({ ...prev, [mapped.id]: mapped.body! }));
      }
    }

    function handleTyping(payload: {
      senderUserId?: number;
      isTyping?: boolean;
    }) {
      if (Number(payload.senderUserId) !== otherUserId) return;
      setTypingLabel(payload.isTyping ? "Typing..." : null);
    }

    socket.on("dm:message", handleMessage);
    socket.on("dm:typing", handleTyping);

    return () => {
      socket.off("dm:message", handleMessage);
      socket.off("dm:typing", handleTyping);
    };
  }, [socket, otherUserId, privateKey]);

  function setSendTyping(isTyping: boolean) {
    socket?.emit("dm:typing", { recipientUserId: otherUserId, isTyping });
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value);
    if (!socket) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setSendTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      setSendTyping(false);
      typingTimeoutRef.current = null;
    }, 2000);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleSend() {
    if (!socket || !connected) {
      toast("Not connected", {
        description: "Realtime connection is not established yet!",
      });
      return;
    }

    const body = input.trim();
    if (!body && !imageUrl) return;

    setSending(true);

    try {
      let encryptedBody: string | null = body || null;

      // Encrypt the text body if E2E is active
      if (body && e2eStatus === "active" && privateKey) {
        const theirKey = await getRemotePublicKey(otherUserId);
        if (theirKey) {
          const encrypted = await encryptMessage(body, privateKey, theirKey);
          encryptedBody = JSON.stringify(encrypted);
        }
      }

      socket.emit("dm:send", {
        recipientUserId: otherUserId,
        body: encryptedBody,
        imageUrl: imageUrl || null,
      });

      setInput("");
      setImageUrl("");
      setSendTyping(false);
    } finally {
      setSending(false);
    }
  }

  const title =
    otherUser?.handle && otherUser?.handle !== ""
      ? `@${otherUser?.handle}`
      : otherUser?.displayName ?? "Conversation";

  const e2eBadge = {
    active: (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-400">
        <Lock className="w-3 h-3" />
        E2E Encrypted
      </span>
    ),
    unavailable: (
      <span className="flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-1 text-[11px] font-medium text-yellow-400">
        <Lock className="w-3 h-3" />
        No encryption (recipient has no key)
      </span>
    ),
    pending: (
      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
        <Lock className="w-3 h-3" />
        Initialising E2E...
      </span>
    ),
  }[e2eStatus];

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/70 bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-3">
        <div>
          <CardTitle className="text-base text-foreground">{title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Direct message conversation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {e2eBadge}
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${
              connected
                ? "bg-primary/10 text-primary"
                : "bg-accent text-accent-foreground"
            }`}
          >
            {connected ? (
              <>
                <Wifi className="w-3 h-3" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                Offline
              </>
            )}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-y-auto bg-background/60 p-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground">Loading messages...</p>
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-muted-foreground">
              No messages yet. Start the first initiative
            </p>
          </div>
        )}

        {!isLoading &&
          messages.map((msg) => {
            const isOther = msg.senderUserId === otherUserId;
            const label = isOther ? title : "You";

            const time = new Date(msg.createdAt).toLocaleDateString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });

            // Use decrypted body if available, otherwise fall back to raw
            const displayBody = decryptedBodies[msg.id] ?? msg.body;
            const wasEncrypted = msg.body
              ? isEncryptedPayload(msg.body)
              : false;

            return (
              <div
                className={`flex gap-2 text-xs ${
                  isOther ? "justify-start" : "justify-end"
                }`}
                key={msg.id}
              >
                <div className={`max-w-xs ${isOther ? "" : "order-2"}`}>
                  <div
                    className={`mb-1 flex items-center gap-1 text-[12px] font-medium ${
                      isOther
                        ? "text-muted-foreground"
                        : "text-muted-foreground justify-end"
                    }`}
                  >
                    {wasEncrypted && (
                      <Lock className="w-2.5 h-2.5 text-emerald-400" />
                    )}
                    {label} - {time}
                  </div>

                  {displayBody && (
                    <div
                      className={`inline-block rounded-lg px-3 py-2 transition-colors duration-150
                      ${
                        isOther
                          ? "bg-accent text-accent-foreground"
                          : "bg-primary/80 text-primary-foreground"
                      }
                      `}
                    >
                      <p className="wrap-break-word text-[16px] leading-relaxed">
                        {displayBody}
                      </p>
                    </div>
                  )}

                  {msg?.imageUrl && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-border">
                      <img
                        src={msg.imageUrl}
                        alt="attachment"
                        className="max-h-52 max-w-xs rounded-lg object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {typingLabel && (
          <div className="flex justify-start gap-2 text-xs">
            <div className="italic text-muted-foreground">{typingLabel}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="space-y-3 border-t border-border bg-car p-5">
        {imageUrl && (
          <div className="rounded-lg border border-border bg-background/70 p-2">
            <p className="text-[12px] text-muted-foreground mb-2">
              Image ready to send:
            </p>
            <img
              src={imageUrl}
              alt="pending"
              className="max-h-32 rounded-lg border border-border object-contain"
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <ImageUploadButton onImageUpload={(url) => setImageUrl(url)} />
            <span className="text-[11px] text-muted-foreground">
              Cloudinary Image Upload
            </span>
          </div>

          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                e2eStatus === "active"
                  ? "Type a message..."
                  : "Type a message..."
              }
              disabled={!connected || sending}
              className="min-h-14 resize-none border-border bg-background text-sm"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={sending || !connected || (!input.trim() && !imageUrl)}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default DirectChatPanel;
