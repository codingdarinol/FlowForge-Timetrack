import { Card } from '../../components/ui';
import { Wallet, Clock } from 'lucide-react';
import type { CurrencyAmount } from '../../services/dashboardService';
import { formatCurrency } from '../../lib/formatters';
import { formatDuration } from '../../types';

interface QuickStatsProps {
  unbilledAmounts: CurrencyAmount[];
  billedAmounts: CurrencyAmount[];
  weeklySeconds: number;
  totalSeconds: number;
}

function normalizeDashboardCurrency(currency: string) {
  return currency === 'USD' ? 'USD' : 'IDR';
}

export function QuickStats({
  unbilledAmounts,
  billedAmounts,
  weeklySeconds,
  totalSeconds,
}: QuickStatsProps) {
  return (
    <Card className='p-4'>
      <h3 className='font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3'>
        Ringkasan Cepat
      </h3>

      <div className='flex flex-wrap gap-4'>
        {unbilledAmounts.length > 0 ? (
          unbilledAmounts.map(({ currency, amount }) => (
            <div key={currency} className='flex items-center gap-3'>
              <div className='p-2 rounded-lg bg-green-500/10'>
                <Wallet className='w-5 h-5 text-green-600 dark:text-green-400' />
              </div>
              <div>
                <div className='text-lg font-bold'>
                  {formatCurrency(amount, normalizeDashboardCurrency(currency))}
                </div>
                <div className='text-xs text-muted-foreground'>Belum ditagih {currency}</div>
              </div>
            </div>
          ))
        ) : (
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-green-500/10'>
              <Wallet className='w-5 h-5 text-green-600 dark:text-green-400' />
            </div>
            <div>
              <div className='text-lg font-bold'>{formatCurrency(0)}</div>
              <div className='text-xs text-muted-foreground'>Belum ditagih</div>
            </div>
          </div>
        )}

        {billedAmounts.length > 0 ? (
          billedAmounts.map(({ currency, amount }) => (
            <div key={`billed-${currency}`} className='flex items-center gap-3'>
              <div className='p-2 rounded-lg bg-indigo-500/10'>
                <Wallet className='w-5 h-5 text-indigo-600 dark:text-indigo-400' />
              </div>
              <div>
                <div className='text-lg font-bold'>
                  {formatCurrency(amount, normalizeDashboardCurrency(currency))}
                </div>
                <div className='text-xs text-muted-foreground'>Total tertagih {currency}</div>
              </div>
            </div>
          ))
        ) : (
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-indigo-500/10'>
              <Wallet className='w-5 h-5 text-indigo-600 dark:text-indigo-400' />
            </div>
            <div>
              <div className='text-lg font-bold'>{formatCurrency(0)}</div>
              <div className='text-xs text-muted-foreground'>Total tertagih</div>
            </div>
          </div>
        )}

        <div className='flex items-center gap-3'>
          <div className='p-2 rounded-lg bg-blue-500/10'>
            <Clock className='w-5 h-5 text-blue-600 dark:text-blue-400' />
          </div>
          <div>
            <div className='text-lg font-bold'>{formatDuration(weeklySeconds)}</div>
            <div className='text-xs text-muted-foreground'>Minggu ini</div>
          </div>
        </div>

        <div className='flex items-center gap-3'>
          <div className='p-2 rounded-lg bg-purple-500/10'>
            <Clock className='w-5 h-5 text-purple-600 dark:text-purple-400' />
          </div>
          <div>
            <div className='text-lg font-bold'>{formatDuration(totalSeconds)}</div>
            <div className='text-xs text-muted-foreground'>Sepanjang waktu</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
