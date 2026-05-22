# Backend Documentation

This document describes the backend-only system in `apps/backend` as it exists in the repository today.

## 1. Backend Overview

The backend is a Node.js service built with:

- `Express` for HTTP APIs
- `Socket.IO` for realtime events
- `Prisma` for database access
- `PostgreSQL` as the primary datastore
- `@whiskeysockets/baileys` for WhatsApp Web connectivity
- `multer`, `csv-parser`, and `ffmpeg-static` for media and import workflows
- `jsonwebtoken` and `bcryptjs` for authentication

The backend is responsible for:

- authenticating users
- connecting to WhatsApp
- receiving and sending WhatsApp messages
- storing contacts, conversations, and messages
- managing automation rules
- handling broadcast campaigns
- exposing analytics
- managing teams and team members
- emitting realtime updates to the frontend

## 2. Runtime Entry Point

The server starts from [`apps/backend/src/index.ts`](../apps/backend/src/index.ts).

At startup it:

- creates an Express app
- attaches CORS with a frontend-only allow list
- mounts JSON and URL-encoded body parsing
- creates an `uploads` directory if it does not exist
- serves `uploads` statically under `/uploads`
- mounts all API route groups under `/api/*`
- starts the HTTP server on `PORT` or `4000`
- automatically connects to WhatsApp unless `WHATSAPP_AUTO_CONNECT=false`

It also creates a shared `Socket.IO` server and binds it through the realtime layer.

## 3. High-Level Feature Set

### 3.1 Authentication

The backend supports:

- user registration
- login
- access token generation
- refresh token generation
- logout
- current-user lookup via `/me`

Implemented auth routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Partially stubbed routes:

- `POST /api/auth/verify-email`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### 3.2 WhatsApp Integration

The backend manages a WhatsApp session using Baileys and exposes:

- connection status
- QR code retrieval
- manual connect/disconnect
- auth reset
- direct message sending
- webhook ingestion

Implemented routes:

- `POST /api/whatsapp/connect`
- `POST /api/whatsapp/reset-auth`
- `GET /api/whatsapp/status`
- `GET /api/whatsapp/qr`
- `POST /api/whatsapp/disconnect`
- `POST /api/whatsapp/send`
- `POST /api/whatsapp/webhook`

### 3.3 Conversations

The backend stores conversation records and supports:

- listing conversations
- filtering by status
- searching by contact name or phone
- reading a single conversation with full message history
- updating conversation status
- assigning a conversation to an agent
- replying to a conversation with text or media

Implemented routes:

- `GET /api/conversations`
- `GET /api/conversations/:id`
- `PUT /api/conversations/:id/status`
- `PUT /api/conversations/:id/assign`
- `POST /api/conversations/:id/reply`

### 3.4 Contacts

The backend supports:

- listing contacts
- filtering by search or tag
- creating contacts
- updating contacts
- deleting contacts
- importing contacts from CSV

Implemented routes:

- `GET /api/contacts`
- `POST /api/contacts`
- `PUT /api/contacts/:id`
- `DELETE /api/contacts/:id`
- `POST /api/contacts/import`

### 3.5 Automations

The backend supports CRUD for automation rules and a toggle action.

Implemented routes:

- `GET /api/automations`
- `POST /api/automations`
- `PUT /api/automations/:id`
- `DELETE /api/automations/:id`
- `PUT /api/automations/:id/toggle`

Supported rule evaluation in the current engine:

- keyword match
- first message
- any message
- outside hours

The Prisma schema defines additional trigger types, but the engine currently only implements a subset.

### 3.6 Broadcasts

The backend supports:

- listing broadcasts
- reading a broadcast and its recipients
- creating broadcasts
- updating broadcasts
- sending broadcasts
- deleting broadcasts
- reading broadcast statistics

Implemented routes:

- `GET /api/broadcasts`
- `GET /api/broadcasts/:id`
- `POST /api/broadcasts`
- `PUT /api/broadcasts/:id`
- `POST /api/broadcasts/:id/send`
- `DELETE /api/broadcasts/:id`
- `GET /api/broadcasts/:id/stats`

### 3.7 Analytics

The backend exposes dashboard-style analytics:

- overview metrics
- message chart data for the last 30 days

Implemented routes:

- `GET /api/analytics/overview`
- `GET /api/analytics/messages`

### 3.8 Team Management

The backend supports:

- viewing a team with members
- creating a team
- adding a member
- removing a member
- changing a member role

Implemented routes:

- `GET /api/teams`
- `POST /api/teams`
- `POST /api/teams/:id/members`
- `DELETE /api/teams/:id/members/:userId`
- `PUT /api/teams/:id/members/:userId/role`

## 4. Authentication Design

### 4.1 Login Flow

On login, the backend:

- looks up the user by email
- checks the password with bcrypt
- signs a short-lived access token
- signs a refresh token
- stores the refresh token in an HttpOnly cookie

### 4.2 Registration Flow

On registration, the backend:

- validates `name`, `email`, and `password`
- checks whether the email already exists
- hashes the password
- creates the user
- automatically creates a personal team for that user
- updates the user to `ADMIN`
- returns access and refresh tokens

### 4.3 Token Strategy

Access token:

- TTL: `15m`
- includes `id`, `email`, `name`, `role`, `teamId`

Refresh token:

- TTL: 7 days
- stored in the `refreshToken` cookie
- also accepted from the `Authorization: Bearer` header during refresh

Logout:

- adds the refresh token to an in-memory revoked-token set
- clears the cookie

### 4.4 Security Notes

The auth implementation currently has a few important properties:

- login throttling is in-memory only
- revoked refresh tokens are in-memory only
- email verification and password reset endpoints are not implemented

This means auth state is not fully durable across server restarts yet.

## 5. Permission and Access Control

The codebase contains `checkPermission(action, resource)` in [`apps/backend/src/auth/auth.middleware.ts`](../apps/backend/src/auth/auth.middleware.ts), but it currently acts as a pass-through and does not enforce permissions.

That means:

- the route layer is written as if role-based authorization exists
- the actual enforcement logic still needs to be implemented

This is one of the biggest backend improvement areas.

## 6. Data Model

The database schema lives in:

- [`apps/backend/prisma/schema.prisma`](../apps/backend/prisma/schema.prisma)

### 6.1 User

Stores system users.

Key fields:

- `name`
- `email`
- `password`
- `role`
- `teamId`
- `emailVerifiedAt`
- `resetToken`
- `resetTokenExpiry`
- `refreshTokenId`

Roles:

- `SUPER_ADMIN`
- `ADMIN`
- `TEAM_LEAD`
- `AGENT`
- `ANALYST`
- `VIEWER`

### 6.2 Team

Represents a workspace or organizational unit.

Key fields:

- `name`
- `ownerId`
- members relation

### 6.3 WhatsAppSession

Stores serialized WhatsApp session data.

### 6.4 Contact

Stores WhatsApp contacts.

Key fields:

- `phone`
- `name`
- `email`
- `tag`
- `notes`
- `status`
- `lifecycleStage`
- `source`
- `customFields`
- `teamId`

### 6.5 Conversation

Represents a contact conversation thread.

Key fields:

- `contactId`
- `teamId`
- `status`
- `priority`
- `assignedTo`
- `lastMessage`
- `lastMessagePreview`
- `lastMessageAt`
- `notes`
- `unreadCount`

Conversation statuses:

- `OPEN`
- `RESOLVED`
- `PENDING`
- `ON_HOLD`
- `ARCHIVED`
- `SPAM`

Priorities:

- `LOW`
- `NORMAL`
- `HIGH`
- `URGENT`

### 6.6 Message

Stores every inbound and outbound message.

Key fields:

- `externalId`
- `sessionId`
- `direction`
- `from`
- `to`
- `phone`
- `conversationId`
- `fromMe`
- `body`
- `type`
- media metadata
- `timestamp`
- `status`
- delivery/read timestamps
- `retryCount`

Message types:

- `TEXT`
- `IMAGE`
- `DOCUMENT`
- `AUDIO`
- `VIDEO`

Message directions:

- `INBOUND`
- `OUTBOUND`

Message statuses:

- `RECEIVED`
- `PROCESSED`
- `SENT`
- `DELIVERED`
- `READ`
- `FAILED`

### 6.7 AutomationRule

Stores automation rules.

Key fields:

- `name`
- `trigger`
- `keyword`
- `response`
- `isActive`

### 6.8 Broadcast

Stores a broadcast campaign.

Key fields:

- `name`
- `description`
- `message`
- `status`
- `type`
- `scheduledAt`
- `recurringCron`
- `timezone`
- `sentAt`
- `totalSent`
- `totalFailed`

### 6.9 BroadcastRecipient

Tracks each recipient in a broadcast.

Key fields:

- `broadcastId`
- `phone`
- `status`

### 6.10 Analytics

Daily metrics snapshot.

Key fields:

- `date`
- `totalMessages`
- `incomingMessages`
- `outgoingMessages`
- `newContacts`
- `resolvedConvs`
- `automationsFired`

### 6.11 AuditLog

An audit table exists in the schema, but there is no visible service layer using it yet.

## 7. WhatsApp Connection Lifecycle

The WhatsApp client lives in [`apps/backend/src/whatsapp/client.ts`](../apps/backend/src/whatsapp/client.ts).

### 7.1 Startup Behavior

If auto-connect is enabled, the backend starts a WhatsApp connection on server launch.

### 7.2 Connection States

The backend tracks:

- `connecting`
- `connected`
- `disconnected`

It also stores:

- current QR code
- last connection error
- reconnect timer

### 7.3 Reconnect Behavior

If the connection closes and the session was not explicitly logged out, the backend schedules a reconnect after a short delay.

### 7.4 Realtime WhatsApp Events

The backend emits realtime events for:

- `wa:qr`
- `wa:status`

## 8. Message Inbound Pipeline

Inbound WhatsApp messages are processed in [`apps/backend/src/workflow/inbound-workflow.ts`](../apps/backend/src/workflow/inbound-workflow.ts).

### 8.1 Input Sources

The pipeline accepts:

- socket-upsert messages from Baileys
- webhook payloads posted to `/api/whatsapp/webhook`

### 8.2 Normalization

The inbound processor:

- unwraps nested WhatsApp payloads
- ignores group chats and broadcast messages
- extracts a phone number
- extracts message body or caption
- maps message type to Prisma message type
- normalizes timestamp
- extracts media metadata
- builds a stable `externalId`

### 8.3 Duplicate Protection

Messages are deduplicated using:

- `externalId`
- `sessionId`

### 8.4 Contact and Conversation Resolution

Incoming messages are matched against an existing contact or create a new contact if needed.

Then the backend:

- gets or creates a conversation
- deletes duplicate conversations if multiple match the same contact

### 8.5 Message Persistence

The backend stores:

- inbound message row
- conversation last-message preview
- unread count increment
- message status progression

### 8.6 Realtime Updates

The backend emits:

- `message:new`
- `conversation:updated`
- `message:status` on failure updates

### 8.7 Automation Triggering

After storing an inbound message, the backend evaluates active automations and may send an automated reply.

## 9. Outbound Message Pipeline

Outgoing messages are handled by [`apps/backend/src/whatsapp/sender.ts`](../apps/backend/src/whatsapp/sender.ts).

### 9.1 Validation

Before sending, the backend checks:

- WhatsApp must be connected
- the phone number must be valid
- the message or media must not be empty
- the recipient must exist on WhatsApp

### 9.2 Media Support

The sender supports:

- image
- video
- audio
- sticker
- document

Audio is transcoded to OGG/Opus using FFmpeg when needed.

### 9.3 Persistence

After sending, the backend stores:

- outbound message row
- updated conversation last message fields

### 9.4 Realtime Updates

The backend emits:

- `message:new`
- `new_message`
- `conversation:updated`

### 9.5 Retry Behavior

Sending uses a retry helper with exponential backoff.

## 10. Contacts System

The contacts service supports robust phone normalization and deduplication.

Implemented in:

- [`apps/backend/src/contacts/contacts.service.ts`](../apps/backend/src/contacts/contacts.service.ts)
- [`apps/backend/src/lib/phone.ts`](../apps/backend/src/lib/phone.ts)

### 10.1 Phone Normalization

The backend tries to normalize numbers into E.164-like form and also derives alternative matching variants.

### 10.2 Contact Deduplication

When creating a contact, the backend looks for matching phone variants and updates the existing record instead of creating a duplicate.

### 10.3 Contact Deletion

Deleting a contact also deletes related conversations and messages in a transaction.

### 10.4 CSV Import

CSV import expects columns like:

- `phone`
- `name`
- `tag`

Rows that fail are skipped rather than aborting the full import.

## 11. Conversation System

The conversation service in [`apps/backend/src/conversations/conversations.service.ts`](../apps/backend/src/conversations/conversations.service.ts) provides:

- listing with filters
- loading full history
- status updates
- assignment to an agent
- reply sending

### 11.1 Listing

Supports filtering by:

- `status`
- search term against contact name and phone
- team

### 11.2 Replying

Replies can include:

- text only
- media attachment
- media caption

The backend writes uploaded reply media to the `uploads` folder.

## 12. Automation Engine

The automation engine in [`apps/backend/src/automations/engine.ts`](../apps/backend/src/automations/engine.ts) currently supports:

- keyword trigger
- first message trigger
- any message trigger
- outside-hours trigger

When a rule fires, it:

- optionally waits for a configured delay
- retries sending the response
- increments daily automation analytics
- logs the event

### 12.1 Important Limitation

The Prisma schema defines many more trigger types than the engine currently executes.

That means the schema is ahead of the runtime implementation.

## 13. Broadcast System

The broadcast service in [`apps/backend/src/broadcasts/broadcasts.service.ts`](../apps/backend/src/broadcasts/broadcasts.service.ts) supports full campaign lifecycle management.

### 13.1 Creation

Creating a broadcast:

- stores the campaign
- creates recipient rows
- marks it `DRAFT` or `SCHEDULED`

### 13.2 Sending

When a broadcast is sent:

- status changes to `SENDING`
- each recipient is processed one by one
- a random delay is inserted between sends
- each recipient status is updated
- realtime progress is emitted
- final totals are stored

### 13.3 Realtime Events

The backend emits:

- `broadcast:progress`
- `broadcast:complete`

### 13.4 Observed Limitation

The send flow is synchronous and process-bound, not queue-driven yet.

For large campaigns, this is likely a performance and reliability improvement target.

## 14. Analytics

The analytics service in [`apps/backend/src/analytics/analytics.service.ts`](../apps/backend/src/analytics/analytics.service.ts) provides:

- total contacts
- open conversations
- messages sent today
- automations fired today
- 30-day incoming/outgoing chart data

It also contains a daily snapshot updater that can recompute:

- total messages
- incoming messages
- outgoing messages
- new contacts
- resolved conversations

## 15. Realtime Layer

The realtime layer is small and centralized in [`apps/backend/src/realtime/socket.ts`](../apps/backend/src/realtime/socket.ts).

It exposes:

- `bindRealtimeServer`
- `emitRealtime`
- `getRealtimeServer`

Used events include:

- WhatsApp connection state
- QR generation
- new messages
- conversation updates
- broadcast progress and completion
- failed message status

## 16. API Surface Summary

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### WhatsApp

- `POST /api/whatsapp/connect`
- `POST /api/whatsapp/reset-auth`
- `GET /api/whatsapp/status`
- `GET /api/whatsapp/qr`
- `POST /api/whatsapp/disconnect`
- `POST /api/whatsapp/send`
- `POST /api/whatsapp/webhook`

### Conversations

- `GET /api/conversations`
- `GET /api/conversations/:id`
- `PUT /api/conversations/:id/status`
- `PUT /api/conversations/:id/assign`
- `POST /api/conversations/:id/reply`

### Contacts

- `GET /api/contacts`
- `POST /api/contacts`
- `PUT /api/contacts/:id`
- `DELETE /api/contacts/:id`
- `POST /api/contacts/import`

### Automations

- `GET /api/automations`
- `POST /api/automations`
- `PUT /api/automations/:id`
- `DELETE /api/automations/:id`
- `PUT /api/automations/:id/toggle`

### Broadcasts

- `GET /api/broadcasts`
- `GET /api/broadcasts/:id`
- `POST /api/broadcasts`
- `PUT /api/broadcasts/:id`
- `POST /api/broadcasts/:id/send`
- `DELETE /api/broadcasts/:id`
- `GET /api/broadcasts/:id/stats`

### Analytics

- `GET /api/analytics/overview`
- `GET /api/analytics/messages`

### Teams

- `GET /api/teams`
- `POST /api/teams`
- `POST /api/teams/:id/members`
- `DELETE /api/teams/:id/members/:userId`
- `PUT /api/teams/:id/members/:userId/role`

## 17. Known Gaps and Improvement Targets

These are the main backend issues visible from the code:

- `checkPermission()` is not implemented and currently does not enforce authorization
- `authMiddleware` does not appear to decode or attach authenticated user data
- login throttling and refresh-token revocation are in-memory only
- password reset and email verification are placeholders
- broadcast sending is synchronous and not queued
- some schema trigger types are not yet implemented in the automation engine
- audit logging exists in the schema but is not wired into services
- some route handlers assume `req.user` exists even though the middleware layer does not yet populate it in the code shown

## 18. Backend Improvement Roadmap

If you want to improve the backend next, the highest-value order is probably:

1. Implement real authentication middleware and permission checks.
2. Move session, token, and rate-limit state to persistent storage.
3. Add queue processing for broadcasts and long-running tasks.
4. Expand automation triggers to match the Prisma schema.
5. Add audit logging around security-sensitive actions.
6. Add tests for message ingestion, contact deduplication, and broadcast delivery.

