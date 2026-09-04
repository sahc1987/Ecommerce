# Ecommerce

A full-stack e-commerce platform with a web storefront, an admin dashboard, and a companion mobile app, backed by a Node.js/Express API with PostgreSQL and Redis.

<p align="left">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/React_Native-0.87-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Redux_Toolkit-State-764ABC?style=for-the-badge&logo=redux&logoColor=white" alt="Redux Toolkit" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Nginx-Reverse_Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx" />
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT" />
  <img src="https://img.shields.io/badge/Cloudinary-Media-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white" alt="Cloudinary" />
</p>

## Overview

This repository contains a monorepo for an e-commerce system made up of three applications that share a single backend API:

- **`backend/`** — REST API built with Node.js and Express, backed by PostgreSQL and Redis, with JWT-based authentication and Cloudinary-powered image uploads.
- **`frontend/`** — Customer-facing web storefront and admin dashboard built with React, TypeScript, and Vite, served in production through Nginx.
- **`mobile/`** — Cross-platform iOS/Android app built with React Native and TypeScript, sharing the same API and Redux data layer as the web client.

## Features

- User authentication with JWT and cookie-based sessions
- Product catalog with categories and search
- Shopping cart and order management
- Payment processing
- Return/refund requests
- User profile management
- Notifications
- Admin dashboard with analytics (charts via Recharts)
- Image uploads with Cloudinary
- Rate limiting and security headers (Helmet, express-rate-limit)
- Dockerized local and production environment (Postgres, Redis, API, web client)

## Tech Stack

| Layer | Technologies |
|---|---|
| Web Frontend | React, TypeScript, Vite, Redux Toolkit, React Router, Tailwind CSS, Axios, Recharts |
| Mobile | React Native, TypeScript, React Navigation, Redux Toolkit |
| Backend | Node.js, Express, JWT, bcrypt, Multer, Helmet |
| Data | PostgreSQL, Redis |
| Infrastructure | Docker, Docker Compose, Nginx, Cloudinary |
| Testing / Tooling | Jest, ESLint, Prettier |

## Project Structure

```
Ecommerce/
├── backend/          # Express API (routes, middleware, db, config)
│   └── src/
│       ├── routes/   # auth, users, products, categories, orders,
│       │             # payments, returns, notifications, dashboard
│       ├── middleware/
│       ├── db/
│       └── config/
├── frontend/         # React + TypeScript + Vite web app
│   └── src/
├── mobile/           # React Native app (iOS + Android)
│   └── src/
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Node.js (v22+ recommended for the mobile app, v18+ for backend/frontend)
- Docker and Docker Compose
- For mobile development: a configured React Native environment (Android Studio and/or Xcode)

### Run with Docker Compose (backend + frontend + database)

```bash
git clone https://github.com/sahc1987/Ecommerce.git
cd Ecommerce
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL, Redis, the API, and the web frontend (served via Nginx).

### Run services individually

**Backend**

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

**Frontend**

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

**Mobile**

```bash
cd mobile
npm install
npm run ios      # or
npm run android
```

## Environment Variables

Each app (`backend/`, `frontend/`, `mobile/`) includes a `.env.example` file documenting the environment variables it expects (database connection, Redis, JWT secret, Cloudinary credentials, API URL, etc.). Copy each to `.env` and fill in your own values before running.

## About the Author

**Saúl Hernández** — Full Stack Developer with 7+ years of experience building web, mobile, and backend systems.

- GitHub: [@sahc1987](https://github.com/sahc1987)
- LinkedIn: [saul-hernandez-dev](https://linkedin.com/in/saul-hernandez-dev)
- Email: [sahc1987@gmail.com](mailto:sahc1987@gmail.com)

## License

No license has been specified for this project yet. All rights reserved by the author unless stated otherwise.
