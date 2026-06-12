## Central de Notificações - Casas de Apostas

### Objetivo
Criar uma central onde admins podem disparar notificações sobre alterações em casas de apostas para todos os usuários, exibidas via ícone de sino com contador no header.

### Eventos rastreados
- Casa adicionada
- Casa movida (entre grupos)
- Casa excluída
- Mudança de status (ativa/inativa)
- Grupo adicionado

### Banco de Dados (nova migration)

**Tabela `notifications`** (notificações disparadas):
- `id`, `type` (added|moved|deleted|status_changed|group_added)
- `title`, `message`
- `metadata` (jsonb com dados do evento)
- `created_by` (admin que disparou)
- `created_at`

**Tabela `notification_events`** (log automático de mudanças disponíveis para disparo):
- `id`, `event_type`, `entity_name`, `details` (jsonb)
- `created_at`

**Tabela `notification_reads`** (controle de leitura por usuário):
- `user_id`, `notification_id`, `read_at`
- PK composta

**RLS:**
- `notifications`: SELECT para authenticated; INSERT apenas admins
- `notification_events`: SELECT apenas admins; INSERT via triggers (service_role)
- `notification_reads`: cada usuário gerencia apenas as próprias

**Triggers automáticos** em `custom_betting_houses`, `hidden_betting_houses`, `custom_betting_groups` para popular `notification_events` quando houver INSERT/UPDATE/DELETE.

### Frontend

**1. Ícone de sino no header (`Layout.tsx`)**
- Componente `NotificationBell` com badge mostrando contador de não-lidas
- Limita exibição a 10 notificações mais recentes
- Dropdown com lista; cada item tem botão "abrir" que marca como lida (sai do contador)
- Checkbox "Ler todas as notificações" que marca todas como lidas

**2. Central de notificações (admin) - novo botão na página `CasasDeApostas`**
- Modal `NotificationCenterDialog` (apenas admin/admin_master)
- Lista os últimos eventos de `notification_events` (últimos 30)
- Admin seleciona um evento e clica "Disparar notificação"
- Cria registro em `notifications` visível para todos

**3. Hook `useNotifications`**
- Busca últimas 10 notificações
- Conta não-lidas (notificações sem entrada em `notification_reads` para o user atual)
- Função `markAsRead(id)` e `markAllAsRead()`
- Realtime opcional (postgres_changes em `notifications`)

### Arquivos a criar/editar
- `supabase/migrations/...` (nova tabela + triggers + RLS)
- `src/hooks/useNotifications.ts` (novo)
- `src/components/NotificationBell.tsx` (novo - sino + dropdown)
- `src/components/NotificationCenterDialog.tsx` (novo - admin)
- `src/components/Layout.tsx` (incluir sino no header)
- `src/pages/CasasDeApostas.tsx` (botão "Central de Notificações" para admins)

### Observação
A captura automática de eventos será feita por triggers no banco, evitando alterar toda lógica de UI existente em `CasasDeApostas.tsx`. Os admins escolhem quais eventos transformar em notificação visível aos usuários.
