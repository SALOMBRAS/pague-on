# Arquitetura dual-front — Pague On

## Decisão

O Pague On terá dois front-ends independentes para a mesma API. Eles não são o mesmo layout “responsivo”: cada um possui navegação, hierarquia e componentes próprios.

```text
                 API Express + PostgreSQL/Supabase
                                │
               rotas, sessão, dados e notificações
                    ┌───────────┴───────────┐
                    │                       │
       Mobile PWA (< 1024 px)     Desktop Admin (≥ 1024 px)
       contas e lembretes         análise e gestão em lote
```

## Entrega do front correto

- A aplicação decide pelo viewport inicial: abaixo de `1024px`, shell mobile; em `1024px` ou mais, shell desktop.
- O shell não é trocado durante uma operação aberta. Ao redimensionar, a troca só ocorre depois de preservar rota, filtro e rascunho local.
- Rotas são semânticas e compartilhadas (`/contas`, `/resumo`, `/perfil`); cada front renderiza a experiência apropriada.
- Notificações e links profundos abrem a rota equivalente no shell do dispositivo.

## Mobile PWA: produto de uso diário

| Elemento | Regra |
| --- | --- |
| Navegação | 4 tabs: Início, Adicionar, Resumo e Perfil. |
| Conteúdo | Um valor principal e listas de cards; sem tabela horizontal. |
| Formulários | Bottom sheet com CTA fixo acima da safe area. |
| Ação rápida | FAB circular de 56 px acima da navegação. |
| Interação | Swipe revela ações, pull-to-refresh, feedback por `transform`/`opacity`. |
| PWA | Manifest, splash mínima, cache de shell, fila offline e push. |

### Telas móveis

1. **Início:** “Você tem R$ X para receber”, próximos vencimentos, atrasados e contas pagas.
2. **Adicionar:** pessoa, valor, vencimento, descrição e lembrete — sem campos de negócio desnecessários.
3. **Resumo:** donut simples por status, meses e filtro de atrasados.
4. **Perfil:** dados pessoais, lembretes, aparência, instalação e segurança.

## Desktop: produto administrativo

| Elemento | Regra |
| --- | --- |
| Navegação | Sidebar fixa de 256 px; perfil no rodapé. |
| Cabeçalho | Breadcrumb, busca global, notificações e “Nova cobrança”. |
| Conteúdo | KPIs densos, gráficos, filtros persistentes e tabelas ricas. |
| Edição | Drawer à direita ou modal central; nunca bottom sheet/FAB. |
| Produtividade | `N`, `/`, `?`, `Esc` e `Ctrl+K`. |

### Telas desktop

1. **Dashboard:** KPIs, evolução, últimas cobranças, distribuição e atalhos.
2. **Cobranças:** tabela filtrável/sortable com seleção em lote e ações inline.
3. **Resumo:** gráficos maiores, comparativo e exportação.
4. **Configurações:** perfil, notificações, aparência e integrações.

## O que é compartilhado

- Endpoints, autenticação, autorização, tipos de status e regras de negócio.
- Tokens de cor, tipografia, elevação, espaçamento, ícones e microcopy.
- Componentes lógicos: formatação de moeda/data, badges de status, validação, fila offline e notificações.

## O que não é compartilhado

- Estrutura DOM, navegação, composição das páginas e densidade de dados.
- Desktop pode usar tabela, sidebar e ações em lote. Mobile usa cards e sheets.
- O modo de abertura de detalhes é drawer/modal no desktop e sheet no mobile.

## Ordem de implementação futura

1. Consolidar tokens e microcopy.
2. Extrair o shell mobile do HTML atual sem mudar regras de negócio.
3. Construir o shell desktop e a tabela de cobranças.
4. Migrar rotas, estados offline e atalhos.
5. Testar mobile 375/430 px e desktop 1024/1440 px antes de ativar a troca automática.

