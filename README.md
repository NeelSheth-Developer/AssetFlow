# AssetFlow

A full-stack **Asset Management System** for organizations — track assets across locations, allocate them to employees, handle transfers between departments, book shared resources, run maintenance workflows, and audit inventory — all with role-based access control.

🔗 **Live Demo:** [https://asset-flow-dun.vercel.app/](https://asset-flow-dun.vercel.app/)

🎥 **Demo Video:** [Watch on Google Drive](https://drive.google.com/file/d/1GhXxHqK-uD-rNudpoKTfZ8A0sikThaaI/view?usp=sharing)

## 💡 What is AssetFlow?

Every organization owns things — laptops, projectors, vehicles, meeting rooms, tools — and usually tracks them in spreadsheets that go stale the moment someone changes desks. AssetFlow replaces that with a single system of record:

- **Where is it?** Every asset lives in a location → floor → room hierarchy and belongs to a category and department.
- **Who has it?** Allocations record which employee or department currently holds an asset, with full history.
- **Can I use it?** Shared resources (meeting rooms, equipment) are bookable with conflict detection, so two teams can't reserve the same projector at the same time.
- **Is it working?** Maintenance requests move through a request → in-progress → resolved workflow, and audit cycles let managers physically verify inventory department by department.
- **Who did what?** Every action is written to an activity log, and users get in-app + email notifications for things that concern them.

Access is controlled by four roles (Admin, Asset Manager, Department Head, Employee) — the API enforces permissions on every endpoint, and the UI adapts to show each role only what they can act on.

## 📁 Repository Structure

```
AssetFlow/
├── Backend/              # Express + TypeScript REST API (PostgreSQL)
│   └── README.md         # → Backend docs (setup, API index, auth, schema)
└── Frontend/
    └── assetflow/        # Next.js 16 (App Router) client
        └── README.md     # → Frontend docs (setup, pages, state, UI stack)
```

- **[Backend README](./Backend/README.md)** — API, database, authentication & RBAC
- **[Frontend README](./Frontend/assetflow/README.md)** — UI, pages, state management

## 🛠 Tech Stack at a Glance

| Layer      | Technology |
|------------|------------|
| Frontend   | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Zustand, React Hook Form + Zod, Recharts, Framer Motion |
| Backend    | Node.js 20+, Express 4, TypeScript, PostgreSQL (Neon), JWT (HttpOnly cookies), bcryptjs, Nodemailer, Cloudinary, Multer, Pino |
| Database   | PostgreSQL — 20+ tables, enum types, FK constraints, targeted indexes |
| Auth       | JWT access token (15 min) + rotating refresh token (7 days), both in HttpOnly cookies; 4-role RBAC with department scoping |

## 🔐 Roles & Demo Credentials

Seeded by `npm run db:seed` in `Backend/`:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| `ADMIN` | admin@assetflow.com | Admin@123 | Full system access — users, departments, org setup, everything |
| `ASSET_MANAGER` | manager@assetflow.com | Manager@123 | Organization-wide asset operations — assets, allocations, transfers, maintenance, audits |
| `DEPT_HEAD` | head@assetflow.com | Head@123 | Scoped to their own department's assets, people, and requests |
| `EMPLOYEE` | employee@assetflow.com | Employee@123 | Own allocations, bookings, and maintenance requests |

## ✨ Main Features

- **Asset registry** — categories with custom fields, locations → floors → rooms hierarchy, documents/images (Cloudinary), QR code generation per asset
- **Allocations** — assign assets to employees or departments, track holder history
- **Transfers** — request/approve workflow for moving assets between departments
- **Bookings** — reserve shared resources with conflict detection and recurring series
- **Maintenance** — request → triage → resolve workflow with comments
- **Audit cycles** — scheduled inventory verification per department with assigned auditors
- **Dashboard & reports** — KPIs and charts, role-scoped
- **Notifications** — in-app feed + email (Nodemailer), per-user preferences
- **Activity logs** — full audit trail of who did what, when

## 🚀 Quick Start

```bash
# 1. Backend (see Backend/README.md for env vars)
cd Backend
npm install
npm run db:migrate && npm run db:seed
npm run dev            # http://localhost:3000

# 2. Frontend
cd Frontend/assetflow
npm install
npm run dev            # http://localhost:3000 (Next.js picks the next free port)
```

Log in with any of the demo credentials above.

## 👥 Team Vector

AssetFlow is designed and developed by **Team Vector**.

| Team Member | Email |
|-------------|-------|
| Tirth Patel | [tirthpatel4822@gmail.com](mailto:tirthpatel4822@gmail.com) |
| Ridham Rangani | [ridhamrangani2004@gmail.com](mailto:ridhamrangani2004@gmail.com) |
| Parth Thakkar | [parththakkar1208@gmail.com](mailto:parththakkar1208@gmail.com) |
| Neel Sheth | [shethneel2022@gmail.com](mailto:shethneel2022@gmail.com) |
