# Investigação: transição de login e logout

**Início:** 2026-08-31

## Sintoma

- Login autenticava com sucesso, mas o painel só aparecia após recarregar.
- Logout só parecia concluir após recarregar.

## Evidência

- Logs do navegador registraram `login_authenticated` e `session_started` antes dos carregamentos do painel.
- `startSession()` aplicava o atributo `hidden` em `#auth-shell`.
- A folha de estilo injetada definia `#auth-shell { display:grid }`. A regra por ID tem prioridade sobre a regra padrão do atributo `hidden`, portanto a camada de autenticação continuava cobrindo o aplicativo.
- `logout()` aguardava a rede antes de limpar a sessão local.

## Causa raiz

O CSS do shell de autenticação impedia que o atributo `hidden` surtisse efeito. Em paralelo, o logout dependia de uma resposta de rede antes de refletir a saída no dispositivo.

## Correção

- Adicionada regra explícita `#auth-shell[hidden]{display:none!important}`.
- Logout limpa a sessão e mostra o acesso imediatamente; a revogação no servidor prossegue em segundo plano.
