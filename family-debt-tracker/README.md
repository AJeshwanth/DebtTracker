# Family Debt Tracker

A simple family debt and repayment tracker built with React + Vite + Tailwind CSS, Express, MongoDB Atlas and Cloudinary.

## Features
- Shared-password access for a private family workspace.
- Dashboard totals, monthly repayments, debt-wise balances and recent payments.
- Add, edit, search, filter and delete debts.
- Record repayments with JPG, PNG or PDF receipts stored in Cloudinary.
- Payment history with debt/month filters and payment deletion.
- Analytics charts using Recharts.
- Balance is recalculated from payment records after payment creation, edit or deletion. Payments above the remaining balance are rejected.

> This is a simple shared-password family tool, not a regulated banking system. Use a strong password, keep service credentials private, and restrict access to the deployed URL. The first version does not implement individual family-member accounts or audit logs.

## Requirements
- Node.js 20+
- MongoDB Atlas database and connection string
- Cloudinary account

## Run locally

### 1. Backend
```bash
cd server
cp .env.example .env
# Fill MONGODB_URI, Cloudinary values and APP_PASSWORD
npm install
npm run dev
```
The API runs on `http://localhost:5000`.

### 2. Frontend
Open a second terminal:
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Enter the same `APP_PASSWORD` configured on the backend.

## Environment variables

### Backend (`server/.env`)
| Variable | Description |
|---|---|
| `PORT` | API port; Render supplies this automatically |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLIENT_URL` | Frontend origin, e.g. `https://your-app.vercel.app` |
| `APP_PASSWORD` | Strong shared family password |

### Frontend (`client/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend origin, e.g. `http://localhost:5000` (no `/api`) |

## Deploy backend to Render
1. Push this repository to your GitHub account.
2. In Render, create **New > Web Service** and connect the repository.
3. Set **Root Directory** to `server`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add all backend environment variables listed above. Set `CLIENT_URL` to your eventual Vercel URL.
7. Deploy. Confirm `https://YOUR-RENDER-SERVICE.onrender.com/api/health` returns `{ "ok": true }`.

## Deploy frontend to Vercel
1. In Vercel, import the same GitHub repository.
2. Set **Root Directory** to `client` and framework preset to **Vite**.
3. Add `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`.
4. Deploy. Copy the Vercel URL and update backend `CLIENT_URL` on Render to that exact origin, then redeploy the backend.

## MongoDB Atlas setup
1. Create a database user with a strong password.
2. Configure Network Access. For a quick Render deployment you may temporarily allow `0.0.0.0/0`; use a restricted IP/network policy where possible.
3. Copy the Node.js connection string into `MONGODB_URI`, replacing the username, password and database name.

## Cloudinary setup
Find the cloud name, API key and API secret in the Cloudinary dashboard. Uploads are placed in the `family-debt-tracker` folder. JPG/PNG are stored as images and PDFs as raw files. Upload limit is 8 MB per file.

## API overview
- `GET /api/health`
- `POST /api/auth/check`
- `GET /api/dashboard`
- `GET, POST /api/debts`
- `GET, PUT, DELETE /api/debts/:id`
- `GET, POST /api/payments`
- `PUT, DELETE /api/payments/:id`
- `GET /api/analytics`

All API endpoints other than health and password check require `x-app-password`.

## Notes / known first-version limits
- Payments reduce principal directly; interest/EMI amortization is intentionally not calculated.
- Editing a debt cannot set its original amount below what has already been repaid.
- Deleting a debt also deletes its payment records from MongoDB. Cloudinary receipt cleanup is not automated in this first version.
- Payment editing is supported by the API; the first UI exposes payment deletion and debt/month filtering, not a payment-edit form.
- Before real family use, consider adding individual accounts, backups and a payment edit screen.
