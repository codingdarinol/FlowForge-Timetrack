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
        'Pajak',
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

function CreateInvoiceModal({
  isOpen,
  onClose,
  clients,
  onCreated,
  initialData,
}: CreateInvoiceModalProps) {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState('');
  const [lineItems, setLineItems] = useState<
    { description: string; quantity: number; unitPrice: number; timeEntryIds?: string[] }[]
  >([]);
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
      setLineItems([{ description: '', quantity: 1, unitPrice: 0 }]);
    }
  };

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleAddProductLine = (product: Product) => {
    setLineItems([
      ...lineItems,
      {
        description: product.name + (product.description ? ` - ${product.description}` : ''),
        quantity: 1,
        unitPrice: product.price,
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
      const lineItemsToSave = lineItems.map(({ ...item }) => item);

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
              <div key={index} className='flex gap-2 items-start'>
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
            label='Pajak (%)'
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
              <span>Pajak ({taxRate}%):</span>
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
            <div className='flex justify-between font-medium mt-2 pt-2 border-t border-border'>
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
    invoiceLogger.info('Exporting invoice to PDF', { invoiceNumber: invoice.invoiceNumber });
    setExporting(true);

    try {
      const { jsPDF } = await import('jspdf');

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const MARGIN = 15;
      const CONTENT_WIDTH = pageWidth - MARGIN * 2;
      const MARGIN_BOTTOM = 30;
      let y = 20;

      // Color constants
      const TEAL: [number, number, number] = [13, 148, 136];
      const GRAY_TEXT: [number, number, number] = [107, 114, 128];
      const GRAY_BG: [number, number, number] = [243, 244, 246];
      const BLACK: [number, number, number] = [0, 0, 0];
      const WHITE: [number, number, number] = [255, 255, 255];

      const invoiceCurrency = clients.find((c) => c.id === invoice.clientId)?.currency || 'IDR';
      const formatInvoiceMoney = (amount: number) => formatCurrency(amount, invoiceCurrency);

      const checkPageBreak = (currentY: number, requiredSpace: number): number => {
        if (currentY + requiredSpace > pageHeight - MARGIN_BOTTOM) {
          doc.addPage();
          return 20;
        }
        return currentY;
      };

      // === HEADER: Logo (left) + title (right) ===
      let headerRightY = y;
      if (settings?.businessLogo) {
        try {
          doc.addImage(settings.businessLogo, 'PNG', MARGIN, y, 40, 20);
        } catch (e) {
          invoiceLogger.warn('Failed to add logo to PDF', { error: e });
        }
      }
      // Invoice title (right-aligned, teal)
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEAL);
      doc.text('INVOICE', pageWidth - MARGIN, headerRightY + 8, { align: 'right' });
      // Invoice number below title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY_TEXT);
      doc.text(`#${invoice.invoiceNumber}`, pageWidth - MARGIN, headerRightY + 16, {
        align: 'right',
      });

      y = Math.max(y + 25, headerRightY + 22);

      // === TEAL DIVIDER LINE ===
      doc.setDrawColor(...TEAL);
      doc.setLineWidth(0.8);
      doc.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 10;

      // === FROM / BILL TO (side by side) ===
      const halfWidth = CONTENT_WIDTH / 2 - 5;
      const fromX = MARGIN;
      const billToX = MARGIN + halfWidth + 10;

      // FROM label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEAL);
      doc.text('DARI', fromX, y);

      // BILL TO label
      doc.text('TAGIH KE', billToX, y);
      y += 5;

      // FROM details
      let fromY = y;
      doc.setTextColor(...BLACK);
      doc.setFontSize(10);
      if (settings?.businessName) {
        doc.setFont('helvetica', 'bold');
        doc.text(settings.businessName, fromX, fromY);
        fromY += 5;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (settings?.businessTagline) {
        doc.setTextColor(...GRAY_TEXT);
        doc.text(settings.businessTagline, fromX, fromY);
        fromY += 4;
      }
      doc.setTextColor(...BLACK);
      if (settings?.businessWebsite) {
        doc.text(settings.businessWebsite, fromX, fromY);
        fromY += 4;
      }
      if (settings?.businessEmail) {
        doc.text(settings.businessEmail, fromX, fromY);
        fromY += 4;
      }
      if (settings?.businessPhone) {
        doc.text(settings.businessPhone, fromX, fromY);
        fromY += 4;
      }
      if (settings?.businessAddress) {
        const lines = settings.businessAddress.split('\n');
        lines.forEach((line) => {
          doc.text(line, fromX, fromY);
          fromY += 4;
        });
      }
      if (settings?.businessVatNumber) {
        doc.text(`NPWP: ${settings.businessVatNumber}`, fromX, fromY);
        fromY += 4;
      }

      // BILL TO details
      let billY = y;
      doc.setTextColor(...BLACK);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(invoice.clientName, billToX, billY);
      billY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (invoice.clientAddress) {
        const lines = invoice.clientAddress.split('\n');
        lines.forEach((line) => {
          doc.text(line, billToX, billY);
          billY += 4;
        });
      }
      if (invoice.clientEmail) {
        doc.text(invoice.clientEmail, billToX, billY);
        billY += 4;
      }
      if (invoice.clientPhone) {
        doc.text(invoice.clientPhone, billToX, billY);
        billY += 4;
      }
      if (invoice.clientVatNumber) {
        doc.text(`NPWP: ${invoice.clientVatNumber}`, billToX, billY);
        billY += 4;
      }

      y = Math.max(fromY, billY) + 10;

      // === DATE BAR (light gray background) ===
      y = checkPageBreak(y, 16);
      doc.setFillColor(...GRAY_BG);
      doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 12, 'F');

      // Calculate due date
      let displayDueDate = formatDate(invoice.dueDate);
      if (!displayDueDate && invoice.issueDate) {
        const issueDate = new Date(invoice.issueDate);
        const dueDate = new Date(issueDate);
        dueDate.setDate(issueDate.getDate() + 30);
        displayDueDate = formatDate(dueDate.toISOString());
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRAY_TEXT);
      const thirdWidth = CONTENT_WIDTH / 3;
      doc.text(`Tanggal Invoice: ${formatDate(invoice.issueDate)}`, MARGIN + 4, y + 2);
      doc.text(`Tanggal Layanan: ${formatDate(invoice.issueDate)}`, MARGIN + thirdWidth + 4, y + 2);
      doc.text(`Jatuh Tempo: ${displayDueDate}`, MARGIN + thirdWidth * 2 + 4, y + 2);
      y += 14;

      // === LINE ITEMS TABLE ===
      y = checkPageBreak(y, 20);

      // Table header (teal background)
      const colDesc = MARGIN;
      const colRate = pageWidth - MARGIN - 90;
      const colQty = pageWidth - MARGIN - 50;
      const colAmount = pageWidth - MARGIN;

      const drawTableHeader = (atY: number): number => {
        doc.setFillColor(...TEAL);
        doc.rect(MARGIN, atY - 5, CONTENT_WIDTH, 10, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...WHITE);
        doc.text('DESKRIPSI', colDesc + 4, atY);
        doc.text('HARGA', colRate, atY, { align: 'right' });
        doc.text('JML', colQty + 8, atY, { align: 'right' });
        doc.text('JUMLAH', colAmount, atY, { align: 'right' });
        return atY + 8;
      };

      y = drawTableHeader(y);

      // Table body
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BLACK);
      invoice.lineItems.forEach((item, index) => {
        const prevY = y;
        y = checkPageBreak(y, 8);
        if (y < prevY) {
          y = drawTableHeader(y);
        }

        // Alternating background
        if (index % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, 'F');
        }

        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
        const descText = doc.splitTextToSize(item.description, colRate - colDesc - 20);
        doc.text(descText[0] || item.description.substring(0, 50), colDesc + 4, y);
        doc.text(formatInvoiceMoney(item.unitPrice), colRate, y, { align: 'right' });
        doc.text(formatNumber(item.quantity, 2), colQty + 8, y, { align: 'right' });
        doc.text(formatInvoiceMoney(item.quantity * item.unitPrice), colAmount, y, {
          align: 'right',
        });
        y += 7;
      });

      // Separator line below items
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 8;

      // === TOTALS (right-aligned) ===
      y = checkPageBreak(y, 30);
      const totalsX = pageWidth - MARGIN - 60;
      const totalsValX = pageWidth - MARGIN;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY_TEXT);
      doc.text('Subtotal', totalsX, y);
      doc.setTextColor(...BLACK);
      doc.text(formatInvoiceMoney(invoice.subtotal), totalsValX, y, { align: 'right' });
      y += 6;

      if (invoice.taxRate > 0) {
        doc.setTextColor(...GRAY_TEXT);
        doc.text(`Pajak (${formatNumber(invoice.taxRate * 100, 1)}%)`, totalsX, y);
        doc.setTextColor(...BLACK);
        doc.text(formatInvoiceMoney(invoice.taxAmount), totalsValX, y, { align: 'right' });
        y += 8;
      }

      if (invoice.downPayment > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY_TEXT);
        doc.text('Uang Muka', totalsX, y);
        doc.setTextColor(22, 163, 74); // green-600
        doc.text(`-${formatInvoiceMoney(invoice.downPayment)}`, totalsValX, y, { align: 'right' });
        doc.setTextColor(...BLACK);
        y += 8;
      }

      // Total due (teal, bold, larger)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEAL);
      doc.text(invoice.downPayment > 0 ? 'Sisa Tagihan' : 'Total Tagihan', totalsX, y);
      doc.text(formatInvoiceMoney(invoice.total), totalsValX, y, { align: 'right' });
      doc.setTextColor(...BLACK);
      y += 15;

      // === NOTES ===
      if (invoice.notes) {
        y = checkPageBreak(y, 20);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...TEAL);
        doc.text('CATATAN', MARGIN, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
        const noteLines = doc.splitTextToSize(invoice.notes, CONTENT_WIDTH);
        doc.text(noteLines, MARGIN, y);
        y += noteLines.length * 4 + 8;
      }

      // === PAYMENT DETAILS BOX ===
      y = checkPageBreak(y, 60);
      const boxY = y;
      const boxPadding = 8;

      // Calculate box height dynamically
      let paymentContentHeight = 10; // header
      if (settings?.paymentTerms) {
        const termLines = doc.splitTextToSize(
          settings.paymentTerms,
          settings?.paymentQrCode ? CONTENT_WIDTH - 55 : CONTENT_WIDTH - boxPadding * 2,
        );
        paymentContentHeight += termLines.length * 4 + 4;
      }
      if (settings?.paymentBankDetails) {
        const bankLines = doc.splitTextToSize(
          settings.paymentBankDetails,
          settings?.paymentQrCode ? CONTENT_WIDTH - 55 : CONTENT_WIDTH - boxPadding * 2,
        );
        paymentContentHeight += bankLines.length * 4 + 8;
      }
      if (settings?.paymentLink || settings?.paymentLink2) paymentContentHeight += 12;
      paymentContentHeight += 8; // Invoice ref line
      const qrHeight = settings?.paymentQrCode ? 45 : 0;
      const boxHeight = Math.max(
        paymentContentHeight + boxPadding * 2,
        qrHeight + boxPadding * 2 + 10,
      );

      // Box border (rounded corners via rect)
      doc.setDrawColor(...TEAL);
      doc.setLineWidth(0.5);
      doc.roundedRect(MARGIN, boxY, CONTENT_WIDTH, boxHeight, 3, 3, 'S');

      // PAYMENT DETAILS header
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEAL);
      doc.text('DETAIL PEMBAYARAN', MARGIN + boxPadding, boxY + boxPadding + 3);
      let payY = boxY + boxPadding + 10;

      // QR Code (left side if present)
      const textStartX = settings?.paymentQrCode ? MARGIN + boxPadding + 48 : MARGIN + boxPadding;

      if (settings?.paymentQrCode) {
        try {
          doc.addImage(settings.paymentQrCode, 'PNG', MARGIN + boxPadding, payY - 2, 40, 40);
        } catch (e) {
          invoiceLogger.warn('Failed to add QR code to PDF', { error: e });
        }
      }

      // Payment text (right of QR or full width)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...BLACK);
      const textWidth = settings?.paymentQrCode
        ? CONTENT_WIDTH - 55 - boxPadding
        : CONTENT_WIDTH - boxPadding * 2;

      if (settings?.paymentTerms) {
        const termLines = doc.splitTextToSize(settings.paymentTerms, textWidth);
        doc.text(termLines, textStartX, payY);
        payY += termLines.length * 4 + 4;
      }

      if (settings?.paymentBankDetails) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Transfer Bank:', textStartX, payY);
        payY += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const bankLines = doc.splitTextToSize(settings.paymentBankDetails, textWidth);
        doc.text(bankLines, textStartX, payY);
        payY += bankLines.length * 4 + 4;
      }

      // Payment links
      if (settings?.paymentLink) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(settings.paymentLinkTitle || 'Tautan Pembayaran:', textStartX, payY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 238);
        doc.textWithLink(
          settings.paymentLink,
          textStartX + doc.getTextWidth((settings.paymentLinkTitle || 'Tautan Pembayaran:') + ' '),
          payY,
          { url: settings.paymentLink },
        );
        doc.setTextColor(...BLACK);
        payY += 5;
      }
      if (settings?.paymentLink2) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(settings.paymentLink2Title || 'Tautan Pembayaran 2:', textStartX, payY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 238);
        doc.textWithLink(
          settings.paymentLink2,
          textStartX +
            doc.getTextWidth((settings.paymentLink2Title || 'Tautan Pembayaran 2:') + ' '),
          payY,
          { url: settings.paymentLink2 },
        );
        doc.setTextColor(...BLACK);
        payY += 5;
      }

      // Invoice reference
      doc.setFontSize(8);
      doc.setTextColor(...GRAY_TEXT);
      doc.text(`Referensi: ${invoice.invoiceNumber}`, textStartX, payY + 2);

      y = boxY + boxHeight + 10;

      // === FOOTER (on every page) ===
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Thin separator
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, pageHeight - 18, pageWidth - MARGIN, pageHeight - 18);

        // Footer text
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_TEXT);
        const footerParts: string[] = [];
        if (settings?.businessName) footerParts.push(settings.businessName);
        if (settings?.businessTagline) footerParts.push(settings.businessTagline);
        if (settings?.businessWebsite) footerParts.push(settings.businessWebsite);
        if (settings?.businessEmail) footerParts.push(settings.businessEmail);
        const footerText = footerParts.join(' • ') || 'Dibuat dengan yuk-kerja';
        doc.text(footerText, pageWidth / 2, pageHeight - 12, { align: 'center' });

        // Page number
        if (totalPages > 1) {
          doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - MARGIN, pageHeight - 12, {
            align: 'right',
          });
        }

        doc.setTextColor(...BLACK);
      }

      // Get PDF as bytes
      const pdfOutput = doc.output('arraybuffer');

      // Check if we're in Tauri environment
      const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;

      if (isTauri) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');

        invoiceLogger.debug('Opening save dialog...');
        const filePath = await save({
          defaultPath: `${invoice.invoiceNumber}.pdf`,
          filters: [{ name: 'File PDF', extensions: ['pdf'] }],
        });

        invoiceLogger.debug('Save dialog returned', { filePath });

        if (filePath) {
          invoiceLogger.debug('Writing file...', { path: filePath, size: pdfOutput.byteLength });
          try {
            await writeFile(filePath, new Uint8Array(pdfOutput));
            invoiceLogger.info('PDF saved successfully', { path: filePath });
            alert(`Invoice disimpan di:\n${filePath}`);
          } catch (writeError) {
            invoiceLogger.error('writeFile failed', writeError);
            throw writeError;
          }
        } else {
          invoiceLogger.info('Save dialog cancelled');
        }
      } else {
        invoiceLogger.info('Not in Tauri environment, using browser download');
        const blob = new Blob([pdfOutput], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      invoiceLogger.info('PDF export completed successfully');
    } catch (error) {
      invoiceLogger.error('Failed to export PDF:', error);
      alert(`Gagal mengekspor PDF: ${(error as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={invoice.invoiceNumber} size='lg'>
      <div className='space-y-4 text-sm'>
        {/* Business Header */}
        {settings && (settings.businessName || settings.businessLogo) && (
          <div className='pb-4 border-b border-border'>
            <div className='flex items-start gap-4'>
              {settings.businessLogo && (
                <img
                  src={settings.businessLogo}
                  alt='Logo bisnis'
                  className='w-16 h-16 object-contain'
                />
              )}
              <div>
                {settings.businessName && (
                  <p className='font-bold text-lg text-foreground'>{settings.businessName}</p>
                )}
                {settings.businessAddress && (
                  <p className='text-muted-foreground whitespace-pre-line text-xs'>
                    {settings.businessAddress}
                  </p>
                )}
                {settings.businessEmail && (
                  <p className='text-muted-foreground text-xs'>{settings.businessEmail}</p>
                )}
                {settings.businessPhone && (
                  <p className='text-muted-foreground text-xs'>{settings.businessPhone}</p>
                )}
                {settings.businessVatNumber && (
                  <p className='text-muted-foreground text-xs'>
                    NPWP: {settings.businessVatNumber}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Info Row */}
        <div className='flex justify-between'>
          <div>
            <p className='font-medium text-foreground'>Tagih ke:</p>
            <p className='text-muted-foreground'>{invoice.clientName}</p>
            {invoice.clientAddress && (
              <p className='text-muted-foreground whitespace-pre-line'>{invoice.clientAddress}</p>
            )}
            {invoice.clientVatNumber && (
              <p className='text-muted-foreground'>NPWP: {invoice.clientVatNumber}</p>
            )}
          </div>
          <div className='text-right'>
            <StatusBadge status={invoice.status} />
            <p className='mt-2 text-muted-foreground'>Tanggal: {formatDate(invoice.issueDate)}</p>
            <p className='text-muted-foreground'>Jatuh Tempo: {formatDate(invoice.dueDate)}</p>
          </div>
        </div>

        {/* Line Items */}
        <table className='w-full'>
          <thead>
            <tr className='border-b border-border text-left'>
              <th className='py-2'>Deskripsi</th>
              <th className='py-2 text-right'>Jumlah</th>
              <th className='py-2 text-right'>Harga</th>
              <th className='py-2 text-right'>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item) => (
              <tr key={item.id} className='border-b border-border'>
                <td className='py-2'>{item.description}</td>
                <td className='py-2 text-right'>{item.quantity}</td>
                <td className='py-2 text-right'>
                  {formatCurrency(
                    item.unitPrice,
                    clients.find((c) => c.id === invoice.clientId)?.currency,
                  )}
                </td>
                <td className='py-2 text-right'>
                  {formatCurrency(
                    item.quantity * item.unitPrice,
                    clients.find((c) => c.id === invoice.clientId)?.currency,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className='flex justify-end'>
          <div className='w-48'>
            <div className='flex justify-between py-1'>
              <span>Subtotal:</span>
              <span>
                {formatCurrency(
                  invoice.subtotal,
                  clients.find((c) => c.id === invoice.clientId)?.currency,
                )}
              </span>
            </div>
            <div className='flex justify-between py-1'>
              <span>Pajak ({formatNumber(invoice.taxRate * 100, 1)}%):</span>
              <span>
                {formatCurrency(
                  invoice.taxAmount,
                  clients.find((c) => c.id === invoice.clientId)?.currency,
                )}
              </span>
            </div>
            {invoice.downPayment > 0 && (
              <div className='flex justify-between py-1 text-green-600 dark:text-green-400'>
                <span>Uang Muka:</span>
                <span>
                  -
                  {formatCurrency(
                    invoice.downPayment,
                    clients.find((c) => c.id === invoice.clientId)?.currency,
                  )}
                </span>
              </div>
            )}
            <div className='flex justify-between py-2 border-t border-border font-medium'>
              <span>{invoice.downPayment > 0 ? 'Sisa Tagihan:' : 'Total:'}</span>
              <span>
                {formatCurrency(
                  invoice.total,
                  clients.find((c) => c.id === invoice.clientId)?.currency,
                )}
              </span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className='pt-4 border-t border-border'>
            <p className='font-medium'>Catatan:</p>
            <p className='text-muted-foreground whitespace-pre-line'>{invoice.notes}</p>
          </div>
        )}

        {settings?.paymentTerms && (
          <div className='pt-4 border-t border-border'>
            <p className='font-medium'>Syarat Pembayaran:</p>
            <p className='text-muted-foreground whitespace-pre-line'>{settings.paymentTerms}</p>
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
