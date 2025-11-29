import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCpf } from '@/hooks/useCpfFormat';
import { ChevronDown } from 'lucide-react';

interface Bank {
  id: string;
  nome: string;
}

interface PartnershipDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
  selectedBanks: string[];
  setSelectedBanks: (banks: string[]) => void;
  banks: Bank[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function PartnershipDialog({
  isOpen,
  onOpenChange,
  isEditing,
  formData,
  setFormData,
  selectedBanks,
  setSelectedBanks,
  banks,
  onSubmit,
  onCancel,
}: PartnershipDialogProps) {
  
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpf(e.target.value);
    setFormData({ ...formData, cpf: formatted });
  };

  const toggleBank = (bankNome: string) => {
    setSelectedBanks(
      selectedBanks.includes(bankNome)
        ? selectedBanks.filter((b) => b !== bankNome)
        : [...selectedBanks, bankNome]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Parceria' : 'Adicionar Parceria'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome_completo">Nome Completo *</Label>
              <Input
                id="nome_completo"
                value={formData.nome_completo}
                onChange={(e) =>
                  setFormData({ ...formData, nome_completo: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={handleCpfChange}
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço *</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) =>
                setFormData({ ...formData, endereco: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_banca">Valor da Banca *</Label>
              <Input
                id="valor_banca"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_banca}
                onChange={(e) =>
                  setFormData({ ...formData, valor_banca: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Bancos Cadastrados *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {selectedBanks.length === 0
                      ? 'Selecionar bancos'
                      : `${selectedBanks.length} banco(s) selecionado(s)`}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-4" align="start">
                  <div className="space-y-2">
                    {banks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum banco cadastrado. Adicione bancos na página de Bancos.
                      </p>
                    ) : (
                      banks.map((bank) => (
                        <div key={bank.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={bank.id}
                            checked={selectedBanks.includes(bank.nome)}
                            onCheckedChange={() => toggleBank(bank.nome)}
                          />
                          <label
                            htmlFor={bank.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {bank.nome}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data de Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) =>
                  setFormData({ ...formData, data_inicio: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              {isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
