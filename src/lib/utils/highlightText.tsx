import React from 'react';

/**
 * Função para destacar texto encontrado na pesquisa com highlight amarelo
 */
export const highlightText = (text: string, search: string): React.ReactNode => {
  if (!search || !text) return text;
  
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-300 dark:bg-yellow-500/50 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
};
