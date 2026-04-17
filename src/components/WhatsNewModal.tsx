// Modal pembaruan fitur, ditampilkan sekali per versi

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from './ui/Modal';
import { Button } from './ui/Button';
import { useSettings } from '../contexts/SettingsContext';
import { updateService } from '../services/updateService';

interface ChangelogSection {
  title: string;
  items: string[];
}

const CHANGELOG: Record<string, ChangelogSection[]> = {
  '0.2.0': [
    {
      title: 'Fitur Baru',
      items: [
        'Dukungan Deposit - Catat uang muka pada invoice dan potong otomatis dari total',
        'Analitik Dashboard - Ringkasan harian, mingguan, dan bulanan dengan statistik per klien dan proyek',
        'Katalog Produk - Kelola produk atau layanan yang bisa dipakai ulang beserta harga dan SKU',
        'Ekspor CSV - Ekspor data invoice ke CSV untuk spreadsheet dan akuntansi',
        'Pencarian Global - Cari klien, proyek, dan invoice dengan cepat dari header',
      ],
    },
    {
      title: 'Peningkatan',
      items: [
        'Font Lexend - Font yang lebih nyaman dibaca',
        'Mata Uang - Sekarang fokus pada IDR dan USD di seluruh aplikasi',
        'PDF Multi-halaman - Invoice dengan banyak item kini terbagi rapi antar halaman',
        'Dialog Pintasan Keyboard - Tekan ? untuk melihat semua shortcut',
      ],
    },
    {
      title: 'Keandalan',
      items: [
        'Penanganan Error - Error di satu bagian tidak langsung menjatuhkan seluruh aplikasi',
        'Undo pada Toast - Aksi penting seperti hapus data bisa dibatalkan',
        'Perbaikan Dark Mode - Tampilan lebih konsisten di semua halaman',
        'Perbaikan Migrasi Database - Proses upgrade versi lebih mulus',
      ],
    },
    {
      title: 'Aksesibilitas',
      items: [
        'Tema Kontras Tinggi - Visibilitas lebih baik untuk kebutuhan low vision',
        'Nonaktifkan Animasi - Opsi UI yang lebih tenang',
        'Navigasi Keyboard Penuh - Aplikasi bisa dipakai sepenuhnya lewat keyboard',
      ],
    },
  ],
};

export function WhatsNewModal() {
  const { settings, updateSetting, loading } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (window.location.pathname === '/widget') return;

    const currentVersion = updateService.getCurrentVersion();
    if (!currentVersion || currentVersion === '0.0.0') return;

    if (settings.seenChangelogVersion !== currentVersion) {
      setIsOpen(true);
    }
  }, [loading, settings.seenChangelogVersion]);

  const handleDismiss = async () => {
    setIsOpen(false);
    const currentVersion = updateService.getCurrentVersion();
    await updateSetting('seenChangelogVersion', currentVersion);
  };

  const currentVersion = updateService.getCurrentVersion();
  const sections = CHANGELOG[currentVersion] || CHANGELOG['0.2.0'];

  if (!sections) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      title={`Yang Baru di v${currentVersion}`}
      size='lg'
    >
      <div className='space-y-5'>
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className='text-sm font-semibold text-primary mb-2'>{section.title}</h3>
            <ul className='space-y-1.5'>
              {section.items.map((item) => {
                const [label, ...rest] = item.split(' - ');
                const description = rest.join(' - ');
                return (
                  <li key={item} className='text-sm text-foreground/80 flex items-start gap-2'>
                    <span className='text-primary mt-0.5 shrink-0'>-</span>
                    <span>
                      {description ? (
                        <>
                          <span className='font-medium text-foreground'>{label}</span>
                          {' - '}
                          {description}
                        </>
                      ) : (
                        label
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <ModalFooter>
        <Button onClick={handleDismiss}>Mengerti</Button>
      </ModalFooter>
    </Modal>
  );
}
