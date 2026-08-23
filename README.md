# Pague-On API

Backend REST do Pague-On, construído com Node.js, Express, Prisma e PostgreSQL. A API usa JSON, JWT e o prefixo `/api/v1`.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL 14 ou superior

## Como executar

```bash
cp .env.example .env
# Edite DATABASE_URL, JWT_SECRET e CRON_SECRET no .env
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

A API estará disponível em `http://localhost:3000`. Verifique com:

```bash
curl http://localhost:3000/health
```

O seed cria `teste@pagueon.com` com a senha `123456`. Altere ou remova essa conta fora do ambiente de desenvolvimento.

## Integração com o front HTML

Use `http://localhost:3000/api/v1` como base e armazene o token retornado no login. Todas as rotas privadas exigem:

```http
Authorization: Bearer <token_jwt>
Content-Type: application/json
```

Exemplo mínimo:

```js
const API_URL = 'http://localhost:3000/api/v1';

const login = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'teste@pagueon.com', password: '123456' }),
});
const { data } = await login.json();
localStorage.setItem('pagueon_token', data.token);

const dashboard = await fetch(`${API_URL}/dashboard`, {
  headers: { Authorization: `Bearer ${data.token}` },
}).then((response) => response.json());
```

O CORS aceita qualquer porta em `localhost` e `127.0.0.1`, incluindo Live Server em `:5500`. Para produção, defina uma lista separada por vírgula em `FRONTEND_ORIGINS` no `.env`.

## Formato de resposta

Sucesso:

```json
{ "success": true, "data": {}, "message": "Opcional" }
```

Erro:

```json
{ "success": false, "error": "Mensagem descritiva", "code": "ERROR_CODE" }
```

As únicas exceções são exportações CSV, que retornam um arquivo `text/csv`.

## Rotas

| Área | Rotas |
| --- | --- |
| Autenticação | `POST /auth/register`, `POST /auth/login`, `GET/PUT /auth/me`, `PUT /auth/password`, `POST /auth/avatar` |
| Dashboard | `GET /dashboard` |
| Dívidas | `GET/POST /debts`, `GET/PUT/DELETE /debts/:id`, `POST /debts/:id/pay`, `POST /debts/:id/cancel`, `GET /debts/:id/installments`, `POST /debts/:id/installments/:installmentId/pay`, `GET /debts/:id/recurring-history`, `POST /debts/:id/collect` |
| Produtos | `GET/POST /products`, `GET/PUT/DELETE /products/:id`, `POST /products/:id/image` |
| Compras | `GET/POST /purchases`, `DELETE /purchases/:id` |
| Clientes | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id` |
| Vendas | `GET/POST /sales`, `GET /sales/:id`, `POST /sales/:id/pay`, `POST /sales/:id/cancel` |
| Pagamentos | `POST /payments` para registrar um pagamento por `debtId` e, opcionalmente, `installmentId` |
| Notificações | `GET /notifications`, `PUT /notifications/read-all`, `PUT /notifications/:id/read`, `DELETE /notifications/:id` |
| Lembretes | `GET/POST /reminders`, `DELETE /reminders/:id` |
| Relatórios | `GET /reports/cashflow`, `GET /reports/profit`, `GET /reports/debts`, `GET /reports/export?format=csv&type=cashflow` |
| Cron | `POST /cron/check-reminders` com `x-cron-secret` |

Filtros suportados: `/debts` aceita `type`, `status`, `paymentType` e `search`; `/products` aceita `search`, `lowStock=true` e `sort=profitMargin|name|stock`; `/purchases` aceita `productId`, `startDate`, `endDate`; `/customers` aceita `search`; `/sales` aceita `customerId`, `status`, `startDate`, `endDate`.

## Exemplos com cURL

Criar uma dívida parcelada:

```bash
curl -X POST http://localhost:3000/api/v1/debts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"RECEIVABLE",
    "paymentType":"INSTALLMENT",
    "description":"Venda de mesa",
    "category":"PRODUCT",
    "counterparty":"Carlos Souza",
    "totalAmount":1500,
    "totalInstallments":6,
    "startDate":"2026-08-25T00:00:00.000Z"
  }'
```

Criar um produto:

```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Camiseta Preta","costPrice":25,"sellingPrice":55,"stockQuantity":12}'
```

Registrar uma venda pelo botão **Nova Venda** do dashboard. O backend calcula o valor, reduz o estoque e cria a cobrança vinculada:

```bash
curl -X POST http://localhost:3000/api/v1/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId":"uuid-do-cliente",
    "items":[{"productId":"uuid-do-produto","quantity":2}],
    "paymentType":"INSTALLMENT",
    "totalInstallments":2,
    "startDate":"2026-08-25T00:00:00.000Z"
  }'
```

Enviar avatar ou foto de produto:

```bash
curl -X POST http://localhost:3000/api/v1/auth/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@./minha-foto.png"
```

## Decisões de negócio

- Valores são calculados e persistidos no backend; o front não define margem, saldo, datas de parcelas ou vencimento recorrente.
- Operações que modificam mais de uma tabela (parcelas, pagamentos e compras) usam transações Prisma.
- Ação **Nova Venda** reduz o estoque, persiste itens com preço/custo do momento e cria uma dívida a receber. Pagamentos mantêm venda e dívida sincronizadas.
- Ação **Novo Cliente** usa `/customers`; o cliente pode ser associado manualmente a uma dívida ou automaticamente por uma venda.
- Produtos são arquivados por soft delete (`isActive = false`).
- Datas são armazenadas em UTC. A conversão para `America/Sao_Paulo` deve ocorrer na interface.
- Arquivos são gravados localmente em `uploads/` e servidos publicamente em `/uploads/...`. Para produção, substitua esse armazenamento por um serviço de objetos.

## Scripts

```bash
npm run dev          # inicia com nodemon
npm start            # inicia com node
npm run prisma:migrate
npm run prisma:seed
```
