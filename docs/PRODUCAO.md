# Pague-On — Guia de Produção

Guia prático para colocar o Pague-On em produção. Cobre ambiente, variáveis,
migrations, push notifications, cron, deploy, segredos, backup e monitoramento.
Leia em ordem na primeira vez; depois vire checklist (`§10`).

---

## 1. Visão geral da arquitetura

O Pague-On é uma **API REST em Node.js (Express)** com **Prisma ORM** sobre o
**Supabase (PostgreSQL)**. O front-end é um **SPA vanilla** (sem framework de
build) servido **pelo próprio Express** a partir de `public/`, com **PWA**
(`public/sw.js` + `public/manifest.webmanifest`) para instalação e
notificações. Não há separação de domínio entre front e back: um único processo
Node atende o HTML/JS/CSS estático e as rotas `/api/v1/*` na mesma porta, com
HTTPS terminado no proxy reverso (nginx) ou pelo provedor de PaaS. O banco fica
no Supabase (gerenciado), então **o servidor não precisa de disco para o banco**
— apenas para `UPLOAD_PATH` (avatares e produtos, gitignored).

Fluxo de uma requisição:

```
Navegador (SPA) ──HTTPS──▶ Express (static + /api/v1) ──Prisma──▶ Supabase (PG)
                              ▲
                              └── PWA: push no service worker (web-push/VAPID)
```

---

## 2. Variáveis de ambiente obrigatórias

Todas são lidas de `.env` na raiz (via `dotenv`). **Nunca** versione o `.env`
(está no `.gitignore`). Valores secretos devem ser definidos no painel do
provedor/gerenciador de secrets, não no repositório.

| Variável | O que é | Exemplo | Secreta |
| --- | --- | --- | --- |
| `DATABASE_URL` | Conexão do **app em runtime** — no Supabase, o **pooler** (porta `6543`, schema `supavisor`/`transaction`). É o que o Prisma usa nas queries da API. | `postgresql://postgres.xxxx:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` | **Sim** |
| `DIRECT_URL` | Conexão **direta** (porta `5432`, sem pooler), usada **exclusivamente em migrations** (`prisma migrate deploy`). Não deve ser usada em runtime. | `postgresql://postgres.xxxx:senha@aws-0-sa-east-1.supabase.com:5432/postgres` | **Sim** |
| `JWT_SECRET` | Segredo para assinar/verificar os JWTs. Forte, ≥ 32 chars, único. Rotacione se vazar. | `ume-segredo-aleatorio-com-no-minimo-32-char` | **Sim** |
| `JWT_EXPIRES_IN` | Validade do token. | `7d` | Não |
| `CRON_SECRET` | Segredo enviado no header `x-cron-secret` para autenticar os endpoints de cron externo (`/api/v1/cron/*`). | `segredo-do-cron` | **Sim** |
| `VAPID_SUBJECT` | Contato (mailto:) usado no push (obrigatório pelo padrão web-push). | `mailto:suporte@seudominio.com` | Não (mas evite expor) |
| `VAPID_PUBLIC_KEY` | Chave pública VAPID — o **front** precisa dela para assinar a subscription. É pública, mas vem do `.env`. | `BK...` (gerada com `web-push`) | Não (pública por design) |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID — nunca exponha. | `QW...` | **Sim** |
| `BACKUP_ENCRYPTION_KEY` | Chave AES-256-GCM do backup cloud do app (fallback: usa `JWT_SECRET`). ≥ 32 chars. | `chave-unica-de-backup-32-chars` | **Sim** |
| `FRONTEND_ORIGINS` | Lista separada por vírgula de origens permitidas pelo CORS (o primeiro salvo de ataque de origem). | `https://app.seudominio.com` | Não |
| `ENABLE_INTERNAL_CRON` | `true` liga o cron interno do processo (node-cron). Requer processo 24/7 (ver §5). | `true` | Não |
| `NODE_ENV` | `production` em produção. | `production` | Não |
| `PORT` | Porta HTTP interna (o Express escuta aqui; o proxy externo faz 80/443 → esta porta). | `3000` | Não |
| `UPLOAD_PATH` | Caminho de disco para uploads (avatares/produtos). Persistente. | `./uploads` | Não |
| `MAX_FILE_SIZE` | Limite de upload em bytes. | `5242880` | Não |

Extras que o app lê opcionalmente: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`,
`WEBAUTHN_ORIGINS` (WebAuthn/passkeys — ajuste `WEBAUTHN_RP_ID` para o domínio
real em produção).

---

## 3. Como rodar migrations em produção (Supabase)

O schema define `directUrl = env("DIRECT_URL")` (ver `prisma/schema.prisma`). O
Prisma usa **`DIRECT_URL` (conexão direta)** para migrations — **nunca o
pooler** — porque DDL não atravessa o Supavisor/pooler.

> ⚠️ **Nunca rode `prisma migrate dev` em produção.** Ele pode resetar/destruir
> dados. Em produção use apenas `migrate deploy` (aplica as migrations
> versionadas de `prisma/migrations/` pendentes).

```bash
# com .env do ambiente de produção carregado (com DIRECT_URL correto):
npx prisma migrate deploy

# gerar o client após aplicar (garante @prisma/client alinhado ao schema):
npx prisma generate
```

Pré-requisitos:

- `DATABASE_URL` e `DIRECT_URL` apontam para o **mesmo** banco Supabase.
- Node >= 18 instalado no ambiente onde roda o comando (pode ser um runner de
  CI com a branch de produção, ou uma sessão shell autenticada).
- As migrations já devem existir em `prisma/migrations/` (versionadas no repo —
  não apague).

Se houver *sync error*, veja o diagnóstico na seção de troubleshooting:
cheque `prisma migrate status` antes de aplicar.

```bash
npx prisma migrate status
```

---

## 4. Ativar notificações push (VAPID) de verdade

### 4.1 Gerar as chaves VAPID

```bash
npx web-push generate-vapid-keys --json
```

O comando retorna um par `publicKey` / `privateKey`. Coloque:

- `VAPID_PUBLIC_KEY` = a chave pública gerada;
- `VAPID_PRIVATE_KEY` = a chave privada gerada;
- `VAPID_SUBJECT` = um `mailto:` real (ex.: `mailto:suporte@seudominio.com`) —
  obrigatório; provedores de push recusam requests sem contato válido.

### 4.2 Como o front obtém a chave pública

**Não é preciso hardcodar nada nem criar endpoint novo.** O front
(`public/push.js`) já busca a chave pública do **backend autenticado**:

1. O usuário ativa notificações no perfil (`enable()` em `public/push.js`).
2. Com sessão ativa, o front chama `GET /api/v1/push/config`
   (`src/controllers/pushController.js` → `config`), que responde
   `{ configured, publicKey }`.
3. Se `configured` e `publicKey` existirem, o front assina a subscription de
   push no navegador com essa chave e envia a subscription para
   `POST /api/v1/push/subscribe`.

Portanto, para o deploy **basta** definir as 3 variáveis VAPID no ambiente. O
backend expõe a chave pública pelo endpoint já existente; `pushService.isConfigured()`
valida que as 3 existem antes de usar `web-push`.

> Nota: o endpoint `/push/config` exige autenticação. Isso é intencional e
> suficiente — o cadastro de subscription de push só acontece com sessão, então
> não há fluxo anônimo que precise da chave pública.

### 4.3 Validação pós-deploy

- Envie uma **notificação de teste**: no perfil do app, botão "Enviar
  notificação de teste", ou `POST /api/v1/push/test` (autenticado).
- Se responder `skipped: 'VAPID_NOT_CONFIGURED'`, alguma das 3 variáveis VAPID
  está ausente/vazia.
- Teste com o app **fechado** (push chega via service worker em segundo plano).

---

## 5. Cron (agendamentos)

Dois modos, **escolha um**:

### 5.1 Cron interno (requer processo 24/7)

`startInternalCron()` (`src/services/cronScheduler.js`) roda com **node-cron em
`America/Sao_Paulo`** somente se `ENABLE_INTERNAL_CRON === 'true'`. Jobs:

| Horário (SP) | Frequência | Job |
| --- | --- | --- |
| 08:00 | diário | Notificações diárias |
| 08:00 | segundas | Resumo semanal |
| 09:00 | dia 1 | Resumo mensal |
| 00:00 | diário | Recalcular juros |
| 06:00 | diário | Atualizar câmbio |

**Atenção:** só funciona se o processo ficar **de pé continuamente (24/7)**.
- Em uma **VPS** com PM2/systemd iniciado no boot: ok.
- Em **serverless / PaaS que "dorme"** (ex.: Render Free, Railway sem sempre-on,
  Fly.io com escala a zero, Functions): **o cron interno NÃO vai disparar** —
  o processo não está vivo no horário agendado. Nesse caso use o cron externo
  (§5.2).

### 5.2 Cron externo (serverless / quem dorme) — recomendado

O app expõe endpoints de job **protegidos por `CRON_SECRET`**
(`src/controllers/cronController.js` valida o header `x-cron-secret`). Use um
agendador externo (cron-job.org, GitHub Actions `schedule`, etc.) que faça `POST`
com o header no horário desejado:

```bash
curl -X POST https://app.seudominio.com/api/v1/cron/notificacoes \
  -H "x-cron-secret: seu-segredo-do-cron"
```

Endpoints disponíveis (todos `POST`, todos exigem `x-cron-secret`):

| Endpoint | Equivalente a |
| --- | --- |
| `POST /api/v1/cron/check-reminders` | Verificar lembretes de vencimento |
| `POST /api/v1/cron/run-notifications` | Notificações diárias (08:00) |
| `POST /api/v1/cron/weekly-digest` | Resumo semanal (seg 08:00) |
| `POST /api/v1/cron/monthly-digest` | Resumo mensal (dia 1, 09:00) |
| `POST /api/v1/cron/recalculate-interest` | Recalcular juros (00:00) |
| `POST /api/v1/cron/update-exchange-rates` | Atualizar câmbio (06:00) |

> Em ambos os modos **desligue** o cron interno se não houver processo 24/7
> (`ENABLE_INTERNAL_CRON=false`) para evitar agendamento duplo.

---

## 6. Deploy passo a passo

Regra geral: **HTTPS sempre** (push notification e Service Worker exigem
contexto seguro; senão o `pushManager` não funciona). Veja duas opções neutras
(sem credencial, escolha a que melhor se encaixa).

### Opção A — VPS (recomendada p/ controle total)

Componentes: Node (app) + nginx (proxy/HTTPS) + processo supervisor (PM2 ou
systemd) + Let's Encrypt.

1. **Provisione a VPS** (Ubuntu/Debian) e instale Node LTS (>= 18):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. **Suba o código** (clone ou rsync do repo) e instale deps:
   ```bash
   cd /srv/pague-on
   npm ci --omit=dev
   npx prisma generate
   ```
3. **Crie o `.env` de produção** (veja `§2`) ou defina via painel do provedor.
   Garanta `NODE_ENV=production`, `PORT=3000`, `FRONTEND_ORIGINS=https://app.seudominio.com`.
4. **Rode as migrations** (`§3`):
   ```bash
   npx prisma migrate deploy
   ```
5. **Supervisor** — ex. **systemd** `/etc/systemd/system/pague-on.service`:
   ```ini
   [Unit]
   Description=Pague-On API
   After=network.target

   [Service]
   WorkingDirectory=/srv/pague-on
   ExecStart=/usr/bin/node src/server.js
   EnvironmentFile=/srv/pague-on/.env
   Restart=always
   User=pagueon

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl enable --now pague-on
   ```
   (Ou use PM2: `pm2 start src/server.js --name pague-on && pm2 save && pm2 startup`.)
6. **nginx + HTTPS** `/etc/nginx/sites-available/pague-on`:
   ```nginx
   server {
     listen 80;
     server_name app.seudominio.com;
     location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
   }
   ```
   ```bash
   sudo certbot --nginx -d app.seudominio.com
   ```
   O Certbot já injeta o bloco HTTPS e renova automaticamente. Aponte `DATABASE_URL`,
   `DIRECT_URL` etc. no `.env` para o Supabase.
7. **Cron**: como a VPS fica de pé, ligue `ENABLE_INTERNAL_CRON=true`; se
   preferir observabilidade, use o cron externo `§5.2` com `false`.

### Opção B — PaaS (Render / Railway / Fly.io)

1. **Crie um serviço web** apontando para o repo (branch de produção),
   comando de start `npm start` (`node src/server.js`).
2. **Defina as env vars** (`§2`) no painel do serviço — incluindo `DATABASE_URL`,
   `DIRECT_URL`, `JWT_SECRET`, `CRON_SECRET`, VAPID e
   `FRONTEND_ORIGINS=https://app.seudominio.com`.
3. **Migrations**: muitos PaaS têm "Start Command" que roda antes do app —
   use `npx prisma migrate deploy && npm start` (aplica migrations e sobe o
   app). Ou rode `migrate deploy` numa etapa/one-off com as envs corretas.
4. **Uploads persistentes**: se o PaaS não monta disco, `UPLOAD_PATH` vira
   efêmero (dados somem no redeploy). Monte um volume persistente no diretório
   de uploads, ou considere mover uploads para um storage externo (fora do
   escopo deste guia, mas necessário se avatares/produtos forem críticos).
5. **HTTPS**: o provedor dá certificado automático no domínio atribuído — use
   esse domínio em `FRONTEND_ORIGINS` e no push.
6. **Cron**: plataformas que "dormem" (Render Free, Fly sem sempre-on, serverless)
   não garantem o cron interno — configure o **cron externo** `§5.2` protegido
   por `CRON_SECRET`, e deixe `ENABLE_INTERNAL_CRON=false`.

Independente da opção, confirme: `FRONTEND_ORIGINS` com o domínio real,
`JWT_SECRET` forte, HTTPS ativo, migrations aplicadas e `/health` respondendo
(`§7.3`).

---

## 7. Segredos

- **Nunca commite `.env`** (já está no `.gitignore`). Se vazar, **rotacione
  imediatamente**.
- Prefira variáveis definidas no **painel do provedor** (Render/Railway/Fly) ou
  um **gerenciador de secrets** (Vault, AKS Secrets, GitHub Actions Secrets) em
  vez de `.env` no servidor quando houver suporte.
- **`JWT_SECRET`**: gere forte e aleatório; troque se suspeitar de vazamento
  (isso invalida tokens existentes — planeje o rollout).
- **`BACKUP_ENCRYPTION_KEY`**: guarde num cofre separado. Se **perder** essa
  chave, os backups cloud do app ficam **irrecuperáveis** (são AES-256-GCM).
  Guarde uma cópia offline. Se trocar, backups antigos não abrem mais com a nova.
- **`VAPID_PRIVATE_KEY`**: privada. A `VAPID_PUBLIC_KEY` é pública, mas ainda
  assim fica no ambiente.
- **Mínimo privilégio no banco**: o `DATABASE_URL` do app deve ser de uma role
  de aplicação (sem DDL). Migrations usam uma conexão/role com permissão de
  DDL via `DIRECT_URL` em ambiente de deploy.

---

## 8. Backup automático

Duas camadas complementares — **faça as duas**.

### (a) Backup do Postgres (Supabase) — o mais importante

O Supabase oferece **Point-in-Time Recovery (PITR)** nativo. Habilite no painel
e guarde também um **dump manual** periódico (offline / outro bucket):

```bash
# usando a conexão direta (DIRECT_URL)
pg_dump "postgresql://postgres.xxxx:senha@aws-0-sa-east-1.supabase.com:5432/postgres" \
  -Fc -f backup_$(date +%F).dump
```

Restore:

```bash
pg_restore -d "postgresql://postgres.xxxx:senha@...:5432/postgres" backup.dump
```

### (b) Backup cloud do próprio app (dados de negócio)

O app gera snapshots JSON **encriptados AES-256-GCM** com a
`BACKUP_ENCRYPTION_KEY`. Endpoints (autenticados):

- `POST /api/v1/backup/cloud` — cria snapshot cloud criptografado;
- `GET /api/v1/backup/cloud/status` — mostra o snapshot mais recente;
- `POST /api/v1/backup/cloud/:id/restore` — restaura um snapshot cloud;
- `GET /api/v1/backup/export` — exporta JSON (para download manual);
- `POST /api/v1/backup/restore` — restaura de um upload/export.

**Rotina recomendada**: um cron **semanal** (e mais frequentemente se o volume
de dados justificar) que chame `POST /api/v1/backup/cloud`. Isso pode ser o
próprio cron do app adicionado ao `cronScheduler`, ou um agendador externo
autenticado na API (usando um token de usuário com permissão). Os snapshots
ficam **no mesmo banco** — por isso o backup (a) do Postgres/Supabase é o que
protege contra perda total do banco.

**Restaurar**:
1. Garanta `BACKUP_ENCRYPTION_KEY` igual à usada no momento do snapshot.
2. `GET /api/v1/backup/cloud/status` → pegue o `id` do snapshot desejado.
3. `POST /api/v1/backup/cloud/:id/restore` (modo `MERGE` para não sobrescrever
   dados novos, ou substitua conforme a política).

---

## 9. Monitoramento (leve, sem dependência de código)

O app já expõe `GET /health` (sem auth) retornando `{ status, timestamp }` — use
como base de tudo. Recomendações:

- **Uptime**: configure um monitor de disponibilidade (ex.: **UptimeRobot**)
  no `https://app.seudominio.com/health`, a cada 1–5 min, com alerta por
  email/WhatsApp.
- **Logs estruturados**: o app loga para stdout/stderr
  (ex.: `Cron X falhou: ...`). Em PaaS, capture/agrupe os logs do serviço; em
  VPS, mande stdout para um agregador (journald/pm2 logs, ou um serviço de
  logs). Evite logar dados sensíveis.
- **Alerta de erro**: use **Sentry** (instrumentar `errorHandler` seria um
  ajuste de código — fora deste escopo) ou o **grupo de logs / alertas de log
  do provedor** (ex.: alertar quando `error`/`status 5xx` aparecer no log).
- **Banco (Supabase)**: acompanhe no painel o **tamanho do banco**, índices e
  queries lentas (Investigation/Lazy blogger, `pg_stat_statements`). Crescimento
  descontrolado da tabela de `backupSnapshot` ou de notificações pode inflar o
  custo.
- **Push**: monitore falhas de entrega nos logs do `pushService` (ele remove
  subscriptions com erro 404/410 e loga falhas). O teste manual `§4.3` valida
  o fluxo fim-a-fim.

---

## 10. Checklist de produção final

- [ ] `DATABASE_URL` (pooler) e `DIRECT_URL` (direta) apontam para o banco
      Supabase de produção.
- [ ] Migrations aplicadas (`npx prisma migrate status` limpo /
      `prisma migrate deploy` rodado).
- [ ] `JWT_SECRET` forte (≥ 32 chars), único, definido no ambiente.
- [ ] `CRON_SECRET` definido no ambiente (usado pelos cron externos).
- [ ] `FRONTEND_ORIGINS` contém o **domínio real** (ex.: `https://app.seudominio.com`).
- [ ] `NODE_ENV=production`, `PORT` definido.
- [ ] VAPID configurado: `VAPID_SUBJECT` (mailto real), `VAPID_PUBLIC_KEY`,
      `VAPID_PRIVATE_KEY` gerados com `web-push`.
- [ ] Push testado fim-a-fim (`§4.3`): notificação de teste chega com o app
      fechado.
- [ ] Cron decidido: `ENABLE_INTERNAL_CRON=true` (VPS 24/7) **ou** cron externo
      `§5.2` + `false`.
- [ ] `BACKUP_ENCRYPTION_KEY` definido e cópia offline guardada.
- [ ] Backup rodando: PITR/Supabase habilitado + rotina de `backup/cloud`.
- [ ] HTTPS ativo (Let's Encrypt ou PaaS) e PWA instalável sem erro.
- [ ] `UPLOAD_PATH` persistente (volume na VPS/PaaS) — avatares/produtos não
      somem no redeploy.
- [ ] Monitor: uptime em `/health` (UptimeRobot), alerta de erro, olho no
      tamanho do banco.
- [ ] `.env` não versionado e sem segredos no repo (confirmar `git status`).

---

## Troubleshooting rápido

| Sintoma | Causa provável | Resolução |
| --- | --- | --- |
| Push: `skipped: 'VAPID_NOT_CONFIGURED'` | Faltam variáveis VAPID no env | Preencha `VAPID_SUBJECT`+`VAPID_PUBLIC_KEY`+`VAPID_PRIVATE_KEY` e reinicie |
| Push não funciona no navegador | Sem HTTPS | Ative HTTPS (push requer contexto seguro) |
| Migrations falham | `DIRECT_URL` errado/pooler no lugar errado | Use conexão direta (porta 5432) para migrations |
| CORS bloqueando | `FRONTEND_ORIGINS` sem o domínio real | Adicione `https://app.seudominio.com` |
| Cron não roda | Processo não está 24/7 | Use cron externo `§5.2` |
| Backup cloud irrecuperável | `BACKUP_ENCRYPTION_KEY` perdida/trocada | Guarde cópia offline; não troque sem re-criar backups |
