// Dados das casas de apostas organizados por grupo
// Extraído da planilha CASAS_CLONES.xlsx

export interface BettingHouse {
  id: string;
  name: string;
  url?: string;
}

export interface BettingHouseGroup {
  id: string;
  name: string;
  houses: BettingHouse[];
}

export const bettingHouseGroups: BettingHouseGroup[] = [
  {
    id: 'casas-sem-clones',
    name: 'Casas sem clones',
    houses: [
      { id: 'betnacional', name: 'Betnacional', url: 'betnacional.bet.br' },
      { id: 'superbet', name: 'Superbet', url: 'superbet.bet.br' },
      { id: 'sportybet', name: 'Sportybet', url: 'sporty.bet.br' },
      { id: 'pinnacle', name: 'Pinnacle', url: 'pinnacle.bet.br' },
      { id: 'betano', name: 'Betano', url: 'betano.bet.br' },
      { id: 'novibet', name: 'Novibet', url: 'novibet.bet.br' },
      { id: 'bet365', name: 'Bet365', url: 'bet365.bet.br' },
      { id: 'betwarrior', name: 'Betwarrior', url: 'betwarrior.bet.br' },
      { id: 'betmilhao', name: 'Betmilhão', url: 'milhao.bet.br' },
    ],
  },
  {
    id: 'clone-vai-de-bet',
    name: 'Clone Vai de Bet',
    houses: [
      { id: 'vai-de-bet', name: 'Vai de Bet', url: 'vaidebet.bet.br' },
      { id: 'esportes-da-sorte', name: 'Esportes da Sorte', url: 'esportesdasorte.bet.br' },
      { id: 'betpix365', name: 'BetPix365', url: 'betpix365.bet.br' },
    ],
  },
  {
    id: 'clone-sportingbet',
    name: 'Clone Sportingbet',
    houses: [
      { id: 'sportingbet', name: 'Sportingbet', url: 'sportingbet.bet.br' },
      { id: 'betboo', name: 'Betboo', url: 'betboo.bet.br' },
    ],
  },
  {
    id: 'clone-stake',
    name: 'Clone Stake',
    houses: [
      { id: 'stake', name: 'Stake', url: 'stake.bet.br' },
      { id: 'betmgm', name: 'BetMGM', url: 'betmgm.bet.br' },
      { id: 'kto', name: 'KTO', url: 'kto.bet.br' },
    ],
  },
  {
    id: 'clone-betfast',
    name: 'Clone Betfast',
    houses: [
      { id: 'betfast', name: 'Betfast', url: 'betfast.bet.br' },
      { id: 'faz1bet', name: 'Faz1bet', url: 'faz1.bet.br' },
      { id: 'tivobet', name: 'Tivobet', url: 'tivo.bet.br' },
    ],
  },
  {
    id: 'clone-vbet',
    name: 'Clone Vbet',
    houses: [
      { id: 'vbet', name: 'Vbet', url: 'vbet.bet.br' },
      { id: 'bravobet', name: 'Bravobet', url: 'bravo.bet.br' },
      { id: 'supremabet', name: 'Supremabet', url: 'suprema.bet.br' },
      { id: 'h2bet', name: 'H2.bet', url: 'h2.bet.br' },
      { id: 'betpark', name: 'Betpark', url: 'betpark.bet.br' },
      { id: 'segurobet', name: 'Segurobet', url: 'seguro.bet.br' },
      { id: '7games', name: '7Games', url: '7games.bet.br' },
      { id: 'betao', name: 'Betão', url: 'betao.bet.br' },
      { id: 'r7bet', name: 'R7.bet', url: 'r7.bet.br' },
      { id: 'maximabet', name: 'Maximabet', url: 'maxima.bet.br' },
      { id: 'ultrabet', name: 'Ultrabet', url: 'ultra.bet.br' },
    ],
  },
  {
    id: 'clone-onabet',
    name: 'Clone Onabet',
    houses: [
      { id: 'onabet', name: 'Onabet', url: 'ona.bet.br' },
      { id: 'esporte365', name: 'Esporte365', url: 'esporte365.bet.br' },
      { id: '1praum', name: '1praum', url: '1pra1.bet.br' },
      { id: 'starbet', name: 'Starbet', url: 'start.bet.br' },
      { id: 'bigbet', name: 'Bigbet', url: 'big.bet.br' },
      { id: 'apostar', name: 'Apostar', url: 'apostar.bet.br' },
      { id: 'luvabet', name: 'Luvabet', url: 'luva.bet.br' },
    ],
  },
  {
    id: 'clone-blaze',
    name: 'Clone Blaze',
    houses: [
      { id: 'blaze', name: 'Blaze', url: 'blaze.bet.br' },
      { id: 'betvip', name: 'BetVip', url: 'betvip.bet.br' },
      { id: 'jonbet', name: 'Jonbet', url: 'jonbet.bet.br' },
      { id: 'afunbet', name: 'Afunbet', url: 'afun.bet.br' },
      { id: 'ganheibet', name: 'GanheiBet', url: 'ganhei.bet.br' },
      { id: 'pinbet', name: 'PinBet', url: 'pin.bet.br' },
      { id: 'apostaganha', name: 'Apostaganha', url: 'apostaganha.bet.br' },
    ],
  },
  {
    id: 'clone-bet7k',
    name: 'Clone Bet7k',
    houses: [
      { id: 'bet7k', name: 'Bet7k', url: '7k.bet.br' },
      { id: 'liderbet', name: 'Liderbet', url: 'lider.bet.br' },
      { id: 'b2xbet', name: 'B2x.bet', url: 'b2x.bet.br' },
      { id: 'verabet', name: 'Verabet', url: 'vera.bet.br' },
      { id: 'sortenabet', name: 'Sortenabet', url: 'sortenabet.bet.br' },
      { id: 'betou', name: 'Betou', url: 'betou.bet.br' },
    ],
  },
  {
    id: 'clone-estrelabet',
    name: 'Clone Estrelabet',
    houses: [
      { id: 'estrelabet', name: 'Estrelabet', url: 'estrelabet.bet.br' },
      { id: 'nossabet', name: 'Nossabet', url: 'nossa.bet.br' },
      { id: 'jogodeouro', name: 'JogodeOuro', url: 'jogodeouro.bet.br' },
      { id: 'mcgames', name: 'MCGames', url: 'mcgames.bet.br' },
      { id: 'multbet', name: 'Multbet', url: 'multi.bet.br' },
      { id: 'aposta1', name: 'Aposta1', url: 'aposta1.bet.br' },
      { id: 'bateubet', name: 'Bateubet', url: 'bateu.bet.br' },
      { id: 'esportivabet', name: 'Esportivabet', url: 'esportiva.bet.br' },
      { id: 'cassinopix', name: 'Cassinopix', url: 'cassino.bet.br' },
      { id: 'vupi', name: 'Vupi', url: 'vupi.bet.br' },
      { id: 'betfusion', name: 'Betfusion', url: 'betfusion.bet.br' },
      { id: 'brasildasorte', name: 'BrasildaSorte', url: 'brasildasorte.bet.br' },
      { id: 'br4bet', name: 'BR4Bet', url: 'br4.bet.br' },
      { id: 'pagol', name: 'PAGOL', url: 'pagol.bet.br' },
      { id: 'playbet', name: 'Playbet', url: 'play.bet.br' },
      { id: 'brbet', name: 'BrBet', url: 'brbet.bet.br' },
    ],
  },
];

// Função auxiliar para buscar todas as casas de um grupo
export const getHousesByGroupId = (groupId: string): BettingHouse[] => {
  const group = bettingHouseGroups.find(g => g.id === groupId);
  return group?.houses || [];
};

// Função auxiliar para buscar um grupo pelo ID
export const getGroupById = (groupId: string): BettingHouseGroup | undefined => {
  return bettingHouseGroups.find(g => g.id === groupId);
};

// Função para buscar todas as casas (flat list)
export const getAllHouses = (): BettingHouse[] => {
  return bettingHouseGroups.flatMap(group => group.houses);
};
