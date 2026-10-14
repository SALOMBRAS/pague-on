# Investigação: autenticação, sessão e carregamento inicial

**Início:** 2026-08-30  
**Sintoma:** login lento e, em dispositivos móveis, painel que pode permanecer carregando.

## Fluxo observado

1. `public/auth.js` recebe o formulário e chama `POST /api/v1/auth/login`.
2. O backend valida a senha, cria um access token e um refresh token HTTP-only.
3. O navegador guarda somente o access token e o usuário em `sessionStorage`; o refresh token fica no cookie `pagueon_refresh`.
4. `startSession()` remove a tela de login e emite `pagueon:auth`.
5. `public/app.js` inicia o cache IndexedDB e também inicia `hydrateRemote()`.
6. A hidratação fazia, em paralelo, `GET /dashboard`, `/debts`, `/products`, `/purchases` e `/auth/me`.
7. `public/dashboard-financial.js` também buscava `GET /dashboard/financial` para a tela inicial.

## Evidências

- A inicialização não tinha timeout em `auth.js`, `api.js` nem no dashboard financeiro. Uma requisição pendente podia manter `aria-busy` e a interface de carregamento indefinidamente.
- `hydrateRemote()` não tinha proteção single-flight. A finalização do bootstrap offline e o evento `pagueon:auth` podiam executar a mesma bateria de cinco requisições ao mesmo tempo.
- O dashboard financeiro era mais uma consulta independente durante o mesmo login. As rotas de dashboard e de dívidas ainda executam atualização de vencidos no banco.
- O cache IndexedDB usava uma única chave (`current-state`), sem vínculo com o usuário. Isso podia apresentar o snapshot de outra sessão até a sincronização remota terminar.
- O service worker mantém um shell de arquivos. Em uma falha de rede, o fallback podia abrir uma versão de shell anterior; o cache atual era `pagueon-shell-v23`.
- Os eventos não sensíveis dos últimos 30 dias registram 39 logins bem-sucedidos, 2 falhas, 6 cadastros e 6 logouts. Não existe uma tabela de perfil separada: todo usuário possui o próprio registro `User` no mesmo `create` do cadastro.
- O endpoint de refresh sem cookie respondeu em aproximadamente 360 ms na produção. Isso refuta a hipótese de que o refresh vazio, sozinho, seja o gargalo observado.

## Causa raiz mais provável

O bootstrap concorrente combina várias chamadas protegidas, sem prazo no cliente, com cache offline não particionado. Sob rede móvel instável ou função serverless fria, uma chamada pode ficar pendente; como o dashboard dependia do resultado e não havia estado terminal de timeout, a pessoa via carregamento infinito. Em paralelo, duplicação de hidratação aumenta carga, latência e a chance de rate limiting.

Uma causa concorrente de encerramento de sessão entre abas é a rotação do refresh token: abas que renovam simultaneamente podem usar o mesmo cookie. A correção adiciona exclusão mútua no navegador para evitar essa corrida antes de chegar ao backend.

## Correção

- timeout e erro explícito para autenticação e API;
- exclusão mútua de renovação de sessão entre abas;
- bootstrap de dados em voo único, sem repetir dashboard/perfil já buscados por outros fluxos;
- cache offline vinculado ao usuário autenticado;
- dashboard com estado final de erro e telemetria de duração;
- nova versão do cache PWA e apenas um ponto de registro do service worker.

## Validação planejada

Testes automatizados cobrem timeout, contrato de bootstrap e cache particionado. A validação manual deve cobrir login/cadastro em desktop e mobile, sessão expirada, logout/login, recarregamento, rede lenta/offline e PWA atualizado.
