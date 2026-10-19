# Apostas e saldos em BRL, USD e EUR

## Comportamento
- Adicionar um seletor **BRL / USD / EUR** ao lado de **Lucro Projetado**, antes de salvar a aposta; BRL será o padrão.
- A moeda escolhida valerá para todos os valores daquela aposta: investimento nas casas, retorno previsto, lucro projetado e resultados recebidos. Odds e porcentagens não mudam.
- Preservar todas as apostas e todos os saldos existentes como BRL, sem converter ou reinterpretar valores históricos.
- A moeda da aposta ficará registrada; ao editar ou lançar resultados, os campos continuarão usando essa moeda.

## Totais e cotações
- Consolidar lucro, investimento, média por dia e demais totais financeiros conforme as apostas do período e dos filtros aplicados.
- Se houver apenas BRL, mostrar reais como hoje.
- Se houver apenas USD ou apenas EUR, mostrar a moeda estrangeira e, ao lado em tamanho menor, o equivalente aproximado em reais.
- Se houver moedas diferentes, inclusive USD com EUR, converter os valores para BRL pela cotação mais recente disponível e mostrar os totais em reais.
- Usar uma única cotação por atualização dos totais, mostrando a data da cotação. Não inventar valores quando a consulta falhar: indicar indisponibilidade e impedir somas de moedas incompatíveis.
- Aplicar a regra às telas de Arbitragens e Dashboard, ao desempenho das casas e parcerias, ao relatório mensal e à exportação PDF. Custos e metas existentes continuam denominados em BRL, sendo convertidos apenas para comparação ou exibição quando necessário.

## Saldos por moeda
- Manter saldos separados em BRL, USD e EUR para cada casa e conta bancária de uma parceria, conforme sua escolha.
- O saldo atual passa a ser o saldo BRL; USD e EUR começam em zero. Nenhum saldo existente será renomeado como moeda estrangeira.
- Permitir consultar e ajustar cada saldo por moeda nas parcerias, incluindo a moeda no extrato.
- Debitar uma aposta somente dos saldos da mesma moeda, mantendo a regra atual de uso do saldo bancário quando faltar saldo na casa. Não retirar reais para financiar uma aposta em dólares ou euros automaticamente.
- Registrar movimentos e resultados na moeda correta, sem transformar a cotação usada para exibição em conversão permanente do dinheiro.

## Detalhes técnicos
- Adicionar moeda às arbitragens e movimentos e armazenamento de saldos por moeda, com permissões equivalentes às atuais e validação das parcerias ativas.
- Centralizar regras de conversão, arredondamento e escolha da moeda de apresentação em um módulo puro compartilhado, evitando somas de valores brutos incompatíveis.
- Consultar cotações em uma função do Lovable Cloud com cache, validação da resposta e identificação da fonte e data; usar a cotação mais recente publicada pela fonte, sem prometer atualização intradiária.
- Tornar as alterações de saldo e o registro dos movimentos consistentes e atômicos, evitando débitos parciais e concorrência entre abas.
- Atualizar os cálculos usados pelo assistente existente quando lerem valores financeiros, sem concluir ou ampliar o recurso de IA pendente.
- Corrigir eventuais erros de compilação que impeçam a página de funcionar, sem outras mudanças de layout.

## Verificação
- Testar BRL como padrão e a preservação das apostas e dos saldos anteriores.
- Testar uma carteira somente USD, uma somente EUR e combinações BRL/USD e USD/EUR com cotações controladas e resultados numéricos concretos.
- Testar lucro, investimento, média por dia, custos em reais, arredondamento e indisponibilidade de cotações.
- Testar isolamento dos saldos e extratos por moeda e por usuário.
- Verificar cadastro, leitura, resultado e totais de uma aposta, além do relatório mensal e PDF, sem alterar o padrão visual de computador ou celular.