# 🔧 FixIt Fast — Backend API

> Node.js + Express + MongoDB + Firebase Auth + OpenAI GPT

---

## 📁 Project Structure

```
fixit-fast-backend/
├── server.js                  # Entry point, Express + Socket.io setup
├── .env.example               # Environment variable template
├── package.json
│
├── config/
│   ├── db.js                  # MongoDB connection
│   ├── firebase.js            # Firebase Admin SDK init
│   └── cloudinary.js          # Cloudinary + Multer for file uploads
│
├── middleware/
│   ├── auth.js                # Firebase token verification + role guard
│   ├── errorHandler.js        # Global error handler
│   ├── rateLimiter.js         # Rate limiting (general + AI endpoints)
│   └── validate.js            # Joi request validation schemas
│
├── models/
│   ├── User.js                # User (tenant / landlord)
│   ├── Property.js            # Property with tenants
│   ├── MaintenanceRequest.js  # Core request model with AI diagnosis
│   └── Vendor.js              # Vendor with stats & reviews
│
├── routes/
│   ├── auth.js                # /api/auth
│   ├── users.js               # /api/users
│   ├── requests.js            # /api/requests  ← main flow
│   ├── properties.js          # /api/properties
│   ├── vendors.js             # /api/vendors
│   ├── analytics.js           # /api/analytics
│   └── upload.js              # /api/upload
│
├── controllers/
│   ├── authController.js
│   └── requestController.js   # Core CRUD + AI diagnosis + approval
│
├── services/
│   ├── aiService.js           # OpenAI GPT-4o diagnosis + insights
│   └── notificationService.js # Socket.io real-time events
│
└── utils/
    └── ApiError.js            # Custom error class
```

---

## 🚀 Setup

### 1. Install dependencies
```bash
cd fixit-fast-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Run
```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin private key |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin client email |
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLIENT_URL` | Frontend URL for CORS |

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/role` | Set role (tenant/landlord) |
| PATCH | `/api/auth/profile` | Update profile |

### Maintenance Requests
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/requests` | Tenant | Submit new request |
| GET | `/api/requests` | All | List requests (filtered by role) |
| GET | `/api/requests/:id` | All | Get request detail |
| POST | `/api/requests/:id/diagnose` | Tenant | Trigger AI diagnosis |
| PATCH | `/api/requests/:id` | Landlord | Update status/vendor/notes |
| POST | `/api/requests/:id/approve` | Landlord | Approve + assign vendor |
| POST | `/api/requests/:id/decline` | Landlord | Decline request |
| POST | `/api/requests/:id/rate` | Tenant | Rate completed repair |

### Properties
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/properties` | Landlord's properties |
| POST | `/api/properties` | Create property |
| GET | `/api/properties/:id` | Property detail |
| PATCH | `/api/properties/:id` | Update property |
| POST | `/api/properties/:id/tenants` | Add tenant |

### Vendors
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/vendors` | List vendors (filter by specialty) |
| POST | `/api/vendors` | Add vendor |
| GET | `/api/vendors/:id` | Vendor detail |
| PATCH | `/api/vendors/:id` | Update vendor |
| DELETE | `/api/vendors/:id` | Deactivate vendor |

### Analytics (Landlord only)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/overview` | KPI dashboard data |
| GET | `/api/analytics/by-category` | Issues by category |
| GET | `/api/analytics/by-month` | Monthly trend |
| GET | `/api/analytics/vendors` | Vendor performance |
| GET | `/api/analytics/insights` | AI-generated insights |

### Upload
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload/request/:id` | Upload photos/videos (max 5, 50MB each) |

---

## 🔐 Authentication Flow

1. User signs in via Firebase on the frontend
2. Frontend gets Firebase ID token: `firebase.auth().currentUser.getIdToken()`
3. Every API request includes: `Authorization: Bearer <firebase-token>`
4. Backend verifies token with Firebase Admin SDK
5. User auto-created in MongoDB on first login
6. Role set via `PATCH /api/auth/role`

---

## 🤖 AI Diagnosis Flow

```
Tenant submits issue
        ↓
POST /api/requests        → Create request in MongoDB
        ↓
POST /api/upload/request/:id  → Upload photos to Cloudinary
        ↓
POST /api/requests/:id/diagnose
        ↓
GPT-4o analyzes title + description + photos
        ↓
Returns: severity, cost estimate, recommendation, confidence
        ↓
Stored in request.aiDiagnosis
        ↓
Real-time Socket.io event → Landlord dashboard updates
```

---

## ⚡ Real-time Events (Socket.io)

| Event | Direction | Payload |
|---|---|---|
| `new_request` | Server → Landlord | New request alert |
| `status_updated` | Server → Tenant | Status change |
| `vendor_assigned` | Server → Tenant | Vendor info |

**Frontend usage:**
```js
socket.emit('join_request', requestId);   // Tenant tracks request
socket.emit('join_landlord', landlordId); // Landlord gets alerts
socket.on('status_updated', (data) => updateUI(data));
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 4 |
| Database | MongoDB Atlas via Mongoose |
| Auth | Firebase Admin SDK |
| AI | OpenAI GPT-4o |
| File Storage | Cloudinary |
| Real-time | Socket.io |
| Validation | Joi |
| Security | Helmet, express-rate-limit |
