import type { ClientSummary } from '../../services/dashboardService';
import { formatCurrency } from '../../lib/formatters';

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(1)}h`;
}

function normalizeDashboardCurrency(currency: string) {
  return currency === 'USD' ? 'USD' : 'IDR';
}

interface ClientBreakdownProps {
  clients: ClientSummary[];
}

export function ClientBreakdown({ clients }: ClientBreakdownProps) {
  if (clients.length === 0) return null;

  return (
    <div className='bg-background border border-border rounded-xl p-4'>
      <h3 className='text-sm font-semibold text-foreground mb-3'>Jam & Tagihan per Klien</h3>
      <div className='space-y-3'>
        {clients.map((client) => {
          const totalAmount = client.unbilledAmount + client.billedAmount;
          const billedPercent = totalAmount > 0 ? (client.billedAmount / totalAmount) * 100 : 0;
          const currency = normalizeDashboardCurrency(client.currency);

          return (
            <div key={client.clientId} className='space-y-1.5'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium text-foreground truncate mr-2'>
                  {client.clientName}
                </span>
                <span className='text-xs text-muted-foreground whitespace-nowrap'>
                  {formatHours(client.totalSeconds)}
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='flex-1 h-2 bg-muted rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-primary rounded-full transition-all duration-300'
                    style={{ width: `${Math.max(billedPercent, 2)}%` }}
                  />
                </div>
                <div className='flex gap-2 text-xs whitespace-nowrap'>
                  <span className='text-muted-foreground'>
                    {formatCurrency(client.unbilledAmount, currency)} belum ditagih
                  </span>
                  <span className='text-primary font-medium'>
                    {formatCurrency(client.billedAmount, currency)} tertagih
                  </span>
                  {client.downPaymentTotal > 0 && (
                    <span className='text-teal-600 dark:text-teal-400 font-medium'>
                      {formatCurrency(client.downPaymentTotal, currency)} deposit
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
