"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import {
  generateOrLoadKeyPair,
  exportPublicKeyJwk,
  importRemotePublicKey,
} from "@/lib/e2e-crypto";
import { createBrowserApiClient } from "@/lib/api-client";
import axios from "axios";

type E2EContextValue = {
  /** Our own ECDH private key */
  privateKey: CryptoKey | null;
  /** Our own ECDH public key */
  publicKey: CryptoKey | null;
  /** Whether key init + server registration is complete */
  ready: boolean;
  /** Fetch and cache a remote user's public key by their numeric DB id */
  getRemotePublicKey: (userId: number) => Promise<CryptoKey | null>;
};

const E2EContext = createContext<E2EContextValue>({
  privateKey: null,
  publicKey: null,
  ready: false,
  getRemotePublicKey: async () => null,
});

export function E2EProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, userId } = useAuth();

  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [ready, setReady] = useState(false);

  // Cache of userId →  CryptoKey so we don't fetch repeatedly
  const remoteKeyCache = useRef<Map<number, CryptoKey>>(new Map());

  useEffect(() => {
    if (!isLoaded || !userId) return;

    let cancelled = false;

    async function init() {
      try {
        // 1. Generate or load key pair from localStorage
        const keyPair = await generateOrLoadKeyPair();

        if (cancelled) return;

        setPrivateKey(keyPair.privateKey);
        setPublicKey(keyPair.publicKey);

        // 2. Register our public key with the server
        const jwkString = await exportPublicKeyJwk(keyPair.publicKey);
        const token = await getToken();

        await axios.post(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000"}/api/me/keys`,
          { publicKey: jwkString },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (cancelled) return;
        setReady(true);
      } catch (err) {
        console.error("[E2E] Key init failed:", err);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId]);

  const getRemotePublicKey = useCallback(
    async (targetUserId: number): Promise<CryptoKey | null> => {
      const cached = remoteKeyCache.current.get(targetUserId);
      if (cached) return cached;

      try {
        const token = await getToken();
        const res = await axios.get<{ data: { publicKey: string } }>(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000"}/api/me/keys/${targetUserId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const cryptoKey = await importRemotePublicKey(res.data.data.publicKey);
        remoteKeyCache.current.set(targetUserId, cryptoKey);
        return cryptoKey;
      } catch (err) {
        console.warn(`[E2E] Could not fetch public key for user ${targetUserId}:`, err);
        return null;
      }
    },
    [getToken]
  );

  return (
    <E2EContext.Provider value={{ privateKey, publicKey, ready, getRemotePublicKey }}>
      {children}
    </E2EContext.Provider>
  );
}

export function useE2E() {
  return useContext(E2EContext);
}
