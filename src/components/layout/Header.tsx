import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Users, FolderKanban, FileText, X } from 'lucide-react';
import { useGlobalSearch, type SearchResult } from '../../hooks/useGlobalSearch';

const TYPE_ICONS: Record<string, typeof Users> = {
  client: Users,
  project: FolderKanban,
  invoice: FileText,
  'time-entry': FileText,
};

const TYPE_LABELS: Record<string, string> = {
  client: 'Klien',
  project: 'Proyek',
  invoice: 'Invoice',
  'time-entry': 'Catatan Waktu',
};

const ROUTE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Timer', subtitle: 'Lacak waktu Anda' },
  '/clients': { title: 'Klien', subtitle: 'Kelola klien Anda' },
  '/projects': { title: 'Proyek', subtitle: 'Atur pekerjaan Anda' },
  '/time-entries': { title: 'Catatan Waktu', subtitle: 'Lihat waktu yang tercatat' },
  '/invoices': { title: 'Invoice', subtitle: 'Buat dan kelola invoice' },
  '/products': { title: 'Produk', subtitle: 'Katalog layanan' },
  '/settings': { title: 'Pengaturan', subtitle: 'Atur preferensi Anda' },
};

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { query, setQuery, isOpen, open, close, results } = useGlobalSearch();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const pageInfo = ROUTE_TITLES[location.pathname] || { title: 'yuk-kerja' };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.route);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <header className='h-16 border-b border-border flex items-center px-8 bg-background shrink-0'>
      <div>
        <h1 className='text-xl font-semibold'>{pageInfo.title}</h1>
        {pageInfo.subtitle && <p className='text-sm text-muted-foreground'>{pageInfo.subtitle}</p>}
      </div>

      <div className='ml-auto relative'>
        <button
          onClick={open}
          className='flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors'
        >
          <Search className='w-4 h-4' />
          <span>Cari...</span>
          <kbd className='ml-2 px-1.5 py-0.5 text-xs font-mono bg-background border border-border rounded'>
            {/Mac/.test(navigator.userAgent) ? 'Cmd' : 'Ctrl'}+K
          </kbd>
        </button>

        {isOpen && (
          <>
            <div className='fixed inset-0 bg-background/60 backdrop-blur-sm z-40' onClick={close} />
            <div className='fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-4 sm:px-0'>
              <div className='bg-background border border-border/60 rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95'>
                <div className='flex items-center gap-3 px-4 py-3 border-b border-border'>
                  <Search className='w-5 h-5 text-muted-foreground shrink-0' />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Cari klien, proyek, invoice...'
                    aria-label='Cari'
                    aria-autocomplete='list'
                    aria-controls='cmd-search-results'
                    className='flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground'
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      aria-label='Hapus pencarian'
                      className='text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    >
                      <X className='w-4 h-4' />
                    </button>
                  )}
                </div>

                {query.trim() && (
                  <div
                    id='cmd-search-results'
                    role='listbox'
                    aria-label='Hasil pencarian'
                    className='max-h-64 overflow-y-auto'
                  >
                    {results.length === 0 ? (
                      <div className='px-4 py-8 text-center text-sm text-muted-foreground'>
                        Tidak ada hasil
                      </div>
                    ) : (
                      results.map((result, index) => {
                        const Icon = TYPE_ICONS[result.type] || FileText;
                        const isSelected = index === selectedIndex;

                        return (
                          <button
                            key={result.id}
                            role='option'
                            aria-selected={isSelected}
                            onClick={() => handleSelect(result)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                              isSelected
                                ? 'bg-secondary border-l-primary'
                                : 'border-l-transparent hover:bg-secondary/60'
                            }`}
                          >
                            <Icon className='w-4 h-4 text-muted-foreground shrink-0' />
                            <div className='flex-1 min-w-0'>
                              <p className='text-sm font-medium truncate'>{result.title}</p>
                              {result.subtitle && (
                                <p className='text-xs text-muted-foreground truncate'>
                                  {result.subtitle}
                                </p>
                              )}
                            </div>
                            <span className='text-xs text-muted-foreground capitalize shrink-0'>
                              {TYPE_LABELS[result.type] || result.type}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                <div className='px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground'>
                  <span>
                    <kbd className='px-1 bg-secondary rounded'>Atas/Bawah</kbd> Navigasi
                  </span>
                  <span>
                    <kbd className='px-1 bg-secondary rounded'>Enter</kbd> Pilih
                  </span>
                  <span>
                    <kbd className='px-1 bg-secondary rounded'>Esc</kbd> Tutup
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
