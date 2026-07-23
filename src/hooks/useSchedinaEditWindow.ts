import { useAppStore } from '@/store';
import { useToast } from '@/contexts/ToastContext';
import { vibrate } from '@/lib/juice';

/**
 * Finestra di modifica/annullamento di una schedina già inviata, condivisa da
 * SchedinaPage e PronosticiPage (che offrono la stessa azione su due schermate
 * diverse). Centralizzata perché le due pagine avevano ricopiato la stessa
 * logica con formule leggermente diverse per `canEdit`, rischiando di divergere.
 */
export function useSchedinaEditWindow() {
  const { currentMatchday, currentSchedina, unlockSchedina, cancelSchedina, isSubmitting } = useAppStore();
  const toast = useToast();

  const isDeadlinePassed = currentMatchday
    ? new Date().getTime() >= new Date(currentMatchday.deadline).getTime()
    : false;
  const isSubmitted = !!(currentSchedina?.isLocked || currentSchedina?.submittedAt);
  const canEdit = isSubmitted && !isDeadlinePassed;

  const handleEdit = () => {
    unlockSchedina();
    toast.info('Puoi modificare la schedina. Re-invia per confermare le modifiche.');
  };

  const handleCancel = async () => {
    await cancelSchedina();
    if (!useAppStore.getState().error) {
      vibrate([40, 20, 40]);
      toast.success('Schedina annullata con successo. Gettoni power-up rimborsati.');
    } else {
      toast.error(useAppStore.getState().error || 'Errore nell\'annullamento della schedina');
    }
  };

  return { isSubmitted, canEdit, isSubmitting, handleEdit, handleCancel };
}
