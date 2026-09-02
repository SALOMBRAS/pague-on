# Revisão técnica do Pague-On — 2026-09-01

## Escopo e método

Esta revisão foi feita no repositório `SALOMBRAS/pague-on`, com foco em segurança, regras financeiras, operação, responsividade e disponibilidade. Foram inspecionados o servidor Express, rotas, serviços, schema e migrations Prisma, arquivos PWA e a suíte de testes.

Foram executados somente testes seguros contra o ambiente configurado:

- `npm test`: **70 testes aprovados, 0 falhas**;
- `npx prisma migrate status`: **20 migrations aplicadas; schema atualizado**;
- Produção: `GET https://pague-on.vercel.app/health` retornou **200**;
- Produção: manifest PWA retornou **200**.

Os testes de integração existentes foram **não executados**: eles apontam explicitamente para PostgreSQL local e criam/apagam dados de teste. Não é seguro redirecioná-los para o Supabase de produção. A validação transacional abaixo, portanto, é honesta sobre o que está coberto e o que requer uma base isolada de homologação.

## Resumo executivo

O sistema possui uma base funcional relevante: autenticação, perfis, auditoria append-only, contas/caixas, empréstimos, recebimentos, estornos, relatórios, PWA e regras financeiras versionadas. Os cálculos principais usam `DECIMAL` no banco e arredondamento em centavos nas rotinas de cronograma.

**Conclusão:** pronto para validação controlada e homologação, mas **não aprovado como operação financeira de produção de alto risco** até fechar os itens P0/P1 deste documento, principalmente a suíte transacional isolada, observabilidade operacional e política de webhooks caso integrações externas sejam ativadas.

## Estado por área

| Área | Status | Evidência e observação |
| --- | --- | --- |
| Autenticação e sessão | Parcialmente concluído | Login, refresh, logout, recuperação de senha, rate limit e testes de fluxo de sessão existem. Ainda falta teste E2E isolado do ciclo completo. |
| Perfis e acesso | Parcialmente concluído | Middleware bloqueia rotas por perfil; consultas de pessoas e parcelas aplicam escopo de cliente/cobrador. Faltam testes HTTP E2E de negação para os perfis. |
| Auditoria | Concluído no código | Eventos críticos de empréstimo, recebimento, estorno e configurações são gravados; há migration append-only. Validar retenção/consulta operacional em homologação. |
| Empréstimos e contratos | Parcialmente concluído | Simulação, cronograma, contrato, débito no caixa e snapshot de regras existem. Falta teste transacional de duas contas e de renovação. |
| Recebimentos | Parcialmente concluído | Prévia, pagamento parcial/integral, divisão, desconto, promessa, idempotência e estorno estão implementados. Faltam execução integrada isolada de todos os caminhos. |
| Caixas e conciliação | Parcialmente concluído | Movimentos vinculados, transferências, fechamento e estornos existem e possuem testes de integração locais. Falta execução em banco de homologação. |
| Relatórios e exportações | Parcialmente concluído | Catálogo, filtros e exportações XLSX/PDF estão presentes e a suíte unitária valida o catálogo. Falta reconciliação de arquivos gerados com dados reais de homologação. |
| Configurações financeiras | Parcialmente concluído | Versões, feriados e snapshots por contrato estão implementados. O cálculo de multa tem testes unitários; a incidência dessas regras no recebimento precisa de teste E2E e aceite jurídico. |
| PWA e responsividade | Parcialmente concluído | Manifest, service worker, shell mobile e testes de assets existem. Falta medição de campo (LCP/erros) e teste em dispositivos reais. |
| Webhooks | Pendente | Não foi localizado endpoint, adaptador, assinatura, retry ou fila de webhook. Não habilitar integrações de pagamento por webhook antes de implementar isso. |
| Observabilidade e operação | Pendente | Há log por requisição e `/health`, mas não há métricas, tracing, alerta de erros, SLO, runbook ou carga automatizada. |

## Cenários financeiros e de acesso exigidos

| # | Cenário | Situação | Cobertura atual |
| --- | --- | --- | --- |
| 1 | Empréstimo de R$ 1.000,00 retirado de dois caixas | Parcial | Validador unitário aceita R$ 500 + R$ 500; falta confirmar movimentos e saldos em transação isolada. |
| 2 | Recebimento integral em um caixa | Parcial | Fluxo existe e há teste de integração local; não executado nesta revisão. |
| 3 | Recebimento dividido entre dois caixas | Pendente | Serviço aceita alocações múltiplas, mas não há teste localizado para confirmar rateio/movimentos em dois caixas. |
| 4 | Pagamento parcial com saldo restante | Parcial | A prévia de apropriação é testada; falta execução transacional isolada e conciliação do saldo. |
| 5 | Antecipação com desconto | Parcial | Teste unitário e teste de integração local do desconto existem; falta execução isolada na revisão. |
| 6 | Promessa de pagamento do saldo | Pendente | Campo `promiseDate` é persistido, mas não foi localizado teste que valide o fluxo inteiro e a agenda resultante. |
| 7 | Pagamento só de juros com renovação autorizada | Parcial | Há criação condicional de nova parcela com confirmação expressa; falta teste que valide principal remanescente, consentimento e trilha. |
| 8 | Estorno de recebimento | Parcial | Fluxo e bloqueio de segundo estorno existem. O cálculo atual trata recibos estornados corretamente, mas o teste local só verifica que a parcela deixa de estar paga; ampliar para exigir saldo e status exatos. |
| 9 | Confirmação duplicada de webhook | Pendente | Há idempotência de recibo por chave única, mas nenhum endpoint/processador de webhook foi localizado. |
| 10 | Cobrador acessando cliente de outro cobrador | Parcial | Escopo por `collectorId` e permissão específica existem; falta teste HTTP com token de cobrador e cliente não vinculado. |
| 11 | Cliente acessando empréstimo de terceiro | Parcial | Escopo por `customerId` existe em pessoas/parcelas e a política de API restringe as rotas; falta teste HTTP de tentativa negada. |
| 12 | Alterar configuração sem afetar contrato anterior | Parcial | Configuração e calendário são copiados para `loanTerms` e `termsSnapshot`; há teste unitário de calendário. Falta criar contrato, alterar configuração e conferir o snapshot em teste integrado. |

Nenhum cenário marcado como “Parcial” deve ser interpretado como homologado em produção: ele possui implementação ou teste de unidade, porém ainda precisa de execução transacional isolada.

## Segurança e LGPD

### Controles encontrados

- Autorização no backend: `authMiddleware` + `apiAccessPolicy`; a ocultação de menus não é a única barreira.
- Escopo de cobrador e cliente aplicado nas consultas de pessoas e parcelas.
- Rate limit global da API e limitador específico de cadastro.
- Helmet/CSP, CORS configurável e upload limitado.
- Senhas com hash, tokens de refresh e recuperação de senha.
- Auditoria com sanitização/hashing de e-mail; eventos financeiros críticos não são silenciosamente ignorados.
- Documentos, consentimentos e perfis de clientes existem no schema.

### Riscos e ações necessárias

1. **P0 — RLS do Supabase não foi encontrado nas migrations.** Como o backend Prisma acessa o banco com credencial de servidor, restrinja a credencial e o acesso direto ao projeto Supabase; se consumidores externos acessarem o banco/API do Supabase, implemente e teste RLS antes disso.
2. **P1 — Faltam testes HTTP de autorização negativa** para os cenários 10 e 11.
3. **P1 — Documentar retenção, base legal, exportação e eliminação de dados pessoais** (LGPD), inclusive para anexos em `uploads`/storage.
4. **P1 — Segredos devem estar apenas em Vercel/Supabase.** Nunca versionar `DATABASE_URL`, `JWT_SECRET`, chaves VAPID, backup ou credenciais WebAuthn.

## Financeiro e integridade

### Controles encontrados

- Valores persistidos como `DECIMAL`; cronograma divide valores em centavos e arredonda em duas casas.
- Liberação, recebimento e estorno usam transações e locks de parcelas/contas.
- Movimentos têm referência única, origem, conta, operação e rateio de principal/juros/multa.
- Transferência registra débito e crédito vinculados; fechamento bloqueia lançamentos no período fechado.
- Idempotência de recibo usa chave única por espaço de trabalho.
- Contratos preservam snapshot de modalidade, configurações e calendário.

### Riscos e ações necessárias

1. **P0 — Criar e executar a suíte transacional em uma base Supabase de staging.** Hoje os testes de integração só funcionam com a URL local declarada em `test/integration/helpers.js`.
2. **P1 — Ampliar o teste de estorno.** Ele deve afirmar `paidAmount = 0`, status correto e saldo do caixa/debt após estorno, não apenas que a parcela deixou de ser `PAID`.
3. **P1 — Ligar e testar explicitamente multa/carência/configuração de ordem de apropriação no fluxo de recebimento.** A função `lateCharges` está testada, mas a revisão não encontrou sua aplicação explícita no rateio de `loanReceiptService`.
4. **P1 — Validar juridicamente as fórmulas, limites e a possibilidade de juros compostos por modalidade/localidade antes de ativá-los.**

## Operação, desempenho e PWA

- A produção respondeu `200` em `/health` e `200` no manifest PWA durante a revisão.
- O app tem manifest, service worker, cache de assets e estilos específicos para desktop/mobile.
- Existe log estruturado básico de conclusão de requisição, porém não há correlação de requisições, métricas de latência/erro, tracing ou alertas.
- Não foi localizado processador de webhook com assinatura, deduplicação por evento, política de retry ou dead-letter queue.
- Não há baseline de bundle, LCP de campo, teste de carga, runbook de incidente ou estratégia de rollback/canário versionada.

**Decisão de readiness:** não usar este status como aprovação para operação financeira crítica até implementar os itens P0. Para uso interno controlado, acompanhar `/health`, logs da Vercel e o banco enquanto a homologação é concluída.

## Migrations aplicadas

O status do Prisma confirmou 20 migrations, incluindo:

- autenticação/sessões, papéis e auditoria;
- contas, movimentos, transferências e fechamentos;
- perfis de cliente, convites, origem de empréstimos, cobradores e recibos;
- índices de movimentos;
- entrada de venda e descrição livre;
- `20260901010000_financial_settings_versions` para versões de regras financeiras e feriados.

## Arquivos relevantes e arquivo alterado nesta revisão

**Alterado nesta revisão:** este documento.

**Áreas analisadas:**

- `src/app.js`, `src/middlewares/authMiddleware.js`, `src/middlewares/apiAccessPolicy.js`;
- `src/services/loanService.js`, `src/services/loanReceiptService.js`, `src/services/financialAccountService.js`;
- `src/services/financialSettingsService.js`, `src/services/collectorService.js`, `src/services/reportService.js`;
- `prisma/schema.prisma` e `prisma/migrations/`;
- `public/manifest.webmanifest`, `public/sw.js`, shells e estilos responsivos;
- `test/*.test.js` e `test/integration/*.test.js`.

## Credenciais e documentação necessárias

Configure em ambiente seguro (Vercel/Supabase), nunca no frontend:

- `DATABASE_URL` e, se utilizado, `DIRECT_URL` do Supabase;
- `JWT_SECRET`, `CRON_SECRET` e `BACKUP_ENCRYPTION_KEY` fortes;
- origens permitidas em `FRONTEND_ORIGINS` e parâmetros WebAuthn corretos do domínio;
- serviço de e-mail/endpoint de recuperação de senha;
- chaves VAPID para push;
- credenciais/documentação do provedor de pagamento antes de criar webhooks assinados;
- bucket privado e regras de retenção/acesso para anexos de clientes.

Consulte `.env.example` e `docs/PRODUCAO.md` como referência de nomes de variáveis, substituindo todos os valores de exemplo.

## Como executar e validar com segurança

1. Instale dependências: `npm ci`.
2. Configure variáveis em `.env` a partir de `.env.example`, apontando para uma base **de staging**, não produção.
3. Gere o cliente: `npm run prisma:generate`.
4. Aplique migrations no staging: `npm run db:migrate`.
5. Execute a regressão segura: `npm test`.
6. Copie a URL do staging para `DATABASE_URL` do runner de integração, retire a URL local fixa dos helpers e execute os 12 cenários deste documento com limpeza isolada.
7. Valide exportações XLSX/PDF, PWA em celular real, autorização com tokens de ADMIN/GERENTE/COBRADOR/CLIENTE e conciliação dos extratos.
8. Só então publique com monitor de `/health`, alertas de erro e plano de rollback.

## Próxima ordem recomendada

1. Criar staging Supabase e desbloquear os 12 testes transacionais.
2. Fechar os cenários de autorização negativa, split payment, promessa, renovação e snapshot de configuração.
3. Implementar infraestrutura de webhook assinada/idempotente com retries apenas quando uma integração real for escolhida.
4. Adicionar métricas, rastreamento, alertas, runbook e teste de carga.
5. Fazer revisão jurídica e LGPD antes de ampliar a operação.
