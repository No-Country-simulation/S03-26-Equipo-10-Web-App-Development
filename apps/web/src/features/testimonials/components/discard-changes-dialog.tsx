'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  creation = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  creation?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-none font-body">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {creation ? 'Descartar borrador' : 'Descartar cambios'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Los cambios que todavía no guardaste se perderán. Podés seguir
            editando para conservarlos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Seguir editando</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onDiscard}>
            {creation ? 'Descartar borrador' : 'Descartar cambios'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
