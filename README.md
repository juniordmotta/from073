# From 073

Quero que você desenvolva um sistema completo de gerenciamento de arbitragens esportivas com suporte a múltiplos usuários, seguindo exatamente as regras e funções abaixo. 🔐 1. Permissões e Usuários Tipos de usuários: Admin Master (primeiro admin criado) O primeiro admin criado automaticamente se torna o Admin Master. Somente ele pode criar novos usuários. Admin (criado pelo Admin Master) Tem acesso a TUDO no sistema. Pode visualizar dados de todos operadores. Pode filtrar resultados por usuário, data, casa etc. Operador Pode acessar somente suas próprias arbitragens. Pode acessar Dashboard (somente dele). Pode adicionar e editar apenas arbitragens dele mesmo. 📊 2. Estrutura do Sistema O sistema deve possuir as seguintes abas/menus: 🔵 Aba: Dashboard Permissões: Admin/Administrador Visualiza o total consolidado de todos usuários. Permite filtrar por: usuário intervalo de datas casa de aposta porcentagem lucro status (aberta, green, red, parcial etc.) Operador Visualiza apenas o Dashboard pessoal. Mesmos filtros, porém somente os dados dele. 🔵 Aba: Arbitragens Nesta aba, deve existir um botão grande: “Adicionar Arbitragem” Quando o usuário clicar: Ele irá colocar/colar os dados vindos da calculadora de arbitragem. O sistema deve ler automaticamente esses dados e preencher todos os campos. Ao confirmar, o sistema salva a arbitragem com todos os dados calculados. Campos padrão de uma arbitragem: Data Descrição do evento Casa 01: odd, valor, nome da casa Casa 02: odd, valor, nome da casa Porcentagem Retorno previsto Lucro projetado Status inicial: Aguardando resultado Admin pode ver todas. Operador vê somente as dele. 🔵 Aba: Minhas Arbitragens Aqui deve mostrar uma tabela completa com todas as arbitragens de cada usuário. Admin: vê tabela de todos ou filtra por usuário. Operador: vê somente as dele. ⚠️ Em cada arbitragem deve aparecer dois botões: Botão 1 – Casa 01 Botão 2 – Casa 02 Cada botão abre um menu com as seguintes opções: Ganhou Perdeu Ganho Parcial Perda Parcial Perda Total Quando o resultado for selecionado: O sistema atualiza o status da arbitragem. Atualiza cálculos de lucro/prejuízo. Atualiza o Dashboard automaticamente. 🧠 3. Regras automáticas O sistema deve: Calcular automaticamente o lucro baseado no resultado. Atualizar automaticamente o Dashboard. Guardar histórico de alterações (quem alterou e quando). Permitir pesquisas rápidas e filtros avançados. 🖥️ 4. Telas Requeridas Tela de login Tela de criação do primeiro Admin Dashboard (Admin + Operador) Aba “Arbitragens” com botão de adicionar Aba “Minhas Arbitragens” com botões de resultado Aba de gerenciamento de usuários (somente Admin Master) 🔧 5. Requisitos Técnicos (opcional, mas recomendado) Backend: Node.js, Python ou qualquer sugerido pela IA Banco: PostgreSQL / Firebase Autenticação JWT Interface limpa e responsiva Filtros dinâmicos e rápidos 🎯 Objetivo Final Entregar um sistema completo, funcional e fácil de usar, onde: Admins controlam tudo. Operadores gerenciam apenas suas apostas. Todo o fluxo de arbitragem é registrado, calculado e organizado automaticamente.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://from073.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b16c8e69-af37-4a5d-81e4-b11cac3785b1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
