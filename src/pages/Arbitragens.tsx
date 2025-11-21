import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, FileText } from 'lucide-react';
import { parseArbitrageText } from '@/utils/arbitrageParser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Arbitragens() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [useTresCasas, setUseTresCasas] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [activeTab, setActiveTab] = useState('manual');
  
  const [formData, setFormData] = useState({
    descricao: '',
    data_evento: '',
    esporte_liga: '',
    casa_01_nome: '',
    casa_01_odd: '',
    casa_01_valor: '',
    casa_01_mercado: '',
    casa_02_nome: '',
    casa_02_odd: '',
    casa_02_valor: '',
    casa_02_mercado: '',
    casa_03_nome: '',
    casa_03_odd: '',
    casa_03_valor: '',
    casa_03_mercado: '',
    porcentagem: '',
    retorno_previsto: '',
    lucro_projetado: '',
  });

  const handleParsePaste = () => {
    const parsed = parseArbitrageText(pasteText);
    
    if (!parsed) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar texto',
        description: 'Verifique se o formato está correto e tente novamente.',
      });
      return;
    }

    // Verificar se tem casa 03
    const hasCasa03 = !!parsed.casa_03_nome && !!parsed.casa_03_odd && !!parsed.casa_03_valor;
    setUseTresCasas(hasCasa03);

    // Preencher formulário
    setFormData({
      descricao: parsed.descricao,
      data_evento: parsed.data_hora || '',
      esporte_liga: parsed.esporte_liga || '',
      casa_01_nome: parsed.casa_01_nome,
      casa_01_odd: parsed.casa_01_odd,
      casa_01_valor: parsed.casa_01_valor,
      casa_01_mercado: parsed.casa_01_mercado || '',
      casa_02_nome: parsed.casa_02_nome,
      casa_02_odd: parsed.casa_02_odd,
      casa_02_valor: parsed.casa_02_valor,
      casa_02_mercado: parsed.casa_02_mercado || '',
      casa_03_nome: parsed.casa_03_nome || '',
      casa_03_odd: parsed.casa_03_odd || '',
      casa_03_valor: parsed.casa_03_valor || '',
      casa_03_mercado: parsed.casa_03_mercado || '',
      porcentagem: parsed.porcentagem,
      retorno_previsto: '',
      lucro_projetado: '',
    });

    toast({
      title: 'Texto processado!',
      description: 'Os dados foram preenchidos automaticamente.',
    });

    // Mudar para a aba manual para ver o formulário preenchido
    setActiveTab('manual');
    setPasteText('');
  };

  // Calcular automaticamente porcentagem, retorno previsto e lucro projetado
  useEffect(() => {
    const odd1 = parseFloat(formData.casa_01_odd);
    const valor1 = parseFloat(formData.casa_01_valor);
    const odd2 = parseFloat(formData.casa_02_odd);
    const valor2 = parseFloat(formData.casa_02_valor);
    const odd3 = parseFloat(formData.casa_03_odd);
    const valor3 = parseFloat(formData.casa_03_valor);

    if (useTresCasas) {
      // Cálculo para 3 casas
      if (odd1 > 0 && valor1 > 0 && odd2 > 0 && valor2 > 0 && odd3 > 0 && valor3 > 0) {
        // Fórmula da porcentagem de arbitragem para 3 casas
        const porcentagem = ((1 / odd1 + 1 / odd2 + 1 / odd3) - 1) * 100;
        
        // Valor total apostado
        const totalApostado = valor1 + valor2 + valor3;
        
        // Retorno previsto (menor dos três possíveis retornos - casa com menor odd)
        const retorno1 = valor1 * odd1;
        const retorno2 = valor2 * odd2;
        const retorno3 = valor3 * odd3;
        const retornoPrevisto = Math.min(retorno1, retorno2, retorno3);
        
        // Lucro projetado
        const lucroProjetado = retornoPrevisto - totalApostado;

        setFormData(prev => ({
          ...prev,
          porcentagem: porcentagem.toFixed(2),
          retorno_previsto: retornoPrevisto.toFixed(2),
          lucro_projetado: lucroProjetado.toFixed(2),
        }));
      }
    } else {
      // Cálculo para 2 casas
      if (odd1 > 0 && valor1 > 0 && odd2 > 0 && valor2 > 0) {
        // Fórmula da porcentagem de arbitragem
        const porcentagem = ((1 / odd1 + 1 / odd2) - 1) * 100;
        
        // Valor total apostado
        const totalApostado = valor1 + valor2;
        
        // Retorno previsto (menor dos dois possíveis retornos - casa com menor odd)
        const retorno1 = valor1 * odd1;
        const retorno2 = valor2 * odd2;
        const retornoPrevisto = Math.min(retorno1, retorno2);
        
        // Lucro projetado
        const lucroProjetado = retornoPrevisto - totalApostado;

        setFormData(prev => ({
          ...prev,
          porcentagem: porcentagem.toFixed(2),
          retorno_previsto: retornoPrevisto.toFixed(2),
          lucro_projetado: lucroProjetado.toFixed(2),
        }));
      }
    }
  }, [
    formData.casa_01_odd,
    formData.casa_01_valor,
    formData.casa_02_odd,
    formData.casa_02_valor,
    formData.casa_03_odd,
    formData.casa_03_valor,
    useTresCasas,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Erro de autenticação',
        description: 'Usuário não autenticado. Faça login novamente.',
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Garantir que o perfil do usuário existe
      const { error: profileError } = await supabase.rpc('ensure_user_profile', {
        user_uuid: user.id
      });

      if (profileError) {
        console.error('Erro ao verificar perfil:', profileError);
        throw profileError;
      }

      // Inserir arbitragem
      const arbitrageData: any = {
        user_id: user.id,
        descricao: formData.descricao,
        data_evento: formData.data_evento || new Date().toISOString(),
        esporte_liga: formData.esporte_liga || null,
        casa_01_nome: formData.casa_01_nome,
        casa_01_odd: parseFloat(formData.casa_01_odd),
        casa_01_valor: parseFloat(formData.casa_01_valor),
        casa_01_mercado: formData.casa_01_mercado || null,
        casa_02_nome: formData.casa_02_nome,
        casa_02_odd: parseFloat(formData.casa_02_odd),
        casa_02_valor: parseFloat(formData.casa_02_valor),
        casa_02_mercado: formData.casa_02_mercado || null,
        porcentagem: parseFloat(formData.porcentagem),
        retorno_previsto: parseFloat(formData.retorno_previsto),
        lucro_projetado: parseFloat(formData.lucro_projetado),
      };

      // Adicionar casa 03 se estiver usando 3 casas
      if (useTresCasas) {
        arbitrageData.casa_03_nome = formData.casa_03_nome;
        arbitrageData.casa_03_odd = parseFloat(formData.casa_03_odd);
        arbitrageData.casa_03_valor = parseFloat(formData.casa_03_valor);
        arbitrageData.casa_03_mercado = formData.casa_03_mercado || null;
      }

      const { error: insertError } = await supabase.from('arbitrages').insert(arbitrageData);

      if (insertError) {
        throw insertError;
      }

      toast({
        title: 'Arbitragem criada!',
        description: 'A arbitragem foi cadastrada com sucesso.',
      });
      setOpen(false);
      setFormData({
        descricao: '',
        data_evento: '',
        esporte_liga: '',
        casa_01_nome: '',
        casa_01_odd: '',
        casa_01_valor: '',
        casa_01_mercado: '',
        casa_02_nome: '',
        casa_02_odd: '',
        casa_02_valor: '',
        casa_02_mercado: '',
        casa_03_nome: '',
        casa_03_odd: '',
        casa_03_valor: '',
        casa_03_mercado: '',
        porcentagem: '',
        retorno_previsto: '',
        lucro_projetado: '',
      });
    } catch (error: any) {
      console.error('Erro ao criar arbitragem:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar arbitragem',
        description: error.message || 'Ocorreu um erro desconhecido',
      });
    } finally {
      toast({
        title: 'Arbitragem criada!',
        description: 'A arbitragem foi cadastrada com sucesso.',
      });
      setOpen(false);
      setFormData({
        descricao: '',
        data_evento: '',
        esporte_liga: '',
        casa_01_nome: '',
        casa_01_odd: '',
        casa_01_valor: '',
        casa_01_mercado: '',
        casa_02_nome: '',
        casa_02_odd: '',
        casa_02_valor: '',
        casa_02_mercado: '',
        casa_03_nome: '',
        casa_03_odd: '',
        casa_03_valor: '',
        casa_03_mercado: '',
        porcentagem: '',
        retorno_previsto: '',
        lucro_projetado: '',
      });
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Arbitragens</h1>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Adicionar Arbitragem
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Arbitragem</DialogTitle>
                <DialogDescription>
                  Cole o texto da arbitragem ou preencha manualmente
                </DialogDescription>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="paste">
                    <FileText className="h-4 w-4 mr-2" />
                    Colar Texto
                  </TabsTrigger>
                  <TabsTrigger value="manual">
                    Manual
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pasteText">Cole o texto da arbitragem aqui</Label>
                    <Textarea
                      id="pasteText"
                      placeholder="Cole aqui o texto da arbitragem formatado com tabs..."
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato esperado: 
                      <br />- Linha 1: Data/Hora, Evento, Esporte/Liga
                      <br />- Linha 2: Casa 01 (nome, mercado, odd, valor, etc)
                      <br />- Linha 3: Casa 02
                      <br />- Linha 4 (opcional): Casa 03 ou Total
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleParsePaste}
                    className="w-full"
                    disabled={!pasteText.trim()}
                  >
                    Processar e Preencher Formulário
                  </Button>
                </TabsContent>

                <TabsContent value="manual">
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="data_evento">Data e Hora do Evento</Label>
                  <Input
                    id="data_evento"
                    type="datetime-local"
                    value={formData.data_evento}
                    onChange={(e) => setFormData({ ...formData, data_evento: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição do Evento</Label>
                  <Textarea
                    id="descricao"
                    placeholder="Ex: Flamengo vs Palmeiras"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="esporte_liga">Esporte / Liga</Label>
                  <Input
                    id="esporte_liga"
                    placeholder="Ex: Futebol - Campeonato Brasileiro"
                    value={formData.esporte_liga}
                    onChange={(e) => setFormData({ ...formData, esporte_liga: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant={!useTresCasas ? "default" : "outline"}
                    onClick={() => setUseTresCasas(false)}
                    className="flex-1"
                  >
                    2 Casas
                  </Button>
                  <Button
                    type="button"
                    variant={useTresCasas ? "default" : "outline"}
                    onClick={() => setUseTresCasas(true)}
                    className="flex-1"
                  >
                    3 Casas
                  </Button>
                </div>

                <div className={`grid gap-4 ${useTresCasas ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Casa 01</h3>
                    <div className="space-y-2">
                      <Label htmlFor="casa_01_nome">Nome da Casa</Label>
                      <Input
                        id="casa_01_nome"
                        placeholder="Ex: Bet365"
                        value={formData.casa_01_nome}
                        onChange={(e) => setFormData({ ...formData, casa_01_nome: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_01_odd">Odd</Label>
                      <Input
                        id="casa_01_odd"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 2.50"
                        value={formData.casa_01_odd}
                        onChange={(e) => setFormData({ ...formData, casa_01_odd: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_01_valor">Valor Apostado (R$)</Label>
                      <Input
                        id="casa_01_valor"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 100.00"
                        value={formData.casa_01_valor}
                        onChange={(e) => setFormData({ ...formData, casa_01_valor: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_01_mercado">Mercado</Label>
                      <Input
                        id="casa_01_mercado"
                        placeholder="Ex: Casa - Vitória"
                        value={formData.casa_01_mercado}
                        onChange={(e) => setFormData({ ...formData, casa_01_mercado: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Casa 02</h3>
                    <div className="space-y-2">
                      <Label htmlFor="casa_02_nome">Nome da Casa</Label>
                      <Input
                        id="casa_02_nome"
                        placeholder="Ex: Betano"
                        value={formData.casa_02_nome}
                        onChange={(e) => setFormData({ ...formData, casa_02_nome: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_02_odd">Odd</Label>
                      <Input
                        id="casa_02_odd"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 1.95"
                        value={formData.casa_02_odd}
                        onChange={(e) => setFormData({ ...formData, casa_02_odd: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_02_valor">Valor Apostado (R$)</Label>
                      <Input
                        id="casa_02_valor"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 80.00"
                        value={formData.casa_02_valor}
                        onChange={(e) => setFormData({ ...formData, casa_02_valor: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_02_mercado">Mercado</Label>
                      <Input
                        id="casa_02_mercado"
                        placeholder="Ex: Fora - Vitória"
                        value={formData.casa_02_mercado}
                        onChange={(e) => setFormData({ ...formData, casa_02_mercado: e.target.value })}
                      />
                    </div>
                  </div>

                  {useTresCasas && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h3 className="font-semibold text-lg">Casa 03</h3>
                      <div className="space-y-2">
                        <Label htmlFor="casa_03_nome">Nome da Casa</Label>
                        <Input
                          id="casa_03_nome"
                          placeholder="Ex: Sportingbet"
                          value={formData.casa_03_nome}
                          onChange={(e) => setFormData({ ...formData, casa_03_nome: e.target.value })}
                          required={useTresCasas}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="casa_03_odd">Odd</Label>
                        <Input
                          id="casa_03_odd"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 3.20"
                          value={formData.casa_03_odd}
                          onChange={(e) => setFormData({ ...formData, casa_03_odd: e.target.value })}
                          required={useTresCasas}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="casa_03_valor">Valor Apostado (R$)</Label>
                        <Input
                          id="casa_03_valor"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 50.00"
                          value={formData.casa_03_valor}
                          onChange={(e) => setFormData({ ...formData, casa_03_valor: e.target.value })}
                          required={useTresCasas}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="casa_03_mercado">Mercado</Label>
                        <Input
                          id="casa_03_mercado"
                          placeholder="Ex: Empate"
                          value={formData.casa_03_mercado}
                          onChange={(e) => setFormData({ ...formData, casa_03_mercado: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="porcentagem">Porcentagem (%)</Label>
                    <Input
                      id="porcentagem"
                      type="number"
                      step="0.01"
                      placeholder={useTresCasas ? "Editável" : "Calculado automaticamente"}
                      value={formData.porcentagem}
                      onChange={(e) => useTresCasas && setFormData({ ...formData, porcentagem: e.target.value })}
                      readOnly={!useTresCasas}
                      className={!useTresCasas ? "bg-muted" : ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      {parseFloat(formData.porcentagem) > 0 
                        ? '⚠️ Não é uma arbitragem válida' 
                        : parseFloat(formData.porcentagem) < 0 
                        ? '✅ Arbitragem válida!' 
                        : ''}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retorno_previsto">Retorno Previsto (R$)</Label>
                    <Input
                      id="retorno_previsto"
                      type="number"
                      step="0.01"
                      placeholder={useTresCasas ? "Editável" : "Calculado automaticamente"}
                      value={formData.retorno_previsto}
                      onChange={(e) => useTresCasas && setFormData({ ...formData, retorno_previsto: e.target.value })}
                      readOnly={!useTresCasas}
                      className={!useTresCasas ? "bg-muted" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lucro_projetado">Lucro Projetado (R$)</Label>
                    <Input
                      id="lucro_projetado"
                      type="number"
                      step="0.01"
                      placeholder={useTresCasas ? "Editável" : "Calculado automaticamente"}
                      value={formData.lucro_projetado}
                      onChange={(e) => useTresCasas && setFormData({ ...formData, lucro_projetado: e.target.value })}
                      readOnly={!useTresCasas}
                      className={`${!useTresCasas ? 'bg-muted' : ''} ${
                        parseFloat(formData.lucro_projetado) > 0 
                          ? 'text-success font-semibold' 
                          : parseFloat(formData.lucro_projetado) < 0 
                          ? 'text-destructive font-semibold' 
                          : ''
                      }`}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Salvando...' : 'Salvar Arbitragem'}
                </Button>
              </form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <p>Clique em "Adicionar Arbitragem" para cadastrar uma nova operação.</p>
        </div>
      </div>
    </Layout>
  );
}
