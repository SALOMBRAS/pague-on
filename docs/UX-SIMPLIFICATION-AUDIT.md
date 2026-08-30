# Auditoria de simplificação do Pague-On

Data: 2026-08-30  
Escopo: reduzir o caminho diário de cadastro e cobrança sem substituir os
domínios financeiros, a autenticação ou os dados já existentes.

## Mapa atual

| Entrada | Ação atual | Dados solicitados / consequência |
| --- | --- | --- |
| `Nova cobrança` | Abre um seletor com oito alternativas | A pessoa precisa conhecer a estrutura interna antes de decidir o que cadastrar. |
| `Nova Dívida ou Conta` | Abre `forms.js` em três etapas | Tipo contábil, categoria, contraparte, telefone, forma de pagamento, vínculo com produto. |
| `Novo empréstimo` | Abre `loan-origination.js` | Cliente, configuração jurídica, modalidade, principal, taxa, parcelas, periodicidade, liberação, vencimento, caixas e consentimento. |
| Venda / produto | É uma rota e fluxo diferentes | Produto cadastrado, estoque, itens, condição e parcelas. Não é uma ação principal na tela inicial. |
| Cliente | É criado em tela separada | O cadastro comum nasce em `PENDING_REVIEW`, exigindo aprovação para empréstimo. |
| Recebimento | É acessado pelo detalhe da dívida/empréstimo | O fluxo é robusto (prévia, recibo, caixa, prova e auditoria), mas está distante da lista diária. |

## Arquitetura preservada

- **Servidor:** Node.js, Express, Prisma e PostgreSQL/Supabase. A API é REST sob
  `/api/v1`; o front é HTML/CSS/JavaScript sem framework.
- **Identidade e autorização:** JWT com refresh, auditoria e perfis `ADMIN`,
  `MANAGER`, `COLLECTOR` e `CLIENT`. A política de API já bloqueia ações de
  perfis sem permissão e deve continuar sendo a fonte de verdade.
- **Núcleo financeiro:** `Debt`, `Installment`, `InstallmentPayment`,
  `FinancialAccount` e `FinancialMovement`. Empréstimos, recebimentos e caixas
  já usam transações Prisma e referências idempotentes.
- **Venda/estoque:** `Sale` e `SaleItem` reduzem o estoque e criam uma dívida
  vinculada na mesma transação. Isso não pode ser contornado por um atalho de
  interface.
- **Empréstimo/contrato:** a simulação e confirmação preservam limite de crédito,
  taxa aprovada, modalidades revisadas, consentimento e trilha de auditoria.
- **Precisão:** o banco usa `Decimal(12,2)`. Novas regras devem trabalhar em
  centavos ou `Decimal`, nunca introduzir `float` como fonte de verdade.

## Redundâncias e riscos encontrados

1. Existem três experiências paralelas para a mesma intenção: registrar algo a
   receber. Isso multiplica campos, estilos, estado e chances de erro.
2. O CTA da tela inicial chama uma folha genérica com oito escolhas, inclusive
   funções administrativas (produto, compra, lembrete e saída) que não são o
   fluxo diário de cobrança.
3. O dashboard financeiro mostra doze cards e filtros antes de responder as
   quatro perguntas prioritárias do dia.
4. `SaleItem` exige um produto cadastrado. Portanto uma descrição livre de
   produto não pode ser simulada como venda com estoque sem uma adaptação de
   backend explicitamente testada.
5. A entrada precisa virar pagamento/lançamento financeiro real. Não pode ser
   apenas subtraída no navegador; precisa gerar recibo, movimento de caixa e
   saldo de dívida conciliáveis na mesma transação.
6. O cadastro comum de cliente fica pendente; empréstimos exigem cliente
   aprovado. O fluxo rápido deve explicitar a autorização de aprovação e
   registrar auditoria, em vez de contornar a regra.
7. A regra existente para `BIWEEKLY` é 14 dias. Ela será preservada para evitar
   mudar vencimentos de operações existentes. A interface chamará isso de
   “quinzenal (a cada 14 dias)” até haver uma decisão de produto/migração.

## Fluxo mínimo proposto

```text
+ Nova operação
  -> Cliente (buscar ou criar nome + telefone)
  -> Tipo (Produto | Empréstimo)
  -> Condições de pagamento
       entrada, parcelas, valor, periodicidade, primeiro vencimento
  -> Prévia calculada pelo servidor
  -> Salvar atomicamente
```

### Produto

- Produto cadastrado é opcional para controlar estoque; quando selecionado, usa
  o fluxo de venda já existente e reduz estoque.
- “Descrição livre” representa uma operação sem estoque e terá uma criação
  financeira explícita, nunca um `SaleItem` falso.
- Entrada será tratada como recebimento confirmado, com caixa de destino e
  recibo. O restante gera as parcelas.

### Empréstimo

- A tela inicial usa a modalidade/taxa aprovada e o caixa disponível como
  sugestão. Se houver mais de um caixa elegível, pede a escolha; divisão entre
  caixas permanece em **Mais opções**.
- Juros, modalidade, exceções de taxa, caixas múltiplos, observações e contrato
  permanecem disponíveis em **Mais opções**. Consentimento contratual continua
  obrigatório para confirmar.

### Dashboard e cliente

- Dashboard: `A receber`, `Recebido no mês`, `Atrasado`, `Vence hoje` e uma
  lista de próximos recebimentos. O pagamento abre o recebimento já existente
  diretamente da linha.
- Cliente: dados essenciais, quatro totais, operações, parcelas e histórico;
  CTA `+ Nova operação` já inicia com o cliente selecionado.

## Sequência de entrega em PRs pequenos

1. Este diagnóstico e as caracterizações do comportamento atual.
2. Contrato de operação rápida no backend: preview calculado no servidor e
   validação/autorização centralizadas.
3. Persistência atômica de operação de produto com entrada e movimentação de
   caixa, incluindo migração compatível se necessária.
4. Adaptador de empréstimo rápido sobre a simulação/contrato existentes.
5. Tela responsiva `+ Nova operação`, cliente inline e disclosure progressivo.
6. Dashboard diário enxuto e recebimento direto.
7. Visão simples de cliente e regressão de desktop/mobile.

Cada PR terá testes de cálculo/contrato afetado, `npm test`, verificação
sintática de JavaScript e checagem manual em desktop e mobile. O projeto ainda
não possui scripts de lint ou typecheck; eles não serão fingidos como existentes.

## Critérios de aceite

- O usuário cria uma operação comum sem trocar de módulo.
- Nenhum total, parcela, saldo ou movimento é calculado como verdade no front.
- Entrada, liberação, recebimento e caixa ficam conciliáveis por movimentos.
- Uma falha em qualquer etapa da confirmação não deixa venda, dívida, parcela ou
  movimento parcialmente gravados.
- Ações avançadas continuam acessíveis, mas não competem com o fluxo principal.
- Perfis sem permissão recebem bloqueio no backend, não apenas menu oculto.
