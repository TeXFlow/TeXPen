import { useState, MouseEvent } from 'react';

export const useHistorySidebar = (onDelete: (id: string) => void) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sanitizeLatex = (text: string) => {
    return text
      .replace(/\\\[/g, '')
      .replace(/\\\]/g, '')
      .replace(/\\\(/g, '')
      .replace(/\\\)/g, '')
      .replace(/\$\$/g, '')
      .replace(/^\$|\$$/g, '')
      .trim();
  };

  const handleDeleteClick = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleConfirm = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
    setConfirmDeleteId(null);
  };

  const handleCancel = (e: MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  return {
    confirmDeleteId,
    sanitizeLatex,
    handleDeleteClick,
    handleConfirm,
    handleCancel
  };
};
