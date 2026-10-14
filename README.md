# Pague-On

Aplicação full-stack de **gestão de cobranças, dívidas, estoque e financeiro**, com front duplo (PWA mobile + dashboard desktop) servido pela mesma base.

- **Backend**: Node.js + Express 5 + Prisma 6 + PostgreSQL (Supabase)
- **Frontend**: Vanilla JS SPA em `public/` (sem framework) — mobile (`≤1023px`) e desktop (`≥1024px`)
- **Deploy**: Vercel serverless (`api/index.js`)

## Requisitos

- Node.js 20 ou superior
- PostgreSQL 14 ou superior (ou um projeto Supabase)

## Como executar

```bash
cp .env.example .env
# Edite DATABASE_URL, DIRECT_URL, JWT_SECRET e CRON_SECRET no .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

A API estará disponível em `http://localhost:3000`. Verifique com:

```bash
curl http://localhost:3000/health
```

O seed cria `teste@pagueon.com` com a senha `123456`. Altere ou remova essa conta fora do ambiente de desenvolvimento.

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `PORT` | Porta da API (padrão 3000) |
| `DATABASE_URL` | Conexão Prisma (pooler Supabase, `pgbouncer=true`) |
| `DIRECT_URL` | Conexão direta para migrations (sem pooler) |
| `JWT_SECRET` | Segredo do token JWT (mín. 32 caracteres) |
| `JWT_EXPIRES_IN` | Expiração do access token (ex.: `7d`) |
| `REFRESH_TOKEN_TTL_DAYS` | Vida do refresh token (padrão 30) |
| `PASSWORD_RESET_TTL_MINUTES` | Validade do token de reset (padrão 30) |
| `PASSWORD_RESET_BASE_URL` | Base para o link de reset |
| `PASSWORD_RESET_DELIVERY_WEBHOOK_URL` | Endpoint que entrega `{ to, name, resetUrl }` |
| `UPLOAD_PATH` | Diretório local de uploads (dev) |
| `MAX_FILE_SIZE` | Tamanho máximo de upload (bytes, padrão 5MB) |
| `SUPABASE_URL` | URL do projeto Supabase (ativa Storage em produção) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (ativa Storage em produção) |
| `CRON_SECRET` | Segredo do endpoint de cron (`x-cron-secret`) |
| `FRONTEND_ORIGINS` | Origens permitidas no CORS (separadas por vírgula) |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_ORIGINS` | Configuração WebAuthn (biometria) |
| `BACKUP_ENCRYPTION_KEY` | Chave de criptografia dos backups |
| `VAPID_SUBJECT` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push notifications (web-push) |
| `ENABLE_INTERNAL_CRON` | Liga o cron interno (`true`/`false`) |
| `NODE_ENV` | `development` / `production` |

> **Uploads**: com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` definidos, os uploads vão para o bucket `uploads/` do Supabase Storage (pastas `avatars/`, `products/`, `payment-proofs/`) e são servidos por URL pública. Sem eles, os arquivos ficam no filesystem local `uploads/` (apenas desenvolvimento — na Vercel o filesystem é efêmero).

## Rotas

Todas as rotas privadas exigem `Authorization: Bearer <token_jwt>` e `Content-Type: application/json`. Prefixo base: `/api/v1`.

| Área | Rotas |
| --- | --- |
| **Auth** | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `GET/PUT /auth/me`, `PUT /auth/password`, `POST /auth/avatar`, `GET/PUT /auth/security`, `POST /auth/pin/set`, `POST /auth/pin/verify`, `POST /auth/biometric/*` (registration/authentication options + verify) |
| **Dashboard** | `GET /dashboard`, `GET /dashboard/financial` |
| **Dívidas** | `GET/POST /debts`, `POST /debts/check-duplicate`, `GET/PUT/DELETE /debts/:id`, `POST /debts/:id/pay`, `POST /debts/:id/cancel`, `GET /debts/:id/installments`, `POST /debts/:id/installments/:installmentId/pay`, `GET /debts/:id/recurring-history`, `POST /debts/:id/collect` |
| **Empréstimos** | `GET/PUT /loans/configurations`, `GET/PUT /loans/settings`, `GET/POST/PUT/DELETE /loans/settings/holidays`, `GET /loans/customers`, `POST /loans/simulate`, `POST /loans` |
| **Recibos de empréstimo** | `GET /loan-receipts/:debtId`, `POST /loan-receipts/installments/:installmentId/proof`, `POST /loan-receipts/installments/:installmentId/preview-receipt`, `POST /loan-receipts/installments/:installmentId/receipts`, `POST /loan-receipts/receipts/:paymentId/reverse` |
| **Parcelas** | `GET /installments/mine`, `GET /installments/overdue`, `POST /installments/:id/extra`, `POST /installments/:id/pay`, `POST /installments/:id/pay-partial`, `POST /installments/:id/unpay`, `POST /installments/:id/remind` |
| **Produtos** | `GET/POST /products`, `GET/PUT/DELETE /products/:id`, `POST /products/:id/image` |
| **Compras** | `GET/POST /purchases`, `DELETE /purchases/:id` |
| **Vendas** | `GET/POST /sales`, `GET/PUT /sales/:id`, `POST /sales/:id/pay`, `POST /sales/:id/cancel`, `DELETE /sales/:id`, `POST /sales/:id/recalculate` |
| **Clientes** | `GET/POST /customers`, `POST /customers/:id/approve`, `GET/PUT/DELETE /customers/:id` |
| **Cadastro de cliente (convite)** | `GET/POST /customer-registration/:token`, `POST /customer-registration/customers/:id/invite`, `POST /customer-registration/invites/:id/revoke` |
| **Pessoas** | `GET/POST /people`, `GET /people/search`, `GET /people/:id/sales`, `GET/PUT/DELETE /people/:id` |
| **Cobradores** | `GET/POST /collectors`, `GET /collectors/me/customers`, `GET /collectors/me/debts`, `GET /collectors/me/agenda`, `GET/POST /collectors/me/contacts`, `GET /collectors/me/commissions`, `POST /collectors/me/installments/:id/pay`, `GET /collectors/:id/commissions`, `PUT /collectors/:id`, `PUT /collectors/:id/customers` |
| **Contas financeiras** | `GET/POST /financial-accounts`, `POST /financial-accounts/transfers`, `POST /financial-accounts/adjustments`, `POST /financial-accounts/closings`, `GET /financial-accounts/closings`, `POST /financial-accounts/movements/:id/reverse`, `PATCH /financial-accounts/:id`, `GET /financial-accounts/statement` |
| **Metas** | `GET/POST /goals`, `PUT/DELETE /goals/:id`, `POST /goals/:id/deposit`, `POST /goals/:id/withdraw` |
| **Relatórios** | `GET /reports/cashflow`, `GET /reports/profit`, `GET /reports/debts`, `GET /reports/export`, `GET /reports/catalog`, `GET /reports/:reportKey`, `GET /reports/:reportKey/export` |
| **Regras automáticas** | `GET/POST /rules`, `POST /rules/run-all`, `GET/PUT/DELETE /rules/:id`, `POST /rules/:id/test` |
| **Sincronização** | `POST /sync/push`, `GET /sync/pull` |
| **Backup** | `GET /backup/export`, `POST /backup/restore`, `GET /backup/cloud/status`, `POST /backup/cloud`, `POST /backup/cloud/:id/restore` |
| **Ativos/Patrimônio** | `GET/POST /assets`, `PUT/DELETE /assets/:id`, `GET /net-worth` |
| **Reconciliação** | `GET /reconciliation`, `POST /reconciliation/upload`, `POST /reconciliation/match`, `POST /reconciliation/confirm`, `GET /reconciliation/:id` |
| **Orçamento** | `GET/POST /budgets`, `PUT/DELETE /budgets/:id` |
| **Moedas** | `GET /currencies`, `GET /currencies/convert`, `POST /currencies/refresh` |
| **Importação de extrato** | `POST /statement-imports` |
| **Push** | `GET /push/config`, `POST /push/subscribe`, `DELETE /push/subscribe`, `POST /push/test` |
| **Notificações** | `GET /notifications`, `PUT /notifications/read-all`, `PUT /notifications/:id/read`, `DELETE /notifications/:id` |
| **Lembretes** | `GET/POST /reminders`, `DELETE /reminders/:id` |
| **Operações rápidas** | `POST /quick-operations/product-preview` |
| **Pagamentos** | `POST /payments` |
| **Cron** | `POST /cron/check-reminders`, `POST /cron/update-exchange-rates`, `POST /cron/run-notifications`, `POST /cron/weekly-digest`, `POST /cron/monthly-digest`, `POST /cron/recalculate-interest` (todas com `x-cron-secret`) |
| **Acesso/Auditoria (admin)** | `GET /access/me`, `GET /access/audit`, `GET/POST /access/users`, `PUT /access/users/:id` |

Filtros comuns: `/debts` aceita `type`, `status`, `paymentType`, `search`; `/products` aceita `search`, `lowStock`, `sort`; `/purchases` aceita `productId`, `startDate`, `endDate`; `/customers` aceita `search`; `/sales` aceita `customerId`, `status`, `startDate`, `endDate`.

## Banco de dados (Prisma)

48 models, 31 enums, 67 índices, 17 uniques. Principais grupos:

- **Identidade/auth**: `User`, `RefreshToken`, `PasswordResetToken`, `UserSecurity`, `WebAuthnCredential`, `AuditLog`
- **Financeiro**: `FinancialAccount`, `FinancialMovement`, `FinancialCashClosing`, `FinancialSettingsVersion`, `FinancialHoliday`
- **Cobranças**: `Debt`, `Installment`, `InstallmentPayment`, `InstallmentPaymentAllocation`, `RecurringPayment`, `Reminder`, `Notification`
- **Empréstimos**: `LoanContract`, `LoanModalityConfiguration`
- **Produtos/estoque**: `Product`, `Purchase`, `Sale`, `SaleItem`
- **Clientes**: `Customer`, `CustomerClassification`, `CustomerDocument`, `CustomerConsent`, `CustomerRegistrationInvite`
- **Cobradores**: `CollectorProfile`, `CollectorContact`, `CollectorCommission`
- **Regras**: `Rule`, `RuleTrigger`, `RuleAction`, `RuleExecution`
- **Extras**: `CashFlow`, `Goal`, `GoalTransaction`, `SyncLog`, `BackupSnapshot`, `Asset`, `NetWorthSnapshot`, `BankStatement`, `BankTransaction`, `Budget`, `Currency`, `PushSubscription`

## Decisões de negócio

- Valores são calculados e persistidos no backend; o front não define margem, saldo, datas de parcelas ou vencimento recorrente.
- Operações que modificam mais de uma tabela usam transações Prisma.
- `Nova Venda` reduz o estoque, persiste itens com preço/custo do momento e cria uma dívida a receber. Pagamentos mantêm venda e dívida sincronizadas.
- Produtos são arquivados por soft delete (`isActive = false`).
- Datas são armazenadas em UTC; a conversão para `America/Sao_Paulo` ocorre na interface.
- Regras financeiras (juros, multa, feriados, vencimentos) são versionadas — alterações nunca mudam contratos antigos.

## Deploy (Vercel)

- `vercel.json` roteia tudo para `api/index.js` (Express serverless), região `gru1` (mesma do Supabase).
- Assets estáticos (`css/js/svg/png/...`) recebem cache de CDN (`s-maxage=3600`); HTML e `sw.js` ficam fora do cache para publicação imediata.
- **Uploads em produção**: configure `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` e crie o bucket `uploads` (público) no Supabase Storage.

## Scripts

```bash
npm run dev               # nodemon
npm start                 # node
npm run prisma:generate   # gera o Prisma Client
npm run prisma:migrate    # migrate dev
npm run prisma:seed       # seed
npm run db:up             # docker compose up postgres
npm run db:migrate        # prisma migrate deploy
npm run db:reset          # prisma migrate reset --force
npm test                  # testes unitários
npm run test:integration  # testes de integração (banco local)
```

## Segurança e dependências

- Helmet (CSP), CORS com allowlist, rate-limit por rota, JWT + refresh token (cookie httpOnly), PIN e WebAuthn (biometria), auditoria append-only.
- `npm audit` reporta 5 vulnerabilidades **aceitas** (deps transitivas de ferramentas, sem fix sem breaking change major): `uuid` via `exceljs` (moderate) e `deepmerge-ts` via `@prisma/config` (high). Ambas fora do caminho crítico de autenticação.

## Estrutura de pastas

```
api/            # entrypoint serverless (Vercel)
src/
  app.js        # Express app (middlewares, rotas, CSP, CORS)
  server.js     # bootstrap local
  routes/       # 31 arquivos de rota
  controllers/  # handlers HTTP
  services/     # regras de negócio
  middlewares/  # auth, errorHandler, upload, apiAccessPolicy
  utils/        # jwt, validators (zod), serializers, httpError, dateHelpers
prisma/
  schema.prisma # 48 models
  migrations/   # 20 ativas + 12 legacy
public/         # front SPA (mobile + desktop), PWA, landing
test/           # 75 unit + 49 integration
```
