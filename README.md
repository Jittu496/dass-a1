# Felicity Event Management System

## Tech Stack
- **Frontend**: React (CRA) — deployed to Vercel/Netlify
- **Backend**: Node.js + Express — deployed to Render/Railway
- **Database**: MongoDB Atlas
- **Realtime**: Socket.IO (for discussion forum)

## Setup

### Backend
```bash
cd backend
npm install
# create .env with MONGO_URI, JWT_SECRET, PORT, FRONTEND_ORIGIN
npm start
```

### Frontend
```bash
cd frontend
npm install
# set REACT_APP_API_BASE in .env
npm start
```

---

## Advanced Features Implemented

### Tier A (Choose 2 – 8 marks each): **Both implemented**

1. **Hackathon Team Registration** (`/team`, `/api/teams`)
   - Team leader creates team with invite code
   - Members join via code, leader finalizes when full
   - Ticket generated for all members on finalization
   - *Justification*: Core feature for IIIT Felicity which hosts multiple hackathons annually

2. **QR Scanner & Attendance Tracking** (`/org/scan`, `/api/tickets/scan`)
   - Organizer scans QR text, marks attendance with timestamp
   - Duplicate scan rejection (409 Already checked-in)
   - Per-event attendance dashboard
   - Export CSV with attendance timestamps
   - *Justification*: Essential for entry management at high-footfall events

### Tier B (Choose 2 – 6 marks each): **Both implemented**

1. **Real-Time Discussion Forum** (`/forum`, `/api/forum`, Socket.IO)
   - Participants & organizers post messages per event
   - Socket.IO real-time delivery + polling fallback
   - *Justification*: Reduces WhatsApp group chaos, keeps discussions event-scoped

2. **Organizer Password Reset Workflow** (`/org/reset`, `/admin/password-resets`, `/api/admin/password-reset`)
   - Organizer submits reset request with reason
   - Admin views all requests, approves/rejects with notes
   - On approval, auto-generates new password shown to admin
   - *Justification*: Required by assignment spec; organizers have no self-service reset

### Tier C (Choose 1 – 2 marks each): **Implemented**

1. **Anonymous Feedback System** (`/feedback`, `/org/feedback`, `/api/feedback`)
   - Participants submit 1-5 star rating + comment anonymously after event
   - Organizers view average rating, distribution, and recent comments
   - *Justification*: Lightweight to implement, high value for organizer improvement

---

## Deployment Links
See `deployment.txt` in root directory.