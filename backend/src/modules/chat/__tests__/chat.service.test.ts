import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDirectMessage, listDirectMessages } from "../chat.service";
import * as db from "../../../db/db";

vi.mock("../../../db/db");

const mockMessageRow = {
  id: 1,
  sender_user_id: 1,
  recipient_user_id: 2,
  body: '{"iv":"abc==","ciphertext":"xyz=="}',
  image_url: null,
  created_at: new Date("2025-01-01T10:00:00Z"),
  sender_display_name: "Alice",
  sender_handle: "alice",
  sender_avatar: null,
  recipient_display_name: "Bob",
  recipient_handle: "bob",
  recipient_avatar: null,
};

beforeEach(() => vi.clearAllMocks());

describe("createDirectMessage", () => {
  it("creates and returns a message with encrypted body", async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, created_at: new Date() }] } as any)
      .mockResolvedValueOnce({ rows: [mockMessageRow] } as any);

    const result = await createDirectMessage({
      senderUserId: 1,
      recipientUserId: 2,
      body: '{"iv":"abc==","ciphertext":"xyz=="}',
    });

    expect(result.id).toBe(1);
    expect(result.senderUserId).toBe(1);
    expect(result.body).toContain("ciphertext");
  });

  it("throws if both body and imageUrl are empty", async () => {
    await expect(
      createDirectMessage({ senderUserId: 1, recipientUserId: 2, body: "" })
    ).rejects.toThrow("Message body or image is required");
  });

  it("stores sender and recipient info correctly", async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, created_at: new Date() }] } as any)
      .mockResolvedValueOnce({ rows: [mockMessageRow] } as any);

    const result = await createDirectMessage({
      senderUserId: 1,
      recipientUserId: 2,
      body: "hello",
    });

    expect(result.sender.handle).toBe("alice");
    expect(result.recipient.handle).toBe("bob");
  });

  it("accepts imageUrl with no body", async () => {
    const rowWithImage = { ...mockMessageRow, body: null, image_url: "https://img.com/x.png" };

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 1, created_at: new Date() }] } as any)
      .mockResolvedValueOnce({ rows: [rowWithImage] } as any);

    const result = await createDirectMessage({
      senderUserId: 1,
      recipientUserId: 2,
      imageUrl: "https://img.com/x.png",
    });

    expect(result.imageUrl).toBe("https://img.com/x.png");
    expect(result.body).toBeNull();
  });
});

describe("listDirectMessages", () => {
  it("returns messages sorted oldest first", async () => {
    const rows = [
      { ...mockMessageRow, id: 2, created_at: new Date("2025-01-01T11:00:00Z") },
      { ...mockMessageRow, id: 1, created_at: new Date("2025-01-01T10:00:00Z") },
    ];

    vi.mocked(db.query).mockResolvedValue({ rows } as any);

    const result = await listDirectMessages({ userId: 1, otherUserId: 2, limit: 50 });

    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it("caps limit at 200", async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [] } as any);

    await listDirectMessages({ userId: 1, otherUserId: 2, limit: 9999 });

    const calledWith = vi.mocked(db.query).mock.calls[0][1] as any[];
    expect(calledWith[2]).toBe(200);
  });

  it("enforces minimum limit of 1", async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [] } as any);

    await listDirectMessages({ userId: 1, otherUserId: 2, limit: 0 });

    const calledWith = vi.mocked(db.query).mock.calls[0][1] as any[];
    expect(calledWith[2]).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array when no messages exist", async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [] } as any);

    const result = await listDirectMessages({ userId: 1, otherUserId: 2, limit: 50 });

    expect(result).toEqual([]);
  });
});
