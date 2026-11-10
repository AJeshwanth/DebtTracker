# Deployment checklist

- [ ] Create MongoDB Atlas database and user; add its connection string to Render.
- [ ] Create Cloudinary account; add cloud name, API key and API secret to Render.
- [ ] Deploy `server/` to Render with `APP_PASSWORD`, `CLIENT_URL`, `MONGODB_URI`, Cloudinary variables.
- [ ] Verify Render `/api/health` responds with `{ "ok": true }`.
- [ ] Deploy `client/` to Vercel with `VITE_API_URL` set to the Render service origin.
- [ ] Set Render `CLIENT_URL` to the Vercel origin and redeploy the backend.
- [ ] Verify login, create/edit/delete debt, payment upload, balance recalculation, filters and charts.

Do not commit `.env` files or share your Cloudinary API secret, MongoDB password or family password.
