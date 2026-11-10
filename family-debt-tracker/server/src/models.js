import mongoose from 'mongoose';

const debtSchema = new mongoose.Schema({
  debtName: { type: String, required: true, trim: true },
  debtType: { type: String, required: true },
  lenderName: { type: String, required: true, trim: true },
  borrowerName: { type: String, required: true, trim: true },
  originalAmount: { type: Number, required: true, min: 0.01 },
  totalRepaid: { type: Number, default: 0, min: 0 },
  remainingAmount: { type: Number, required: true, min: 0 },
  interestRate: { type: Number, default: null, min: 0 },
  startDate: { type: Date, required: true },
  tenure: { type: Number, required: true, min: 1 },
  monthlyPayment: { type: Number, default: null, min: 0 },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Completed'], default: 'Active' }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

const paymentSchema = new mongoose.Schema({
  debtId: { type: mongoose.Schema.Types.ObjectId, ref: 'Debt', required: true, index: true },
  paymentDate: { type: Date, required: true },
  amountPaid: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ['UPI', 'Cash', 'Bank Transfer', 'Other'], required: true },
  transactionId: { type: String, default: '' },
  screenshotUrl: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

export const Debt = mongoose.model('Debt', debtSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
