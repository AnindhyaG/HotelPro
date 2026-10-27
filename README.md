# HotelPro


Hotel booking and management system built with the stack from your requirements: **MongoDB, Express, React, Node.js**.

## Features
- Guests: register and log in, search rooms by dates, guests and type, book, pay, and cancel
- Double-booking protection: availability is checked against existing bookings on search and again on booking
- Staff: dashboard with occupancy, arrivals, departures and revenue; check guests in and out; view guests
- Admin: everything staff can do, plus add, reprice and remove rooms
- Security: bcrypt password hashing, JWT auth, role-based access on the server

## Setup
1. Install Node.js (current LTS), Git, and MongoDB (local or Atlas).
2. Backend:
   ```
   cd server
   npm install
   cp .env.example .env     # set MONGO_URI and a long random JWT_SECRET
   npm run seed             # demo users and 12 rooms
   npm run dev              # http://localhost:5000
   ```
3. Frontend (second terminal):
   ```
   cd client
   npm install
   npm run dev              # http://localhost:5173
   ```

## Demo logins (from the seed script)
| Role | Email | Password |
|---|---|---|
| Admin | admin@hotelpro.com | admin123 |
| Staff | staff@hotelpro.com | staff123 |
| Guest | guest@hotelpro.com | guest123 |

Change or delete these accounts before any real deployment.

## API (Postman)
Send `Authorization: Bearer <token>` on protected routes.
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/rooms?checkIn=&checkOut=&guests=&type=`; `POST/PUT/DELETE /api/rooms` (admin)
- `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings` (staff)
- `POST /api/bookings/:id/pay`, `PATCH /api/bookings/:id/status`
- `GET /api/admin/stats`, `GET /api/admin/guests`

## Before going live
- Payments are a **demo**: `/bookings/:id/pay` marks a booking paid without charging anyone. Replace it with Stripe or Razorpay and verify webhooks.
- Add HTTPS, rate limiting (e.g. express-rate-limit), and `helmet`.

