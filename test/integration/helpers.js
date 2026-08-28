// Helpers dos testes de integração.
//
// Importante: a env de teste tem que estar definida ANTES de qualquer require
// que importe o PrismaClient (src/config/database lê process.env.DATABASE_URL
// na criação do singleton). Por isso este módulo define a env no topo, antes de
// qualquer require, e todos os testes de integração devem importar este helper
// como PRIMEIRA dependência.
const TEST_DATABASE_URL = 'postgresql://pagueon_user:pagueon_local_dev_password@localhost:5432/pagueon?schema=public';

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;
if (!process.env.DIRECT_URL) process.env.DIRECT_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

const prisma = require('../../src/config/database');
const goalService = require('../../src/services/goalService');
const syncService = require('../../src/services/syncService');
const saleService = require('../../src/services/saleService');
const installmentService = require('../../src/services/installmentService');
const debtService = require('../../src/services/debtService');
const reportService = require('../../src/services/reportService');
const dashboardService = require('../../src/services/dashboardService');

let counter = 0;
function suffix() {
  counter += 1;
  return `${Date.now()}-${process.pid}-${counter}`;
}

// Cria um usuário de teste com email único por execução, para nunca colidir
// com dados existentes no banco local. `overrides` permite plan/value paths.
async function createTestUser(overrides = {}) {
  const unique = suffix();
  return prisma.user.create({
    data: {
      name: 'Teste Integração',
      email: `teste-${unique}@pagueon.test`,
      password: 'test-password',
      plan: 'PRO',
      ...overrides,
    },
  });
}

// Apaga o usuário de teste e tudo que pertence a ele. O schema usa ON DELETE
// CASCADE na maioria das relações, mas há FKs com Restrict (SaleItem->Product,
// Purchase->Product) — o delete direto do user falha por causa delas. Por isso
// apagamos primeiro as tabelas que criam tais restrições/deixam o grafo limpo,
// e só então o user (que limpa o resto via cascade: sales, goals, syncLogs…).
async function cleanup(userId) {
  if (!userId) return;

  // O AuditLog é append-only graças a um trigger no banco: qualquer UPDATE/DELETE
  // de auditoria é abortado. O cascade do delete do usuário faz SET NULL nas FKs
  // de auditoria (actorId/workspaceOwnerId), o que violaria esse trigger. Por isso
  // apagamos as linhas de auditoria do usuário primeiro, desabilitando o trigger
  // APENAS dentro desta transação. O `ALTER TABLE DISABLE TRIGGER` é DDL
  // transacional: com tudo na mesma transação, o estado "disabled" vale só para a
  // nossa própria conexão até o commit e o `ENABLE` ao final devolve o estado
  // original. Nenhuma outra limpeza paralela (os arquivos rodam em paralelo com
  // `node --test`) pode intercalar DISABLE/ENABLE entre processos — o lock
  // ACCESS EXCLUSIVE da tabela segura concorrência até o commit.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_no_update');
    await tx.auditLog.deleteMany({
      where: { OR: [{ workspaceOwnerId: userId }, { actorId: userId }] },
    });
    await tx.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER audit_log_no_update');
  });

  // Delegações que giram em torno do usuário mas que têm FKs Restrict para
  // tabelas que o cascade do user tentaria apagar depois. Apagamos na ordem
  // correta para o delete do user não estourar.
  await prisma.installmentPayment.deleteMany({ where: { userId } });
  await prisma.collectorCommission.deleteMany({ where: { userId } });
  await prisma.collectorContact.deleteMany({ where: { userId } });
  await prisma.customerRegistrationInvite.deleteMany({ where: { userId } });
  await prisma.financialMovement.deleteMany({ where: { userId } });
  await prisma.financialCashClosing.deleteMany({ where: { userId } });
  await prisma.financialAccount.deleteMany({ where: { userId } });

  // Membros do workspace (cobradores/coletores) criados pelos testes tornam-se
  // órfãos se não forem removidos junto com o owner.
  const members = await prisma.user.findMany({ where: { workspaceOwnerId: userId }, select: { id: true } });
  await prisma.user.deleteMany({ where: { workspaceOwnerId: userId } });

  await prisma.$transaction([
    prisma.saleItem.deleteMany({ where: { sale: { userId } } }),
    prisma.debt.deleteMany({ where: { userId } }),
    prisma.purchase.deleteMany({ where: { userId } }),
    prisma.product.deleteMany({ where: { userId } }),
    prisma.customer.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]).catch((error) => {
    if (error.code !== 'P2025') throw error; // P2025 = registro já não existe
  });
}

async function disconnect() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  TEST_DATABASE_URL,
  createTestUser,
  cleanup,
  disconnect,
  goalService,
  syncService,
  saleService,
  installmentService,
  debtService,
  reportService,
  dashboardService,
};
