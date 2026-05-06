import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, FileText, Eye, Download, Trash2, Pencil } from 'lucide-react';
import type {
  InvoiceWithDetails,
  Client,
  AppSettings,
  Product,
  InvoiceStatus,
  Currency,
} from '../../types';
import { INVOICE_STATUS_OPTIONS, generateInvoiceNumber, calculateInvoiceTotals } from '../../types';
import {
  invoiceService,
  clientService,
  projectService,
  timeEntryService,
  settingsService,
  productService,
  downPaymentService,
} from '../../services';
import { invoiceLogger } from '../../lib/logger';
import { generateCSV, downloadCSV } from '../../lib/exportUtils';
import {
  formatCurrency as formatMoney,
  formatDate as formatAppDate,
  formatNumber,
} from '../../lib/formatters';
import { ListSkeleton } from '../../components/ui';
import { useUndoableAction } from '../../hooks/useUndoableAction';
import {
  Button,
  Card,
  EmptyState,
  ConfirmDialog,
  StatusBadge,
  Select,
  Modal,
  ModalFooter,
  Input,
  Textarea,
} from '../../components/ui';
import { QuerySelect } from './QuerySelect';
import { exportInvoicePdf } from './exportInvoicePdf';

function formatCurrency(amount: number, currency: Currency = 'IDR'): string {
  return formatMoney(amount, currency);
}

function getInvoiceStatusLabel(status: InvoiceStatus | string): string {
  return INVOICE_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

export function InvoicesList() {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [allInvoicesCount, setAllInvoicesCount] = useState(0); // Track total count for filter visibility
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceWithDetails | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithDetails | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceWithDetails | null>(null);

  const { execute: executeUndoable } = useUndoableAction();

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoicesData, clientsData, allInvoicesData] = await Promise.all([
        invoiceService.getAll(statusFilter || undefined),
        clientService.getAll(),
        // Always get total count to know if filter should be shown
        statusFilter ? invoiceService.getAll() : Promise.resolve([]),
      ]);
      setInvoices(invoicesData);
      setClients(clientsData);
      // Track total count: either from filtered or all data
      setAllInvoicesCount(statusFilter ? allInvoicesData.length : invoicesData.length);
    } catch (err) {
      invoiceLogger.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleDelete = () => {
    if (!deletingInvoice) return;
    const invoiceToDelete = deletingInvoice;
    setDeletingInvoice(null);

    setInvoices((prev) => prev.filter((i) => i.id !== invoiceToDelete.id));

    executeUndoable({
      message: `Invoice "${invoiceToDelete.invoiceNumber}" dihapus`,
      action: async () => {
        await invoiceService.delete(invoiceToDelete.id);
      },
      onUndo: () => {
        loadData();
      },
    });
  };

  const handleExportCSV = async () => {
    try {
      const headers = [
        'No. Invoice',
        'Klien',
        'Tanggal Invoice',
        'Jatuh Tempo',
        'Status',
        'Mata Uang',
        'Subtotal',
        'PPN',
        'Uang Muka',
        'Total',
      ];
      const rows = invoices.map((inv) => {
        const currency = clients.find((c) => c.id === inv.clientId)?.currency || 'IDR';
        return [
          inv.invoiceNumber,
          inv.clientName,
          formatAppDate(inv.issueDate),
          formatAppDate(inv.dueDate),
          getInvoiceStatusLabel(inv.status),
          currency,
          formatNumber(inv.subtotal, currency === 'IDR' ? 0 : 2),
          formatNumber(inv.taxAmount, currency === 'IDR' ? 0 : 2),
          formatNumber(inv.downPayment || 0, currency === 'IDR' ? 0 : 2),
          formatNumber(inv.total, currency === 'IDR' ? 0 : 2),
        ];
      });
      const csv = generateCSV(headers, rows);
      await downloadCSV(`invoice-${new Date().toISOString().split('T')[0]}.csv`, csv);
    } catch (error) {
      invoiceLogger.error('Failed to export CSV', error);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    try {
      await invoiceService.update(invoiceId, { status: newStatus });
      await loadData();
    } catch (error) {
      invoiceLogger.error('Failed to update invoice status:', error);
    }
  };

  const formatDate = (isoString: string) => {
    return formatAppDate(isoString);
  };

  const statusOptions = [
    { value: '', label: 'Semua Status' },
    ...INVOICE_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
  ];

  if (loading) {
    return <ListSkeleton />;
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-foreground'>Invoice</h1>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleExportCSV}
            disabled={invoices.length === 0}
          >
            <Download className='w-4 h-4' />
            Ekspor CSV
          </Button>
          <Button onClick={() => setShowCreate(true)} disabled={clients.length === 0}>
            <Plus className='w-4 h-4' />
            Invoice Baru
          </Button>
        </div>
      </div>

      {/* Filter - always show when there are any invoices or filter is active */}
      {(allInvoicesCount > 0 || statusFilter) && (
        <div className='w-48'>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
          />
        </div>
      )}

      {/* List */}
      {invoices.length === 0 && allInvoicesCount === 0 ? (
        <EmptyState
          icon={<FileText className='w-8 h-8' />}
          variant='guided'
          title='Belum ada invoice'
          description={
            clients.length === 0
              ? 'Buat klien terlebih dahulu untuk membuat invoice.'
              : 'Buat invoice pertama untuk mulai menagih.'
          }
          secondaryText={
            clients.length > 0
              ? 'Invoice membantu Anda menagih klien dari waktu yang sudah dicatat.'
              : undefined
          }
          action={
            clients.length > 0 ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className='w-4 h-4' />
                Buat Invoice
              </Button>
            ) : undefined
          }
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<Search className='w-8 h-8' />}
          variant='minimal'
          title='Tidak ada invoice yang cocok'
          description='Coba pilih filter status lain.'
          action={
            <Button variant='outline' onClick={() => setStatusFilter('')}>
              Hapus Filter
            </Button>
          }
        />
      ) : (
        <div className='space-y-3'>
          {invoices.map((invoice) => (
            <Card key={invoice.id} className='flex items-center gap-4 p-4'>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <span className='font-mono font-medium text-foreground'>
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <p className='text-sm text-muted-foreground truncate'>{invoice.clientName}</p>
              </div>

              {/* Status Dropdown */}
              <div className='min-w-[120px]'>
                <select
                  value={invoice.status}
                  onChange={(e) => handleStatusChange(invoice.id, e.target.value as InvoiceStatus)}
                  className='w-full h-8 px-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer'
                  style={{
                    color:
                      INVOICE_STATUS_OPTIONS.find((s) => s.value === invoice.status)?.color ||
                      'inherit',
                  }}
                >
                  {INVOICE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ color: option.color }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='text-right'>
                <p className='font-medium text-foreground'>
                  {formatCurrency(
                    invoice.total,
                    clients.find((c) => c.id === invoice.clientId)?.currency,
                  )}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Jatuh tempo {formatDate(invoice.dueDate)}
                </p>
              </div>

              <div className='flex items-center gap-1'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setEditingInvoice(invoice)}
                  aria-label='Ubah invoice'
                >
                  <Pencil className='w-4 h-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setViewingInvoice(invoice)}
                  aria-label='Lihat invoice'
                >
                  <Eye className='w-4 h-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setDeletingInvoice(invoice)}
                  aria-label='Hapus invoice'
                >
                  <Trash2 className='w-4 h-4 text-destructive' />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        clients={clients}
        onCreated={loadData}
      />

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <CreateInvoiceModal
          isOpen={true}
          onClose={() => setEditingInvoice(null)}
          clients={clients}
          onCreated={loadData}
          initialData={editingInvoice}
        />
      )}

      {/* Invoice Preview */}
      {viewingInvoice && (
        <InvoicePreview
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          clients={clients}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingInvoice}
        onClose={() => setDeletingInvoice(null)}
        onConfirm={handleDelete}
        title='Hapus Invoice'
        message={`Yakin ingin menghapus invoice ${deletingInvoice?.invoiceNumber}?`}
        confirmLabel='Hapus'
        variant='danger'
      />
    </div>
  );
}

// Create/Edit Invoice Modal Component
interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onCreated: () => void;
  initialData?: InvoiceWithDetails | null;
}

type DraftInvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  timeEntryIds?: string[];
};

function CreateInvoiceModal({
  isOpen,
  onClose,
  clients,
  onCreated,
  initialData,
}: CreateInvoiceModalProps) {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState('');
  const [lineItems, setLineItems] = useState<DraftInvoiceLineItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [saving, setSaving] = useState(false);

  // Reset form when opened and load settings or initial data
  useEffect(() => {
    if (isOpen) {
      setStep(1);

      if (initialData) {
        // Editing mode
        setClientId(initialData.clientId);
        setLineItems(
          initialData.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
          })),
        );
        setIssueDate(initialData.issueDate);
        setDueDate(initialData.dueDate);
        setNotes(initialData.notes || '');
        setTaxRate(initialData.taxRate * 100);
        setDownPayment(initialData.downPayment || 0);
        // Load payment terms from settings for existing invoices
        settingsService
          .load()
          .then((settings) => {
            setPaymentTerms(settings.paymentTerms || '');
          })
          .catch((err) => invoiceLogger.error('Failed to load settings:', err));
      } else {
        // Creation mode
        setClientId('');
        setLineItems([]);

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const due = new Date(today);
        due.setDate(due.getDate() + 30);
        const dueStr = due.toISOString().split('T')[0];

        setIssueDate(todayStr);
        setDueDate(dueStr);
        setNotes('');
        setDownPayment(0);

        // Load default options from settings
        settingsService
          .load()
          .then((settings) => {
            if (settings.defaultTaxRate !== undefined) {
              setTaxRate(settings.defaultTaxRate * 100);
            } else {
              setTaxRate(0);
            }
            setPaymentTerms(settings.paymentTerms || '');
          })
          .catch((err) => invoiceLogger.error('Failed to load settings:', err));
      }
    }
  }, [isOpen, initialData]);

  // Load products
  useEffect(() => {
    if (isOpen) {
      productService
        .getAll()
        .then(setProducts)
        .catch((err) => invoiceLogger.error('Failed to load products:', err));
    }
  }, [isOpen]);

  const handleLoadHours = async () => {
    if (!clientId) return;

    invoiceLogger.info('handleLoadHours called', { clientId });

    // Get projects for this client
    const projects = await projectService.getByClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    const hourlyRate = client?.hourlyRate || 0;

    const items: typeof lineItems = [];

    for (const project of projects) {
      const unbilled = await timeEntryService.getUnbilledByProject(project.id);
      if (unbilled.length === 0) continue;

      const entryIds: string[] = [];
      unbilled.forEach((e) => entryIds.push(e.id));

      const totalSeconds = unbilled.reduce((sum, entry) => {
        if (!entry.endTime) return sum;
        const duration =
          (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 1000 -
          entry.pauseDuration;
        return sum + Math.max(0, duration);
      }, 0);

      const hours = totalSeconds / 3600;

      if (hours > 0) {
        const formattedHours = formatNumber(hours, 2);
        items.push({
          description: `${project.name} - ${formattedHours} jam`,
          quantity: parseFloat(hours.toFixed(2)),
          unitPrice: hourlyRate,
          discount: 0,
          timeEntryIds: entryIds,
        });
      }
    }

    if (items.length > 0) {
      // Append to existing items if editing, or replace if empty
      if (lineItems.length > 0 && (lineItems.length > 1 || lineItems[0].description !== '')) {
        setLineItems([...lineItems, ...items]);
      } else {
        setLineItems(items);
      }
    } else if (lineItems.length === 0) {
      setLineItems([{ description: '', quantity: 1, unitPrice: 0, discount: 0 }]);
    }
  };

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, discount: 0 }]);
  };

  const handleAddProductLine = (product: Product) => {
    setLineItems([
      ...lineItems,
      {
        description: product.name + (product.description ? ` - ${product.description}` : ''),
        quantity: 1,
        unitPrice: product.price,
        discount: 0,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    (updated[index] as unknown as Record<string, string | number | undefined>)[field] = value;
    setLineItems(updated);
  };

  const totals = useMemo(
    () =>
      calculateInvoiceTotals(
        lineItems.map((item) => ({ ...item, id: '', invoiceId: '' })),
        taxRate / 100,
        downPayment,
      ),
    [lineItems, taxRate, downPayment],
  );

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Prepare line items for saving (strip timeEntryIds)
      const lineItemsToSave = lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
      }));

      // Collect IDs to mark as billed from the remaining line items
      const idsToMarkBilled = lineItems.reduce<string[]>((acc, item) => {
        if (item.timeEntryIds) {
          return [...acc, ...item.timeEntryIds];
        }
        return acc;
      }, []);

      if (initialData) {
        // Update
        await invoiceService.update(initialData.id, {
          invoiceNumber: initialData.invoiceNumber, // Keep existing number
          issueDate,
          dueDate,
          status: initialData.status, // Keep existing status or allow change? Usually keep for edits unless explicit.
          notes,
          taxRate: taxRate / 100,
          downPayment,
        });

        await invoiceService.replaceLineItems(
          initialData.id,
          lineItemsToSave.map((item) => ({
            ...item,
            invoiceId: initialData.id,
          })),
        );
      } else {
        // Create
        const allInvoices = await invoiceService.getAllForNumbering();
        const invoiceNumber = generateInvoiceNumber(allInvoices);

        await invoiceService.create(
          {
            clientId,
            invoiceNumber,
            issueDate,
            dueDate,
            status: 'draft',
            notes,
            taxRate: taxRate / 100,
            downPayment,
          },
          lineItemsToSave.map((item) => ({
            invoiceId: '',
            ...item,
          })),
        );
      }

      // Mark entries as billed if any were linked to the submitted line items
      if (idsToMarkBilled.length > 0) {
        await timeEntryService.markAsBilled(idsToMarkBilled);
      }

      onCreated();
      onClose();
    } catch (err) {
      invoiceLogger.error('Failed to save invoice:', err);
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Ubah Invoice' : 'Buat Invoice'}
      size='xl'
    >
      {step === 1 && (
        <div className='space-y-4'>
          <Select
            label='Klien *'
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            options={clientOptions}
            placeholder='Pilih klien...'
            disabled={!!initialData} // Lock client on edit
          />

          <ModalFooter>
            <Button variant='outline' onClick={onClose}>
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!initialData) {
                  handleLoadHours();
                  // Auto-populate down payment from client's deposit ledger
                  try {
                    const total = await downPaymentService.getTotalByClientId(clientId);
                    if (total > 0) setDownPayment(total);
                  } catch (err) {
                    invoiceLogger.error('Failed to load client deposits:', err);
                  }
                }
                setStep(2);
              }}
              disabled={!clientId}
            >
              Berikutnya: Item Tagihan
            </Button>
          </ModalFooter>
        </div>
      )}

      {step === 2 && (
        <div className='space-y-4'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Item Tagihan</label>
            {lineItems.map((item, index) => (
              <div
                key={index}
                className='grid grid-cols-[minmax(0,1fr)_5rem_6rem_6rem_2.5rem] gap-2 items-start'
              >
                <Input
                  placeholder='Deskripsi'
                  value={item.description}
                  onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                  className='flex-1'
                />
                <Input
                  type='number'
                  placeholder='Jumlah'
                  value={item.quantity || ''}
                  onChange={(e) =>
                    handleLineItemChange(
                      index,
                      'quantity',
                      e.target.value === '' ? 0 : parseFloat(e.target.value),
                    )
                  }
                  className='w-20'
                  min={0}
                  step={0.01}
                />
                <Input
                  type='number'
                  placeholder='Harga'
                  value={item.unitPrice || ''}
                  onChange={(e) =>
                    handleLineItemChange(
                      index,
                      'unitPrice',
                      e.target.value === '' ? 0 : parseFloat(e.target.value),
                    )
                  }
                  className='w-24'
                  min={0}
                  step={0.01}
                />
                <Input
                  type='number'
                  placeholder='Diskon'
                  value={item.discount || ''}
                  onChange={(e) =>
                    handleLineItemChange(
                      index,
                      'discount',
                      e.target.value === '' ? 0 : parseFloat(e.target.value),
                    )
                  }
                  className='w-24'
                  min={0}
                  step={0.01}
                />
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => handleRemoveLineItem(index)}
                  disabled={lineItems.length === 1}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button variant='outline' size='sm' onClick={handleAddLineItem}>
              + Tambah Baris
            </Button>
            <div className='inline-block relative ml-2'>
              <QuerySelect products={products} onSelect={handleAddProductLine} />
            </div>
            {!initialData && (
              <Button variant='ghost' size='sm' onClick={handleLoadHours} className='ml-2'>
                Muat Ulang Jam
              </Button>
            )}
          </div>

          {/* Down Payment */}
          <div className='pt-4 border-t border-border'>
            <Input
              label='Uang Muka'
              type='number'
              value={downPayment || ''}
              onChange={(e) =>
                setDownPayment(e.target.value === '' ? 0 : parseFloat(e.target.value))
              }
              min={0}
              step={0.01}
              helperText='Nominal yang sudah dibayar di awal dan akan mengurangi total tagihan'
            />
          </div>

          <ModalFooter>
            <Button variant='outline' onClick={() => setStep(1)}>
              Kembali
            </Button>
            <Button onClick={() => setStep(3)} disabled={lineItems.length === 0}>
              Berikutnya: Detail
            </Button>
          </ModalFooter>
        </div>
      )}

      {step === 3 && (
        <div className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <Input
              label='Tanggal Invoice'
              type='date'
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
            <Input
              label='Jatuh Tempo'
              type='date'
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <Input
            label='PPN (%)'
            type='number'
            value={taxRate || ''}
            onChange={(e) => setTaxRate(e.target.value === '' ? 0 : parseFloat(e.target.value))}
            min={0}
            max={100}
            step={0.1}
          />

          <Textarea
            label='Catatan'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='Catatan tambahan untuk invoice...'
            rows={2}
          />

          <Textarea
            label='Syarat Pembayaran'
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder='Masukkan syarat pembayaran (terisi dari pengaturan)...'
            rows={2}
            helperText='Ubah syarat pembayaran khusus untuk invoice ini'
          />

          <div className='p-4 bg-secondary rounded-lg'>
            <div className='flex justify-between text-sm'>
              <span>Subtotal:</span>
              <span>
                {formatCurrency(totals.subtotal, clients.find((c) => c.id === clientId)?.currency)}
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span>PPN ({taxRate}%):</span>
              <span>
                {formatCurrency(totals.taxAmount, clients.find((c) => c.id === clientId)?.currency)}
              </span>
            </div>
            {downPayment > 0 && (
              <div className='flex justify-between text-sm text-green-600 dark:text-green-400'>
                <span>Uang Muka:</span>
                <span>
                  -{formatCurrency(downPayment, clients.find((c) => c.id === clientId)?.currency)}
                </span>
              </div>
            )}
            <div className='flex justify-between font-bold text-base text-primary mt-2 pt-2 border-t border-border'>
              <span>{downPayment > 0 ? 'Sisa Tagihan:' : 'Total:'}</span>
              <span>
                {formatCurrency(totals.total, clients.find((c) => c.id === clientId)?.currency)}
              </span>
            </div>
          </div>

          <ModalFooter>
            <Button variant='outline' onClick={() => setStep(2)}>
              Kembali
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {initialData ? 'Simpan Perubahan' : 'Buat Invoice'}
            </Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  );
}

// Invoice Preview Component
interface InvoicePreviewProps {
  invoice: InvoiceWithDetails;
  onClose: () => void;
  clients: Client[];
}

function InvoicePreview({ invoice, onClose, clients }: InvoicePreviewProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    settingsService
      .load()
      .then(setSettings)
      .catch((err) => invoiceLogger.error('Failed to load settings for preview:', err));
  }, []);

  const formatDate = (isoString: string) => {
    try {
      return formatAppDate(isoString);
    } catch {
      return '';
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);

    try {
      const filePath = await exportInvoicePdf({ invoice, clients, settings });
      if (filePath) {
        alert(`Invoice disimpan di:\n${filePath}`);
      }
    } catch (error) {
      invoiceLogger.error('Failed to export PDF:', error);
      alert(`Gagal mengekspor PDF: ${(error as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const invoiceCurrency = clients.find((c) => c.id === invoice.clientId)?.currency;

  return (
    <Modal isOpen={true} onClose={onClose} title={invoice.invoiceNumber} size='lg'>
      <div className='min-w-0 space-y-4 text-sm'>
        {/* Business Header */}
        {settings && (settings.businessName || settings.businessLogo) && (
          <div className='pb-4 border-b border-border'>
            <div className='flex items-start gap-4 min-w-0'>
              {settings.businessLogo && (
                <img
                  src={settings.businessLogo}
                  alt='Logo bisnis'
                  className='w-16 h-16 object-contain shrink-0'
                />
              )}
              <div className='min-w-0 flex-1'>
                {settings.businessName && (
                  <p className='font-bold text-lg text-foreground break-words'>
                    {settings.businessName}
                  </p>
                )}
                {settings.businessAddress && (
                  <p className='text-muted-foreground whitespace-pre-wrap break-words text-xs'>
                    {settings.businessAddress}
                  </p>
                )}
                {settings.businessEmail && (
                  <p className='text-muted-foreground text-xs break-words'>{settings.businessEmail}</p>
                )}
                {settings.businessPhone && (
                  <p className='text-muted-foreground text-xs break-words'>{settings.businessPhone}</p>
                )}
                {settings.businessVatNumber && (
                  <p className='text-muted-foreground text-xs break-words'>
                    NPWP: {settings.businessVatNumber}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Info Row */}
        <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-6'>
          <div className='min-w-0'>
            <p className='font-medium text-foreground'>Tagih ke:</p>
            <p className='text-muted-foreground break-words'>{invoice.clientName}</p>
            {invoice.clientAddress && (
              <p className='text-muted-foreground whitespace-pre-wrap break-words'>
                {invoice.clientAddress}
              </p>
            )}
            {invoice.clientVatNumber && (
              <p className='text-muted-foreground break-words'>NPWP: {invoice.clientVatNumber}</p>
            )}
          </div>
          <div className='text-right shrink-0'>
            <p className='font-semibold text-foreground'>{invoice.invoiceNumber}</p>
            <p className='text-muted-foreground'>Tanggal: {formatDate(invoice.issueDate)}</p>
            <div className='mt-2'>
              <StatusBadge status={invoice.status} />
            </div>
            <p className='text-muted-foreground'>Jatuh Tempo: {formatDate(invoice.dueDate)}</p>
          </div>
        </div>

        {/* Line Items */}
        <table className='w-full table-fixed'>
          <thead>
            <tr className='border-b border-border text-left'>
              <th className='w-10 py-2 pr-2 align-top'>No</th>
              <th className='py-2 pr-3 align-top'>Deskripsi</th>
              <th className='w-16 py-2 pl-2 text-right align-top'>Qty</th>
              <th className='w-24 py-2 pl-2 text-right align-top'>Harga</th>
              <th className='w-24 py-2 pl-2 text-right align-top'>Diskon</th>
              <th className='w-24 py-2 pl-2 text-right align-top'>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item, index) => {
              const discountAmount = item.discount || 0;
              const lineTotal = Math.max(0, item.quantity * item.unitPrice - discountAmount);

              return (
                <tr key={item.id} className='border-b border-border'>
                  <td className='py-2 pr-2 align-top'>{index + 1}</td>
                  <td className='py-2 pr-3 align-top whitespace-pre-wrap break-words'>
                    {item.description || '-'}
                  </td>
                  <td className='py-2 pl-2 text-right align-top whitespace-nowrap'>
                    {formatNumber(item.quantity, 2)}
                  </td>
                  <td className='py-2 pl-2 text-right align-top whitespace-nowrap'>
                    {formatCurrency(item.unitPrice, invoiceCurrency)}
                  </td>
                  <td className='py-2 pl-2 text-right align-top whitespace-nowrap'>
                    {discountAmount > 0
                      ? `-${formatCurrency(discountAmount, invoiceCurrency)}`
                      : formatCurrency(0, invoiceCurrency)}
                  </td>
                  <td className='py-2 pl-2 text-right align-top whitespace-nowrap'>
                    {formatCurrency(lineTotal, invoiceCurrency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className='flex justify-end'>
          <div className='w-64 max-w-full'>
            <div className='flex justify-between py-1'>
              <span>Subtotal:</span>
              <span className='text-right'>{formatCurrency(invoice.subtotal, invoiceCurrency)}</span>
            </div>
            <div className='flex justify-between py-1'>
              <span>PPN ({formatNumber(invoice.taxRate * 100, 1)}%):</span>
              <span className='text-right'>{formatCurrency(invoice.taxAmount, invoiceCurrency)}</span>
            </div>
            {invoice.downPayment > 0 && (
              <div className='flex justify-between py-1 text-green-600 dark:text-green-400'>
                <span>Uang Muka:</span>
                <span className='text-right'>
                  -{formatCurrency(invoice.downPayment, invoiceCurrency)}
                </span>
              </div>
            )}
            <div className='flex justify-between py-2 border-t border-border font-bold text-base text-primary'>
              <span>{invoice.downPayment > 0 ? 'Sisa Tagihan:' : 'Total:'}</span>
              <span className='text-right'>{formatCurrency(invoice.total, invoiceCurrency)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className='pt-4 border-t border-border'>
            <p className='font-medium'>Catatan:</p>
            <p className='text-muted-foreground whitespace-pre-wrap break-words'>{invoice.notes}</p>
          </div>
        )}

        {settings?.paymentTerms && (
          <div className='pt-4 border-t border-border'>
            <p className='font-medium'>Syarat Pembayaran:</p>
            <p className='text-muted-foreground whitespace-pre-wrap break-words'>
              {settings.paymentTerms}
            </p>
          </div>
        )}

        {settings?.paymentLink && (
          <div className='pt-4 border-t border-border'>
            <p className='font-medium'>Tautan Pembayaran 1:</p>
            <a
              href={settings.paymentLink}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline break-all block'
            >
              {settings.paymentLink}
            </a>
          </div>
        )}

        {settings?.paymentLink2 && (
          <div className='pt-2'>
            <p className='font-medium'>Tautan Pembayaran 2:</p>
            <a
              href={settings.paymentLink2}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline break-all block'
            >
              {settings.paymentLink2}
            </a>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant='outline' onClick={onClose}>
          Tutup
        </Button>
        <Button onClick={handleExportPDF} loading={exporting}>
          <Download className='w-4 h-4' />
          Ekspor PDF
        </Button>
      </ModalFooter>
    </Modal>
  );
}
