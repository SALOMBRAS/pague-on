# Proposta de componentes e roteiro do dual-front

**Estado:** proposta para aprovação. Não altera o front atual e não substitui regras de negócio existentes.

## Decisão de produto

O Pague On terá uma única marca verde e dois front-ends independentes, servidos pela mesma API, sessão e dados:

```text
API atual + autenticação + dados de cobranças
                  │
        ┌─────────┴─────────┐
        │                   │
  PWA mobile            Painel desktop
  uso diário             gestão e análise
  < 1024 px              >= 1024 px
```

O breakpoint escolhe o shell no carregamento inicial. Uma troca de largura não deve descartar formulário, rota, filtros nem dados pendentes; ela só passa ao outro shell de forma controlada.

## Componentes reutilizáveis por regra, não por estrutura

Os dois fronts compartilham tokens, linguagem, ícones, formatação, validação, estado de cobrança e serviços. Não compartilham a mesma árvore visual, navegação ou densidade de informação.

| Componente lógico | Contrato comum | Mobile PWA | Desktop |
| --- | --- | --- | --- |
| `StatusBadge` | Texto, ícone, status e cor semântica. | Badge dentro do card. | Badge na tabela e nos detalhes. |
| `MoneyValue` | BRL, números tabulares, valor e período. | Valor principal do topo/card. | KPI e célula alinhada à direita. |
| `ChargeForm` | Pessoa, valor, vencimento, descrição, lembrete e validação. | Bottom sheet com CTA fixo. | Drawer lateral ou modal. |
| `ChargeStatusAction` | Confirmação e feedback recuperável. | Ação por toque/swipe com confirmação. | Ação inline e em lote quando fizer sentido. |
| `ReminderSettings` | Consentimento, horário/canal e texto da próxima ação. | Seção no Perfil. | Área de Configurações. |
| `EmptyState` | Motivo, orientação e uma ação. | Card de largura total. | Área central de página/tabela. |

## Componentes exclusivos do mobile

| Nome proposto | Responsabilidade | Critério de qualidade |
| --- | --- | --- |
| `MobileAppShell` | Header compacto, área rolável e safe areas. | Nenhum conteúdo fica abaixo de notch ou home indicator. |
| `MobileBottomNav` | Início, Adicionar, Resumo e Perfil. | Até 4 destinos, alvo de toque de 48 px e rótulo sempre visível. |
| `QuickAddSheet` | Cadastro rápido de conta. | Aberto sem perder o contexto; `Salvar` fixa acima da safe area. |
| `ChargeCard` | Pessoa, data, valor, status e próxima ação. | Sem tabela horizontal nem informação truncada. |
| `UpcomingTimeline` | Vencimentos por proximidade. | Hierarquia clara: hoje, amanhã, próximos dias, atrasados. |
| `PullToRefresh` | Atualização manual com estado de sincronização. | Usa só `transform`/`opacity` e respeita reduzir movimento. |
| `OfflineNotice` | Mostra cache, fila ou falha de sync. | Nunca afirma que algo sincronizou sem confirmação. |

## Componentes exclusivos do desktop

| Nome proposto | Responsabilidade | Critério de qualidade |
| --- | --- | --- |
| `DesktopAppShell` | Sidebar de 256 px, cabeçalho e conteúdo. | Não contém bottom navigation ou FAB. |
| `GlobalCommand` | Busca e ações por teclado. | `/` foca busca, `Ctrl+K` abre comandos, `Esc` fecha camadas. |
| `KpiGrid` | Indicadores de recebimento, atraso e período. | Cada número exibe período e texto explicativo. |
| `ChargeDataTable` | Lista filtrável, ordenável e selecionável. | Valor à direita, status textual, ações acessíveis e estado vazio. |
| `PersistentFilters` | Filtros de status, período, pessoa e busca. | Filtros ficam visíveis e são refletidos na rota/estado. |
| `ChargeDrawer` | Ver/editar cobrança sem abandonar a lista. | Fecha com `Esc`, prende foco e confirma alterações. |
| `BulkActionBar` | Ações para seleção em lote. | Só aparece com seleção e sempre confirma ações destrutivas. |

## Padrões de tela

### Mobile PWA

1. **Início:** total a receber, próximos vencimentos, atrasados e uma ação rápida.
2. **Adicionar:** bottom sheet para uma conta; campos mínimos e confirmação imediata.
3. **Resumo:** totais por período, lista de status e um gráfico simples apenas quando ajudar.
4. **Perfil:** dados pessoais, aparência, notificações, instalação e segurança.

### Desktop

1. **Dashboard:** grade de KPIs, evolução, itens críticos e atalhos.
2. **Cobranças:** filtros persistentes, tabela, seleção e drawer de detalhe.
3. **Resumo:** gráficos comparáveis, período explícito e exportação futura.
4. **Configurações:** perfil, notificações, aparência e integrações.

## Estratégia técnica inicial

O front atual em HTML, CSS e JavaScript continuará sendo a base no primeiro ciclo. Isso reduz peso de bundle e evita uma migração de framework enquanto se valida a experiência.

- Criar posteriormente dois pontos de entrada explícitos: `public/mobile/` e `public/desktop/`.
- Manter em `public/shared/` apenas contratos de API, autenticação, formatação, tokens, ícones e regras de estado; nunca estruturas de tela inteiras.
- Carregar módulos pesados (OCR, gráficos grandes, exportação) somente quando a pessoa abrir o recurso correspondente.
- Preservar o backend Express/PostgreSQL/Supabase e contratos atuais. A mudança visual não reescreve o backend.
- Avaliar Vite/React somente se a quantidade de componentes interativos justificar a migração; esta decisão deve vir acompanhada de orçamento de bundle, testes e plano de migração.

## Roteiro de implementação posterior

| Fase | Entrega | Aceite |
| --- | --- | --- |
| 0. Fundação | Aplicar tokens, microcopy e inventário de ícones. | Landing, acesso e app deixam de parecer produtos de marcas diferentes; contraste AA verificado. |
| 1. Shell mobile | Navegação de 4 tabs, Início e cadastro em sheet. | Testes manuais em 375 px e 430 px, sem overflow; formulário preserva rascunho. |
| 2. Fluxo mobile | Cards, detalhes, resumo, cache/offline e feedback. | Operações exibem carregando, sucesso e erro recuperável; animações respeitam preferências. |
| 3. Shell desktop | Sidebar, dashboard, tabela e drawer. | Testes em 1024 px e 1440 px; navegação e atalhos por teclado funcionam. |
| 4. Qualidade | Testes de acessibilidade, desempenho e regressão visual. | Sem dependências pesadas na carga inicial; LCP e interações medidos antes/depois. |
| 5. Troca controlada | Roteamento por shell e observação em produção. | Rota, filtro e rascunho são preservados; existe caminho de reversão. |

## Checklist obrigatório antes de cada tela

- A tela tem uma pergunta principal e uma ação primária clara?
- Ela usa apenas tokens, linguagem e ícones aprovados?
- Teclado, leitor de tela, foco visível e contraste foram testados?
- Em mobile, há alvo de 48 px, safe area e nenhuma tabela lateral?
- Em desktop, há densidade e filtros úteis sem copiar padrões móveis?
- O carregamento inicial não baixou recurso de OCR, gráfico ou exportação que a pessoa não abriu?
- A alteração foi submetida em um commit isolado e verificável?
