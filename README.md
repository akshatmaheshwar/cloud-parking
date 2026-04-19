# Cloud Parking App

A full-stack smart parking management system built as part of a cloud computing assignment. Users can find, book, and manage parking spaces via a web interface, with the backend supporting both monolithic and microservices architectures.

## Architecture

The project contains two implementations:

**Monolith backend** (`backend/`) — a single Express.js server with Sequelize ORM, JWT authentication, and REST API routes for parking spaces and bookings.

**Microservices** (`services/`) — three independently deployable services (auth, booking, parking), each with their own SQLite database and Dockerfile.

## Tech Stack

- **Frontend:** React, Leaflet (map view)
- **Backend:** Node.js, Express.js, Sequelize ORM, SQLite
- **Auth:** JWT (JSON Web Tokens), bcrypt
- **Containerisation:** Docker, Docker Compose
- **Orchestration:** Kubernetes (manifests in `k8s/`)

## Project Structure

```
├── backend/              # Monolith Express API
│   ├── routes/           # Auth, parkingSpaces, bookings
│   ├── models/           # Sequelize models
│   ├── middleware/        # JWT auth middleware
│   └── server.js
├── client/               # React frontend
│   └── src/
│       └── components/   # Dashboard, MapView, Login, Signup, etc.
├── services/             # Microservices version
│   ├── auth-service/
│   ├── booking-service/
│   └── parking-service/
├── k8s/                  # Kubernetes manifests
│   ├── hpa.yaml          # Horizontal Pod Autoscaler
│   ├── ingress.yaml
│   └── ...
└── docker-compose.yml
```

## Running Locally

### Monolith (backend + frontend)

```bash
# Backend
cd backend
npm install
npm start        # runs on port 5000

# Frontend
cd client
npm install
npm start        # runs on port 3000
```

### With Docker Compose

```bash
docker-compose up --build
```

### Microservices with Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/parkingspaces` | List all parking spaces |
| POST | `/api/parkingspaces` | Add a parking space |
| GET | `/api/bookings` | Get user's bookings |
| POST | `/api/bookings` | Create a booking |

## Features

- User registration and login with JWT auth
- Browse available parking spaces on an interactive map
- Create and manage bookings
- Admin view to add/manage parking spaces
- Containerised with Docker for easy deployment
- Kubernetes manifests with Horizontal Pod Autoscaler for scalability
