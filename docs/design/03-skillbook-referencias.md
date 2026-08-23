# Skillbook de referências UI/UX — Pague On

**Escopo:** extrair princípios e técnicas de projetos open source para orientar o futuro front-end dual do Pague On. Nenhum componente, arte ou código destes projetos deve ser copiado literalmente.

## Como usar este documento

Cada referência resolve um problema diferente. A escolha não é de uma "biblioteca vencedora": é uma combinação pequena de padrões compatíveis com o sistema de design em `design-system/pague-on/MASTER.md`.

| Referência | O que ensina | Técnica que vale reaproveitar | Aplicação no Pague On | Front |
| --- | --- | --- | --- | --- |
| [Tremor](https://github.com/tremorlabs/tremor) | Dashboards legíveis com componentes acessíveis para métricas e gráficos. | Compor KPIs a partir de valor, comparação e estado; gráficos com propósito e legenda clara. | Cards de "a receber", "vencem esta semana" e evolução mensal; gráfico só no resumo, não como decoração. | Desktop; resumo mobile simplificado. |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Componentes que pertencem ao produto, em vez de uma caixa-preta visual. | Primitivas acessíveis, variantes explícitas e código local controlado pelo time. | Especificar `Button`, `Field`, `Dialog`, `Sheet`, `Badge` e `Toast` como componentes próprios, todos com estados de foco, erro e carregamento. | Ambos. |
| [Tabler](https://github.com/tabler/tabler) | Densidade administrativa e navegação de painel sem perder legibilidade. | Hierarquia de sidebar, cabeçalho, filtros persistentes e tabela com ações discretas. | Desktop terá sidebar, KPIs e tabela de cobranças com valores alinhados e ações em lote; não levar esse modelo para o celular. | Desktop. |
| [Windmill Dashboard](https://github.com/estevanmaito/windmill-dashboard) | Acessibilidade e temas fazem parte do componente, não de uma revisão posterior. | Contraste AA, navegação por teclado, foco preso em modais e preferência de tema persistida. | Todo sheet/modal devolve foco ao gatilho; tema acompanha sistema e pode ser escolhido no Perfil; indicadores não dependem apenas de cor. | Ambos. |
| [awesome-design-md](https://github.com/voltagent/awesome-design-md) | Um `DESIGN.md` reduz decisões repetidas e inconsistência entre telas. | Registrar paleta, papéis semânticos, tipografia, layout, elevação, exemplos e anti-exemplos. | `MASTER.md` é o contrato visual; novas telas devem declarar quais tokens e componentes usam antes de serem implementadas. | Ambos. |
| [Billy](https://github.com/lyqht/Billy) | A rotina de contas funciona melhor quando prioriza próximo vencimento, cadastro curto e lembrete. | Jornada: visão do que vem a seguir → adicionar conta → acompanhar status → receber lembrete. | Início mobile mostra vencimentos e atrasos primeiro; o cadastro pede apenas pessoa, valor, data, descrição e lembrete. O repositório está arquivado, portanto serve apenas como referência de produto. | Mobile, com dados compartilhados. |
| [bill-reminder](https://github.com/remigathoni/bill-reminder) | Lembrete é um fluxo completo entre dado de vencimento, agendamento e canal de envio. | Modelar vencimento, tipo de lembrete e job de envio como responsabilidades separadas. | Futuramente, configurar lembrete por cobrança e mostrar claramente a próxima notificação; backend pode evoluir para jobs idempotentes e canais opt-in. | Ambos; backend compartilhado. |

## Técnicas consolidadas

### 1. Informação financeira sem jargão

- Começar pela pergunta da pessoa: "Quem te deve?", "O que vence agora?" e "Quanto entrou no mês?".
- Um número principal por área mobile; contexto complementar em cards curtos.
- No desktop, usar indicadores e tabela para comparação, busca e gestão em lote.
- Dinheiro e datas devem usar formatação local e números tabulares para evitar salto visual.

### 2. Componentes previsíveis e acessíveis

- Todo controle interativo deve funcionar por toque, mouse e teclado.
- Alvos de toque têm no mínimo 48 px; ações apenas com ícone possuem rótulo acessível.
- Modal e bottom sheet precisam de foco inicial, `Esc`/fechar, foco preso enquanto abertos e retorno ao elemento de origem.
- Erro de formulário aparece ao lado do campo, com texto objetivo; não depender de borda vermelha isolada.

### 3. Dados e visualização

- KPI responde a uma pergunta e tem período claro; evitar números grandes sem comparação ou ação seguinte.
- Gráficos usam legenda, rótulo e alternativa textual. No mobile, preferir um resumo pequeno ou lista em vez de gráfico comprimido.
- Tabelas são exclusivas do desktop; no PWA, a mesma informação é uma lista de cards com status, pessoa, data, valor e ações seguras.

### 4. Tema e consistência

- Manter somente a identidade verde definida no sistema mestre; verde é CTA/estado ativo, não fundo obrigatório.
- Light e dark usam os mesmos papéis semânticos, não uma segunda marca.
- Cada tela nova deve reutilizar tokens, ícones SVG locais e linguagem humana já definidos.

### 5. Lembretes como confiança

- Um lembrete deve explicar **qual conta**, **quando vence** e **qual ação é possível**.
- Preferências de notificação são opt-in e editáveis no Perfil.
- O app confirma cadastro, edição e envio agendado imediatamente; falhas recebem estado recuperável e não silencioso.

## Limites de adoção

- Tremor e shadcn/ui são referências de composição e componentes; o projeto atual não será migrado de tecnologia só para reproduzi-los.
- Tabler e Windmill são referências de painel. Não usar sidebar ou tabela como adaptação de mobile.
- Billy está arquivado e não deve ser incorporado como dependência ou fonte de código.
- bill-reminder mostra uma solução de lembrete baseada em job diário; a implementação do Pague On deverá validar fuso horário, idempotência, consentimento e canais antes de adotar uma estratégia.

## Fontes consultadas

- [Tremor — README](https://github.com/tremorlabs/tremor)
- [shadcn/ui — README](https://github.com/shadcn-ui/ui)
- [Tabler — README](https://github.com/tabler/tabler)
- [Windmill Dashboard — README](https://github.com/estevanmaito/windmill-dashboard)
- [awesome-design-md — README](https://github.com/voltagent/awesome-design-md)
- [Billy — README e status de arquivamento](https://github.com/lyqht/Billy)
- [bill-reminder — README](https://github.com/remigathoni/bill-reminder)
