# Assistente de IA nas Arbitragens

## Objetivo
Adicionar, somente na versão desktop da tela **Minhas Arbitragens**, um botão **IA** que abre um diálogo de consulta. O assistente responderá perguntas sobre apostas, casas, períodos, parcerias, valores e métricas usando os dados reais permitidos para o usuário conectado.

## Interface
- Inserir o botão **IA** junto aos botões “Ir para Casas” e “Adicionar Arbitragem”, oculto em celular e tablet.
- Abrir um diálogo amplo com uma única conversa, histórico carregado automaticamente e campo de pergunta sempre focado.
- Exibir respostas formatadas, estado “Analisando...” e erros claros.
- Usar os componentes oficiais de conversa, mensagens, campo de pergunta e carregamento do AI Elements.
- Manter respostas do assistente sem bolha colorida e mensagens do usuário com contraste adequado ao tema.

## Dados e segurança
- Criar uma tabela de histórico da conversa vinculada ao usuário, com permissões para cada pessoa acessar somente as próprias mensagens.
- Validar a sessão na função segura antes de qualquer consulta.
- Operadores poderão consultar somente os próprios dados e suas parcerias ativas.
- Administradores consultarão apenas os dados que suas permissões atuais já permitem; informações pessoais não serão entregues ao modelo.
- Respeitar o limite de 5.000 registros e aplicar filtros no servidor.

## Funcionamento da IA
- Criar uma função segura que recebe o histórico completo da conversa e usa o modelo padrão da Lovable AI com resposta transmitida em tempo real.
- Disponibilizar ferramentas restritas para a IA consultar contagens, totais e rankings por período, casa, status, usuário e parceria.
- Interpretar datas relativas no horário de São Paulo, incluindo “hoje”, “ontem” e “anteontem”.
- Salvar a pergunta e a resposta concluída no histórico da conversa.
- Tratar falta de créditos, limites temporários e demais erros com mensagens específicas, sem respostas inventadas.

## Validação
- Testar consultas como “quantas apostas abertas tem na casa Betnacional?”, “quantas fiz de anteontem até ontem?” e “qual parceria usei mais hoje?”.
- Confirmar que o botão não aparece abaixo do desktop, que o histórico reaparece após recarregar e que dados de outro operador não são expostos.
- Validar tema claro/escuro, compilação, carregamento, envio, foco do campo e estados de erro.

## Detalhes técnicos
- Persistência: uma conversa por usuário, armazenando mensagens no formato compatível com a interface de IA.
- Backend: função Edge com AI SDK, `openai/gpt-6-astra` via Responses API, raciocínio ativado, `store: false`, histórico completo e ferramentas com esquemas estritos.
- Banco: migration com `GRANT`, RLS e políticas `SELECT/INSERT/UPDATE/DELETE` por `auth.uid()`.
