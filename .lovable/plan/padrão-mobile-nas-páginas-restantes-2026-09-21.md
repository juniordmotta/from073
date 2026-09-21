# Padrão mobile nas páginas restantes

## Objetivo
Aplicar o mesmo visual mobile escuro e translúcido já usado no Dashboard e em Arbitragens às páginas restantes, sem alterar computador e tablet.

## Páginas
- Parcerias
- Casas de Apostas
- Custos Operacionais
- Anotações
- Gerenciar Usuários

## Alterações
- Estender o fundo, cabeçalho e cores mobile para todas essas rotas.
- Padronizar títulos, buscas, filtros recolhíveis, indicadores, listas e cartões móveis.
- Manter todas as informações, permissões, cálculos e ações atuais.
- Preservar integralmente o layout a partir de 768 px.
- Garantir cartões verticais compactos, textos legíveis e ausência de rolagem horizontal.

## Validação
- Conferir as páginas em 393 × 843.
- Testar abertura de filtros e principais cartões/listas.
- Confirmar que a versão desktop permanece inalterada e que o projeto compila sem erros.

## Detalhes técnicos
- Reutilizar os tokens e classes mobile existentes, adicionando apenas variações semânticas necessárias.
- Usar `MobileFilters` nas páginas que ainda exibem filtros diretamente.
- Limitar todas as novas regras visuais a telas abaixo de 768 px.
