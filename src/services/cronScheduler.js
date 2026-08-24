const cron = require('node-cron');
const notificationJobs = require('./notificationJobsService');
const interestCalculator = require('./interestCalculator');
const currencyService = require('./currencyService');

function runSafely(name, job) {
  return async () => {
    try { await job(); } catch (error) { console.error(`Cron ${name} falhou:`, error.message); }
  };
}

function startInternalCron() {
  if (process.env.ENABLE_INTERNAL_CRON !== 'true') return;
  cron.schedule('0 8 * * *', runSafely('notificações diárias', notificationJobs.runDailyNotifications), { timezone: 'America/Sao_Paulo' });
  cron.schedule('0 8 * * 1', runSafely('resumo semanal', () => notificationJobs.runDigest('WEEKLY_DIGEST')), { timezone: 'America/Sao_Paulo' });
  cron.schedule('0 9 1 * *', runSafely('resumo mensal', () => notificationJobs.runDigest('MONTHLY_DIGEST')), { timezone: 'America/Sao_Paulo' });
  cron.schedule('0 0 * * *', runSafely('recalcular juros', interestCalculator.recalculateAllInterest), { timezone: 'America/Sao_Paulo' });
  cron.schedule('0 6 * * *', runSafely('atualizar câmbio', () => currencyService.updateExchangeRates()), { timezone: 'America/Sao_Paulo' });
  console.log('Cron interno ativado (America/Sao_Paulo).');
}

module.exports = { startInternalCron };
