import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Debt, Payment } from './models.js';

app.use(cors({
    origin: 'https://debt-tracker-peach-iota.vercel.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '2mb' }));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const requirePassword = (req, res, next) => {
  if (!process.env.APP_PASSWORD) return res.status(500).json({ message: 'APP_PASSWORD is not configured on the server.' });
  if (req.headers['x-app-password'] !== process.env.APP_PASSWORD) return res.status(401).json({ message: 'Incorrect family password.' });
  next();
};
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/check', (req, res) => {
  if (!process.env.APP_PASSWORD) return res.status(500).json({ message: 'Set APP_PASSWORD on the backend.' });
  return req.body.password === process.env.APP_PASSWORD ? res.json({ ok: true }) : res.status(401).json({ message: 'Incorrect password.' });
});
app.use('/api', (req, res, next) => req.path === '/health' || req.path === '/auth/check' ? next() : requirePassword(req, res, next));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  cb(allowed.includes(file.mimetype) ? null : new Error('Only JPG, PNG and PDF files are allowed.'), allowed.includes(file.mimetype));
} });
const uploadToCloudinary = (file) => new Promise((resolve, reject) => {
  const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
  const stream = cloudinary.uploader.upload_stream({ folder: 'family-debt-tracker', resource_type: resourceType, use_filename: true }, (err, result) => err ? reject(err) : resolve(result.secure_url));
  stream.end(file.buffer);
});
const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
async function refreshDebt(debtId) {
  const debt = await Debt.findById(debtId);
  if (!debt) return;
  const aggregate = await Payment.aggregate([{ $match: { debtId: debt._id } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]);
  const totalRepaid = money(aggregate[0]?.total || 0);
  debt.totalRepaid = totalRepaid;
  debt.remainingAmount = money(Math.max(0, debt.originalAmount - totalRepaid));
  debt.status = debt.remainingAmount <= 0 ? 'Completed' : 'Active';
  await debt.save();
}
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const debts = await Debt.find().sort({ createdAt: -1 });
  const payments = await Payment.find().populate('debtId', 'debtName').sort({ paymentDate: -1 }).limit(8);
  const totalDebt = money(debts.reduce((s, d) => s + d.originalAmount, 0));
  const totalRepaid = money(debts.reduce((s, d) => s + d.totalRepaid, 0));
  const monthly = await Payment.aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } }, total: { $sum: '$amountPaid' } } }, { $sort: { _id: 1 } }]);
  res.json({ totals: { totalDebt, totalRepaid, remainingDebt: money(totalDebt - totalRepaid), activeDebts: debts.filter(d => d.status === 'Active').length }, debts, recentPayments: payments, monthly });
}));

app.get('/api/debts', asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;
  if (req.query.search) filter.$or = ['debtName', 'lenderName', 'borrowerName'].map(k => ({ [k]: { $regex: req.query.search, $options: 'i' } }));
  res.json(await Debt.find(filter).sort({ createdAt: -1 }));
}));
app.post('/api/debts', asyncRoute(async (req, res) => {
  const body = req.body;
  const debt = await Debt.create({ ...body, totalRepaid: 0, remainingAmount: Number(body.originalAmount), status: 'Active' });
  res.status(201).json(debt);
}));
app.get('/api/debts/:id', asyncRoute(async (req, res) => {
  const debt = await Debt.findById(req.params.id);
  if (!debt) return res.status(404).json({ message: 'Debt not found.' });
  const payments = await Payment.find({ debtId: debt._id }).sort({ paymentDate: -1 });
  res.json({ debt, payments });
}));
app.put('/api/debts/:id', asyncRoute(async (req, res) => {
  const debt = await Debt.findById(req.params.id);
  if (!debt) return res.status(404).json({ message: 'Debt not found.' });
  const originalAmount = Number(req.body.originalAmount);
  if (!Number.isFinite(originalAmount) || originalAmount < debt.totalRepaid) return res.status(400).json({ message: 'Original amount cannot be less than the amount already repaid.' });
  Object.assign(debt, req.body, { remainingAmount: money(originalAmount - debt.totalRepaid), status: originalAmount - debt.totalRepaid <= 0 ? 'Completed' : 'Active' });
  await debt.save(); res.json(debt);
}));
app.delete('/api/debts/:id', asyncRoute(async (req, res) => {
  const debt = await Debt.findByIdAndDelete(req.params.id);
  if (!debt) return res.status(404).json({ message: 'Debt not found.' });
  await Payment.deleteMany({ debtId: debt._id }); res.json({ ok: true });
}));

app.get('/api/payments', asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.debtId) filter.debtId = req.query.debtId;
  if (req.query.month) {
    const [year, month] = req.query.month.split('-').map(Number);
    filter.paymentDate = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
  }
  res.json(await Payment.find(filter).populate('debtId', 'debtName').sort({ paymentDate: -1 }));
}));
app.post('/api/payments', upload.single('screenshot'), asyncRoute(async (req, res) => {
  const debt = await Debt.findById(req.body.debtId);
  if (!debt) return res.status(404).json({ message: 'Select a valid debt.' });
  const amount = Number(req.body.amountPaid);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Payment must be greater than zero.' });
  await refreshDebt(debt._id);
  const freshDebt = await Debt.findById(debt._id);
  if (amount > freshDebt.remainingAmount) return res.status(400).json({ message: `Payment exceeds remaining balance of ₹${freshDebt.remainingAmount.toLocaleString('en-IN')}.` });
  const screenshotUrl = req.file ? await uploadToCloudinary(req.file) : '';
  const payment = await Payment.create({ debtId: debt._id, paymentDate: req.body.paymentDate, amountPaid: amount, paymentMethod: req.body.paymentMethod, transactionId: req.body.transactionId || '', screenshotUrl, notes: req.body.notes || '' });
  await refreshDebt(debt._id); res.status(201).json(payment);
}));
app.put('/api/payments/:id', upload.single('screenshot'), asyncRoute(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Payment not found.' });
  const oldDebtId = payment.debtId;
  const nextDebtId = req.body.debtId || String(oldDebtId);
  const debt = await Debt.findById(nextDebtId);
  if (!debt) return res.status(404).json({ message: 'Debt not found.' });
  const amount = Number(req.body.amountPaid);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Payment must be greater than zero.' });
  const currentTotal = await Payment.aggregate([{ $match: { debtId: debt._id, _id: { $ne: payment._id } } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]);
  if ((currentTotal[0]?.total || 0) + amount > debt.originalAmount) return res.status(400).json({ message: 'This change would exceed the debt amount.' });
  Object.assign(payment, { debtId: debt._id, paymentDate: req.body.paymentDate, amountPaid: amount, paymentMethod: req.body.paymentMethod, transactionId: req.body.transactionId || '', notes: req.body.notes || '' });
  if (req.file) payment.screenshotUrl = await uploadToCloudinary(req.file);
  await payment.save(); await refreshDebt(oldDebtId); if (String(oldDebtId) !== String(debt._id)) await refreshDebt(debt._id);
  res.json(payment);
}));
app.delete('/api/payments/:id', asyncRoute(async (req, res) => {
  const payment = await Payment.findByIdAndDelete(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Payment not found.' });
  await refreshDebt(payment.debtId); res.json({ ok: true });
}));
app.get('/api/analytics', asyncRoute(async (_req, res) => {
  const debts = await Debt.find().select('debtName originalAmount totalRepaid remainingAmount status');
  const monthly = await Payment.aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m' , date: '$paymentDate' } }, total: { $sum: '$amountPaid' } } }, { $sort: { _id: 1 } }]);
  res.json({ debts, monthly, totalDebt: money(debts.reduce((s,d)=>s+d.originalAmount,0)), totalRepaid: money(debts.reduce((s,d)=>s+d.totalRepaid,0)) });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err instanceof multer.MulterError ? 400 : 500;
  res.status(status).json({ message: err.message || 'Server error.' });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('MongoDB connected'); app.listen(PORT, () => console.log(`API running on ${PORT}`));
}).catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
