require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const auth = require('./middlewares/authMiddleware');
const apiAccessPolicy = require('./middlewares/apiAccessPolicy');
const { sendSuccess } = require('./utils/responseHelper');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const accessRoutes = require('./routes/accessRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const financialAccountRoutes = require('./routes/financialAccountRoutes');
const debtRoutes = require('./routes/debtRoutes');
const loanRoutes = require('./routes/loanRoutes');
const loanReceiptRoutes = require('./routes/loanReceiptRoutes');
const productRoutes = require('./routes/productRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const customerRoutes = require('./routes/customerRoutes');
const customerRegistrationRoutes = require('./routes/customerRegistrationRoutes');
const saleRoutes = require('./routes/saleRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const reportRoutes = require('./routes/reportRoutes');
const cronRoutes = require('./routes/cronRoutes');
const ruleRoutes = require('./routes/ruleRoutes');
const backupRoutes = require('./routes/backupRoutes');
const assetRoutes = require('./routes/assetRoutes');
const reconciliationRoutes = require('./routes/reconciliationRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const statementImportRoutes = require('./routes/statementImportRoutes');
const pushRoutes = require('./routes/pushRoutes');
const peopleRoutes = require('./routes/peopleRoutes');
const installmentRoutes = require('./routes/installmentRoutes');
const syncRoutes = require('./routes/syncRoutes');
const goalRoutes = require('./routes/goalRoutes');
const collectorRoutes = require('./routes/collectorRoutes');
const assetController = require('./controllers/assetController');

const app = express();
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const configuredOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      workerSrc: ["'self'", 'blob:', 'https://cdn.jsdelivr.net'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || localOrigin.test(origin) || configuredOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin não permitida pelo CORS.'));
  },
  credentials: true,
}));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_PATH || './uploads')));
app.get('/', (_req, res) => res.sendFile(path.resolve('public/landing.html')));
app.get('/app', (_req, res) => res.sendFile(path.resolve('public/index.html')));
app.use(express.static(path.resolve('public')));

app.get('/health', (_req, res) => sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customer-registration', customerRegistrationRoutes);
app.use('/api/v1', (req, res, next) => auth(req, res, (error) => error ? next(error) : apiAccessPolicy(req, res, next)));
app.use('/api/v1/access', accessRoutes);
app.use('/api/v1/collectors', collectorRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/financial-accounts', financialAccountRoutes);
app.use('/api/v1/debts', debtRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/loan-receipts', loanReceiptRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/purchases', purchaseRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/people', peopleRoutes);
app.use('/api/v1/sales', saleRoutes);
app.use('/api/v1/installments', installmentRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reminders', reminderRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/cron', cronRoutes);
app.use('/api/v1/rules', ruleRoutes);
app.use('/api/v1/backup', backupRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/reconciliation', reconciliationRoutes);
app.use('/api/v1/budgets', budgetRoutes);
app.use('/api/v1/currencies', currencyRoutes);
app.use('/api/v1/statement-imports', statementImportRoutes);
app.use('/api/v1/push', pushRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/goals', goalRoutes);
app.get('/api/v1/net-worth', require('./middlewares/authMiddleware'), assetController.summary);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
