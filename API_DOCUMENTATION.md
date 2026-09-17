# Backend API & Real-Time Socket Documentation

> **Target Audience:** Frontend Engineers building Web/Mobile UI for this Chat Application.  
> **Server Base URL:** `http://localhost:5000` (configurable via `.env` `PORT`)  
> **Socket.IO Endpoint:** `http://localhost:5000`  
> **Default Protocol:** HTTP/1.1 + WebSocket (Socket.IO v4)  
> **Data Format:** JSON (`Content-Type: application/json`)  
> **CORS:** Enabled for all origins (`*`)

---

## 1. Architecture & Connection Overview

```
 ┌────────────────────────────────────────────────────────┐
 │                      FRONTEND UI                       │
 └─────────────┬────────────────────────────┬─────────────┘
               │                            │
   1. Register / Login                      │ 3. Socket.IO Connection
   (HTTP POST /auth/*)                      │    (with JWT in auth handshake)
               │                            │
               ▼                            ▼
 ┌───────────────────────────┐    ┌───────────────────────────────────┐
 │   JWT Token (expires 50h) │    │ Real-time bidirectional streaming │
 └─────────────┬─────────────┘    │ - Join room (roomId)              │
               │                  │ - Send message ({ roomId, sender, │
   2. Fetch History               │                  content })       │
   (HTTP GET /chat/:roomId)       │ - Receive broadcasted messages    │
               │                  └───────────────────────────────────┘
               ▼                                    ▲
 ┌──────────────────────────────────────────────────┴─────────────────┐
 │                        BACKEND SERVER                              │
 │                 (Node.js + Express + Socket.IO)                    │
 └─────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │  MongoDB (chatapp DB) │
                       │  - users              │
                       │  - messages           │
                       └───────────────────────┘
```

---

## 2. TypeScript Data Models / Interfaces

Frontend developers can directly copy these interface definitions into their TypeScript project:

```typescript
// User Object
export interface User {
  _id: string;
  username: string;
}

// Chat Message Object
export interface ChatMessage {
  _id: string;
  roomId: string;
  sender: string;       // username of the sender
  content: string;      // text content of the message
  createdAt: string;    // ISO 8601 Timestamp (e.g. "2026-09-17T14:30:00.000Z")
  __v?: number;
}

// Auth Response Payload
export interface LoginResponse {
  token: string;
}

export interface RegisterResponse {
  message: string;
}

// Standard Error Response
export interface ApiError {
  error: string;
}

// Socket Emit Payloads
export interface SendMessagePayload {
  roomId: string;
  sender: string;
  content: string;
}
```

---

## 3. Authentication (REST API)

### 3.1 Register New User
Creates a new user profile with a hashed password in the database.

- **URL:** `/auth/register`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Auth Required:** No

#### Request Body:
```json
{
  "username": "alice",
  "password": "mypassword123"
}
```

#### Responses:
- **`201 Created`** — Registration succeeded:
  ```json
  {
    "message": "User registered successfully"
  }
  ```
- **`500 Internal Server Error`** — When the username is already taken (unique constraint):
  ```json
  {
    "error": "User already exists or server error"
  }
  ```

---

### 3.2 User Login
Authenticates user credentials and returns a signed JSON Web Token (valid for **50 hours**).

- **URL:** `/auth/login`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Auth Required:** No

#### Request Body:
```json
{
  "username": "alice",
  "password": "mypassword123"
}
```

#### Responses:
- **`200 OK`** — Authentication succeeded:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **`400 Bad Request`** — Invalid username or incorrect password:
  ```json
  {
    "error": "Invalid credentials"
  }
  ```

#### Token Decoding (Client-side):
The returned JWT token payload contains:
```json
{
  "id": "6648a129f123abc456789012",
  "iat": 1726584000,
  "exp": 1726764000
}
```
> **UI Recommendation:** Store `token` in `localStorage.setItem("authToken", token)` and store the logged-in `username` in your UI state/storage for populating the `sender` field in messages.

---

## 4. Chat Messages (REST API)

### 4.1 Get Room Message History
Retrieves all historical messages for a given room, sorted in ascending order (`createdAt: 1` — oldest to newest). Call this when a user opens/enters a chat room.

- **URL:** `/chat/:roomId`
- **Method:** `GET`
- **URL Parameters:**
  - `roomId` *(string, required)*: Unique identifier of the room (e.g. `general`, `room-101`, `team-engineering`).
- **Headers:**
  - `Authorization: Bearer <token>` *(Recommended)*
- **Auth Required:** Optional on current REST route, but client should send token if available.

#### Success Response (`200 OK`):
```json
[
  {
    "_id": "66e84d412351af4b3e8c901a",
    "roomId": "general",
    "sender": "alice",
    "content": "Hello everyone!",
    "createdAt": "2026-09-17T14:30:15.120Z",
    "__v": 0
  },
  {
    "_id": "66e84d5a2351af4b3e8c901b",
    "roomId": "general",
    "sender": "bob",
    "content": "Hey Alice, welcome to the channel!",
    "createdAt": "2026-09-17T14:31:02.450Z",
    "__v": 0
  }
]
```
*(If no messages exist in the room, returns an empty array `[]`)*.

---

### 4.2 Send Message via HTTP (Alternative / Fallback)
Allows sending a message using standard HTTP POST instead of WebSocket.

- **URL:** `/chat/:roomId`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **URL Parameters:**
  - `roomId` *(string, required)*
- **Request Body:**
  ```json
  {
    "sender": "alice",
    "content": "Hello via REST!"
  }
  ```

#### Success Response (`201 Created`):
```json
{
  "_id": "66e84df92351af4b3e8c901c",
  "roomId": "general",
  "sender": "alice",
  "content": "Hello via REST!",
  "createdAt": "2026-09-17T14:32:45.000Z",
  "__v": 0
}
```

> **Note:** Sending messages via the Socket.IO event `chatMessage` (see Section 5) automatically persists the message **and** broadcasts it to all other active participants in real-time. HTTP POST saves the message to the database but does not trigger a WebSocket broadcast to other active users.

---

## 5. Real-Time Socket.IO API

The backend uses **Socket.IO (v4)** for real-time messaging.

### 5.1 Connection Handshake & Authentication
To establish a connection, the frontend **must** pass the JWT token in `auth.token`:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: localStorage.getItem("authToken") // JWT string received from /auth/login
  }
});
```

#### Connection Events:
- **`connect`**: Fired when connection and authentication are successful.
  ```javascript
  socket.on("connect", () => {
    console.log("Connected to socket server with ID:", socket.id);
  });
  ```
- **`connect_error`**: Fired if authentication fails (missing or invalid/expired token).
  ```javascript
  socket.on("connect_error", (err) => {
    console.error("Socket Auth Error:", err.message); // "Authentication error"
    // Redirect user to login screen or refresh token
  });
  ```

---

### 5.2 Client Emitted Events (Frontend -> Backend)

#### `joinRoom`
Notifies the backend to subscribe this client's socket to messages within a specific room. Call this as soon as the user selects or enters a room.

- **Event Name:** `joinRoom`
- **Payload:** `roomId` *(string)*
- **Example:**
  ```javascript
  socket.emit("joinRoom", "general");
  ```

---

#### `chatMessage`
Sends a new message to the room. The server automatically saves this message in MongoDB and emits it to all connected sockets in that room.

- **Event Name:** `chatMessage`
- **Payload:**
  ```typescript
  {
    roomId: string;
    sender: string;
    content: string;
  }
  ```
- **Example:**
  ```javascript
  socket.emit("chatMessage", {
    roomId: "general",
    sender: "alice",
    content: "Hey team! How is the frontend coming along?"
  });
  ```

---

### 5.3 Server Emitted Events (Backend -> Frontend)

#### `chatMessage`
Broadcasted to all users who joined the room when any user sends a message.

- **Event Name:** `chatMessage`
- **Payload:**
  ```json
  {
    "_id": "66e851a82351af4b3e8c9020",
    "roomId": "general",
    "sender": "alice",
    "content": "Hey team! How is the frontend coming along?",
    "createdAt": "2026-09-17T14:35:10.123Z",
    "__v": 0
  }
  ```
- **Frontend Handling:**
  Append this message object to your local messages list for display in the active room.

---

## 6. Recommended Frontend Screen Flow & UI Specs

### Screen 1: Authentication (`/login` & `/register`)
- **UI Elements:**
  - Input field: `Username`
  - Input field: `Password` (masked)
  - Buttons: `Login` and `Sign Up`
  - Error banner (displays error strings like `"Invalid credentials"`)
- **Actions:**
  1. Call `POST /auth/login` or `POST /auth/register`.
  2. On login success, save `token` to `localStorage` and keep `username` in memory/state.
  3. Transition to the Chat Dashboard.

---

### Screen 2: Room Selector / Channels Sidebar
- **UI Elements:**
  - Sidebar showing available rooms (e.g. `#general`, `#dev`, `#random`) or an input to create/join any room ID.
  - Active user display (`"Logged in as: alice"`).
  - "Logout" button (clears storage and disconnects socket).
- **Actions:**
  1. When a user clicks on a room:
     - Update active `roomId`.
     - Fetch historical messages via `GET /chat/:roomId`.
     - Emit socket event: `socket.emit('joinRoom', roomId)`.

---

### Screen 3: Chat Room View
- **UI Elements:**
  - **Header:** Current Room Name (`#general`), Connection Indicator (🟢 Online / 🔴 Disconnected).
  - **Message Stream:**
    - List of messages ordered chronologically.
    - Differentiate sender:
      - If `message.sender === currentUser`: Align to right (primary color bubble).
      - If `message.sender !== currentUser`: Align to left with sender name badge.
    - Timestamp formatted nicely (e.g. `14:35 PM` using `message.createdAt`).
    - Auto-scroll to bottom on new incoming message.
  - **Message Input Area:**
    - Textarea or text input field (submits on `Enter` key).
    - Send button.
- **Actions:**
  1. On click / Enter:
     - Emit `socket.emit('chatMessage', { roomId, sender: currentUser, content })`.
     - Clear input field.
  2. On socket receiving `chatMessage`:
     - If `receivedMsg.roomId === currentRoomId`, append to message array.

---

## 7. Complete Frontend Integration Example (React + TypeScript)

Here is a drop-in reference implementation for React using `socket.io-client`:

```tsx
import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  _id: string;
  roomId: string;
  sender: string;
  content: string;
  createdAt: string;
}

const API_BASE = "http://localhost:5000";

export const ChatRoom: React.FC<{ roomId: string; currentUser: string; token: string }> = ({
  roomId,
  currentUser,
  token
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputContent, setInputContent] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch historical messages
  useEffect(() => {
    fetch(`${API_BASE}/chat/${roomId}`)
      .then((res) => res.json())
      .then((data: Message[]) => setMessages(data))
      .catch((err) => console.error("Error loading chat history:", err));
  }, [roomId]);

  // 2. Initialize Socket.IO connection
  useEffect(() => {
    const socket = io(API_BASE, {
      auth: { token }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("joinRoom", roomId);
    });

    socket.on("connect_error", (err) => {
      setIsConnected(false);
      console.error("Socket authentication failed:", err.message);
    });

    // 3. Listen for incoming messages
    socket.on("chatMessage", (newMsg: Message) => {
      if (newMsg.roomId === roomId) {
        setMessages((prev) => [...prev, newMsg]);
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, token]);

  // 4. Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 5. Send message handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !socketRef.current) return;

    socketRef.current.emit("chatMessage", {
      roomId,
      sender: currentUser,
      content: inputContent
    });

    setInputContent("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 600, margin: "auto" }}>
      {/* Header */}
      <div style={{ padding: 12, borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
        <h3>Room: #{roomId}</h3>
        <span>{isConnected ? "🟢 Online" : "🔴 Disconnected"}</span>
      </div>

      {/* Message List */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.map((msg) => {
          const isMe = msg.sender === currentUser;
          return (
            <div
              key={msg._id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                marginBottom: 12
              }}
            >
              <span style={{ fontSize: 12, color: "#888", marginBottom: 2 }}>
                {msg.sender} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <div
                style={{
                  background: isMe ? "#007bff" : "#e9ecef",
                  color: isMe ? "#fff" : "#000",
                  padding: "8px 14px",
                  borderRadius: 16,
                  maxWidth: "75%",
                  wordBreak: "break-word"
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} style={{ display: "flex", padding: 12, borderTop: "1px solid #ddd" }}>
        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc", marginRight: 8 }}
        />
        <button type="submit" style={{ padding: "10px 18px", borderRadius: 8, background: "#007bff", color: "#fff", border: "none" }}>
          Send
        </button>
      </form>
    </div>
  );
};
```

---

## 8. Summary Table of All Endpoints & Events

| Type | Name / Route | Method / Direction | Payload / Parameters | Purpose |
|---|---|---|---|---|
| **REST** | `/auth/register` | `POST` | `{ username, password }` | Register new user account |
| **REST** | `/auth/login` | `POST` | `{ username, password }` | Authenticate and obtain JWT token |
| **REST** | `/chat/:roomId` | `GET` | `roomId` in URL path | Load all message history for a room |
| **REST** | `/chat/:roomId` | `POST` | `{ sender, content }` | Send/persist a message via HTTP |
| **Socket** | `connection` | Handshake (Client -> Server) | `auth: { token: string }` | Connect to real-time server with JWT |
| **Socket** | `joinRoom` | Client -> Server | `roomId: string` | Subscribe socket to specific room updates |
| **Socket** | `chatMessage` | Client -> Server | `{ roomId, sender, content }` | Send message to room in real-time |
| **Socket** | `chatMessage` | Server -> Client | Full message object `{ _id, roomId, sender, content, createdAt }` | Receive real-time message in the room |
| **Socket** | `connect_error` | Server -> Client | `{ message: "Authentication error" }` | Triggered when JWT is missing or invalid |
