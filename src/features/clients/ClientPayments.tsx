// Expandable down payment history section for client cards

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { DownPaymentWithDetails, CreateDownPaymentInput, Currency } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { downPaymentService } from '../../services';
import { Button, ConfirmDialog } from '../../components/ui';
import { PaymentForm } from './PaymentForm';
import { useUndoableAction } from '../../hooks/useUndoableAction';

interface ClientPaymentsProps {
  clientId: string;
  currency: Currency;
}

export function ClientPayments({ clientId, currency }: ClientPaymentsProps) {
  const [payments, setPayments] = useState<DownPaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<DownPaymentWithDetails | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<DownPaymentWithDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { execute: executeUndoable } = useUndoableAction();

  const loadPayments = async () => {
    try {
      const data = await downPaymentService.getByClientId(clientId);
      setPayments(data);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [clientId]);

  const totalDeposits = payments.reduce((sum, p) => sum + p.amount, 0);

  const handleCreate = async (data: CreateDownPaymentInput) => {
    setSubmitting(true);
    try {
      await downPaymentService.create(data);
      await loadPayments();
      setShowForm(false);
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (data: CreateDownPaymentInput) => {
    if (!editingPayment) return;
    setSubmitting(true);
    try {
      await downPaymentService.update(editingPayment.id, {
        projectId: data.projectId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        notes: data.notes,
      });
      await loadPayments();
      setEditingPayment(null);
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!deletingPayment) return;
    const paymentToDelete = deletingPayment;
    setDeletingPayment(null);

    setPayments((prev) => prev.filter((p) => p.id !== paymentToDelete.id));

    executeUndoable({
      message: `Pembayaran ${formatCurrency(paymentToDelete.amount, currency)} dihapus`,
      action: async () => {
        await downPaymentService.delete(paymentToDelete.id);
      },
      onUndo: () => {
        loadPayments();
      },
    });
  };

  if (loading) {
    return <div className='py-2 text-sm text-muted-foreground'>Memuat pembayaran...</div>;
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='text-sm text-muted-foreground'>
          {payments.length > 0 ? (
            <>
              <span className='font-medium text-foreground'>
                {formatCurrency(totalDeposits, currency)}
              </span>{' '}
              total deposit ({payments.length} pembayaran)
            </>
          ) : (
            'Belum ada pembayaran'
          )}
        </div>
        <Button size='sm' variant='outline' onClick={() => setShowForm(true)}>
          <Plus className='w-3.5 h-3.5' />
          Tambah
        </Button>
      </div>

      {payments.length > 0 && (
        <div className='space-y-1.5'>
          {payments.map((payment) => (
            <div
              key={payment.id}
              className='flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 group'
            >
              <div className='flex items-center gap-3 min-w-0 flex-1'>
                <span className='text-xs text-muted-foreground whitespace-nowrap'>
                  {formatDate(`${payment.paymentDate}T00:00:00`)}
                </span>
                <span className='text-sm font-medium text-foreground whitespace-nowrap'>
                  {formatCurrency(payment.amount, currency)}
                </span>
                {payment.projectName && (
                  <span className='text-xs text-muted-foreground truncate'>
                    {payment.projectName}
                  </span>
                )}
                {payment.notes && (
                  <span className='text-xs text-muted-foreground truncate hidden sm:inline'>
                    - {payment.notes}
                  </span>
                )}
              </div>
              <div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setEditingPayment(payment)}
                  aria-label='Ubah pembayaran'
                >
                  <Pencil className='w-3.5 h-3.5' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setDeletingPayment(payment)}
                  aria-label='Hapus pembayaran'
                >
                  <Trash2 className='w-3.5 h-3.5 text-destructive' />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaymentForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        clientId={clientId}
        loading={submitting}
      />

      {editingPayment && (
        <PaymentForm
          isOpen={true}
          onClose={() => setEditingPayment(null)}
          onSubmit={handleUpdate}
          clientId={clientId}
          initialData={editingPayment}
          loading={submitting}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingPayment}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDelete}
        title='Hapus pembayaran'
        message={`Hapus pembayaran ${deletingPayment ? formatCurrency(deletingPayment.amount, currency) : ''} tanggal ${deletingPayment ? formatDate(`${deletingPayment.paymentDate}T00:00:00`) : ''}?`}
        confirmLabel='Hapus'
        variant='danger'
        loading={submitting}
      />
    </div>
  );
}
