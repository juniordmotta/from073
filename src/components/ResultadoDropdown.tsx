import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// Mapa para resultado individual de cada casa (usado no dropdown de seleção)
export const resultadoMap: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
  aguardando: { label: 'Aguardando', variant: 'secondary' },
  green: { label: 'Green', variant: 'default' },
  parcial_green: { label: 'Meio Green', variant: 'default' },
  red: { label: 'Red', variant: 'destructive' },
  parcial_red: { label: 'Meio Red', variant: 'destructive' },
  devolvido: { label: 'Devolvido', variant: 'secondary' },
  cashout: { label: 'Cashout', variant: 'secondary' },
};

// Opções de resultado individual para cada casa (com parciais)
export const resultOptions = [
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'green', label: 'Green' },
  { value: 'parcial_green', label: 'Meio Green' },
  { value: 'red', label: 'Red' },
  { value: 'parcial_red', label: 'Meio Red' },
  { value: 'devolvido', label: 'Devolvido' },
  { value: 'cashout', label: 'Cashout' },
];

interface ResultadoDropdownProps {
  currentResult: string;
  currentCashoutValue?: number | null;
  valorApostado: number;
  onResultChange: (resultado: string, cashoutValue?: number) => void;
}

export function ResultadoDropdown({
  currentResult,
  currentCashoutValue,
  valorApostado,
  onResultChange,
}: ResultadoDropdownProps) {
  const [cashoutDialogOpen, setCashoutDialogOpen] = useState(false);
  const [cashoutValue, setCashoutValue] = useState('');

  const handleOptionClick = (value: string) => {
    if (value === 'cashout') {
      // Preencher com valor atual do cashout se existir
      setCashoutValue(currentCashoutValue ? String(currentCashoutValue) : '');
      setCashoutDialogOpen(true);
    } else {
      onResultChange(value);
    }
  };

  const handleCashoutConfirm = () => {
    const value = parseFloat(cashoutValue);
    if (!isNaN(value) && value >= 0) {
      onResultChange('cashout', value);
      setCashoutDialogOpen(false);
      setCashoutValue('');
    }
  };

  const getDisplayLabel = () => {
    if (currentResult === 'cashout' && currentCashoutValue !== undefined && currentCashoutValue !== null) {
      const diff = currentCashoutValue - valorApostado;
      const sign = diff >= 0 ? '+' : '';
      return `CO: ${sign}R$${formatCurrency(diff)}`;
    }
    return resultadoMap[currentResult]?.label || 'Definir';
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs gap-1 ${
              currentResult === 'cashout' 
                ? currentCashoutValue !== undefined && currentCashoutValue !== null && (currentCashoutValue - valorApostado) >= 0 
                  ? 'border-success text-success' 
                  : 'border-destructive text-destructive'
                : ''
            }`}
          >
            {getDisplayLabel()}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-background z-50">
          {/* Se já é cashout, mostrar opção de editar primeiro */}
          {currentResult === 'cashout' && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setCashoutValue(currentCashoutValue ? String(currentCashoutValue) : '');
                  setCashoutDialogOpen(true);
                }}
                className="font-medium"
              >
                ✏️ Editar Cashout
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {resultOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleOptionClick(option.value)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={cashoutDialogOpen} onOpenChange={setCashoutDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Valor do Cashout</DialogTitle>
            <DialogDescription>
              Informe o valor recebido no cashout para calcular o resultado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Valor Original Apostado */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor Apostado</span>
                <span className="text-base font-semibold">R$ {formatCurrency(valorApostado)}</span>
              </div>
            </div>

            {/* Input do Valor Recebido */}
            <div className="space-y-2">
              <Label htmlFor="cashout-value">Valor recebido no cashout</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="cashout-value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={cashoutValue}
                  onChange={(e) => setCashoutValue(e.target.value)}
                  autoFocus
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCashoutConfirm();
                    }
                  }}
                />
              </div>
            </div>

            {/* Resultado do Cashout */}
            {cashoutValue && !isNaN(parseFloat(cashoutValue)) && (
              <div className={`p-3 rounded-lg border ${
                parseFloat(cashoutValue) - valorApostado >= 0 
                  ? 'bg-success/10 border-success/30' 
                  : 'bg-destructive/10 border-destructive/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Resultado</span>
                  <span className={`text-base font-bold ${
                    parseFloat(cashoutValue) - valorApostado >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {parseFloat(cashoutValue) - valorApostado >= 0 ? '+' : ''}R$ {formatCurrency(parseFloat(cashoutValue) - valorApostado)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashoutDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCashoutConfirm}
              disabled={!cashoutValue || isNaN(parseFloat(cashoutValue)) || parseFloat(cashoutValue) < 0}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
