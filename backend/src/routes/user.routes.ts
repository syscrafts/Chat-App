import { Router } from "express";
import { z } from "zod";
import {
  toUserProfileResponse,
  UserProfile,
  UserProfileResponse,
} from "../modules/users/user.types.js";
import { getAuth } from "../config/clerk.js";
import { UnauthorizedError } from "../lib/errors.js";
import {
  getPublicKeyByUserId,
  getUserFromClerk,
  savePublicKey,
  updateUserProfile,
} from "../modules/users/user.service.js";

export const userRouter = Router();

// user update schema

const UserProfileUpdateSchema = z.object({
  displayName: z.string().trim().max(50).optional(),
  handle: z.string().trim().max(30).optional(),
  bio: z.string().trim().max(500).optional(),
  avatarUrl: z.url("Avatar must be valid url").optional(),
});

function toResponse(profile: UserProfile): UserProfileResponse {
  return toUserProfileResponse(profile);
}

// get -> /api/me

userRouter.get("/", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("Unauthorized");
    }

    const profile = await getUserFromClerk(auth.userId);
    const response = toResponse(profile);

    res.json({ data: response });
  } catch (err) {
    next(err);
  }
});

// patch -> /api/me

userRouter.patch("/", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("Unauthorized");
    }

    const parsedBody = UserProfileUpdateSchema.parse(req.body);

    const displayName =
      parsedBody.displayName && parsedBody.displayName.trim().length > 0
        ? parsedBody.displayName.trim()
        : undefined;

    const handle =
      parsedBody.handle && parsedBody.handle.trim().length > 0
        ? parsedBody.handle.trim()
        : undefined;

    const bio =
      parsedBody.bio && parsedBody.bio.trim().length > 0
        ? parsedBody.bio.trim()
        : undefined;

    const avatarUrl =
      parsedBody.avatarUrl && parsedBody.avatarUrl.trim().length > 0
        ? parsedBody.avatarUrl.trim()
        : undefined;

    try {
      const profile = await updateUserProfile({
        clerkUserId: auth.userId,
        displayName,
        handle,
        bio,
        avatarUrl,
      });

      const response = toResponse(profile);

      res.json({ data: response });
    } catch (e) {
      throw e;
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/me/keys  — register the caller's ECDH public key
userRouter.post("/keys", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("Unauthorized");
    }

    const { publicKey } = req.body as { publicKey?: string };

    if (!publicKey || typeof publicKey !== "string" || publicKey.trim() === "") {
      return res.status(400).json({ error: "publicKey (JWK string) is required" });
    }

    await savePublicKey({ clerkUserId: auth.userId, publicKey: publicKey.trim() });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/me/keys/:userId  — fetch another user's public key
userRouter.get("/keys/:userId", async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new UnauthorizedError("Unauthorized");
    }

    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const publicKey = await getPublicKeyByUserId(targetUserId);

    if (!publicKey) {
      return res.status(404).json({ error: "Public key not found for this user" });
    }

    res.json({ data: { userId: targetUserId, publicKey } });
  } catch (err) {
    next(err);
  }
});
