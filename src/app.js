const dotenvPath = process.env.DOTENV_CONFIG_PATH || '.env';
require('dotenv').config({ path: dotenvPath, override: process.env.VERCEL !== '1' });

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const auth = require('./middlewares/authMiddleware');
const apiAccessPolicy = require('./middlewares/apiAccessPolicy');
const { sendSuccess } = require('./utils/responseHelper');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const HttpError = require('./utils/httpError');

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
const quickOperationRoutes = require('./routes/quickOperationRoutes');
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
// Trust proxy: em serverless (Vercel) e atrás de proxy, o Express precisa confiar
// no header X-Forwarded-For para req.ip e o rate-limit funcionarem. Sem isso,
// express-rate-limit lança ERR_ERL_UNEXPECTED_X_FORWARDED_FOR (500 em toda rota).
app.set('trust proxy', 1);
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const vercelProjectOrigin = /^https:\/\/pague-on-git-[a-z0-9-]+-pedrosalomao22099-4358s-projects\.vercel\.app$/;
const configuredOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
      workerSrc: ["'self'", 'blob:', 'https://cdn.jsdelivr.net'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || localOrigin.test(origin) || vercelProjectOrigin.test(origin) || configuredOrigins.includes(origin)) return callback(null, true);
    return callback(new HttpError(403, 'CORS_ORIGIN_FORBIDDEN', 'Origem não permitida pelo CORS.'));
  },
  credentials: true,
}));
// Observabilidade do caminho crítico sem expor identidade, credenciais, token
// ou query string. Ajuda a separar autenticação, perfil e dashboard lentos.
app.use('/api/v1', (req, res, next) => {
  const area = req.path.startsWith('/auth') ? 'AUTH' : req.path.startsWith('/dashboard') ? 'DASHBOARD' : null;
  if (!area) return next();
  const startedAt = process.hrtime.bigint();
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.info(`[${area}] request_completed`, { method: req.method, route: req.path, status: res.statusCode, durationMs: Math.round(durationMs) });
  });
  next();
});
// O limite é da API. Aplicá-lo ao app inteiro bloqueava a própria tela e seus
// arquivos estáticos depois de muitas requisições no mesmo minuto.
app.use('/api/v1', rateLimit({ windowMs: 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
// Rotas públicas de auto-cadastro: limiter dedicado para conter brute-force de token.
const registrationLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api/v1/customer-registration', (req, res, next) => { if (req.path === '/customers' || req.path.startsWith('/invites') || req.path.startsWith('/customers/')) return next(); return registrationLimiter(req, res, next); });
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
// Uploads locais só são servidos em desenvolvimento. Em produção os arquivos
// vão para o Supabase Storage e são acessados por URL pública (ver uploadMiddleware).
if (!process.env.SUPABASE_URL) {
  app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_PATH || './uploads')));
}
app.get('/', (_req, res) => res.sendFile(path.resolve('public/landing.html')));
app.get('/app', (_req, res) => res.sendFile(path.resolve('public/index.html')));
// Os arquivos versionados pelo deploy devem ser atendidos pelo CDN entre
// acessos. HTML e o service worker ficam fora desta política, para que uma
// publicação nova seja descoberta imediatamente pelo PWA.
const cacheablePublicAsset = /\.(?:css|js|svg|png|jpg|jpeg|webp|ico|woff2?)$/i;
app.use(express.static(path.resolve('public'), {
  setHeaders(res, filePath) {
    if (cacheablePublicAsset.test(filePath) && !/[/\\]sw\.js$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    }
  },
}));

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
app.use('/api/v1/quick-operations', quickOperationRoutes);
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
