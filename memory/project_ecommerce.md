---
name: project-ecommerce
description: Full-stack e-commerce application built from scratch — tech stack, architecture, features, and key decisions
metadata:
  type: project
---

Full-stack e-commerce app scaffolded at `c:\Users\sahc1\Documents\Coding\Ecommerce`.

**Why:** User requested a complete e-commerce platform with admin dashboard, product management, and roles. Stripe payment was removed at user request — checkout uses cash-on-delivery only.

**Tech Stack:**
- Backend: Node.js + Express + PostgreSQL (pg) at `backend/`
- Frontend: React + TypeScript + Vite + Tailwind CSS + Redux Toolkit at `frontend/`
- Auth: JWT + bcrypt, role-based (admin / staff / customer)
- Payments: Cash on delivery only (no payment gateway)
- Docker: `docker-compose.yml` at root — postgres + backend + frontend (nginx)

**Key features built:**
- First-time store setup wizard (3-step)
- Product management with categories / subcategories / multi-image upload / discounts
- Admin dashboard: revenue charts (recharts), top products, recent orders, pending shipments, pending returns
- Role-based access control (admin sees everything, staff manages products/orders, customers buy)
- Checkout at `/checkout` — cash on delivery, no payment processor
- Returns & refund processing (admin manually marks returns as refunded, no external API)
- Customer order history at `/orders`

**How to apply:** When working on this project, understand the DB schema is in `backend/src/db/schema.sql`. First user to register becomes admin and is redirected to `/setup` wizard. No payment keys needed.

**Docker startup:**
```
cp .env.example .env
docker-compose up --build
```
Then visit http://localhost — auto-runs DB init.

**Local dev startup:**
```
# DB: run schema.sql against postgres
cd backend && npm run db:init && npm run dev
cd frontend && npm run dev
```
