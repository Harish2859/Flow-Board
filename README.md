<div align="center">

```
███████╗██╗      ██████╗ ██╗    ██╗██████╗  ██████╗  █████╗ ██████╗ ██████╗
██╔════╝██║     ██╔═══██╗██║    ██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗
█████╗  ██║     ██║   ██║██║ █╗ ██║██████╔╝██║   ██║███████║██████╔╝██║  ██║
██╔══╝  ██║     ██║   ██║██║███╗██║██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║
██║     ███████╗╚██████╔╝╚███╔███╔╝██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝
```

**Real-Time Collaborative Task Management**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

> **FlowBoard** is a collaborative Kanban board backed by a custom Express + PostgreSQL API.  
> Drag tasks across columns, assign teammates, and manage projects — all with role-based access control.

[🐛 Report a Bug](../../issues) · [✨ Request Feature](../../issues)

</div>

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  FlowBoard  ●  Q3 Sprint      👤 Arjun  👤 Priya  👤 Sam           │
├──────────────────┬───────────────────┬──────────────────────────────┤
│    📋 TO DO      │   ⚡ IN PROGRESS │        ✅ DONE               |
│                  │                   │                              │
│  ┌────────────┐  │  ┌─────────────┐  │  ┌───────────────────────┐   │
│  │ Design API │  │  │ Auth Module │  │  │ Project Setup         │   │
│  │ schema     │  │  │ ● HIGH      │  │  │ ● LOW                 │   │
│  │ ● MEDIUM   │  │  │ 👤 Priya    │  │  │ 👤 Arjun             │   │
│  └────────────┘  │  └─────────────┘  │  └───────────────────────┘   │
│                  │                   │                              │
│  ┌────────────┐  │  ┌─────────────┐  │                              │
│  │ Write docs │  │  │ WebSocket   │  │                              │
│  │ ● LOW      │  │  │ integration │  │                              │
│  └────────────┘  │  │ ● HIGH      │  │                              │
│                  │  │ 👤 Sam      │  │                              |
│  + Add Task      │  └─────────────┘  │                              │
└──────────────────┴───────────────────┴──────────────────────────────┘
```

---

## Features

- **Kanban Columns** — Create, rename, and drag-reorder columns to match any workflow
- **Drag-and-Drop Tasks** — Fluid card movement across columns powered by `@dnd-kit`
- **Optimistic Updates** — UI responds instantly; API confirms in the background
- **Task Detail Modal** — Edit title, description, priority, and assignee in a full panel
- **Role-Based Access** — `admin` / `editor` / `viewer` roles enforced in both UI and API
- **Board Membership** — Invite teammates by email; they appear on the board immediately
- **View-Only Mode** — All edit actions disabled for viewer-role members with a clear badge
- **Priority Levels** — `low` · `medium` · `high` — colour-coded dot on every card
- **User Assignment** — Assign any board member to a task; avatar shown on the card
- **JWT Auth** — Stateless authentication with bcrypt password hashing; token stored in `localStorage`

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     BROWSER (React 19)                   │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ Board Page  │  │  Task Modal  │  │   Dashboard /  │   │
│  │  + dnd-kit  │  │  Edit/View   │  │   Auth Pages   │   │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘   │
│         │                │                  │            │
│  ┌──────▼────────────────▼──────────────────▼─────────┐  │
│  │         TanStack Query  (cache + mutations)        │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │  fetch + JWT Bearer            │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│              EXPRESS API  (localhost:4000)               │
│                                                          │
│  POST /api/auth/signup      POST /api/auth/login         │
│  GET  /api/boards           POST /api/boards             │
│  GET  /api/boards/:id       PATCH /api/boards/:id        │
│  GET  /api/boards/:id/members                            │
│  POST /api/boards/:id/members                            │
│  GET  /api/boards/:id/columns                            │
│  POST /api/boards/:id/columns                            │
│  PATCH /api/columns/:id     POST /api/columns/reorder    │
│  GET  /api/boards/:id/tasks POST /api/tasks              │
│  PATCH /api/tasks/:id       DELETE /api/tasks/:id        │
│  POST /api/tasks/reorder                                 │
│                                                          │
└──────────────────────────┬───────────────────────────────┘
                           │  node-postgres (pg)
┌──────────────────────────▼───────────────────────────────┐
│           PostgreSQL  (task_orchestrator DB)             │
│                                                          │
│   users · boards · columns · tasks · board_members       │
└──────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
users         (id, email, password_hash, display_name, created_at)

boards        (id, title, owner_id → users, created_at)

columns       (id, board_id → boards, title, position, created_at)

tasks         (id, column_id → columns, title, description,
               position, priority ∈ {low|medium|high},
               assigned_to → users, created_at, updated_at)

board_members (board_id → boards, user_id → users,
               role ∈ {admin|editor|viewer})
```

Deleting a board cascades to its columns and tasks. Deleting a user nullifies their task assignments.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React + TypeScript | 19 / 5.x |
| Routing | TanStack Router | v1 |
| Server state | TanStack Query | v5 |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable | 6 / 10 |
| Styling | Tailwind CSS | 4.x |
| UI components | Radix UI primitives | latest |
| Icons | Lucide React | latest |
| API server | Express | 4.x |
| Authentication | bcrypt + JWT (jsonwebtoken) | — |
| Database driver | node-postgres (pg) | 8.x |
| Database | PostgreSQL | 15 |
| Build tool | Vite | 7.x |

---

## Project Structure

```
flowboard-live/
├── src/
│   ├── components/
│   │   ├── board/
│   │   │   ├── ColumnCard.tsx        # Sortable column with task list
│   │   │   ├── TaskCard.tsx          # Draggable task card
│   │   │   ├── TaskDetailModal.tsx   # Full task editor modal
│   │   │   └── InviteModal.tsx       # Invite member by email
│   │   └── ui/                       # Radix-based shadcn/ui components
│   ├── hooks/
│   │   └── use-mobile.tsx
│   ├── lib/
│   │   ├── api.ts                    # Typed fetch client (all API calls)
│   │   ├── auth.tsx                  # AuthProvider + useAuth hook (JWT)
│   │   ├── board-types.ts            # Shared TypeScript types
│   │   └── utils.ts
│   ├── routes/
│   │   ├── __root.tsx                # Root layout (QueryClient, AuthProvider)
│   │   ├── index.tsx                 # Landing page
│   │   ├── auth.tsx                  # Login / signup page
│   │   ├── dashboard.tsx             # Board list + create board
│   │   └── board.$id.tsx             # Board canvas with DnD
│   ├── router.tsx
│   ├── routeTree.gen.ts              # Auto-generated by TanStack Router
│   └── styles.css
├── server/
│   ├── index.js                      # Express app — all API routes
│   ├── db.js                         # PostgreSQL pool (node-postgres)
│   ├── auth.js                       # JWT sign + requireAuth middleware
│   ├── schema.sql                    # Reference schema for pgAdmin
│   └── package.json                  # Server-only dependencies
├── .env                              # VITE_API_URL, JWT_SECRET, API_PORT
├── package.json                      # Frontend dependencies
├── vite.config.ts
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js `>= 18`
- PostgreSQL running locally (pgAdmin or CLI)
- A database named `task_orchestrator`

### 1. Clone and install

```bash
git clone https://github.com/your-username/flowboard.git
cd flowboard-live

# Frontend dependencies
npm install

# API server dependencies
cd server && npm install && cd ..
```

### 2. Set up the database

Open pgAdmin, connect to your local PostgreSQL, and run `server/schema.sql` in the Query Tool against the `task_orchestrator` database. This creates all five tables if they don't already exist.

### 3. Configure environment

The `.env` file in the project root:

```env
VITE_API_URL=http://localhost:4000
JWT_SECRET=your_secret_key_here
API_PORT=4000
```

The `server/db.js` file holds the database connection — update it if your credentials differ:

```js
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'task_orchestrator',
  password: 'your_password',
  port: 5432,
});
```

### 4. Run both servers

Terminal 1 — API server:

```bash
cd server
npm run dev
# ✅ PostgreSQL connected.
# 🚀 API running on http://localhost:4000
```

Terminal 2 — Frontend:

```bash
cd flowboard-live
npm run dev
# ➜ Local: http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173), create an account, and start building boards.

---

## API Reference

All routes except `/api/auth/signup` and `/api/auth/login` require an `Authorization: Bearer <token>` header.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/boards` | List boards for current user |
| POST | `/api/boards` | Create a board |
| GET | `/api/boards/:id` | Get board + current user's role |
| PATCH | `/api/boards/:id` | Rename board (admin/editor only) |
| GET | `/api/boards/:id/members` | List board members |
| POST | `/api/boards/:id/members` | Invite member by email |
| GET | `/api/boards/:id/columns` | List columns |
| POST | `/api/boards/:id/columns` | Create column |
| PATCH | `/api/columns/:id` | Rename or reposition column |
| POST | `/api/columns/reorder` | Bulk update column positions |
| GET | `/api/boards/:id/tasks` | List all tasks on a board |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task fields |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/reorder` | Bulk update task positions |

---

## Roadmap

| Status | Feature |
|--------|---------|
| ✅ | Kanban board with drag-and-drop |
| ✅ | Custom Express + PostgreSQL backend |
| ✅ | JWT authentication with bcrypt |
| ✅ | Role-based access (admin / editor / viewer) |
| ✅ | Board membership and invite by email |
| ✅ | Task priority and assignee |
| 📋 | WebSocket / polling for live sync |
| 📋 | Task comments and activity log |
| 📋 | Due dates and calendar view |
| 📋 | Board templates |

---

## Contributing

1. Fork the repository
2. Create a feature branch — `git checkout -b feature/your-feature`
3. Commit — `git commit -m 'feat: description'`
4. Push — `git push origin feature/your-feature`
5. Open a Pull Request

---

<img width="1920" height="918" alt="image" src="https://github.com/user-attachments/assets/a363be97-d311-4eb4-a796-f2a4f0f583db" />
<img width="660" height="657" alt="image" src="https://github.com/user-attachments/assets/a14fc8f7-9061-4893-b29e-e8d78a3f7912" />
<img width="1918" height="507" alt="image" src="https://github.com/user-attachments/assets/a8f06cf7-1195-4704-b25c-e7e42a626061" />
<img width="1919" height="329" alt="image" src="https://github.com/user-attachments/assets/c62af67f-b5bb-4a76-9823-7fa3d9ea2a1e" />




