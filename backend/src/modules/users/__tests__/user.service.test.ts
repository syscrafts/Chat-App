import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserFromClerk, updateUserProfile } from "../user.service";
import * as repo from "../user.repository";
import * as clerkConfig from "../../../config/clerk";

vi.mock("../user.repository");
vi.mock("../../../config/clerk");

const mockUser = {
  id: 1,
  clerkUserId: "clerk_123",
  displayName: "Alice",
  handle: "alice",
  bio: "Hello",
  avatarUrl: "https://img.clerk.com/abc.jpg",
  publicKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockClerkUser = {
  firstName: "Alice",
  lastName: null,
  emailAddresses: [{ emailAddress: "alice@test.com", id: "em_1" }],
  primaryEmailAddressId: "em_1",
  imageUrl: "https://img.clerk.com/abc.jpg",
};

beforeEach(() => {
  vi.clearAllMocks();
  (clerkConfig as any).clerkClient = {
    users: { getUser: vi.fn().mockResolvedValue(mockClerkUser) },
  };
});

describe("getUserFromClerk", () => {
  it("returns a user profile when clerk user exists", async () => {
    vi.mocked(repo.upsertUserFromClerkProfile).mockResolvedValue(mockUser);
    const result = await getUserFromClerk("clerk_123");
    expect(result.user.displayName).toBe("Alice");
    expect(result.clerkEmail).toBe("alice@test.com");
  });

  it("calls upsertUserFromClerkProfile with correct params", async () => {
    vi.mocked(repo.upsertUserFromClerkProfile).mockResolvedValue(mockUser);
    await getUserFromClerk("clerk_123");
    expect(repo.upsertUserFromClerkProfile).toHaveBeenCalledWith({
      clerkUserId: "clerk_123",
      displayName: "Alice",
      avatarUrl: "https://img.clerk.com/abc.jpg",
    });
  });

  it("handles user with first and last name", async () => {
    (clerkConfig as any).clerkClient.users.getUser.mockResolvedValue({
      ...mockClerkUser, firstName: "Alice", lastName: "Smith",
    });
    vi.mocked(repo.upsertUserFromClerkProfile).mockResolvedValue(mockUser);
    const result = await getUserFromClerk("clerk_123");
    expect(result.clerkFullName).toBe("Alice Smith");
  });

  it("handles user with no name — fullName is null", async () => {
    (clerkConfig as any).clerkClient.users.getUser.mockResolvedValue({
      ...mockClerkUser, firstName: "", lastName: null,
    });
    vi.mocked(repo.upsertUserFromClerkProfile).mockResolvedValue(mockUser);
    const result = await getUserFromClerk("clerk_123");
    expect(result.clerkFullName).toBeNull();
  });

  it("propagates repository errors", async () => {
    vi.mocked(repo.upsertUserFromClerkProfile).mockRejectedValue(new Error("DB connection failed"));
    await expect(getUserFromClerk("clerk_123")).rejects.toThrow("DB connection failed");
  });
});

describe("updateUserProfile", () => {
  it("updates and returns the updated profile", async () => {
    const updated = { ...mockUser, handle: "alice_updated" };
    vi.mocked(repo.repoUpdateUserProfile).mockResolvedValue(updated);
    const result = await updateUserProfile({ clerkUserId: "clerk_123", handle: "alice_updated" });
    expect(result.user.handle).toBe("alice_updated");
  });

  it("calls repoUpdateUserProfile with correct params", async () => {
    vi.mocked(repo.repoUpdateUserProfile).mockResolvedValue(mockUser);
    await updateUserProfile({ clerkUserId: "clerk_123", displayName: "Alice New", handle: "alicenew", bio: "Updated bio" });
    expect(repo.repoUpdateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ clerkUserId: "clerk_123", displayName: "Alice New", handle: "alicenew", bio: "Updated bio" })
    );
  });

  it("propagates repository errors", async () => {
    vi.mocked(repo.repoUpdateUserProfile).mockRejectedValue(new Error("no user found for clerk user id= clerk_999"));
    await expect(updateUserProfile({ clerkUserId: "clerk_999", handle: "ghost" })).rejects.toThrow("no user found");
  });
});
