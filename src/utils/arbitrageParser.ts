/**
 * Parser para arbitragens no formato com tabs
 * Estrutura esperada:
 * Linha 1: data_hora \t descricao_evento \t esporte_liga
 * Linha 2: casa_01_nome \t mercado \t odd \t 0.0 \t odd_confirmada \t valor \t 0 \t moeda \t lucro \t porcentagem
 * Linha 3: casa_02_nome \t mercado \t odd \t 0.0 \t odd_confirmada \t valor \t 0 \t moeda \t lucro
 * Linha 4 (opcional): total (vazio) \t \t \t \t valor_total \t \t moeda
 */

export interface ParsedArbitrage {
  descricao: string;
  data_hora?: string;
  esporte_liga?: string;
  casa_01_nome: string;
  casa_01_mercado?: string;
  casa_01_odd: string;
  casa_01_valor: string;
  casa_02_nome: string;
  casa_02_mercado?: string;
  casa_02_odd: string;
  casa_02_valor: string;
  casa_03_nome?: string;
  casa_03_mercado?: string;
  casa_03_odd?: string;
  casa_03_valor?: string;
  porcentagem: string;
  total_apostado?: string;
}

export function parseArbitrageText(text: string): ParsedArbitrage | null {
  try {
    // Dividir em linhas
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 3) {
      throw new Error('Formato inválido: mínimo 3 linhas necessárias');
    }

    // Linha 1: Dados do evento
    const line1Parts = lines[0].split('\t');
    const dataHora = line1Parts[0]?.trim() || '';
    const descricaoEvento = line1Parts[1]?.trim() || '';
    const esporteLiga = line1Parts[2]?.trim() || '';

    // Linha 2: Casa 01
    const line2Parts = lines[1].split('\t');
    if (line2Parts.length < 10) {
      throw new Error('Linha 2 (Casa 01) com formato inválido');
    }
    
    const casa01Nome = line2Parts[0]?.trim() || '';
    const casa01Mercado = line2Parts[1]?.trim() || '';
    const casa01Odd = line2Parts[2]?.trim() || '';
    const casa01Valor = line2Parts[5]?.trim() || '';
    const porcentagem = line2Parts[9]?.trim().replace('%', '') || '';

    // Linha 3: Casa 02
    const line3Parts = lines[2].split('\t');
    if (line3Parts.length < 9) {
      throw new Error('Linha 3 (Casa 02) com formato inválido');
    }
    
    const casa02Nome = line3Parts[0]?.trim() || '';
    const casa02Mercado = line3Parts[1]?.trim() || '';
    const casa02Odd = line3Parts[2]?.trim() || '';
    const casa02Valor = line3Parts[5]?.trim() || '';

    // Linha 4 (opcional): Casa 03 ou Total
    let casa03Nome = '';
    let casa03Mercado = '';
    let casa03Odd = '';
    let casa03Valor = '';
    let totalApostado = '';

    if (lines.length >= 4) {
      const line4Parts = lines[3].split('\t');
      
      // Verificar se é uma casa 03 (tem nome da casa) ou linha de total (vazia no início)
      if (line4Parts[0]?.trim() && line4Parts.length >= 9) {
        // É uma casa 03
        casa03Nome = line4Parts[0]?.trim() || '';
        casa03Mercado = line4Parts[1]?.trim() || '';
        casa03Odd = line4Parts[2]?.trim() || '';
        casa03Valor = line4Parts[5]?.trim() || '';
        
        // Se houver linha 5, é o total
        if (lines.length >= 5) {
          const line5Parts = lines[4].split('\t');
          totalApostado = line5Parts[4]?.trim() || '';
        }
      } else {
        // É a linha de total
        totalApostado = line4Parts[4]?.trim() || '';
      }
    }

    // Calcular total se não foi fornecido
    if (!totalApostado) {
      const valor1 = parseFloat(casa01Valor) || 0;
      const valor2 = parseFloat(casa02Valor) || 0;
      const valor3 = parseFloat(casa03Valor) || 0;
      totalApostado = (valor1 + valor2 + valor3).toString();
    }

    const result: ParsedArbitrage = {
      descricao: descricaoEvento,
      data_hora: dataHora,
      esporte_liga: esporteLiga,
      casa_01_nome: casa01Nome,
      casa_01_mercado: casa01Mercado,
      casa_01_odd: casa01Odd,
      casa_01_valor: casa01Valor,
      casa_02_nome: casa02Nome,
      casa_02_mercado: casa02Mercado,
      casa_02_odd: casa02Odd,
      casa_02_valor: casa02Valor,
      porcentagem: porcentagem,
      total_apostado: totalApostado,
    };

    // Adicionar casa 03 se existir
    if (casa03Nome) {
      result.casa_03_nome = casa03Nome;
      result.casa_03_mercado = casa03Mercado;
      result.casa_03_odd = casa03Odd;
      result.casa_03_valor = casa03Valor;
    }

    return result;
  } catch (error) {
    console.error('Erro ao fazer parsing da arbitragem:', error);
    return null;
  }
}
