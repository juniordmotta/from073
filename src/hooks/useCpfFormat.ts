import { useState } from 'react';

export function useCpfFormat(initialValue: string = '') {
  const [value, setValue] = useState(formatCpf(initialValue));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const formatted = formatCpf(rawValue);
    setValue(formatted);
    return formatted;
  };

  return { value, setValue, handleChange };
}

export function formatCpf(value: string): string {
  // Remove tudo que não é dígito
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 11 dígitos
  const limited = numbers.slice(0, 11);
  
  // Aplica a máscara XXX.XXX.XXX-XX
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 6) {
    return `${limited.slice(0, 3)}.${limited.slice(3)}`;
  } else if (limited.length <= 9) {
    return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
  } else {
    return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
  }
}

export function unformatCpf(value: string): string {
  return value.replace(/\D/g, '');
}
