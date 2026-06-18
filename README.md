# Ecommerce

A full-stack e-commerce application featuring a customer-facing storefront and an admin dashboard. The project is split into a React + TypeScript frontend and a Node.js/Express REST API backend, backed by a PostgreSQL database and fully containerized with Docker.

## Features

- User authentication with JWT (registration and login)
- Product catalog with categories and image uploads
- Shopping experience: browse products, place orders, and process payments
- Order management with order tracking (tracking number and carrier)
- Returns handling with a configurable return window
- Product search and category filtering in the storefront
- Address autocomplete and verification at checkout
- Configurable tax applied to cart and order totals
- In-app notifications for users
- Admin dashboard with sales analytics and charts
- User management
- Guided first-run setup flow for initial configuration
- Redis-backed caching for improved performance
- Containerized deployment via Docker Compose

## Tech Stack

**Frontend**
- React 18 with TypeScript
- Vite build tooling
- Redux Toolkit for state management
- React Router for navigation
- Tailwind CSS for styling
- Axios, React Hot Toast, Recharts, and Lucide icons

**Backend**
- Node.js with Express
- PostgreSQL (via the `pg` driver)
- Redis for caching
- JWT authentication and bcrypt password hashing
- Multer for file/image uploads

**Infrastructure**
- Docker and Docker Compose
- Nginx (serves the production frontend build)

## Project Structure

```
.
├── backend/        # Express REST API
│   └── src/
│       ├── config/
│       ├── db/
│       ├── middleware/
│       ├── routes/
│       └── utils/    # caching, notifications helpers
├── frontend/       # React + TypeScript app
│   └── src/
│       ├── api/
│       ├── components/
│       ├── pages/  # Admin, Auth, Setup, Shop
│       └── store/
├── docker-compose.yml
└── .env.example
```

## Getting Started

### Prerequisites
- Docker and Docker Compose installed

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/sahc1987/Ecommerce.git
   cd Ecommerce
   ```

2. Create your environment file from the example and adjust the values:

   ```bash
   cp .env.example .env
   ```

3. Start the stack:

   ```bash
   docker compose up -d --build
   ```

The services will be available at:

- Frontend: http://localhost
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432

## Environment Variables

Configuration is managed through a `.env` file (see `.env.example`):

| Variable | Description | Default |
| --- | --- | --- |
| `DB_NAME` | PostgreSQL database name | `ecommerce` |
| `DB_USER` | Database user | `ecommerce_user` |
| `DB_PASSWORD` | Database password | `ecommerce_pass` |
| `DB_PORT` | Database port | `5432` |
| `BACKEND_PORT` | Backend server port | `5000` |
| `NODE_ENV` | Node environment | `production` |
| `JWT_SECRET` | Secret for signing JWTs (use 32+ chars) | - |
| `CLIENT_URL` | Allowed client origin (CORS) | `http://localhost` |
| `FRONTEND_PORT` | Frontend port | `80` |
| `VITE_API_URL` | API base URL used by the frontend | `http://localhost:5000` |
| `TZ` | Timezone | `UTC` |

## API Overview

The backend exposes a REST API under `/api`:

- `/api/auth` — authentication
- `/api/setup` — first-run setup
- `/api/categories` — product categories
- `/api/products` — products
- `/api/orders` — orders
- `/api/payments` — payments
- `/api/returns` — returns
- `/api/dashboard` — admin analytics
- `/api/users` — user management
- `/api/notifications` — user notifications
- `/api/health` — health check

## Local Development

Run the backend and frontend separately without Docker.

**Backend**

```bash
cd backend
npm install
npm run db:init   # initialize the database schema
npm run dev
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

## License

No license has been specified for this project.
