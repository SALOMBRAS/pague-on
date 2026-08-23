const app = require('./app');
const prisma = require('./config/database');
const { startInternalCron } = require('./services/cronScheduler');

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
  console.log(`Pague-On API disponível em http://localhost:${port}/api/v1`);
  startInternalCron();
});

async function shutdown(signal) {
  console.log(`${signal} recebido. Encerrando API...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
