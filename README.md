# 💬 Chat App

This chat application is made for my university coursework.

A full-stack real-time chat and threaded forum application with End-to-End Encryption, built with Next.js, Node.js, PostgreSQL, and Socket.IO.

---

## 📸 Features

- 🔒 **End-to-End Encrypted** direct messaging (ECDH + AES-GCM via Web Crypto API)
- 💬 **Real-time** direct messages with typing indicators and online presence
- 🧵 **Threaded forum** with categories, replies, likes, and search
- 🔔 **Live notifications** via Socket.IO
- 👤 **User profiles** with handle, bio, and avatar
- 🖼️ **Image sharing** via Cloudinary
- 🔐 **JWT Authentication** powered by Clerk
- 🐳 **One-command setup** with Docker Compose

---

## 🏗️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 16 | React framework (App Router) |
| TypeScript | Type safety |
| Tailwind CSS v4 | Styling |
| shadcn | UI component library |
| Socket.IO Client | Real-time communication |
| Clerk (Next.js) | Authentication |
| Web Crypto API | E2E encryption (built-in browser API) |
| Axios | HTTP client |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | HTTP server |
| TypeScript + tsx | Runtime & type safety |
| Socket.IO | WebSocket server |
| PostgreSQL (pg) | Database |
| Clerk (Express) | JWT middleware |
| Cloudinary | Image storage |
| Zod | Schema validation |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker + Docker Compose | Containerisation |
| PostgreSQL 16 (Alpine) | Database container |

---

## 🔒 End-to-End Encryption

Messages are encrypted entirely in the browser before being sent. The server only ever stores and transmits ciphertext, it cannot read message content.

### How it works

```
Alice                        Server                        Bob
  |                             |                            |
  |--- POST /api/me/keys ------>|                            |
  |    { publicKey: JWK }       |<--- POST /api/me/keys -----|
  |                             |     { publicKey: JWK }     |
  |                             |                            |
  |--- GET /api/me/keys/bob --->|                            |
  |<-- Bob's public key --------|                            |
  |                             |                            |
  | ECDH(Alice.priv, Bob.pub)   |                            |
  |  → HKDF → AES-GCM-256 key   |                            |
  |                             |                            |
  |=== { iv, ciphertext } =====>|====== { iv, ciphertext } ==>|
  |     (encrypted body)        |      (server sees only     |
  |                             |       ciphertext)          |
  |                             |                            |
  |                             |     ECDH(Bob.priv,         |
  |                             |         Alice.pub)         |
  |                             |      → same AES key        |
  |                             |      → AES-GCM decrypt     |
  |                             |      → plaintext ✓         |
```


## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-docker/) and Docker Compose
- [Clerk](https://clerk.com) account (free tier works)
- [Cloudinary](https://cloudinary.com) account (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/chat-app.git
cd chat-app
```

### 2. Configure environment variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DB_NAME=chat_app
DB_USER=postgres
DB_PASSWORD=postgres

# Clerk — get these from https://dashboard.clerk.com
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Cloudinary — get these from https://cloudinary.com/console
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Run the application

```bash
# First time (builds Docker images)
docker compose up --build

# Subsequent runs
docker compose up
```

This single command will:
1. Start a PostgreSQL 16 database
2. Wait for the database to be healthy
3. Run all database migrations automatically
4. Start the backend API on `http://localhost:5000`
5. Start the frontend on `http://localhost:4000`

### 4. Open the app

```
http://localhost:4000
```

### Stopping the app

```bash
docker compose down

# To also remove the database volume (resets all data)
docker compose down -v
```


## 🔐 Security Features

### Authentication
- All API routes protected by Clerk JWT middleware
- Tokens validated against Clerk's public keys on every request
- 401 returned immediately for missing or forged tokens

### End-to-End Encryption
- Private keys generated in-browser via Web Crypto API and stored in localStorage
- Private keys **never transmitted** to the server
- Server stores only ECDH public keys and AES-GCM ciphertext
- Key versioning forces regeneration when crypto parameters change

### Transport Security
- CORS restricted to known frontend origin
- WebSocket connections authenticated via Clerk userId on handshake

---

