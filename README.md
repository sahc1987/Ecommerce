# 🛒 Ecommerce

A full-stack e-commerce platform with a customer storefront and an admin dashboard — everything you need to sell products online, manage orders, and understand your sales.

It's built as two apps that work together: a **React + TypeScript** frontend for what shoppers and admins see, and a **Node.js / Express REST API** backend that handles the data. Everything runs in **Docker**, so you can start the whole stack with a single command.

---

## ✨ What can it do?

### 🛍️ For shoppers
- **Browse and search** the product catalog, filtered by category
- **Place orders** and pay through a guided checkout
- **Smart checkout** with address autocomplete and verification
- **Track orders** with tracking number and carrier details
- **Request returns** within a configurable return window
- **Stay informed** with in-app notifications

### 🛠️ For admins
- **Sales analytics dashboard** with charts and key metrics
- **Manage the catalog** — products, categories, and image uploads
- **Manage orders and returns** from a single place
- **Manage users** and their access
- **Configure the store** — tax rates, return window, and more
- **Guided first-run setup** to get the store ready quickly

### ⚙️ Under the hood
- **Secure authentication** with JWT and hashed passwords
- **Fast responses** thanks to Redis caching
- **One-command deployment** with Docker Compose

---

## 🧰 Tech Stack

### Frontend — what users see
| Technology | What it's used for |
| --- | --- |
| **React 18 + TypeScript** | Building the user interface, with type safety |
| **Vite** | Fast development server and build tooling |
| **Redux Toolkit** | Managing application state |
| **React Router** | Navigation between pages |
| **Tailwind CSS** | Styling the interface |
| **Axios** | Talking to the backend API |
| **Recharts** | Drawing the dashboard charts |
| **React Hot Toast** | Showing notifications and alerts |
| **Lucide** | Icons throughout the app |

### Backend — the engine
| Technology | What it's used for |
| --- | --- |
| **Node.js + Express** | The REST API server |
| **PostgreSQL** (\`pg\` driver) | Storing products, orders, users, and more |
| **Redis** | Caching to keep things fast |
| **JWT + bcrypt** | Authentication and secure password storage |
| **Multer** | Handling file and image uploads |

### Infrastructure — how it runs
| Technology | What it's used for |
| --- | --- |
| **Docker + Docker Compose** | Running the whole stack in containers |
| **Nginx** | Serving the production frontend build |

---

## 📁 Project Structure

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

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) and Docker Compose installed

### Setup

**1. Clone the repository**
```bash
git clone https://github.com/sahc1987/Ecommerce.git
cd Ecommerce
```

**2. Create your environment file** from the example and adjust the values:
```bash
cp .env.example .env
```

**3. Start the stack:**
```bash
docker compose up -d --build
```

Once it's running, the services will be available at:

| Service | URL |
| --- | --- |
| 🖥️ Frontend | http://localhost |
| 🔌 Backend API | http://localhost:5000 |
| 🗄️ PostgreSQL | localhost:5432 |

---

## 🔧 Environment Variables

Configuration is managed through a `.env` file (see `.env.example`):

| Variable | Description | Default |
| --- | --- | --- |
| `DB_NAME` | PostgreSQL database name | `ecommerce` |
| `DB_USER` | Database user | `ecommerce_user` |
| `DB_PASSWORD` | Database password | `ecommerce_pass` |
| `DB_PORT` | Database port | `5432` |
| `BACKEND_PORT` | Backend server port | `5000` |
| `NODE_ENV` | Node environment | `production` |
| `JWT_SECRET` | Secret for signing JWTs (use 32+ chars) | – |
| `CLIENT_URL` | Allowed client origin (CORS) | `http://localhost` |
| `FRONTEND_PORT` | Frontend port | `80` |
| `VITE_API_URL` | API base URL used by the frontend | `http://localhost:5000` |
| `TZ` | Timezone | `UTC` |

---

## 📡 API Overview

The backend exposes a REST API under `/api`:

| Endpoint | Purpose |
| --- | --- |
| `/api/auth` | Authentication |
| `/api/setup` | First-run setup |
| `/api/categories` | Product categories |
| `/api/products` | Products |
| `/api/orders` | Orders |
| `/api/payments` | Payments |
| `/api/returns` | Returns |
| `/api/dashboard` | Admin analytics |
| `/api/users` | User management |
| `/api/notifications` | User notifications |
| `/api/health` | Health check |

---

## 💻 Local Development

Prefer to run the apps directly without Docker? Run the backend and frontend separately.

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

---

## 📄 License

No license has been specified for this project.
