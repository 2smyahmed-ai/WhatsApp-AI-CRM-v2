# WhatsApp CRM System — Full Technical Documentation

> **Audience**: Senior engineers inheriting, extending, or scaling this system.
> **Scope**: End-to-end architecture, every API endpoint, every data model, every frontend page, security analysis, performance analysis, and a concrete upgrade roadmap toward a WATI-grade SaaS product.
> **Last updated**: 2026-05-09

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Frontend Documentation](#3-frontend-documentation)
4. [Backend Documentation](#4-backend-documentation)
5. [Database Design](#5-database-design)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [WhatsApp Integration](#7-whatsapp-integration)
8. [Real-Time Features](#8-real-time-features)
9. [Current Features Breakdown](#9-current-features-breakdown)
10. [Performance Analysis](#10-performance-analysis)
11. [Scalability Analysis](#11-scalability-analysis)
12. [Code Quality Review](#12-code-quality-review)
13. [Security Review](#13-security-review)
14. [DevOps & Deployment](#14-devops--deployment)
15. [Missing Features vs WATI](#15-missing-features-vs-wati)
16. [Upgrade Roadmap](#16-upgrade-roadmap)

---

## 1. PROJECT OVERVIEW

### 1.1 Project Name
**WhatsApp CRM System** (internal codename: `WHATSAPP SYSTEM BAILEYES`)

### 1.2 Purpose and Business Goals
A multi-tenant WhatsApp-based customer relationship management (CRM) platform targeting businesses that need to:
- Manage inbound/outbound WhatsApp conversations at scale
- Assign conversations to sales or support agents
- Send bulk broadcast campaigns to segmented contact lists
- Automate responses via keyword/time-based rules and multi-step flows
- Build rich message templates with a visual block-based editor
- Track leads through a deals pipeline
- Measure team productivity through an analytics dashboard

The end goal is a **SaaS product** where multiple businesses (tenants) each connect their own WhatsApp number and manage their customer interactions from a shared hosted platform, similar to [WATI](https://www.wati.io), [Respond.io](https://respond.io), or [Interakt](https://www.interakt.shop).

### 1.3 Target Users
| Role | Description |
|------|-------------|
| **Business Owner / Admin** | Configures the system, manages agents, views analytics |
| **Team Lead** | Supervises agent work, assigns conversations |
| **Agent** | Replies to conversations, manages contacts |
| **Analyst** | Read-only access to analytics and reports |
| **Viewer** | Read-only, cannot send messages |

### 1.4 Core Features Currently Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| WhatsApp QR connection (Baileys) | ✅ Done | Single session per backend instance |
| Inbound message processing | ✅ Done | Full normalization, dedup, media download |
| Outbound messaging | ✅ Done | Text + media (image/video/audio/document) |
| Real-time Socket.IO updates | ✅ Done | Scoped to `team:<teamId>` + `user:<userId>` personal rooms |
| Contact management (CRUD + import) | ✅ Done | CSV import, phone normalization, tag management |
| Conversation management | ✅ Done | Filtering, search, assignment, status, priority |
| Conversation pin / snooze | ✅ Done | Pin to top; snooze sets ON_HOLD + auto-wakeup scheduler |
| Saved inbox views | ✅ Done | Bookmark filter state to localStorage chips |
| Internal notes on conversations | ✅ Done | Agent-only visibility |
| Typing indicators | ✅ Done | Peer agent typing via socket; WA contact indicator |
| Sound & browser notifications | ✅ Done | NotificationProvider, requestPermission |
| Automation rules engine | ✅ Done | KEYWORD / FIRST_MESSAGE / ANY_MESSAGE / OUTSIDE_HOURS + 10 more trigger types |
| Multi-step automation flows | ✅ Done | SEND_MESSAGE + WAIT steps, BullMQ delayed, stop-on-reply |
| Automation flow executions tracking | ✅ Done | `AutomationFlowExecution` model tracks running/completed/stopped state |
| No-reply detector | ✅ Done | Polls every 5 min, fires NO_RESPONSE_TIME flows after 30 min |
| Snooze wakeup scheduler | ✅ Done | Runs every 60s, auto-reopens expired snoozed conversations |
| Broadcast campaigns | ✅ Done | BullMQ-backed, tag-based segmentation, pause/resume, scheduled, recurring |
| Broadcast randomized delay | ✅ Done | 1.5s–4s between sends (configurable via env) |
| Saved replies (templates) | ✅ Done | Shortcut-triggered, {{name}}/{{phone}} variables |
| Message Templates system | ✅ Done | Full CRUD, TEXT/MEDIA/INTERACTIVE types, DRAFT/PUBLISHED/ARCHIVED lifecycle |
| Visual template builder | ✅ Done | Drag-and-drop 7 block types: Text, Buttons, Media, Promo, Product, Reminder, Support |
| Template preset library | ✅ Done | 9 built-in templates across Sales, E-commerce, Appointments, Support, Welcome, Follow-up |
| Template variable rendering | ✅ Done | Server-side `POST /api/templates/:id/render` with variable substitution |
| Tag management | ✅ Done | Relational tags with color, CRUD, per-team, real-time socket events |
| Tag workspace page | ✅ Done | Dedicated `/tags` page with contact filtering by tag |
| Deals pipeline | ✅ Done | Stages: NEW → INTERESTED → NEGOTIATION → CLOSED; quick advance button |
| Task / follow-up management | ✅ Done | Priority, due dates, conversation links, IN_PROGRESS status |
| Team management | ✅ Done | Members, role assignments, auto-assign toggle |
| Round-robin auto-assignment | ✅ Done | Per-team opt-in (`autoAssign` flag), least-busy routing |
| User management | ✅ Done | Admin CRUD, roles |
| Analytics dashboard | ✅ Done | Overview KPIs + 30-day message chart + agent performance (incl. avg first response time) + pipeline funnel |
| Agent first response time tracking | ✅ Done | `avgFirstResponseMin` per agent in analytics |
| Contact timeline | ✅ Done | Combined conversations + deals + tasks + notes in one view |
| Reply-to quoting | ✅ Done | Visual quoted bubble, `replyToId`/`replyToBody` stored |
| Message reactions | ✅ Done | Toggle emoji reactions, synced to WhatsApp, real-time via socket, grouped pills |
| Contact reactions tracking | ✅ Done | `contactPhone` field on `MessageReaction` captures WhatsApp-side reactions |
| Message search | ✅ Done | Within-conversation full-text search |
| Message forward | ✅ Done | Modal picks target conversation, sends body as reply |
| Emoji picker | ✅ Done | 6 categories + search, 8-column grid |
| Assignment history panel | ✅ Done | GitBranch tab in chat right panel, reads audit log |
| Dark / light theme toggle | ✅ Done | ThemeProvider + localStorage, Sun/Moon in Header |
| Onboarding wizard | ✅ Done | Bottom-right floating checklist (4 steps, dismissible) |
| Audit log | ✅ Done | Action tracking across resources |
| JWT authentication | ✅ Done | Access + refresh tokens, auto-refresh on 401/403 |
| Role-based access control | ✅ Done | 6 roles with permission matrix |
| CSV export utility | ✅ Done | `lib/exportCsv.ts` — client-side CSV download for any data set |
| Dedicated file upload endpoint | ✅ Done | `POST /api/upload` — 32 MB limit, UUID-named files |
| Data table component system | ✅ Done | shadcn/ui `@tanstack/react-table` integration with column headers, pagination, bulk bar, toolbar |
| Premium UI design system | ✅ Done | shadcn/ui components (button, input, card, tabs, checkbox, select, dropdown-menu) |

### 1.5 Missing Features Compared to WATI
*(detailed in Section 15)*
- Multi-WhatsApp-session support (one number per team/tenant)
- Official WhatsApp Business API (Meta Cloud API) — currently uses unofficial Baileys
- Visual chatbot flow builder with CONDITION/ASSIGN/TAG/END nodes (current flows: SEND_MESSAGE + WAIT only)
- WhatsApp Message Templates (HSM) with Meta approval workflow
- Contact opt-in / opt-out management
- Multi-language support
- White-label / custom domain per tenant
- Billing and subscription management
- Advanced analytics (CSAT, SLA breach tracking)
- SLA / escalation rules
- Email and webhook notification channels
- Broadcast personalization variables ({{name}})

---

## 2. SYSTEM ARCHITECTURE

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Next.js 16.2.2 Frontend (React 18 + TypeScript 5)      │    │
│  │  Port: 3000                                              │    │
│  │  - App Router pages (15 routes)                          │    │
│  │  - useState / useCallback (direct state management)      │    │
│  │  - shadcn/ui + @tanstack/react-table component library   │    │
│  │  - Socket.IO client 4.x (real-time, optimistic updates)  │    │
│  │  - lib/api.ts (fetch wrapper + auto token refresh)       │    │
│  └────────────────────────┬────────────────────────────────┘    │
└───────────────────────────│──────────────────────────────────────┘
                            │ HTTP REST + WebSocket
┌───────────────────────────▼──────────────────────────────────────┐
│                         API LAYER                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Express.js Backend (Node.js + TypeScript)               │    │
│  │  Port: 4000                                              │    │
│  │  - 16 route groups                                       │    │
│  │  - JWT auth middleware (checkPermission per resource)    │    │
│  │  - Socket.IO server (team-scoped + user-personal rooms)  │    │
│  │  - Multer (file uploads, 32 MB limit)                    │    │
│  │  - BullMQ worker (broadcasts + automation flow steps)    │    │
│  │  - No-reply detector (setInterval, every 5 min)          │    │
│  │  - Snooze wakeup scheduler (setInterval, every 60 s)     │    │
│  └────────┬───────────────────────────────┬────────────────┘    │
└───────────│───────────────────────────────│──────────────────────┘
            │                               │
┌───────────▼──────────┐   ┌───────────────▼──────────────────────┐
│   DATA LAYER         │   │   MESSAGING LAYER                     │
│  ┌────────────────┐  │   │  ┌────────────────────────────────┐  │
│  │  PostgreSQL    │  │   │  │  Baileys 7.x (WhatsApp Web)    │  │
│  │  Port: 5433    │  │   │  │  Multi-file auth state         │  │
│  │  (via Prisma 5)│  │   │  │  auto-reconnect logic          │  │
│  └────────────────┘  │   │  └────────────────────────────────┘  │
│  ┌────────────────┐  │   │  ┌────────────────────────────────┐  │
│  │  Redis         │  │   │  │  Bull 4.x Queue                │  │
│  │  Port: 6380    │  │   │  │  (broadcasts + flow steps)     │  │
│  │  (Bull only)   │  │   │  └────────────────────────────────┘  │
│  └────────────────┘  │   └───────────────────────────────────────┘
└──────────────────────┘
```

### 2.2 Architecture Pattern
The backend follows a **layered MVC-service pattern**:

```
Routes (HTTP routing)
  → Middleware (authMiddleware, checkPermission, multer)
    → Controllers (thin — req/res parsing only, inline in routes)
      → Services (all business logic)
        → Prisma ORM (data access)
          → PostgreSQL
```

There is no dependency injection container. Services are singleton classes with static methods imported directly. The `prisma` client is a shared singleton exported from `src/lib/prisma.ts`.

### 2.3 Data Flow — Inbound Message Lifecycle

```
[WhatsApp]
  │ Message from contact
  ▼
[Baileys socket: messages.upsert]
  │ processIncomingMessage()
  ▼
[inbound-workflow.ts]
  │ normalizePhone() → getOrCreateConversationByPhone()
  │   → deduplicates contacts + conversations
  │   → merges duplicate conversations (deletes stale, keeps latest)
  │ downloadMediaMessage() (if non-text, 15s timeout)
  │ prisma.message.create()
  │ prisma.conversation.update({ lastMessage, unreadCount++ })
  │ emitRealtime('message:new', fullMessage, teamId)
  │ emitRealtime('conversation:updated', conv, teamId)
  │ checkAutomationRules() → triggerFlows()
  ▼
[Socket.IO: team:<teamId> room]
  │
  ├─► [ConversationList] appends lastMessage preview, increments unread badge
  └─► [ChatWindow] appends message directly to state (no HTTP refetch)
```

### 2.4 Data Flow — Outbound Message Lifecycle

```
[Agent in ChatWindow]
  │ POST /api/conversations/:id/reply  (multipart/form-data)
  ▼
[conversations.routes.ts]
  │ authMiddleware → checkPermission('create', 'messages')
  │ multer({ storage: memoryStorage() }) — file buffered in RAM
  │ Write file to uploads/ with UUID filename
  ▼
[ConversationsService.sendReply]
  │ normalizePhone → sender.sendMessage()
  ▼
[sender.ts]
  │ sock.sendMessage(jid, content) — Baileys, 3 retries
  │ prisma.message.create({ direction: 'OUTBOUND' })
  │ prisma.conversation.update({ lastMessage, lastMessageAt })
  │ emitRealtime('message:new', message, teamId)
  │ emitRealtime('conversation:updated', conv, teamId)
  ▼
[Socket.IO: team:<teamId> room]
  └─► All team clients receive the new message instantly
```

### 2.5 Data Flow — Reaction Sync

```
[Agent clicks emoji on message]
  │ POST /api/conversations/:id/messages/:messageId/reactions
  ▼
[conversations.routes.ts]
  │ Upsert/delete MessageReaction in DB (toggle logic)
  │ Sync to WhatsApp via sock.sendMessage({ react: { text, key } })
  │ emitRealtime('message:reaction', { reactions[] }, teamId)
  ▼
[Frontend] Updates reaction pills in ChatWindow
```

### 2.6 Deployment Architecture (Current State)

```
┌─────────────────────────────────┐
│  Developer Machine / Single VPS │
│                                 │
│  docker-compose.yml:            │
│  ├─ postgres:5433               │
│  └─ redis:6380                  │
│                                 │
│  Node processes:                │
│  ├─ backend (ts-node :4000)     │
│  └─ frontend (next dev :3000)   │
└─────────────────────────────────┘
```

**Current state**: Single-machine monorepo, development-mode only. No containerization of the application itself, no CI/CD, no reverse proxy, no SSL.

---

## 3. FRONTEND DOCUMENTATION

### 3.1 Technology Stack
| Dependency | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.2.2 | React framework with App Router |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.4.x | Utility-first styling |
| shadcn/ui | 4.2.0 | Accessible component primitives |
| @tanstack/react-table | 8.21.3 | Headless data table |
| @tanstack/react-query | 5.x | Installed, available for future use |
| Socket.IO client | 4.7.x | WebSocket real-time |
| NextAuth.js | 4.24.x | Session management |
| Lucide React | 0.400.x | Icon library |
| Recharts | 2.10.x | Charts (analytics pages) |
| Axios | 1.6.x | Installed, unused (api.ts uses fetch) |
| react-hook-form | 7.49.x | Form management |
| Zod | 3.22.x | Schema validation |
| date-fns | 3.x | Date formatting |
| class-variance-authority | 0.7.x | Component variant system |
| clsx + tailwind-merge | latest | Class merging utilities |
| tw-animate-css | 1.4.x | CSS animation utilities |
| radix-ui | 1.4.x | Headless UI primitives |

> **Note on React Query**: `@tanstack/react-query` is in `package.json` but not yet wired up to a `QueryClientProvider`. State is managed via `useState`/`useCallback` + direct `api.get/post/put` calls. Pages that need caching or deduplication should migrate to React Query in future iterations.

### 3.2 Directory Structure

```
apps/frontend/
├── app/                                  # Next.js App Router
│   ├── layout.tsx                        # Root layout (ThemeProvider, SessionProvider)
│   ├── page.tsx                          # Root redirect (→ /dashboard)
│   ├── login/page.tsx                    # Login page (NextAuth credentials)
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Dashboard shell (Sidebar + Header + Notifications + Onboarding)
│   │   ├── dashboard/page.tsx            # Analytics overview — KPIs, chart, agents, pipeline
│   │   ├── conversations/page.tsx        # Main inbox — conversation list + chat window
│   │   ├── contacts/page.tsx             # Contact directory + timeline + tag management
│   │   ├── tags/page.tsx                 # Tag workspace — create/filter/assign tags
│   │   ├── saved-replies/page.tsx        # Saved reply shortcut management
│   │   ├── templates/
│   │   │   ├── page.tsx                  # Template library (My Templates + Preset Library tabs)
│   │   │   └── builder/page.tsx          # Visual block-based template builder
│   │   ├── deals/page.tsx                # Sales pipeline kanban
│   │   ├── tasks/page.tsx                # Follow-up task management
│   │   ├── broadcasts/
│   │   │   ├── page.tsx                  # Broadcast campaign list
│   │   │   ├── new/page.tsx              # Create broadcast (uses BroadcastForm)
│   │   │   └── [id]/edit/page.tsx        # Edit existing broadcast
│   │   ├── automations/page.tsx          # Rules + multi-step flows
│   │   ├── settings/page.tsx             # WhatsApp QR connection
│   │   └── admin/
│   │       ├── users/page.tsx            # Admin user CRUD
│   │       └── teams/page.tsx            # Admin teams + auto-assign toggle
│   └── api/auth/[...nextauth]/route.ts   # NextAuth handler
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx                   # Collapsible nav (mobile slide-in, desktop fixed)
│   │   └── Header.tsx                    # Theme toggle, user pill, role badge, logout
│   ├── conversations/
│   │   ├── ConversationList.tsx          # Inbox with saved views, pin, snooze, typing
│   │   ├── ChatWindow.tsx                # Chat UI, reply, media, voice note
│   │   ├── MessageBubble.tsx             # Bubble + reactions + voice player
│   │   ├── AssignmentHistory.tsx         # Audit log tab in right panel
│   │   ├── ForwardModal.tsx              # Forward message to another conversation
│   │   ├── InternalNotes.tsx             # Agent-only conversation notes
│   │   └── SaveContactModal.tsx          # Save unknown contact form
│   ├── contacts/
│   │   ├── ContactsTable.tsx             # Data table for contacts list
│   │   ├── ContactForm.tsx               # Create/edit contact form
│   │   ├── ContactTimeline.tsx           # Combined conversations/deals/tasks/notes view
│   │   └── ContactTagSelector.tsx        # Tag assignment UI for contacts
│   ├── dashboard/
│   │   ├── StatsCards.tsx                # KPI metric cards
│   │   ├── MessagesChart.tsx             # 30-day message volume chart (Recharts)
│   │   └── RecentConversations.tsx       # Recent conversations preview widget
│   ├── automations/
│   │   ├── RuleForm.tsx                  # Create/edit automation rule
│   │   ├── RuleCard.tsx                  # Rule display card with toggle
│   │   └── FlowBuilder.tsx               # Multi-step flow editor
│   ├── broadcasts/
│   │   └── BroadcastForm.tsx             # Broadcast creation/edit form
│   ├── shared/
│   │   ├── QRCodeDisplay.tsx             # WhatsApp QR code scanner component
│   │   └── ConnectionStatus.tsx          # WhatsApp connection status badge
│   ├── onboarding/
│   │   └── OnboardingWizard.tsx          # Bottom-right floating 4-step checklist
│   ├── providers/
│   │   ├── ThemeProvider.tsx             # dark/light, localStorage persistence
│   │   ├── SessionProvider.tsx           # NextAuth SessionProvider wrapper
│   │   └── NotificationProvider.tsx      # Sound + browser push notifications
│   └── ui/                               # shadcn/ui primitive components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── tabs.tsx
│       ├── checkbox.tsx
│       ├── select.tsx
│       ├── dropdown-menu.tsx
│       ├── EmojiPicker.tsx               # 6 categories, search, 8-column grid
│       └── data-table/
│           ├── DataTableColumnHeader.tsx # Sortable column header
│           ├── DataTablePagination.tsx   # Page size + navigation
│           ├── DataTableBulkBar.tsx      # Multi-row selection actions
│           └── DataTableToolbar.tsx      # Filters + search
├── hooks/
│   └── useSocket.ts                      # Socket.IO event subscription hook
├── lib/
│   ├── api.ts                            # Fetch wrapper (auto token refresh on 401/403)
│   ├── socket.ts                         # Socket.IO singleton (getSocket / default export)
│   ├── phone.ts                          # Client-side phone display formatting
│   ├── exportCsv.ts                      # Client-side CSV file download utility
│   ├── notifications.ts                  # Browser notification helpers
│   └── utils.ts                          # cn() — clsx + tailwind-merge
└── .env.local
```

### 3.3 State Management Pattern

The frontend uses **direct component state** (no global store):

```typescript
// Standard fetch pattern used throughout
const [data, setData] = useState([]);

useEffect(() => { fetchData(); }, [dep]);

async function fetchData() {
  const result = await api.get('/api/...');
  setData(result);
}

// Socket events update state directly (no refetch for messages)
useSocket('message:new', useCallback((data) => {
  setConversation(prev => ({
    ...prev,
    messages: [...(prev.messages ?? []), data.message]
  }));
}, [conversationId]));
```

Key design decision: socket handlers append/merge data directly into state rather than triggering HTTP refetches. This was changed from an earlier refetch-on-event pattern which caused latency and missed updates.

### 3.4 API Client — `lib/api.ts`

The fetch wrapper includes **automatic token refresh** on 401/403:

```typescript
export const api = {
  get:    (endpoint) => apiRequest(endpoint),
  post:   (endpoint, data) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put:    (endpoint, data) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
};

// apiRequest logic:
// 1. Get access token from NextAuth session (falls back to localStorage)
// 2. Make request with Authorization: Bearer <token>
// 3. On 401/403: call /api/auth/refresh → retry once with new token
// 4. On persistent failure: remove token from localStorage
```

`apiForm(endpoint, formData)` handles multipart uploads using the same auth + retry logic.

### 3.5 Page-by-Page Documentation

---

#### Page: Login (`app/login/page.tsx`)
**Purpose**: Authenticate user and establish session via NextAuth.

**API Call**: NextAuth credentials provider → `POST /api/auth/login`

---

#### Page: Dashboard (`app/(dashboard)/dashboard/page.tsx`)
**Purpose**: High-level KPI overview and pipeline analytics with live WhatsApp status.

**UI Behavior**:
- 4 KPI cards (via `StatsCards` component): Total Contacts, Open Conversations, Messages Today, Automations Fired Today
- Line/bar chart for 30-day message volume via `MessagesChart` (Recharts)
- Agent performance table: open/resolved conversations + **avg first response time in minutes**
- Pipeline funnel: 4 stage cards with deal counts, values, and overall conversion rate
- Live WhatsApp connection status via `ConnectionStatus` component
- Auto-refreshes all data every 60 seconds via `setInterval`
- Socket-driven KPI re-fetch on `message:new` events

**API Calls**:
- `GET /api/analytics/overview`
- `GET /api/analytics/messages`
- `GET /api/analytics/agents`
- `GET /api/analytics/pipeline`
- `GET /api/whatsapp/status`

---

#### Page: Conversations (`app/(dashboard)/conversations/page.tsx`)
**Purpose**: Main inbox — conversation list + chat window.

**UI Behavior**:
- Left panel: `ConversationList` with:
  - Search bar + bookmark (save current filter as named chip)
  - View tabs: All / Mine / My Team / Unassigned / Closed
  - Status filter pills: All / OPEN / PENDING / ON_HOLD / RESOLVED
  - Saved view chips (localStorage)
  - Per-item hover: Pin/Unpin, Snooze menu
  - Typing indicator dots on active conversations
  - Unread badge, snoozed bell icon
- Right panel: `ChatWindow` with:
  - Message history (newest at bottom, latest 50, cursor-paginated via `/messages`)
  - Hover toolbar per message: Reply-to, Copy, Forward
  - Quick react button (6-emoji popup), reaction pills (synced to WhatsApp)
  - Reply input: text, emoji picker, attachment picker (Image/Video/Audio/Document), voice note recorder
  - Saved reply autocomplete (`/shortcut` → expands with `{{name}}`/`{{phone}}`)
  - Message search within conversation
  - Right panel tabs: Details (status/pipeline/assign), Notes, History (audit log)
  - Peer agent typing indicator

**Socket Events Consumed**:
- `message:new` — appends message directly to state, no HTTP refetch
- `conversation:updated` — merges fields into conversation state
- `message:reaction` — updates reaction pills on specific message
- `typing:start` / `typing:stop` — peer typing indicator

---

#### Page: Contacts (`app/(dashboard)/contacts/page.tsx`)
**Purpose**: Contact directory with CRM data, timeline, and tag management.

**UI Behavior**:
- `ContactsTable` component with search and tag filter
- Slide-in detail panel: overview, `ContactTimeline`, tag assignment via `ContactTagSelector`
- CSV import via `POST /api/contacts/import`
- CSV export via `lib/exportCsv.ts` (client-side download)
- Socket-driven updates on `contact:tag_added` / `contact:tag_removed`

**API Calls**: `GET/POST/PUT/DELETE /api/contacts`, `POST /api/contacts/import`, `GET /api/contacts/:id`, `GET /api/tags`

---

#### Page: Tags (`app/(dashboard)/tags/page.tsx`)
**Purpose**: Tag management workspace — create tags with custom colors, filter contacts by tag.

**UI Behavior**:
- Left panel: tag list with color dots, contact count, delete button; create form with 8 color presets
- Right panel: contacts filtered by selected tag, with quick-link to start a conversation
- Real-time updates: socket events update tag counts without page refresh

**API Calls**: `GET/POST/PUT/DELETE /api/tags`, `GET /api/contacts`

---

#### Page: Templates (`app/(dashboard)/templates/page.tsx`)
**Purpose**: Message template library — create, manage, and apply visual message templates.

**UI Behavior**:
- Two tabs: **My Templates** (user-created) and **Preset Library** (built-in templates)
- My Templates: searchable, filterable by category (Sales/Support/E-commerce/Appointments/Follow-up/Welcome/General)
- Per-template: Edit, Duplicate, Delete actions
- Template card shows: type badge (TEXT/MEDIA/INTERACTIVE), category badge, draft badge, content preview, variable chips
- Preset Library: 9 curated templates across 6 categories — click "Use Template" to clone into library
- Empty state: prompt to create first template or browse presets

**API Calls**: `GET/POST/DELETE /api/templates`

---

#### Page: Template Builder (`app/(dashboard)/templates/builder/page.tsx`)
**Purpose**: Visual drag-and-drop template builder with live preview.

**UI Behavior**:
- Left panel: Block palette with 7 block types
- Center: Canvas of ordered blocks (drag up/down to reorder)
- Right: Live preview with sample variable substitution
- Block types:
  - **Text**: body/title/footer styles, markdown-style bold (*text*)
  - **Buttons**: up to N buttons with reply/URL/call actions
  - **Media**: image/video/document with caption, upload via `/api/upload`
  - **Promo Card**: title, description, CTA label, image
  - **Product**: name, price, image, buy button
  - **Reminder**: title, datetime, confirm/reschedule buttons
  - **Support**: greeting + FAQ shortcut list
- Variable chips: auto-extracted from content ({{name}}, {{phone}}, etc.)
- Save as DRAFT or PUBLISHED; supports editing existing templates via `?id=` query param
- Sample variables for live preview: name, phone, email, order_id, date, time, amount, product

**API Calls**: `GET /api/templates/:id` (edit mode), `POST /api/templates`, `PUT /api/templates/:id`, `POST /api/upload`

---

#### Page: Saved Replies (`app/(dashboard)/saved-replies/page.tsx`)
**Purpose**: Manage shortcut-triggered text templates for quick replies in chat.

**API Calls**: `GET/POST/PUT/DELETE /api/saved-replies`

---

#### Page: Broadcasts (`app/(dashboard)/broadcasts/page.tsx`)
**Purpose**: Campaign list and management.

**UI Behavior**:
- Campaign list with status badges (DRAFT/SCHEDULED/SENDING/PAUSED/SENT/FAILED)
- Pause/Resume running broadcasts
- Progress bar via socket `broadcast:progress` event

**API Calls**: `GET /api/broadcasts`, `POST /api/broadcasts/:id/pause`, `POST /api/broadcasts/:id/resume`

#### Page: New Broadcast (`app/(dashboard)/broadcasts/new/page.tsx`)
**Purpose**: Create and optionally schedule a new broadcast.

**UI Behavior**:
- Uses `BroadcastForm` component
- On save: creates broadcast via `POST /api/broadcasts`
- If no `scheduledAt`: immediately fires `POST /api/broadcasts/:id/send`
- If `scheduledAt` set: broadcast stays as SCHEDULED, sent by BullMQ at that time

#### Page: Edit Broadcast (`app/(dashboard)/broadcasts/[id]/edit/page.tsx`)
**Purpose**: Edit a DRAFT or SCHEDULED broadcast before it sends.

---

#### Page: Automations (`app/(dashboard)/automations/page.tsx`)
**Purpose**: Keyword/time rules + multi-step flows.

**UI Behavior**:
- Rules tab: `RuleCard` list with trigger type, keyword, response; toggle enable/disable
- Flows tab: `FlowBuilder` — multi-step sequences with SEND_MESSAGE and WAIT step types
- Toggle enable/disable without delete

**API Calls**: `GET /api/automations`, `POST /api/automations`, `PUT /api/automations/:id`, `PUT /api/automations/:id/toggle`, `DELETE /api/automations/:id`, and all `/api/automations/flows` endpoints

---

#### Page: Deals (`app/(dashboard)/deals/page.tsx`)
**Purpose**: Sales pipeline kanban.

**UI Behavior**:
- 4 columns: NEW / INTERESTED / NEGOTIATION / CLOSED
- Deal cards with contact name, value, owner
- Quick stage-advance button (hidden for CLOSED)
- Create/edit/delete deals

**API Calls**: `GET/POST/PUT/DELETE /api/deals`

---

#### Page: Tasks (`app/(dashboard)/tasks/page.tsx`)
**Purpose**: Follow-up task management.

**API Calls**: `GET/POST/PUT/DELETE /api/tasks`

---

#### Page: Settings (`app/(dashboard)/settings/page.tsx`)
**Purpose**: WhatsApp connection management via QR code.

**UI Behavior**:
- `QRCodeDisplay` component shows QR for scanning
- `ConnectionStatus` badge shows current state
- Connect / Disconnect / Reset Auth actions

**API Calls**: `GET /api/whatsapp/status`, `GET /api/whatsapp/qr`, `POST /api/whatsapp/connect`, `POST /api/whatsapp/disconnect`, `POST /api/whatsapp/reset-auth`

---

#### Page: Admin Users (`app/(dashboard)/admin/users/page.tsx`)
**Purpose**: Admin-only user management (CRUD, role assignment).

**API Calls**: `GET/POST/PUT/DELETE /api/users`

---

#### Page: Admin Teams (`app/(dashboard)/admin/teams/page.tsx`)
**Purpose**: Admin-only team and member management.

**UI Behavior**:
- Team list with member counts
- Per-team "Auto-assign ON/OFF" toggle (round-robin assignment)
- Create/edit/delete teams and users

**API Calls**: `GET/POST/PUT/DELETE /api/teams`, `PUT /api/teams/:id/auto-assign`, `POST /api/teams/:id/members`, `DELETE /api/teams/:id/members/:userId`

---

### 3.6 Sidebar Navigation Structure

The sidebar is **role-aware** with an Admin-only section:

```
Main Menu:
  Dashboard → /dashboard
  Conversations → /conversations
  Contacts → /contacts
  Tags → /tags
  Saved Replies → /saved-replies
  Templates → /templates
  Deals → /deals
  Tasks → /tasks
  Broadcasts → /broadcasts
  Settings → /settings

Admin Section (SUPER_ADMIN | ADMIN only):
  Users → /admin/users
  Teams → /admin/teams
  Automations → /automations

Footer:
  WhatsApp connection pulse indicator
  User role badge (color-coded per role)
```

**Mobile behavior**: hamburger button (top-left) → slide-in overlay panel with close button and backdrop dismiss.

**Active state**: WhatsApp green (`#25D366`) highlight with animated dot indicator.

### 3.7 Theme System

- `ThemeProvider` wraps the root layout
- Reads `localStorage.getItem('theme')` on mount; respects `prefers-color-scheme` as default
- Sets `document.documentElement.classList` to `dark` or removes it
- Toggle button in `Header.tsx` (Sun/Moon icons)
- Tailwind `darkMode: 'class'` in config
- Dark color palette: background `#0B141A`, sidebar/cards `#111B21`, secondary panels `#202C33`
- Brand color: WhatsApp green `#25D366` / `#128C7E`

### 3.8 Design System

The UI implements a **WhatsApp-inspired dark premium** aesthetic:

| Token | Value | Usage |
|-------|-------|-------|
| Brand green | `#25D366` | Active states, CTAs, indicators |
| Dark green | `#128C7E` | Gradient end, hover states |
| Background | `#0B141A` | App background (dark) |
| Sidebar | `#111B21` | Sidebar, cards (dark) |
| Panel | `#202C33` | Secondary panels (dark) |
| Muted text | `#8696A0` | Placeholder, secondary text (dark) |
| Border | `white/5` | Subtle borders (dark) |

All interactive elements use `transition-colors duration-150` for smooth hover feedback. Cards use `rounded-2xl` with `shadow-sm`. Active indicators use the `animate-ping` pulsing dot pattern.

### 3.9 Onboarding Wizard

`components/onboarding/OnboardingWizard.tsx`:
- Fixed bottom-right panel, 4 steps: Connect WhatsApp → Add Contact → Send Message → Create Automation
- On mount: calls all 4 APIs to check completion; shows only if ≥1 step incomplete and not dismissed
- Dismissed via `localStorage.setItem('crm_onboarding_dismissed', '1')`
- Shown in `app/(dashboard)/layout.tsx` alongside `NotificationProvider`

---

## 4. BACKEND DOCUMENTATION

### 4.1 Folder Structure

```
apps/backend/
├── prisma/
│   └── schema.prisma                    # Single source of truth for DB schema
├── scripts/
│   └── seed-templates.ts                # Seed script for default message templates
├── src/
│   ├── index.ts                         # Express bootstrap + scheduler startup
│   ├── auth/
│   │   ├── auth.middleware.ts           # authMiddleware, checkPermission, requireAdmin
│   │   ├── auth.routes.ts
│   │   └── auth.service.ts
│   ├── whatsapp/
│   │   ├── client.ts                    # Baileys lifecycle (QR, auth, reconnect)
│   │   ├── sender.ts                    # Outbound message dispatch + emitRealtime
│   │   ├── handler.ts                   # Message delivery status updates
│   │   └── whatsapp.routes.ts           # /api/whatsapp endpoints
│   ├── workflow/
│   │   └── inbound-workflow.ts          # Full inbound message pipeline
│   ├── conversations/
│   │   ├── conversation-resolver.ts     # getOrCreateConversationByPhone (dedup)
│   │   ├── conversations.service.ts     # Business logic
│   │   ├── messages.service.ts          # Paginated message loading
│   │   ├── auto-assign.service.ts       # Round-robin, checks team.autoAssign
│   │   ├── notes.service.ts             # Internal notes CRUD
│   │   └── snooze-wakeup.ts             # Scheduler: reopen snoozed convs every 60s
│   ├── automations/
│   │   ├── engine.ts                    # Rule evaluation (KEYWORD, OUTSIDE_HOURS, etc.)
│   │   ├── flow-executor.ts             # BullMQ multi-step flow execution
│   │   ├── no-reply-detector.ts         # Polls every 5 min, fires NO_RESPONSE_TIME
│   │   ├── automations.service.ts       # Rule CRUD
│   │   ├── flows.service.ts             # Flow CRUD
│   │   └── automations.routes.ts
│   ├── broadcasts/
│   │   ├── broadcasts.service.ts        # Pause/resume/schedule support
│   │   ├── broadcast.queue.ts           # Bull queue + randomized delay
│   │   └── broadcasts.routes.ts
│   ├── analytics/
│   │   ├── analytics.service.ts         # overview, messagesChart, agentStats (incl. avgFirstResponseMs), pipelineStats
│   │   └── analytics.routes.ts
│   ├── contacts/
│   │   └── contacts.service.ts
│   ├── deals/
│   │   └── deals.service.ts
│   ├── tasks/
│   │   └── tasks.service.ts
│   ├── teams/
│   │   └── teams.routes.ts
│   ├── users/
│   │   └── users.routes.ts
│   ├── saved-replies/
│   │   └── saved-replies.routes.ts
│   ├── services/
│   │   └── template.service.ts          # renderTemplate() — variable substitution
│   ├── realtime/
│   │   └── socket.ts                    # emitRealtime(), emitToUser(), bindRealtimeServer()
│   └── lib/
│       ├── prisma.ts                    # Shared Prisma client singleton
│       ├── logger.ts                    # Structured JSON logger
│       ├── phone.ts                     # normalizePhone(), buildPhoneVariants(), normalizeRecipient()
│       └── retry.ts                     # Exponential backoff retry helper
└── uploads/                             # Local media storage (UUID-named files)
```

### 4.2 Entry Point (`src/index.ts`)

Bootstrap order:
1. Load environment variables (`dotenv/config`)
2. Create Express app
3. Create `http.Server` and bind `Socket.IO` (`bindRealtimeServer`)
4. Configure CORS (whitelist `FRONTEND_URL`, fail on unknown origins)
5. Mount middleware: JSON body parser (2 MB), URL-encoded, static `/uploads`
6. Mount all 16 route groups under `/api/`
7. Start scheduled jobs:
   - `startSnoozeWakeupScheduler()` — every 60 seconds
   - `ensureFlowWorker()` — BullMQ worker for automation flow steps
   - `startNoReplyDetector()` — every 5 minutes
8. Optionally auto-connect WhatsApp (`WHATSAPP_AUTO_CONNECT !== 'false'`)
9. Listen on `PORT` (default 4000)

### 4.3 Complete API Endpoint Reference

---

#### AUTH ROUTES (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | No | Email+password → `{ accessToken, refreshToken, user }` |
| POST | `/refresh` | No | Refresh token → new access token |
| POST | `/logout` | Yes | Invalidate refresh token |
| GET | `/me` | Yes | `{ id, name, email, role, teamId, team }` |

---

#### WHATSAPP ROUTES (`/api/whatsapp`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/connect` | Admin | Init Baileys socket, begin QR cycle |
| GET | `/status` | Yes | `{ status: CONNECTED\|DISCONNECTED\|CONNECTING\|QR_READY }` |
| GET | `/qr` | Yes | `{ qr: string \| null }` |
| POST | `/disconnect` | Admin | `sock.logout()` |
| POST | `/reset-auth` | Admin | Delete `auth_info_baileys/`, restart connection |
| POST | `/send` | Yes | Direct send bypassing conversation context |
| POST | `/webhook` | Secret | External gateway webhook (secret via `WHATSAPP_WEBHOOK_SECRET`) |

---

#### CONVERSATIONS ROUTES (`/api/conversations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List with `view`, `search`, `status`, `assignedTo`, `teamId` filters |
| GET | `/:id` | Yes | Single conversation (no messages — use `/messages` endpoint) |
| GET | `/:id/messages` | Yes | Cursor-paginated: `?cursor=<messageId>&limit=50` |
| GET | `/:id/messages/search` | Yes | `?q=` full-text search within conversation (max 30 results) |
| PUT | `/:id/status` | Yes | Update status, emit `conversation:updated` |
| PUT | `/:id/read` | Yes | `unreadCount = 0` |
| PUT | `/:id/assign` | Yes | Set `assignedTo`, log activity |
| PUT | `/:id/assign-team` | Yes | Set `assignedTeamId`, log activity |
| PUT | `/:id/pipeline` | Yes | Set pipeline stage, log activity |
| PUT | `/:id/pin` | Yes | Toggle `isPinned` |
| PUT | `/:id/snooze` | Yes | `{ snoozedUntil: ISO\|null }` — snooze or clear snooze |
| GET | `/:id/notes` | Yes | Internal notes with author |
| POST | `/:id/notes` | Yes | Create note, emit `note:new` |
| DELETE | `/:id/notes/:noteId` | Yes | Author or ADMIN only |
| POST | `/:id/messages/:messageId/reactions` | Yes | Toggle reaction, sync to WhatsApp, emit `message:reaction` |
| POST | `/:id/reply` | Yes | `multipart/form-data` — text or media send |
| GET | `/by-phone/:phone` | Yes | Lookup or create conversation by phone number |

---

#### CONTACTS ROUTES (`/api/contacts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List: `search`, `tag`, `status`, `lifecycleStage` filters |
| POST | `/` | Yes | Create/upsert by phone |
| GET | `/:id` | Yes | Contact + timeline (conversations, deals, tasks, notes) |
| PUT | `/:id` | Yes | Update any fields |
| DELETE | `/:id` | Team Lead+ | Cascades to conversations |
| POST | `/import` | Yes | CSV multipart: `phone`, `name`, `tag` per row |

---

#### TEMPLATES ROUTES (`/api/templates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List templates for team (includes shared global templates where `teamId = null`) |
| POST | `/` | Yes | Create: `{ name, content, mediaUrl?, type?, status?, payload?, variables? }` |
| PUT | `/:id` | Yes | Update any template fields (team-scoped) |
| DELETE | `/:id` | Yes | Delete (team-scoped, 404 if not found) |
| POST | `/:id/render` | Yes | Server-side variable substitution: `{ variables: { name: "Ahmed" } }` → rendered content |

---

#### BROADCASTS ROUTES (`/api/broadcasts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List with recipient counts |
| GET | `/:id` | Yes | Single broadcast with recipients |
| POST | `/` | Yes | Create: `{ name, message, description?, type?, scheduledAt?, recurringCron?, timezone? }` |
| PUT | `/:id` | Yes | Update draft broadcast |
| POST | `/:id/send` | Yes | Enqueue Bull job, set status SENDING |
| POST | `/:id/pause` | Yes | Set PAUSED, Bull job checks flag before each send |
| POST | `/:id/resume` | Yes | Resume from PAUSED state |
| DELETE | `/:id` | Yes | Delete broadcast |
| GET | `/:id/stats` | Yes | `{ totalSent, totalFailed, total, recipients[] }` |

---

#### AUTOMATIONS ROUTES (`/api/automations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | `AutomationRule[]` for team |
| POST | `/` | Yes | Create rule: `{ name, trigger, keyword?, response }` |
| PUT | `/:id` | Yes | Update rule |
| PUT | `/:id/toggle` | Yes | Flip `isActive` |
| DELETE | `/:id` | Yes | Delete rule |
| GET | `/flows` | Yes | `AutomationFlow[]` with steps |
| GET | `/flows/:id` | Yes | Single flow with full steps |
| POST | `/flows` | Yes | Create flow with steps array |
| PUT | `/flows/:id` | Yes | Update flow + steps |
| PUT | `/flows/:id/toggle` | Yes | Flip `isActive` |
| DELETE | `/flows/:id` | Yes | Delete flow (cascades steps + executions) |

---

#### DEALS ROUTES (`/api/deals`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | Deals with contact + owner |
| POST | `/` | Yes | `{ title, contactId, stage, value?, ownerId? }` |
| PUT | `/:id` | Yes | Update; sets `closedAt` if stage → CLOSED |
| DELETE | `/:id` | Yes | Delete |

---

#### TASKS ROUTES (`/api/tasks`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | Scoped by role (agents see own; leads/admins see team) |
| POST | `/` | Yes | `{ title, description?, dueDate?, status?, priority?, assigneeId?, contactId?, conversationId? }` |
| PUT | `/:id` | Yes | Update (status: OPEN \| IN_PROGRESS \| DONE) |
| DELETE | `/:id` | Yes | Delete |
| GET | `/conversation/:conversationId` | Yes | Tasks linked to specific conversation |

---

#### TAGS ROUTES (`/api/tags`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | All tags for team with `_count.contacts` |
| POST | `/` | Yes | Create: `{ name, color? }` — emits `tag:created` |
| PUT | `/:id` | Yes | Update name/color — emits `tag:updated` |
| DELETE | `/:id` | Yes | Delete — emits `tag:deleted` |
| POST | `/contacts/:contactId/tags/:tagId` | Yes | Add tag to contact — emits `contact:tag_added` |
| DELETE | `/contacts/:contactId/tags/:tagId` | Yes | Remove tag from contact — emits `contact:tag_removed` |
| GET | `/contacts/:contactId` | Yes | Get all tags for a contact |

---

#### TEAMS ROUTES (`/api/teams`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | Teams with members |
| GET | `/all` | Any | Flat list for assignment dropdowns |
| GET | `/agents` | Any | All agents across teams |
| POST | `/` | Admin | `{ name }` |
| PUT | `/:id` | Admin | `{ name }` |
| DELETE | `/:id` | Admin | Cascade remove member assignments |
| POST | `/:id/members` | Admin | `{ userId }` |
| DELETE | `/:id/members/:userId` | Admin | Remove member |
| PUT | `/:id/auto-assign` | Admin | `{ autoAssign: boolean }` — toggle round-robin |

---

#### ANALYTICS ROUTES (`/api/analytics`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/overview` | Yes | `{ totalContacts, openConversations, todayMessages, automationsFired }` |
| GET | `/messages` | Yes | Last 30 days: `[{ date, incoming, outgoing }]` |
| GET | `/agents` | Yes | Per-agent: `{ agentId, name, email, openConversations, resolvedConversations, avgFirstResponseMs, avgFirstResponseMin }` |
| GET | `/pipeline` | Yes | `{ stages[{ stage, count, value }], totalDeals, totalValue, closedDeals, conversionRate }` |

---

#### UPLOAD ROUTES (`/api/upload`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Yes | Single file upload (32 MB limit) → `{ url, name, size, mimeType }` |

---

#### OTHER ROUTES

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/saved-replies` | Team saved replies |
| POST | `/api/saved-replies` | `{ shortcut, message }` |
| PUT | `/api/saved-replies/:id` | Update |
| DELETE | `/api/saved-replies/:id` | Delete |
| GET | `/api/activity` | Paginated audit log |
| GET | `/api/activity/conversation/:id` | Activity for specific conversation |
| GET | `/api/users` | Role-scoped user list |
| POST | `/api/users` | Admin: create user |
| PUT | `/api/users/:id` | Admin: update user |
| DELETE | `/api/users/:id` | Admin: delete user |

---

## 5. DATABASE DESIGN

### 5.1 Database Type
PostgreSQL (v14+), accessed via Prisma ORM 5.x. Local: port 5433 (Docker). Schema managed with `prisma db push` (not migrate — no migration history files).

### 5.2 Complete Schema Documentation

---

#### Model: `User`
```prisma
model User {
  id              String    @id @default(cuid())
  name            String
  email           String    @unique
  password        String                    // bcrypt hash
  role            Role      @default(AGENT) // See Role enum below
  teamId          String?
  team            Team?     @relation("TeamMembers", fields: [teamId], references: [id])
  ownedTeam       Team?     @relation("TeamOwner")
  emailVerifiedAt DateTime?
  resetToken      String?
  resetTokenExpiry DateTime?
  refreshTokenId  String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @default(now()) @updatedAt
  conversations   Conversation[]     @relation("AssignedConversations")
  ownedDeals      Deal[]             @relation("OwnedDeals")
  assignedTasks   Task[]             @relation("AssignedTasks")
  internalNotes   InternalNote[]     @relation("InternalNotes")
  auditLogs       AuditLog[]
  reactions       MessageReaction[]  @relation("UserReactions")
}

enum Role {
  SUPER_ADMIN
  ADMIN
  TEAM_LEAD
  AGENT
  ANALYST
  VIEWER
}
```

---

#### Model: `Team`
```prisma
model Team {
  id          String   @id @default(cuid())
  name        String
  ownerId     String   @unique
  owner       User     @relation("TeamOwner", fields: [ownerId], references: [id])
  members     User[]   @relation("TeamMembers")
  conversations Conversation[]
  autoAssign  Boolean  @default(false)  // round-robin auto-assignment opt-in
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now()) @updatedAt
}
```

---

#### Model: `WhatsAppSession`
```prisma
model WhatsAppSession {
  id        String   @id @default(cuid())
  sessionId String   @unique
  data      Json                         // Baileys auth state backup in DB
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
}
```

---

#### Model: `Contact`
```prisma
model Contact {
  id             String    @id @default(cuid())
  teamId         String?
  phone          String    @unique         // E.164 normalized, globally unique
  name           String?
  email          String?
  tag            String?                   // LEGACY CSV field — kept for migration compatibility
  notes          String?
  status         String    @default("ACTIVE")
  lifecycleStage String    @default("LEAD")
  source         String?
  customFields   Json?                     // includes avatarUrl from WhatsApp on first open
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @default(now()) @updatedAt
  conversations  Conversation[]
  deals          Deal[]
  tasks          Task[]
  contactTags    ContactTag[]

  @@index([teamId])
  @@index([phone])
}
```

**Important**: `phone` is now `@unique` globally (not per-team). Avatar URL is fetched from WhatsApp on first conversation open and cached in `customFields.avatarUrl`.

---

#### Model: `Tag` + `ContactTag`
```prisma
model Tag {
  id        String       @id @default(cuid())
  teamId    String?
  name      String
  color     String       @default("#6366f1")   // 8 color presets in UI
  createdAt DateTime     @default(now())
  contacts  ContactTag[]

  @@unique([teamId, name])                     // tag names unique per team
  @@index([teamId])
}

model ContactTag {
  contactId String
  tagId     String
  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([contactId, tagId])                     // composite PK prevents duplicates
}
```

The legacy `Contact.tag` CSV string is kept for backwards-compatibility. New code should use `ContactTag` junction.

---

#### Model: `Conversation`
```prisma
model Conversation {
  id                 String     @id @default(cuid())
  teamId             String?
  contactId          String
  contact            Contact    @relation(fields: [contactId], references: [id])
  status             ConvStatus @default(OPEN)
  priority           Priority   @default(NORMAL)  // NEW: per-conversation priority
  assignedTo         String?
  assignedUser       User?      @relation("AssignedConversations", fields: [assignedTo], references: [id])
  assignedTeamId     String?
  assignedTeam       Team?      @relation(fields: [assignedTeamId], references: [id])
  pipeline           String?
  lastMessage        String?
  lastMessagePreview String?
  lastMessageAt      DateTime?
  notes              String?
  unreadCount        Int        @default(0)
  isPinned           Boolean    @default(false)
  snoozedUntil       DateTime?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @default(now()) @updatedAt
  messages           Message[]
  internalNotes      InternalNote[]
  tasks              Task[]     @relation("ConversationTasks")

  @@index([teamId, status, lastMessageAt(sort: Desc)])
  @@index([contactId, status])
  @@index([assignedTo])
  @@index([snoozedUntil])                        // used by snooze-wakeup scheduler
}

enum ConvStatus {
  OPEN
  RESOLVED
  PENDING
  ON_HOLD
  ARCHIVED
  SPAM
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
}
```

---

#### Model: `Message`
```prisma
model Message {
  id             String           @id @default(cuid())
  externalId     String                              // WhatsApp message ID (NOT NULL)
  sessionId      String                              // Baileys session identifier (NOT NULL)
  direction      MessageDirection
  from           String
  to             String
  phone          String
  conversationId String
  conversation   Conversation     @relation(...)
  fromMe         Boolean
  body           String
  type           MessageType      @default(TEXT)
  mediaUrl       String?
  mediaMimeType  String?
  mediaFileName  String?
  mediaCaption   String?
  mediaDuration  Int?
  timestamp      DateTime
  status         MsgStatus        @default(SENT)
  errorReason    String?                             // failure reason if status=FAILED
  deliveredAt    DateTime?                           // when WhatsApp confirmed delivery
  readAt         DateTime?                           // when contact read the message
  retryCount     Int              @default(0)        // outbound retry counter
  replyToId      String?                             // CRM message ID (visual quoting only)
  replyToBody    String?
  reactions      MessageReaction[]

  @@unique([externalId, sessionId])                  // deduplication key
  @@index([conversationId, timestamp(sort: Desc)])
  @@index([phone])
}

enum MessageType { TEXT | IMAGE | DOCUMENT | AUDIO | VIDEO }
enum MessageDirection { INBOUND | OUTBOUND }
enum MsgStatus { RECEIVED | PROCESSED | SENT | DELIVERED | READ | FAILED }
```

---

#### Model: `MessageReaction`
```prisma
model MessageReaction {
  id           String   @id @default(cuid())
  messageId    String
  message      Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId       String?                               // null for WhatsApp contact reactions
  user         User?    @relation("UserReactions", fields: [userId], references: [id], onDelete: Cascade)
  contactPhone String?                               // set when reaction comes from WhatsApp contact
  emoji        String
  createdAt    DateTime @default(now())

  @@unique([messageId, userId])                      // one CRM-user reaction per message (toggle replaces)
  @@index([messageId])
  @@index([messageId, contactPhone])
}
```

**Note**: Reactions sent by CRM agents set `userId`. Reactions received from WhatsApp contacts (via `messages.upsert` reaction events) set `contactPhone`.

---

#### Model: `AutomationRule` (single-step)
```prisma
model AutomationRule {
  id        String      @id @default(cuid())
  teamId    String?
  name      String
  trigger   TriggerType
  keyword   String?
  response  String
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @default(now()) @updatedAt
}
```

---

#### Model: `AutomationFlow` (multi-step)
```prisma
model AutomationFlow {
  id            String                    @id @default(cuid())
  teamId        String?
  name          String
  trigger       TriggerType
  keyword       String?
  isActive      Boolean                   @default(true)
  stopOnReply   Boolean                   @default(true)  // cancel execution if contact replies
  steps         AutomationFlowStep[]
  executions    AutomationFlowExecution[]
  createdAt     DateTime                  @default(now())
  updatedAt     DateTime                  @default(now()) @updatedAt

  @@index([teamId, isActive])
}

model AutomationFlowStep {
  id       String         @id @default(cuid())
  flowId   String
  flow     AutomationFlow @relation(fields: [flowId], references: [id], onDelete: Cascade)
  order    Int
  type     FlowStepType
  message  String?
  delayMs  Int?           // milliseconds to wait before executing this step

  @@index([flowId, order])
}

enum FlowStepType {
  SEND_MESSAGE
  WAIT
}

model AutomationFlowExecution {
  id            String         @id @default(cuid())
  flowId        String
  flow          AutomationFlow @relation(...)
  phone         String
  currentStep   Int            @default(0)
  status        String         @default("RUNNING")  // RUNNING | COMPLETED | STOPPED
  startedAt     DateTime       @default(now())
  stoppedAt     DateTime?
  stoppedReason String?

  @@index([flowId, phone, status])
  @@index([phone, status])
}
```

**Current limitation**: Flow steps only support `SEND_MESSAGE` and `WAIT`. The CONDITION, ASSIGN, TAG, and END node types are not yet in the schema (they appeared in earlier planning docs but were simplified during implementation).

---

#### Model: `TriggerType` enum
```prisma
enum TriggerType {
  KEYWORD
  FIRST_MESSAGE
  ANY_MESSAGE
  OUTSIDE_HOURS
  REGEX
  CONTAINS_URL
  CONTAINS_PHONE
  SENTIMENT_NEGATIVE
  NO_RESPONSE_TIME
  TAG_ADDED
  STATUS_CHANGE
  TIME_BASED
  DAY_OF_WEEK
  WEBHOOK
  API_CALL
}
```

**Implemented in engine**: `KEYWORD`, `FIRST_MESSAGE`, `ANY_MESSAGE`, `OUTSIDE_HOURS`, `NO_RESPONSE_TIME`. The remaining trigger types are defined in the schema and available for selection in the UI but are **not yet evaluated** by the automation engine.

---

#### Model: `Broadcast`
```prisma
model Broadcast {
  id            String          @id @default(cuid())
  teamId        String?
  name          String
  description   String?
  message       String
  status        BroadcastStatus @default(DRAFT)
  type          BroadcastType   @default(IMMEDIATE)
  scheduledAt   DateTime?
  recurringCron String?                             // cron expression for recurring broadcasts
  timezone      String          @default("UTC")
  sentAt        DateTime?
  totalSent     Int             @default(0)
  totalFailed   Int             @default(0)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @default(now()) @updatedAt
  recipients    BroadcastRecipient[]
}

enum BroadcastStatus { DRAFT | SCHEDULED | SENDING | PAUSED | SENT | FAILED }
enum BroadcastType   { IMMEDIATE | SCHEDULED | RECURRING }
```

---

#### Model: `MessageTemplate`
```prisma
model MessageTemplate {
  id        String         @id @default(cuid())
  teamId    String?
  name      String
  content   String                    // plain text representation
  mediaUrl  String?
  type      TemplateType   @default(TEXT)
  status    TemplateStatus @default(DRAFT)
  payload   Json?                     // structured block JSON (for visual builder)
  variables Json?                     // cached variable list e.g. ["name","order_id"]
  createdAt DateTime       @default(now())
  updatedAt DateTime       @default(now()) @updatedAt

  @@index([teamId])
}

enum TemplateType   { TEXT | MEDIA | INTERACTIVE }
enum TemplateStatus { DRAFT | PUBLISHED | ARCHIVED }
```

`payload.blocks` stores the visual builder block array. `content` stores the plain-text fallback for display and sending.

---

#### Model: `Deal`
```prisma
model Deal {
  id          String    @id @default(cuid())
  teamId      String?
  contactId   String
  contact     Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  title       String
  stage       DealStage @default(NEW)
  value       Float     @default(0)
  ownerId     String?
  owner       User?     @relation("OwnedDeals", fields: [ownerId], references: [id])
  notes       String?
  closedAt    DateTime?             // auto-set when stage → CLOSED
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @default(now()) @updatedAt

  @@index([teamId, stage])
}

enum DealStage { NEW | INTERESTED | NEGOTIATION | CLOSED }
```

---

#### Model: `Task`
```prisma
model Task {
  id             String        @id @default(cuid())
  teamId         String?
  contactId      String?
  contact        Contact?      @relation(...)
  conversationId String?
  conversation   Conversation? @relation("ConversationTasks", ...)
  title          String
  description    String?
  dueDate        DateTime?
  status         TaskStatus    @default(OPEN)
  priority       TaskPriority  @default(MEDIUM)
  assigneeId     String?
  assignee       User?         @relation("AssignedTasks", ...)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @default(now()) @updatedAt

  @@index([teamId, status])
}

enum TaskStatus   { OPEN | IN_PROGRESS | DONE }
enum TaskPriority { LOW | MEDIUM | HIGH }
```

---

#### Other Models
- `InternalNote` — conversation notes with authorId + body
- `SavedReply` — shortcut→message templates (`@unique([shortcut])`)
- `BroadcastRecipient` — per-recipient status (pending/sent/failed)
- `Analytics` — daily stats row (`@unique` on date, upserted per event)
- `AuditLog` — action/resource/details/userId with optional user relation

### 5.3 Entity Relationship Summary

```
User ──────┬──── Team (owned, member of)
           ├──── Conversation.assignedTo
           ├──── MessageReaction (one active reaction per message per user)
           ├──── Deal.ownerId
           ├──── Task.assigneeId
           └──── InternalNote.authorId

Contact ───┬──── Conversation (phone @unique; dedup to one active per team)
           ├──── Deal (cascade delete)
           ├──── Task
           └──── ContactTag → Tag (relational; legacy CSV tag field preserved)

Conversation ──┬── Message → MessageReaction
               ├── InternalNote
               └── Task (via ConversationTasks)

AutomationFlow ──── AutomationFlowStep (cascade)
               └─── AutomationFlowExecution

Broadcast ─────── BroadcastRecipient

MessageTemplate  (standalone — no relations to Conversation/Message yet)
```

---

## 6. AUTHENTICATION & AUTHORIZATION

### 6.1 Auth Flow

NextAuth credentials provider on the frontend calls `POST /api/auth/login`. The backend returns `{ accessToken, refreshToken, user }`. The frontend `api.ts` wrapper:
1. Retrieves the access token from NextAuth session (or localStorage fallback)
2. On 401/403: calls `POST /api/auth/refresh` and retries the request once
3. On persistent auth failure: clears localStorage token

The access token is passed in the `Authorization: Bearer <token>` header. Socket.IO connections authenticate via `socket.handshake.auth.token`.

### 6.2 Role Hierarchy

```
SUPER_ADMIN → ADMIN → TEAM_LEAD → AGENT → ANALYST → VIEWER
```

| Action | VIEWER | ANALYST | AGENT | TEAM_LEAD | ADMIN | SUPER_ADMIN |
|--------|--------|---------|-------|-----------|-------|-------------|
| read conversations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| read analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| send message | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| create broadcast | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| create template | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| delete contact | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| manage automations | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| manage users | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| manage teams | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| connect WhatsApp | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### 6.3 Security Weaknesses

| Weakness | Severity | Status |
|---------|----------|--------|
| Webhook no mandatory auth | HIGH | `WHATSAPP_WEBHOOK_SECRET` is optional |
| File upload no MIME type validation | HIGH | Any file type accepted in `upload.routes.ts` |
| No rate limiting on most endpoints | HIGH | Only `/api/auth/login` (if configured) |
| No Helmet.js security headers | MEDIUM | Missing CSP, HSTS, X-Frame-Options |
| No Zod validation on request bodies | MEDIUM | Manual checks only |
| `prisma db push` in production | MEDIUM | No migration history, schema drift risk |
| No 2FA | MEDIUM | Admin accounts unprotected |
| `console.log` mixed with structured logger | LOW | Inconsistent observability |

---

## 7. WHATSAPP INTEGRATION

### 7.1 Library: Baileys
`@whiskeysockets/baileys` version 7.x — unofficial WhatsApp Web reverse-engineering library. **Violates WhatsApp ToS for commercial use.** Migration to Meta Cloud API is required before public SaaS launch.

### 7.2 Connection Lifecycle
`client.ts` manages: QR generation → auth save to `auth_info_baileys/` + `WhatsAppSession` DB backup → reconnect on close (except `loggedOut` reason). Exports `sock` (Baileys socket) and `waStatus` (current connection state string) for use by other modules.

### 7.3 Phone Normalization Pipeline

`src/lib/phone.ts` and `conversation-resolver.ts`:
```
input: "+20 122 538 8127"
→ normalizePhone() → "+201225388127" (libphonenumber-js, WA_DEFAULT_REGION=EG)
→ phoneFingerprint() → "201225388127"
→ variants: ["+201225388127", "201225388127", last-8, last-9]
→ findMatchingContact: OR query across all variants + endsWith matching
→ normalizeRecipient() → "201225388127@s.whatsapp.net" (for sending)
```

### 7.4 Duplicate Conversation Handling

`getOrCreateConversationByPhone()` in `conversation-resolver.ts`:
- Finds contact by phone variants (OR query across all formats)
- Finds **all** conversations for that contact ordered by `updatedAt desc`
- If duplicates exist: deletes messages from duplicates, deletes duplicate conversations, keeps only the most recent
- Returns the single primary conversation

**Frontend implication**: If the UI holds a stale conversation ID (the deleted duplicate), `fetchConversation()` returns 404 → `onConversationNotFound()` fires → list refetches + selection cleared.

### 7.5 Snooze Wakeup Scheduler (`conversations/snooze-wakeup.ts`)
- Runs every 60 seconds via `setInterval`
- Finds conversations with `snoozedUntil <= now` and `status = ON_HOLD`
- Updates them to `{ status: 'OPEN', snoozedUntil: null }`
- Emits `conversation:updated` socket event per wakeup

### 7.6 No-Reply Detector (`automations/no-reply-detector.ts`)
- Runs every `NO_REPLY_CHECK_INTERVAL_MS` (default: 5 min)
- Finds OPEN conversations where `lastMessageAt <= 30 min ago`
- Skips if a recent OUTBOUND message exists after the cutoff
- Fires `triggerFlows(phone, '', 'NO_RESPONSE_TIME', teamId)` for each qualifying conversation

### 7.7 Reaction Sync to WhatsApp
When a CRM agent reacts to a message:
1. `MessageReaction` is upserted/deleted in DB
2. Backend calls `sock.sendMessage(jid, { react: { text: emoji, key: { remoteJid, fromMe, id: externalId } } })`
3. The reaction appears on the contact's WhatsApp
4. Socket event `message:reaction` is emitted to update all connected agents

### 7.8 Broadcast Anti-Ban
Between each send: `delay(random(BROADCAST_DELAY_MIN_MS, BROADCAST_DELAY_MAX_MS))` — defaults 1500ms–4000ms. Pause/resume supported by checking a `paused` flag on the Broadcast record before each recipient. Failed sends are recorded in `BroadcastRecipient.status`.

---

## 8. REAL-TIME FEATURES

### 8.1 Socket.IO Configuration

```typescript
// Two room types:
// 1. Team room — all agents on same team share events
socket.join(`team:${user.teamId}`)

// 2. Personal room — direct user notifications
socket.join(`user:${user.id}`)

// Emit helpers:
export function emitRealtime(event, payload, teamId?) {
  if (teamId) io.to(`team:${teamId}`).emit(event, payload);
  else io.emit(event, payload);  // system-level only (wa:status, wa:qr)
}

export function emitToUser(userId, event, payload) {
  socketServer?.to(`user:${userId}`).emit(event, payload);
}
```

Auth: JWT verified on `socket.handshake.auth.token` before joining rooms. Unauthorized sockets are rejected with an error.

### 8.2 Complete Event Catalog

| Event | Emitted By | Payload | Frontend Action |
|-------|-----------|---------|----------------|
| `wa:status` | client.ts | `{ status, error? }` | Header/settings badge update |
| `wa:qr` | client.ts | `{ qr: string }` | Refresh QR image in settings |
| `message:new` | sender.ts, inbound-workflow.ts | Full message record + conversationId | Append to ChatWindow state; update ConversationList preview + unread |
| `message:status` | handler.ts | `{ externalId, status }` | Update delivery tick on bubble |
| `message:reaction` | conversations.routes.ts | `{ conversationId, messageId, reactions[] }` | Update reaction pills in ChatWindow |
| `conversation:updated` | conversations.service.ts, snooze-wakeup.ts | Partial conversation fields | Merge into ChatWindow + ConversationList state |
| `note:new` | notes.service.ts | Full note with author | Append to notes list |
| `note:deleted` | notes.service.ts | `{ noteId }` | Remove from notes list |
| `broadcast:progress` | broadcast.queue.ts | `{ broadcastId, sent, failed, total }` | Update progress bar |
| `broadcast:complete` | broadcast.queue.ts | `{ broadcastId, status }` | Show completion toast |
| `tag:created` | tags.routes.ts | Full tag | Add to tag list |
| `tag:updated` | tags.routes.ts | Updated tag | Update tag in list |
| `tag:deleted` | tags.routes.ts | `{ tagId }` | Remove from tag list |
| `contact:tag_added` | tags.routes.ts | `{ contactId, tagId }` | Refresh contact tag display |
| `contact:tag_removed` | tags.routes.ts | `{ contactId, tagId }` | Refresh contact tag display |
| `typing:start` | Socket relay (client-emitted) | `{ conversationId, userId }` | Show peer typing dots |
| `typing:stop` | Socket relay (client-emitted) | `{ conversationId, userId }` | Clear typing indicator |

---

## 9. CURRENT FEATURES BREAKDOWN

### 9.1 Chat System ✅
Full inbound/outbound pipeline. Real-time via socket with direct state append (no re-fetch). Supports text, image, video, audio, document, voice notes (OGG/Opus via FFmpeg). Reply-to quoting, message reactions (synced to WhatsApp), forward, copy, search within conversation.

**Limitations**: Single WhatsApp number per instance. Media on local disk (no CDN). `replyToId` is CRM message ID (visual quoting only — does not reference actual WhatsApp thread ID).

### 9.2 Conversation Management ✅
Pin, snooze (with auto-wakeup), status change (OPEN/RESOLVED/PENDING/ON_HOLD/ARCHIVED/SPAM), priority (LOW/NORMAL/HIGH/URGENT), pipeline stage, assignment (agent + team). Saved inbox views. Deduplication by phone (backend). Cursor-paginated message loading.

### 9.3 Contact Management ✅
CRUD + CSV import + CSV export (client-side). WhatsApp avatar auto-fetched on first open. Contact timeline (conversations, deals, tasks, notes). Phone normalization with multi-variant matching. Relational tag system with color-coded tags. `ContactTagSelector` component for UI.

### 9.4 Message Templates System ✅
Full CRUD with TEXT/MEDIA/INTERACTIVE types and DRAFT/PUBLISHED/ARCHIVED lifecycle. Visual block-based builder with 7 block types. Server-side variable rendering. 9 preset templates across 6 business categories. Duplicate template action.

### 9.5 Broadcast System ✅
Bull-queue-backed. Tag-based or phone list targeting. Pause/resume. Anti-ban randomized delay (1.5s–4s). Progress via socket. Three broadcast types: IMMEDIATE, SCHEDULED, RECURRING (cron). Separate create/edit/list pages.

**Limitations**: No `{{name}}` personalization variables. No link tracking. No bounce detection.

### 9.6 Automation Engine ✅
Single-step rules: KEYWORD, FIRST_MESSAGE, ANY_MESSAGE, OUTSIDE_HOURS (Cairo timezone hardcoded).
Multi-step flows: SEND_MESSAGE + WAIT steps with BullMQ delayed execution. Stop-on-reply: active flow executions cancelled when contact replies. No-reply detector triggers NO_RESPONSE_TIME flows. 15 trigger types defined in schema; 5 currently evaluated by engine.

### 9.7 Assignment System ✅
Manual assign to agent or team. Round-robin auto-assign (per-team opt-in via `autoAssign` flag). Least-busy routing (agent with fewest open OPEN conversations). Assignment history in right panel (reads AuditLog).

### 9.8 Analytics ✅
Overview KPIs, 30-day message chart (Recharts), agent performance table with **avg first response time**, pipeline funnel with conversion rate. Dashboard auto-refreshes every 60s.

**Limitations**: No CSAT. No SLA breach tracking. No CSV export of conversation data.

### 9.9 Tag Management ✅
Full relational tag system: create/edit/delete tags with 8 color options. Assign/remove tags from contacts. Tag workspace page (`/tags`) with contact filtering. Real-time socket events for all tag operations. Contact count shown per tag.

### 9.10 Deals Pipeline ✅
Kanban columns. Quick stage-advance button. Linked to contacts (cascade delete). `closedAt` auto-set when stage → CLOSED. Pipeline stats used in analytics funnel.

### 9.11 Theme + UI System ✅
Dark/light mode via ThemeProvider. WhatsApp-inspired dark palette. shadcn/ui component library. `@tanstack/react-table` data tables with sorting, pagination, bulk actions. Premium sidebar with role-aware navigation.

---

## 10. PERFORMANCE ANALYSIS

### 10.1 Identified Bottlenecks

| Area | Issue | Severity | Impact |
|------|-------|----------|--------|
| `GET /conversations` | No cursor-based pagination | HIGH | 500+ convs = 2s+ response |
| File storage | Local disk, no CDN | HIGH | No scaling, no redundancy |
| Baileys in-process | WhatsApp socket in same Node process as API | HIGH | Socket lag can block API requests |
| Tag queries | Legacy `LIKE '%tag%'` on CSV field (if still used) | MEDIUM | Slow at 100K+ contacts |
| Analytics updates | Full count queries per request | MEDIUM | Slow at high volume |
| Message loading | Cursor-paginated at 50 — good; but no virtualization in chat | LOW | DOM bloat for long conversations |

### 10.2 Frontend Performance

| Issue | Impact |
|-------|--------|
| No virtualization on conversation list | DOM bloat at 500+ items |
| No lazy loading of media in chat | Heavy initial render for media-heavy history |
| Dashboard re-fetches all 5 APIs every 60s | Minor overhead; could be socket-driven |
| `useSocket` callbacks must be wrapped in `useCallback` | All current handlers use `useCallback` — no regression |

### 10.3 Applied Optimizations (from Schema)

The following indexes are now present in `schema.prisma`:
```prisma
Conversation: @@index([teamId, status, lastMessageAt(sort: Desc)])
Conversation: @@index([contactId, status])
Conversation: @@index([assignedTo])
Conversation: @@index([snoozedUntil])
Message:      @@unique([externalId, sessionId])
Message:      @@index([conversationId, timestamp(sort: Desc)])
Message:      @@index([phone])
Contact:      @@index([teamId])
Contact:      @@index([phone])
Tag:          @@index([teamId])
AutomationFlow: @@index([teamId, isActive])
AutomationFlowStep: @@index([flowId, order])
AutomationFlowExecution: @@index([flowId, phone, status])
AutomationFlowExecution: @@index([phone, status])
Task:         @@index([teamId, status])
Deal:         @@index([teamId, stage])
```

### 10.4 Remaining Missing Indexes

```prisma
// Still missing for production scale:
@@index([broadcastId, status])          // BroadcastRecipient
@@unique([teamId, phone])              // Contact (phone is globally unique now — per-team index not needed)
@@index([conversationId])              // InternalNote
```

---

## 11. SCALABILITY ANALYSIS

### 11.1 Current Limits (Estimated)

| Metric | Estimated Safe Limit | What Breaks |
|--------|---------------------|-------------|
| Concurrent agents | ~50 | Socket.IO CPU overhead |
| Total contacts | ~100,000 | Phone `@unique` index helps; tag queries on CSV field slow |
| Messages per day | ~10,000 | Analytics update queries, disk space |
| Conversations | ~5,000 | Unpaginated conversation list API |
| Broadcast recipients | ~2,000 | Anti-ban delay helps; WhatsApp still rate-limits |
| WhatsApp sessions | 1 | Single Baileys connection |

### 11.2 What Breaks at 1K Concurrent Users
- `GET /conversations` without pagination → 10–50s response
- Local file storage fills disk
- Single PostgreSQL instance without read replicas
- Single Baileys instance → only 1 WhatsApp number
- No Redis pub/sub adapter on Socket.IO → can't scale horizontally

### 11.3 What Needs Redesign for 100K Users
1. **Architecture**: Separate WhatsApp Gateway service, stateless API cluster, Bull worker cluster, Socket.IO with Redis adapter
2. **Database**: Read replicas, partitioned `Message` table by month, proper indexes
3. **Storage**: S3-compatible object storage (MinIO / AWS S3)
4. **WhatsApp**: Official Meta Cloud API, multiple WABA numbers
5. **Multi-tenancy**: Row-level security or separate schemas per tenant

---

## 12. CODE QUALITY REVIEW

### 12.1 Positive Patterns
- Consistent layered architecture (routes → service → Prisma)
- Retry logic with exponential backoff (`lib/retry.ts`)
- Structured JSON logging (`lib/logger.ts`)
- Phone normalization centralized with multi-variant matching
- Bull for async broadcasts and flow execution
- TypeScript throughout frontend and backend
- Comprehensive audit logging on key actions
- Team-scoped socket rooms (not global broadcast)
- Real-time state updates via socket payload (no HTTP re-fetch on `message:new`)
- Duplicate conversation handling in `conversation-resolver.ts`
- Auto token refresh on 401/403 in `lib/api.ts`
- React 18 `useCallback` on all socket handlers (no re-registration on every render)
- shadcn/ui component system for consistent primitive components
- CSV export utility as pure client-side function (no server roundtrip)

### 12.2 Technical Debt

| Issue | Location | Severity |
|-------|----------|----------|
| No cursor-based pagination on conversation list | `GET /api/conversations` | HIGH |
| Tags as CSV string (legacy) | `Contact.tag` | HIGH — new code should use `ContactTag` |
| `prisma db push` instead of migrations | Dev workflow | HIGH — no migration history |
| OUTSIDE_HOURS hardcoded Cairo timezone | `automations/engine.ts` | MEDIUM |
| `uploads/` served statically without auth | `express.static` | MEDIUM |
| `any` type scattered in TypeScript code | Various | LOW |
| `console.log` mixed with structured logger | Various | LOW |
| `replyToId` is CRM ID not WhatsApp message ID | `Message` model | LOW |
| Flow step types limited to SEND_MESSAGE + WAIT | Schema | LOW — CONDITION/ASSIGN/TAG/END planned |
| Pending trigger types not evaluated by engine | `automations/engine.ts` | LOW |

### 12.3 Missing Error Handling
- FFmpeg conversion failure in `sender.ts` — not gracefully caught
- Media download timeout in `inbound-workflow.ts` — error swallowed
- Bull job failure — no admin notification, only `status=FAILED` in DB
- File upload MIME validation absent — any binary accepted

---

## 13. SECURITY REVIEW

### 13.1 Critical Vulnerabilities

**[HIGH] Webhook endpoint has no mandatory auth**
- `WHATSAPP_WEBHOOK_SECRET` is optional — attacker can POST fake messages
- Fix: make mandatory, validate HMAC signature

**[HIGH] File upload has no MIME type/size validation**
- `POST /api/upload` and `POST /api/conversations/:id/reply` accept any file
- 32 MB limit exists on upload endpoint; reply endpoint uses multer memoryStorage with no size limit configured
- Fix: validate MIME with magic bytes library, enforce per-type size limits

**[HIGH] No rate limiting on most endpoints**
- Brute force possible on all authenticated endpoints
- Fix: `express-rate-limit` at 100 req/min per user token

**[HIGH] Uploaded files served without authentication**
- `express.static(uploadsDir)` serves all files publicly by URL
- Anyone who discovers a file URL can access it without auth
- Fix: serve files through an authenticated proxy route

**[MEDIUM] No Helmet.js security headers**
- Missing CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Fix: `app.use(helmet())`

**[MEDIUM] No Zod/Joi input validation**
- Malformed inputs can reach Prisma or crash services
- Fix: Zod schema on all POST/PUT bodies

**[MEDIUM] No 2FA**
- Admin accounts have no MFA protection

**[MEDIUM] `prisma db push` as deployment strategy**
- Production schema changes applied without review or rollback path
- Fix: use `prisma migrate deploy` with reviewed migration files

### 13.2 Security Recommendations

```
Priority 1 (Fix before production):
  □ Mandatory webhook secret + HMAC validation
  □ File upload MIME type validation (magic bytes)
  □ Authenticated file serving endpoint
  □ Add Helmet.js
  □ General API rate limiting

Priority 2 (Within 2 sprints):
  □ Zod validation on all API inputs
  □ Switch from db push to proper migrations
  □ Path traversal check in file serving

Priority 3 (Before SaaS launch):
  □ 2FA for admin accounts
  □ JWT blocklist in Redis (session revocation)
  □ Penetration test + OWASP Top 10 review
```

---

## 14. DEVOPS & DEPLOYMENT

### 14.1 Current State
Single-machine, development mode. `npm run dev` (via `ts-node`) runs backend. `next dev` runs frontend. Docker Compose for PostgreSQL + Redis only. No CI/CD, no PM2, no Nginx, no SSL, no monitoring, no health checks.

### 14.2 Environment Variables

**Backend (`apps/backend/.env`)**:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/whatsapp_system
REDIS_URL=redis://localhost:6380
JWT_SECRET=<min-32-chars>
PORT=4000
FRONTEND_URL=http://localhost:3000

# WhatsApp
WA_DEFAULT_REGION=EG
WHATSAPP_AUTO_CONNECT=true
WHATSAPP_SESSION_ID=default
WHATSAPP_TEAM_ID=<team_cuid>
WHATSAPP_WEBHOOK_SECRET=<secret>

# Broadcast anti-ban delays (ms)
BROADCAST_DELAY_MIN_MS=1500
BROADCAST_DELAY_MAX_MS=4000

# No-reply detector
NO_REPLY_THRESHOLD_MS=1800000      # 30 min default
NO_REPLY_CHECK_INTERVAL_MS=300000  # 5 min default
```

**Frontend (`apps/frontend/.env.local`)**:
```env
NEXTAUTH_SECRET=<strong-secret>
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 14.3 NPM Scripts

**Backend**:
```
npm run dev          — ts-node src/index.ts (development)
npm run build        — tsc (compile to dist/)
npm run start        — node dist/index.js (production)
npm run db:push      — prisma db push
npm run db:migrate   — prisma migrate dev
npm run db:generate  — prisma generate
npm run db:seed:templates — ts-node scripts/seed-templates.ts
```

**Frontend**:
```
npm run dev    — next dev
npm run build  — next build
npm run start  — next start
npm run lint   — eslint .
```

### 14.4 Recommended Production Setup

```
Internet → [Nginx + SSL (Let's Encrypt)] → /api/* → Express :4000
                                         → /socket.io/* → Express :4000 (ws upgrade)
                                         → /* → Next.js :3000

[PM2]
  ├─ backend (cluster, 4 workers)
  └─ frontend (standalone server)

[Docker Compose]
  ├─ postgres:5433
  └─ redis:6380
```

### 14.5 Known Windows Dev Issues
- `prisma generate` requires killing all Node processes on Windows due to EPERM file lock on `query_engine-windows.dll.node`
- Use: `Stop-Process -Name "node" -Force` then `npx prisma generate`
- `ts-node` cold-start is slow (~3s) on Windows — consider `tsx` or `ts-node-dev` for faster restarts

---

## 15. MISSING FEATURES VS WATI

| Feature | WATI Has | This System | Priority |
|---------|----------|-------------|----------|
| Official WhatsApp Business API | ✅ | ❌ Baileys only | P0 |
| Multi-WhatsApp-number support | ✅ | ❌ Single session | P0 |
| WhatsApp Message Templates (HSM / Meta approval) | ✅ | ❌ (local templates only) | P0 |
| Contact opt-in management | ✅ | ❌ | P0 |
| Visual chatbot flow builder (CONDITION/ASSIGN/TAG nodes) | ✅ | ❌ (SEND+WAIT only) | P1 |
| SLA rules and escalation | ✅ | ❌ | P1 |
| Agent response time analytics | ✅ | ⚠️ Partial (avg first response only) | P1 |
| CSAT surveys | ✅ | ❌ | P1 |
| Agent online/availability status | ✅ | ❌ | P1 |
| Conversation tags | ✅ | ❌ (contact tags only) | P1 |
| Canned responses with media | ✅ | ⚠️ Text only (Saved Replies) | P1 |
| Broadcast personalization ({{name}}) | ✅ | ❌ | P1 |
| Message scheduling (per conversation) | ✅ | ❌ | P2 |
| Link tracking in broadcasts | ✅ | ❌ | P2 |
| CSV export of conversations | ✅ | ❌ (contacts export exists) | P2 |
| Email notifications | ✅ | ❌ | P2 |
| API webhooks to external systems | ✅ | ❌ (incoming only) | P2 |
| Zapier / Make integration | ✅ | ❌ | P2 |
| Multi-language UI | ✅ | ❌ | P2 |
| White-label / custom domain | ✅ | ❌ | P2 SaaS |
| Billing / subscription management | ✅ | ❌ | P2 SaaS |
| Mobile app | ✅ | ❌ | P3 |
| AI reply suggestions | Partial | ❌ | P3 |

---

## 16. UPGRADE ROADMAP

### Phase 0: Stabilization (2–4 weeks)
*Make the current system production-safe.*

- [ ] Add Helmet.js security headers
- [ ] Make webhook secret mandatory + HMAC validation
- [ ] File upload MIME type validation + size limits
- [ ] Serve uploaded files through authenticated route (not `express.static`)
- [ ] Zod validation on all API inputs
- [ ] General rate limiting (100 req/min per user)
- [ ] Switch `prisma db push` to `prisma migrate deploy` with proper migration history
- [ ] Add cursor-based pagination to `GET /api/conversations`
- [ ] Dockerize backend + frontend
- [ ] Nginx reverse proxy config + SSL (Let's Encrypt)
- [ ] PM2 ecosystem file
- [ ] GitHub Actions CI (lint, build, type-check)
- [ ] Add missing `BroadcastRecipient` index

### Phase 1: Automation Engine Completion (2–3 weeks)
*Implement the remaining trigger types and flow node types.*

Add missing trigger evaluations to `engine.ts`:
- `REGEX` — match message body against regex pattern
- `CONTAINS_URL` — detect URLs in message
- `CONTAINS_PHONE` — detect phone numbers in message
- `TAG_ADDED` / `STATUS_CHANGE` — event-driven triggers
- `TIME_BASED` / `DAY_OF_WEEK` — scheduled evaluation

Add missing flow step types:
```prisma
enum FlowStepType {
  SEND_MESSAGE
  WAIT
  CONDITION          // branch on contact field / tag / message content
  ASSIGN             // assign to agent or team
  TAG                // add/remove tag on contact
  UPDATE_STATUS      // change conversation status
  END
}
```

### Phase 2: Multi-Session Support (4–8 weeks)
*Each team gets their own WhatsApp number.*

New model:
```prisma
model WhatsAppAccount {
  id        String @id @default(cuid())
  teamId    String @unique
  sessionId String @unique
  status    String
  phone     String?
  qr        String?
}
```

Architecture: session manager that spawns one Baileys instance per `WhatsAppAccount`, routes `message:new` to the correct team room.

New endpoints: `POST/DELETE/GET /api/whatsapp/sessions`

### Phase 3: Official WhatsApp Business API (4–6 weeks)
*Replace Baileys with Meta Cloud API.*

Abstract an `IWhatsAppProvider` interface:
```typescript
interface IWhatsAppProvider {
  sendTextMessage(phone: string, text: string): Promise<string>;
  sendMediaMessage(phone: string, media: MediaPayload): Promise<string>;
  sendTemplate(phone: string, template: HSMTemplate): Promise<string>;
  getConnectionStatus(): 'CONNECTED' | 'DISCONNECTED';
}
```

Implement `BaileysProvider` (current) and `MetaCloudProvider`. Switch via env flag per team. Receive Meta webhooks → `processIncomingMessage()`.

**Unlocks**: HSM Templates with Meta approval, interactive messages (buttons, lists), official delivery receipts, 24-hour conversation window enforcement.

### Phase 4: Broadcast Personalization + CSV Export (1–2 weeks)
*Fill the highest-priority gaps in broadcast and data portability.*

- Broadcast message body: replace `{{name}}`, `{{phone}}`, `{{custom_field}}` per recipient before send
- Add `GET /api/broadcasts/:id/export` → CSV of all recipients + delivery status
- Add `GET /api/conversations/export` → CSV of conversations within a date range

### Phase 5: Advanced Analytics (3–4 weeks)

New model:
```prisma
model ConversationMetric {
  conversationId  String   @unique
  firstResponseAt DateTime?
  resolvedAt      DateTime?
  csatScore       Int?
  firstResponseMs Int?
  slaBreached     Boolean  @default(false)
}
```

New metrics: SLA breach detection, CSAT survey dispatch (send WhatsApp message post-resolution), agent workload heatmap, broadcast click tracking (link shortener).

### Phase 6: SaaS Infrastructure (6–8 weeks)
*Billing, onboarding, white-labeling.*

- Stripe integration (subscription tiers: agents, messages, contacts)
- Tenant onboarding flow (sign up → connect WA → invite agents)
- Super-admin dashboard across all tenants
- Custom subdomain routing per tenant (`<tenant>.yoursaas.com`)
- Usage metering + overage alerts
- Email notification channel (SendGrid / Resend)
- Outbound webhook delivery to external systems

### Architecture Target State (12–18 months)

```
[Cloudflare CDN / Load Balancer]
       │                         │
[API Cluster]             [WebSocket Gateway]
[Node + Express]          [Socket.IO + Redis Adapter]
       │
[WhatsApp Gateway]   ─── one process per WhatsApp account
       │
[Bull Workers]       ─── horizontal scale (broadcasts + flows)
       │
[PostgreSQL Primary] ─── + Read Replicas
[Redis Cluster]      ─── BullMQ + Socket.IO adapter + JWT blocklist
[S3 Object Storage]  ─── media files (replace local uploads/)
```
