# Pague-On — Plano de implementação das specs pendentes

> Revisão feita em 2026-08-24 contra o código real do repo (branch `main`).
> Banco já conectado ao Supabase. Requisito não-negociável por onda: `verify` passa ao final.

## Decisões travadas (usuário)
- Estratégia: **SPA vanilla + breakpoint 1024px** (não reescrever em React).
- Identidade: **preto + verde** (PicPay/C6) → ver `.planning/DESIGN.md`.
- Escopo: implementar **todas as specs pendentes** (01,02,03,04,13,16,19).

## Ondas de execução

### Onda 0 — Fundação
- [ ] Adicionar ao `prisma/schema.prisma`: `model Goal`, `model GoalTransaction`, `model SyncLog`.
- [ ] `npx prisma migrate dev` + `prisma generate`.
- [ ] Aplicar a migration no Supabase sem apagar dados existentes (`migrate deploy`).

### Onda 1 — Backend funcional (não toca UI)
- [ ] **Spec 02 Metas/Cofrinhos**: service `goalService` (CRUD, `deposit`/`withdraw` atômico c/ saldo, progresso, `monthlyNeeded`, limite Free=3/Pro=∞, notificação `GOAL_REACHED`), controller, rotas `/api/v1/goals` + `/goals/:id/deposit|withdraw`, integração em `debtService.pay()`.
- [ ] **Spec 01/19 Sync backend**: `syncController` + rotas `POST /api/v1/sync/push` e `GET /sync/pull`, gravando `SyncLog` (entity, recordId, op, ts) e aplicando `pending` ops. Fechar o 404 do `offline.js`.
- [ ] **Spec 13 Cron câmbio**: agendar `currencyService.updateExchangeRates()` diário no `cronScheduler` (gated por `ENABLE_INTERNAL_CRON`).

### Onda 2 — Integração front-back
- [ ] **Spec 16/19 Pessoas/Vendas writes**: `people.js` passa a `POST /people`, `POST /sales`, `POST /installments/:id/pay`. Adicionar `PUT /sales/:id` (editar venda, blocker se parcela paga), `POST /installments/:id/extra` (parcela extra) e seção Histórico de Pagamentos em `renderPerson`.
- [ ] **Spec 03 Smart Rules**: `renderRulesPanel` migra para ler/gravar `/rules` (CRUD + test + run-all) via API quando autenticado; adicionar editor de regra (TriggerBuilder/ActionBuilder).
- [ ] **Spec 04 Segurança**: aplicar `hideValues` aos helpers `money` de `budget`, `currency`, `duplicate`, `export`, `reconciliation`, `statement-import`; adicionar "Sair da conta" e "Esqueci meu PIN" na lock screen.
- [ ] **Spec 19 limpeza**: consumir `/dashboard` e `/reports/profit` no render; resolver contrato `/goals`; adicionar skeleton/error-retry conforme seção 4 do spec.

### Onda 3 — Design system dual-front
- [ ] Injetar tokens CSS (preto/verde) e trocar UI atual pela nova identidade.
- [ ] **Mobile (<1024px)**: bottom-tabs (4: Início/Adicionar/Resumo/Perfil), cards full-width com barra de progresso de vencimento, FAB + bottom-sheet, safe-areas, PWA (manifest/splash já existem — ajustar cores).
- [ ] **Desktop (≥1024px)**: sidebar fixa, header com busca+atalhos (`N`,`/`,`?`,`Esc`), DataTable de cobranças (sort/filtro/seleção/bulk), KPI cards `tabular-nums`, gráficos (área + donut), drawer de edição com live preview.
- [ ] Aplicar tom de voz (microcopy) em ambos.

### Onda 4 — Verificação
- [ ] `verify` (lint/typecheck/test/build), derrubar container Postgres local, teste E2E contra Supabase.

## Legenda de esforço
Metas e Sync são as únicas **construções novas** (Grande). O restante é fechar lacunas de integração (Médio) e ajustes (Pequeno).
