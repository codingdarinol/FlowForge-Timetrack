import { useState, useEffect } from 'react';
import {
  Moon,
  Sun,
  Monitor,
  Volume2,
  VolumeX,
  Bell,
  Palette,
  LayoutGrid,
  Building2,
  Clock,
  RotateCcw,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Timer,
  Users,
  Briefcase,
  FileText,
  Package,
  Zap,
  Coffee,
  Keyboard,
  BarChart3,
  PauseCircle,
  Eye,
  Globe,
  QrCode,
} from 'lucide-react';
import type { AppSettings, Theme, FontSize, Density } from '../types';
import { FONT_SIZE_OPTIONS, DENSITY_OPTIONS, DEFAULT_SETTINGS } from '../types';
// settingsService is accessed through useSettings context
import { useSettings } from '../contexts/SettingsContext';
import { toggleWidget } from '../lib/widgetWindow';
import {
  Button,
  Input,
  Textarea,
  Card,
  CardTitle,
  CardContent,
  CardDescription,
  ConfirmDialog,
} from '../components/ui';
import clsx from 'clsx';

import { emit } from '@tauri-apps/api/event';
import { uiLogger } from '../lib/logger';

type TabId = 'general' | 'appearance' | 'accessibility' | 'business' | 'guide';

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const {
    settings: globalSettings,
    updateSetting: persistSetting,
    applyTheme,
    applyFontSize,
    applyDensity,
  } = useSettings();

  // Local state for immediate feedback and input handling
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [localSettings, setLocalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Sync local state with global settings when they change (e.g. initial load or external update)
  useEffect(() => {
    setLocalSettings(globalSettings);
  }, [globalSettings]);

  // Handle immediate visual updates and local state
  const handleLocalChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));

    // Apply visual changes immediately for preview
    if (key === 'theme') applyTheme(value as Theme);
    if (key === 'fontSize') applyFontSize(value as FontSize);
    if (key === 'density') applyDensity(value as Density);

    // Broadcast preview to other windows
    emit('setting-preview', { key, value });
  };

  // Persist setting to database (Auto-Save)
  const handleAutoSave = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    // First update locally/visually
    handleLocalChange(key, value);

    // Then persist
    try {
      await persistSetting(key, value);
      // Notify other windows to reload settings
      await emit('settings-sync');
    } catch (error) {
      uiLogger.error(`Failed to auto-save ${key}:`, error);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'Umum', icon: <Bell className='w-4 h-4' /> },
    { id: 'appearance', label: 'Tampilan', icon: <Palette className='w-4 h-4' /> },
    { id: 'accessibility', label: 'Aksesibilitas', icon: <LayoutGrid className='w-4 h-4' /> },
    { id: 'business', label: 'Bisnis', icon: <Building2 className='w-4 h-4' /> },
    { id: 'guide', label: 'Panduan', icon: <BookOpen className='w-4 h-4' /> },
  ];

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-foreground'>Pengaturan</h1>
      </div>

      {/* Tabs */}
      <div className='flex gap-2 border-b border-border'>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition-colors text-sm font-medium',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className='space-y-6'>
          <Card>
            <CardContent>
              <ToggleSetting
                label='Tampilkan Widget Timer Mengambang'
                description='Tampilkan jendela mini timer yang selalu di atas'
                checked={localSettings.showFloatingWidget}
                onChange={(v) => {
                  handleAutoSave('showFloatingWidget', v);
                  toggleWidget(v).catch((err) => uiLogger.error('Failed to toggle widget:', err));
                }}
                icon={<Bell className='w-5 h-5' />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <ToggleSetting
                label='Umpan Balik Suara'
                description='Putar suara saat memulai atau menghentikan timer'
                checked={localSettings.enableSoundFeedback}
                onChange={(v) => handleAutoSave('enableSoundFeedback', v)}
                icon={
                  localSettings.enableSoundFeedback ? (
                    <Volume2 className='w-5 h-5' />
                  ) : (
                    <VolumeX className='w-5 h-5' />
                  )
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className='space-y-4'>
              <ToggleSetting
                label='Timer Pomodoro'
                description='Tampilkan pengingat istirahat setelah bekerja dalam durasi tertentu'
                checked={localSettings.pomodoroEnabled}
                onChange={(v) => handleAutoSave('pomodoroEnabled', v)}
                icon={<Clock className='w-5 h-5' />}
              />

              {localSettings.pomodoroEnabled && (
                <>
                  <div className='grid grid-cols-2 gap-4 pt-4 border-t border-border'>
                    <div>
                      <label className='block text-sm font-medium mb-2'>Durasi Kerja (menit)</label>
                      <Input
                        type='number'
                        value={localSettings.pomodoroWorkMinutes || ''}
                        onChange={(e) =>
                          handleLocalChange(
                            'pomodoroWorkMinutes',
                            e.target.value === '' ? 0 : parseInt(e.target.value),
                          )
                        }
                        onBlur={() => {
                          let val = localSettings.pomodoroWorkMinutes;
                          if (!val || val < 1) val = 25;
                          handleAutoSave('pomodoroWorkMinutes', val);
                        }}
                        min={1}
                        max={120}
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium mb-2'>
                        Durasi Istirahat (menit)
                      </label>
                      <Input
                        type='number'
                        value={localSettings.pomodoroBreakMinutes || ''}
                        onChange={(e) =>
                          handleLocalChange(
                            'pomodoroBreakMinutes',
                            e.target.value === '' ? 0 : parseInt(e.target.value),
                          )
                        }
                        onBlur={() => {
                          let val = localSettings.pomodoroBreakMinutes;
                          if (!val || val < 1) val = 5;
                          handleAutoSave('pomodoroBreakMinutes', val);
                        }}
                        min={1}
                        max={60}
                      />
                    </div>
                  </div>

                  <div className='flex justify-end pt-4'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        handleAutoSave('pomodoroWorkMinutes', 25);
                        handleAutoSave('pomodoroBreakMinutes', 5);
                      }}
                      className='gap-2 text-muted-foreground hover:text-foreground'
                    >
                      <RotateCcw className='w-3.5 h-3.5' />
                      Reset ke Default
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className='space-y-4'>
              <ToggleSetting
                label='Jeda Otomatis Saat Tidak Aktif'
                description='Jeda timer secara otomatis saat Anda meninggalkan komputer'
                checked={localSettings.enableIdleDetection}
                onChange={(v) => handleAutoSave('enableIdleDetection', v)}
                icon={<Clock className='w-5 h-5' />}
              />

              {localSettings.enableIdleDetection && (
                <div className='pt-4 border-t border-border'>
                  <label className='block text-sm font-medium mb-2'>Batas Tidak Aktif</label>
                  <p className='text-sm text-muted-foreground mb-3'>
                    Jumlah menit tidak aktif sebelum timer dijeda
                  </p>
                  <div className='flex gap-2'>
                    {[2, 5, 10, 15, 30].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() => handleAutoSave('idleThresholdMinutes', minutes)}
                        className={clsx(
                          'px-4 py-2 rounded-lg border transition-colors',
                          localSettings.idleThresholdMinutes === minutes
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>
                  <p className='text-xs text-muted-foreground mt-3'>
                    Saat Anda kembali, Anda akan diminta memilih tindakan untuk waktu tidak aktif
                    tersebut.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className='space-y-6'>
          <Card>
            <CardContent className='space-y-4'>
              <div>
                <label className='block text-sm font-medium mb-2'>Tema</label>
                <div className='flex gap-3 flex-wrap'>
                  <ThemeButton
                    theme='light'
                    current={localSettings.theme}
                    onClick={() => handleAutoSave('theme', 'light')}
                    icon={<Sun className='w-5 h-5' />}
                    label='Terang'
                  />
                  <ThemeButton
                    theme='dark'
                    current={localSettings.theme}
                    onClick={() => handleAutoSave('theme', 'dark')}
                    icon={<Moon className='w-5 h-5' />}
                    label='Gelap'
                  />
                  <ThemeButton
                    theme='system'
                    current={localSettings.theme}
                    onClick={() => handleAutoSave('theme', 'system')}
                    icon={<Monitor className='w-5 h-5' />}
                    label='Sistem'
                  />
                  <ThemeButton
                    theme='high-contrast'
                    current={localSettings.theme}
                    onClick={() => handleAutoSave('theme', 'high-contrast')}
                    icon={<Eye className='w-5 h-5' />}
                    label='Kontras Tinggi'
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='space-y-4'>
              <div>
                <label className='block text-sm font-medium mb-2'>Ukuran Font</label>
                <p className='text-sm text-muted-foreground mb-3'>
                  Pengaturan ini mengubah ukuran SEMUA teks di seluruh aplikasi.
                </p>
                <div className='flex gap-2'>
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleAutoSave('fontSize', option.value)}
                      className={clsx(
                        'px-4 py-2 rounded-lg border transition-colors',
                        localSettings.fontSize === option.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='space-y-4'>
              <div>
                <label className='block text-sm font-medium mb-2'>Kerapatan</label>
                <p className='text-sm text-muted-foreground mb-3'>
                  Mengatur jarak dan padding di seluruh aplikasi.
                </p>
                <div className='flex gap-2'>
                  {DENSITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleAutoSave('density', option.value)}
                      className={clsx(
                        'px-4 py-2 rounded-lg border transition-colors',
                        localSettings.density === option.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accessibility Tab */}
      {activeTab === 'accessibility' && (
        <div className='space-y-6'>
          <Card>
            <CardContent className='space-y-4'>
              <ToggleSetting
                label='Nonaktifkan Animasi UI'
                description='Matikan semua transisi, efek hover, dan animasi untuk mengurangi gerakan'
                checked={localSettings.animationPreference === 'disabled'}
                onChange={(v) => handleAutoSave('animationPreference', v ? 'disabled' : 'enabled')}
                icon={<PauseCircle className='w-5 h-5' />}
              />
            </CardContent>
          </Card>

          <Card className='bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'>
            <CardContent>
              <CardTitle className='text-blue-800 dark:text-blue-300 mb-2'>
                Desain Ramah Neurodivergen
              </CardTitle>
              <CardDescription className='text-blue-700 dark:text-blue-400'>
                yuk-kerja dirancang dengan mempertimbangkan pengguna neurodivergen. Fitur yang
                tersedia:
                <ul className='list-disc list-inside mt-2 space-y-1'>
                  <li>Area sentuh besar (minimal 44pt)</li>
                  <li>Label jelas dengan ikon</li>
                  <li>Transisi halus dan ringan (bisa dinonaktifkan)</li>
                  <li>Opsi tema kontras tinggi</li>
                  <li>Widget timer yang selalu terlihat</li>
                  <li>Antarmuka rapi dan fokus</li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Business Tab */}
      {activeTab === 'business' && (
        <div className='space-y-6'>
          <Card>
            <CardTitle className='px-6 pt-6 text-base'>Informasi Invoice</CardTitle>
            <CardDescription className='px-6 pb-2'>
              Informasi ini akan tampil pada invoice yang Anda buat.
            </CardDescription>
            <CardContent className='space-y-4'>
              {/* Logo Upload */}
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Logo Bisnis
                </label>
                {localSettings.businessLogo ? (
                  <div className='flex items-center gap-4'>
                    <img
                      src={localSettings.businessLogo}
                      alt='Logo Bisnis'
                      className='w-24 h-24 object-contain border border-border rounded-lg p-2 bg-background'
                    />
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => handleAutoSave('businessLogo', null)}
                    >
                      Hapus Logo
                    </Button>
                  </div>
                ) : (
                  <label className='flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors'>
                    <div className='flex flex-col items-center justify-center pt-5 pb-6'>
                      <Building2 className='w-8 h-8 text-muted-foreground mb-2' />
                      <p className='text-sm text-muted-foreground'>
                        <span className='font-medium text-primary'>Klik untuk unggah</span> atau
                        seret lalu lepas
                      </p>
                      <p className='text-xs text-muted-foreground mt-1'>PNG, JPG hingga 1MB</p>
                    </div>
                    <input
                      type='file'
                      accept='image/png,image/jpeg,image/jpg'
                      className='hidden'
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1024 * 1024) {
                            alert('Ukuran file harus kurang dari 1MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const base64 = event.target?.result as string;
                            handleAutoSave('businessLogo', base64);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <Input
                label='Nama Bisnis'
                value={localSettings.businessName}
                onChange={(e) => handleLocalChange('businessName', e.target.value)}
                onBlur={() => handleAutoSave('businessName', localSettings.businessName)}
                placeholder='Nama perusahaan Anda'
              />

              <Textarea
                label='Alamat Bisnis'
                value={localSettings.businessAddress}
                onChange={(e) => handleLocalChange('businessAddress', e.target.value)}
                onBlur={() => handleAutoSave('businessAddress', localSettings.businessAddress)}
                placeholder='Jl. Contoh No. 123&#10;Kota, Provinsi 12345&#10;Indonesia'
                rows={3}
              />

              <div className='grid grid-cols-2 gap-4'>
                <Input
                  label='Email'
                  type='email'
                  value={localSettings.businessEmail}
                  onChange={(e) => handleLocalChange('businessEmail', e.target.value)}
                  onBlur={() => handleAutoSave('businessEmail', localSettings.businessEmail)}
                  placeholder='billing@perusahaan.co.id'
                />
                <Input
                  label='Telepon'
                  type='tel'
                  value={localSettings.businessPhone}
                  onChange={(e) => handleLocalChange('businessPhone', e.target.value)}
                  onBlur={() => handleAutoSave('businessPhone', localSettings.businessPhone)}
                  placeholder='+62 812-3456-7890'
                />
              </div>

              <Input
                label='NPWP / Nomor Pajak'
                value={localSettings.businessVatNumber}
                onChange={(e) => handleLocalChange('businessVatNumber', e.target.value)}
                onBlur={() => handleAutoSave('businessVatNumber', localSettings.businessVatNumber)}
                placeholder='Contoh: 12.345.678.9-012.000'
              />

              <Input
                label='Tarif Pajak Default (%)'
                type='number'
                value={localSettings.defaultTaxRate * 100}
                onChange={(e) =>
                  handleLocalChange('defaultTaxRate', (parseFloat(e.target.value) || 0) / 100)
                }
                onBlur={() => handleAutoSave('defaultTaxRate', localSettings.defaultTaxRate)}
                min={0}
                max={100}
                step={0.1}
              />

              <div className='space-y-4'>
                <div className='grid grid-cols-3 gap-4'>
                  <div>
                    <Input
                      label='Judul Tautan Pembayaran 1'
                      value={localSettings.paymentLinkTitle || ''}
                      onChange={(e) => handleLocalChange('paymentLinkTitle', e.target.value)}
                      onBlur={() =>
                        handleAutoSave('paymentLinkTitle', localSettings.paymentLinkTitle)
                      }
                      placeholder='Contoh: Bayar via Midtrans'
                    />
                  </div>
                  <div className='col-span-2'>
                    <Input
                      label='URL Tautan Pembayaran 1'
                      value={localSettings.paymentLink || ''}
                      onChange={(e) => handleLocalChange('paymentLink', e.target.value)}
                      onBlur={() => handleAutoSave('paymentLink', localSettings.paymentLink)}
                      placeholder='https://payment.example.com/bisnis-anda'
                    />
                  </div>
                </div>

                <div className='grid grid-cols-3 gap-4'>
                  <div>
                    <Input
                      label='Judul Tautan Pembayaran 2'
                      value={localSettings.paymentLink2Title || ''}
                      onChange={(e) => handleLocalChange('paymentLink2Title', e.target.value)}
                      onBlur={() =>
                        handleAutoSave('paymentLink2Title', localSettings.paymentLink2Title)
                      }
                      placeholder='Contoh: Bayar via Xendit'
                    />
                  </div>
                  <div className='col-span-2'>
                    <Input
                      label='URL Tautan Pembayaran 2'
                      value={localSettings.paymentLink2 || ''}
                      onChange={(e) => handleLocalChange('paymentLink2', e.target.value)}
                      onBlur={() => handleAutoSave('paymentLink2', localSettings.paymentLink2)}
                      placeholder='https://checkout.example.com/bisnis-anda'
                    />
                  </div>
                </div>
              </div>

              <Textarea
                label='Syarat Pembayaran'
                value={localSettings.paymentTerms}
                onChange={(e) => handleLocalChange('paymentTerms', e.target.value)}
                onBlur={() => handleAutoSave('paymentTerms', localSettings.paymentTerms)}
                placeholder='Pembayaran jatuh tempo dalam 30 hari sejak tanggal invoice.&#10;&#10;Detail Transfer Bank:&#10;Bank: ...&#10;No. Rekening: ...&#10;Atas Nama: ...'
                rows={6}
              />

              {/* QR Code Upload */}
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Kode QR Pembayaran
                </label>
                {localSettings.paymentQrCode ? (
                  <div className='flex items-center gap-4'>
                    <img
                      src={localSettings.paymentQrCode}
                      alt='Kode QR Pembayaran'
                      className='w-24 h-24 object-contain border border-border rounded-lg p-2 bg-background'
                    />
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => handleAutoSave('paymentQrCode', null)}
                    >
                      Hapus Kode QR
                    </Button>
                  </div>
                ) : (
                  <label className='flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors'>
                    <div className='flex flex-col items-center justify-center pt-5 pb-6'>
                      <QrCode className='w-8 h-8 text-muted-foreground mb-2' />
                      <p className='text-sm text-muted-foreground'>
                        <span className='font-medium text-primary'>Klik untuk unggah</span> atau
                        seret lalu lepas
                      </p>
                      <p className='text-xs text-muted-foreground mt-1'>
                        PNG, JPG hingga 1MB. Dipakai di semua invoice.
                      </p>
                    </div>
                    <input
                      type='file'
                      accept='image/png,image/jpeg,image/jpg'
                      className='hidden'
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1024 * 1024) {
                            alert('Ukuran file harus kurang dari 1MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const base64 = event.target?.result as string;
                            handleAutoSave('paymentQrCode', base64);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <Input
                label='Situs Web'
                value={localSettings.businessWebsite}
                onChange={(e) => handleLocalChange('businessWebsite', e.target.value)}
                onBlur={() => handleAutoSave('businessWebsite', localSettings.businessWebsite)}
                placeholder='https://situsanda.com'
              />

              <Input
                label='Slogan'
                value={localSettings.businessTagline}
                onChange={(e) => handleLocalChange('businessTagline', e.target.value)}
                onBlur={() => handleAutoSave('businessTagline', localSettings.businessTagline)}
                placeholder='Slogan bisnis Anda'
              />

              <Textarea
                label='Detail Transfer Bank'
                value={localSettings.paymentBankDetails}
                onChange={(e) => handleLocalChange('paymentBankDetails', e.target.value)}
                onBlur={() =>
                  handleAutoSave('paymentBankDetails', localSettings.paymentBankDetails)
                }
                placeholder={'Bank: BCA\nNo. Rekening: 1234567890\nAtas Nama: Nama Bisnis'}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardTitle className='px-6 pt-6 text-base'>Kelola Data</CardTitle>
            <CardDescription className='px-6 pb-2'>
              Ekspor atau impor database yuk-kerja untuk keperluan cadangan.
            </CardDescription>
            <CardContent className='space-y-4'>
              <div className='flex gap-4'>
                <Button
                  variant='outline'
                  onClick={async () => {
                    try {
                      const { backupService } = await import('../services/backupService');
                      const path = await backupService.exportBackup();
                      if (path) {
                        alert(`Cadangan disimpan di: ${path}`);
                      }
                    } catch (error) {
                      alert('Ekspor cadangan gagal: ' + (error as Error).message);
                    }
                  }}
                >
                  Ekspor Cadangan
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setShowImportConfirm(true)}
                  disabled={importing}
                >
                  {importing ? 'Mengimpor...' : 'Impor Cadangan'}
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>
                Tips: Ekspor data secara berkala untuk mencegah kehilangan data. Impor akan memulai
                ulang aplikasi.
              </p>
            </CardContent>
          </Card>

          <ConfirmDialog
            isOpen={showImportConfirm}
            onClose={() => setShowImportConfirm(false)}
            onConfirm={async () => {
              setShowImportConfirm(false); // Close dialog first to prevent overlay issues
              setImporting(true);
              try {
                const { backupService } = await import('../services/backupService');
                uiLogger.debug('Calling backupService.importBackup...');
                const success = await backupService.importBackup();
                uiLogger.debug('importBackup result:', success);
                if (success) {
                  try {
                    const { message } = await import('@tauri-apps/plugin-dialog');
                    await message('Cadangan berhasil diimpor! Aplikasi akan dimulai ulang.', {
                      title: 'yuk-kerja',
                      kind: 'info',
                    });
                  } catch (e) {
                    uiLogger.error('Failed to show success message:', e);
                  }
                  // Small delay to ensure dialog closes cleanly
                  setTimeout(() => {
                    window.location.reload();
                  }, 100);
                }
              } catch (error) {
                uiLogger.error('Import error in UI:', error);
                alert('Impor cadangan gagal: ' + (error as Error).message);
              } finally {
                setImporting(false);
              }
            }}
            title='Impor Cadangan'
            message='Mengimpor cadangan akan menggantikan seluruh data saat ini dan memulai ulang aplikasi. Yakin ingin melanjutkan?'
            confirmLabel='Impor & Mulai Ulang'
            variant='danger'
            loading={importing}
          />
        </div>
      )}

      {/* Guide Tab */}
      {activeTab === 'guide' && (
        <div className='space-y-4'>
          <Card className='bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20'>
            <CardContent className='py-6'>
              <div className='flex items-center gap-3 mb-2'>
                <Zap className='w-6 h-6 text-primary' />
                <CardTitle className='text-xl'>Selamat datang di yuk-kerja!</CardTitle>
              </div>
              <CardDescription className='text-base'>
                yuk-kerja membantu Anda mencatat waktu, mengelola klien dan proyek, lalu membuat
                invoice dengan alur yang cepat dan sederhana. Panduan ini akan membantu Anda
                memahami fitur-fitur utamanya langkah demi langkah.
              </CardDescription>
            </CardContent>
          </Card>

          <GuideSection
            icon={<Timer className='w-5 h-5' />}
            title='Timer & Pelacakan Waktu'
            defaultOpen={true}
          >
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Mulai dari halaman Timer untuk memilih proyek dan mencatat sesi kerja secara
                real-time.
              </p>
              <div>
                <h4 className='font-medium mb-2'>Alur Dasar</h4>
                <ol className='list-decimal list-inside space-y-1 text-sm text-muted-foreground'>
                  <li>Buka halaman Timer lalu pilih proyek.</li>
                  <li>Klik tombol mulai untuk memulai pencatatan waktu.</li>
                  <li>Gunakan jeda, lanjutkan, atau hentikan sesuai kebutuhan.</li>
                </ol>
              </div>
              <div>
                <h4 className='font-medium mb-2'>Kontrol</h4>
                <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                  <li>Jeda untuk berhenti sementara tanpa mengakhiri sesi.</li>
                  <li>Lanjutkan untuk meneruskan sesi yang dijeda.</li>
                  <li>Hentikan untuk menyimpan sesi sebagai catatan waktu.</li>
                </ul>
              </div>
              <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm'>
                <strong>Tips:</strong> Saat timer dihentikan, catatan waktu akan dibuat otomatis.
              </div>
            </div>
          </GuideSection>

          <GuideSection
            icon={<div className='w-5 h-5 border-2 border-current rounded' />}
            title='Widget Mengambang'
          >
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Widget mengambang menampilkan status timer dalam jendela kecil yang selalu di atas,
                bahkan saat aplikasi diminimalkan.
              </p>
              <div>
                <h4 className='font-medium mb-2'>Fitur Widget</h4>
                <ul className='space-y-1 text-sm text-muted-foreground'>
                  <li>Menampilkan nama proyek aktif dan waktu berjalan.</li>
                  <li>
                    <strong>Tombol Mulai/Jeda:</strong> Mengontrol timer dengan cepat.
                  </li>
                  <li>
                    <strong>Tombol Hentikan:</strong> Mengakhiri sesi saat ini.
                  </li>
                  <li>
                    <strong>Tombol Buka Aplikasi:</strong> Membawa yuk-kerja ke depan.
                  </li>
                  <li>
                    <strong>Handle seret:</strong> Memindahkan widget ke posisi yang nyaman.
                  </li>
                </ul>
              </div>
              <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm'>
                <strong>Tips:</strong> Aktifkan atau nonaktifkan widget di Pengaturan - Umum.
              </div>
            </div>
          </GuideSection>

          <GuideSection icon={<Coffee className='w-5 h-5' />} title='Timer Pomodoro'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Fitur Pomodoro membantu Anda bekerja fokus dalam blok waktu tertentu lalu
                beristirahat secara teratur.
              </p>
              <ol className='list-decimal list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Atur durasi kerja dan durasi istirahat sesuai kebiasaan Anda.</li>
                <li>Setelah waktu kerja habis, aplikasi akan menampilkan pengingat istirahat.</li>
                <li>Anda bisa memulai atau melewati sesi istirahat dari banner timer.</li>
              </ol>
            </div>
          </GuideSection>

          <GuideSection icon={<Users className='w-5 h-5' />} title='Kelola Klien'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Simpan data klien agar lebih mudah dipakai di proyek, catatan waktu, dan invoice.
              </p>
              <ol className='list-decimal list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Buka halaman Klien dan buat klien baru.</li>
                <li>Isi nama, kontak, alamat, tarif, mata uang, dan catatan bila perlu.</li>
                <li>Mata uang klien akan dipakai sebagai acuan saat membuat invoice.</li>
              </ol>
            </div>
          </GuideSection>

          <GuideSection icon={<Briefcase className='w-5 h-5' />} title='Kelola Proyek'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Proyek membantu Anda memisahkan pekerjaan per klien atau per jenis pekerjaan.
              </p>
              <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Pilih klien untuk mengaitkan proyek dengan pihak yang tepat.</li>
                <li>Gunakan warna proyek agar mudah dikenali di timer dan daftar.</li>
                <li>Status aktif, dijeda, dan selesai membantu mengatur visibilitas proyek.</li>
              </ul>
              <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm'>
                <strong>Tips:</strong> Hanya proyek aktif yang muncul di pilihan timer.
              </div>
            </div>
          </GuideSection>

          <GuideSection icon={<Clock className='w-5 h-5' />} title='Catatan Waktu'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Catatan waktu adalah hasil akhir dari sesi kerja Anda dan bisa dikelola sebelum
                masuk ke invoice.
              </p>
              <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Catatan dikelompokkan per klien dan proyek.</li>
                <li>Gunakan filter untuk menyaring proyek, klien, atau status penagihan.</li>
                <li>Anda bisa mengubah waktu mulai, selesai, catatan, dan status dapat ditagih.</li>
              </ul>
            </div>
          </GuideSection>

          <GuideSection icon={<FileText className='w-5 h-5' />} title='Membuat Invoice'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Invoice dapat dibuat dari catatan waktu yang belum ditagih maupun dari item manual.
              </p>
              <ol className='list-decimal list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Pilih klien saat membuat invoice baru.</li>
                <li>Tinjau item baris, pajak, tanggal, dan catatan invoice.</li>
                <li>Ekspor PDF atau ubah status invoice setelah disimpan.</li>
              </ol>
            </div>
          </GuideSection>

          <GuideSection icon={<Package className='w-5 h-5' />} title='Produk & Layanan'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Simpan item yang sering dipakai agar lebih cepat saat menambahkan baris ke invoice,
                dan gunakan juga catatan waktu yang belum ditagih sebagai dasar penagihan.
              </p>
              <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Buat item dengan nama, deskripsi, harga, dan SKU opsional.</li>
                <li>Gunakan fitur Tambah Cepat untuk membuat item dari template.</li>
                <li>Item tersimpan bisa dipilih kembali saat menyusun invoice.</li>
              </ul>
            </div>
          </GuideSection>

          <GuideSection icon={<Building2 className='w-5 h-5' />} title='Pengaturan Bisnis'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Lengkapi informasi bisnis agar invoice terlihat profesional dan siap dikirim.
              </p>
              <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Unggah logo, isi nama bisnis, alamat, kontak, dan NPWP bila ada.</li>
                <li>Tambahkan tautan pembayaran, detail transfer bank, dan kode QR pembayaran.</li>
                <li>Atur tarif pajak default untuk mempermudah pembuatan invoice baru.</li>
              </ul>
            </div>
          </GuideSection>

          <GuideSection icon={<Palette className='w-5 h-5' />} title='Pengaturan Tampilan'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Sesuaikan tema, ukuran font, kerapatan, dan animasi agar aplikasi terasa nyaman
                dipakai.
              </p>
              <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Pilih tema terang, gelap, sistem, atau kontras tinggi.</li>
                <li>Ukuran font dan kerapatan memengaruhi seluruh tampilan aplikasi.</li>
                <li>Animasi dapat dimatikan dari tab aksesibilitas.</li>
              </ul>
            </div>
          </GuideSection>

          <GuideSection icon={<Keyboard className='w-5 h-5' />} title='Pintasan Global'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Pintasan global memungkinkan Anda mengontrol timer tanpa harus membuka jendela
                utama.
              </p>
              <div>
                <h4 className='font-medium mb-2'>Pintasan Tersedia</h4>
                <ul className='space-y-1 text-sm text-muted-foreground'>
                  <li>
                    <strong>Cmd/Ctrl + Shift + S:</strong> Mulai atau lanjutkan timer.
                  </li>
                  <li>
                    <strong>Cmd/Ctrl + Shift + P:</strong> Jeda timer.
                  </li>
                  <li>
                    <strong>Cmd/Ctrl + Shift + X:</strong> Hentikan timer dan simpan catatan.
                  </li>
                  <li>
                    <strong>Cmd/Ctrl + Shift + W:</strong> Tampilkan atau sembunyikan widget.
                  </li>
                  <li>
                    <strong>Cmd/Ctrl + Shift + M:</strong> Aktifkan atau nonaktifkan suara.
                  </li>
                </ul>
              </div>
              <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm'>
                <strong>Tips:</strong> Pintasan ini bekerja secara global, jadi Anda tidak perlu
                memfokuskan jendela yuk-kerja terlebih dahulu.
              </div>
            </div>
          </GuideSection>

          <GuideSection icon={<BarChart3 className='w-5 h-5' />} title='Analitik Dashboard'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Dashboard memberi ringkasan visual supaya Anda cepat memahami progres kerja dan
                potensi penagihan.
              </p>
              <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Ringkasan hari ini dan progres mingguan.</li>
                <li>Statistik cepat untuk jam kerja dan nilai belum ditagih.</li>
                <li>Rincian klien, proyek, dan jam bulanan.</li>
              </ul>
            </div>
          </GuideSection>

          <GuideSection
            icon={<PauseCircle className='w-5 h-5' />}
            title='Deteksi Tidak Aktif Otomatis'
          >
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Deteksi tidak aktif membantu mencegah timer terus berjalan saat Anda meninggalkan
                komputer.
              </p>
              <ol className='list-decimal list-inside space-y-1 text-sm text-muted-foreground'>
                <li>Atur batas tidak aktif di tab Umum.</li>
                <li>Jika tidak ada aktivitas, timer akan dijeda otomatis.</li>
                <li>Saat kembali, Anda bisa memilih membuang atau mempertahankan waktu idle.</li>
              </ol>
            </div>
          </GuideSection>

          <GuideSection icon={<Package className='w-5 h-5' />} title='Cadangan & Pembaruan'>
            <div className='space-y-4'>
              <div>
                <h4 className='font-medium mb-2'>Cadangan Data</h4>
                <p className='text-sm text-muted-foreground mb-2'>
                  Lindungi data dengan mengekspor cadangan berkala dari tab{' '}
                  <strong>Pengaturan - Bisnis</strong>.
                </p>
                <ul className='space-y-1 text-sm text-muted-foreground'>
                  <li>
                    <strong>Ekspor:</strong> Menyimpan seluruh database ke file di komputer Anda.
                  </li>
                  <li>
                    <strong>Impor:</strong> Memulihkan data dari file cadangan. Proses ini
                    mengganti data saat ini dan memulai ulang aplikasi.
                  </li>
                </ul>
              </div>
              <div>
                <h4 className='font-medium mb-2'>Pembaruan Aplikasi</h4>
                <p className='text-sm text-muted-foreground'>
                  yuk-kerja memeriksa pembaruan saat aplikasi dibuka. Jika ada versi baru, banner
                  akan muncul di bagian atas layar untuk mengunduh rilis terbaru.
                </p>
              </div>
            </div>
          </GuideSection>

          <GuideSection icon={<Globe className='w-5 h-5' />} title='Tentang yuk-kerja'>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                yuk-kerja dikembangkan oleh{' '}
                <a
                  href='https://pahampajak.id'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline'
                >
                  team pahampajak
                </a>{' '}
                sebagai aplikasi pelacakan waktu dan invoice yang berfokus pada kesederhanaan dan
                kecepatan.
              </p>
              <div>
                <h4 className='font-medium mb-2'>Tautan</h4>
                <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                  <li>
                    <a
                      href='https://pahampajak.id'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary hover:underline'
                    >
                      pahampajak.id
                    </a>{' '}
                    - Website produk
                  </li>
                  <li>
                    <a
                      href='https://pahampajak.id'
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary hover:underline'
                    >
                      team pahampajak
                    </a>{' '}
                    - Portofolio developer
                  </li>
                </ul>
              </div>
              <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm'>
                <strong>Versi:</strong> 0.2.0
              </div>
            </div>
          </GuideSection>

          <Card className='bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'>
            <CardContent className='py-6'>
              <CardTitle className='text-green-800 dark:text-green-300 mb-2'>Semua Siap!</CardTitle>
              <CardDescription className='text-green-700 dark:text-green-400'>
                Sekarang Anda sudah tahu fitur utama yuk-kerja. Lanjutkan mencatat waktu dan membuat
                invoice dengan lebih cepat.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
// Toggle Setting Component
interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

function ToggleSetting({ label, description, checked, onChange, icon }: ToggleSettingProps) {
  return (
    <div className='flex items-center justify-between'>
      <div className='flex items-center gap-3'>
        {icon && <div className='text-muted-foreground'>{icon}</div>}
        <div>
          <p className='font-medium text-foreground'>{label}</p>
          <p className='text-sm text-muted-foreground'>{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={clsx(
          'w-12 h-7 rounded-full transition-colors relative',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <div
          className={clsx(
            'w-5 h-5 bg-white rounded-full absolute top-1 transition-transform shadow',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

// Theme Button Component
interface ThemeButtonProps {
  theme: Theme;
  current: Theme;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ThemeButton({ theme, current, onClick, icon, label }: ThemeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors min-w-[80px]',
        current === theme
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-muted-foreground',
      )}
    >
      {icon}
      <span className='text-sm'>{label}</span>
    </button>
  );
}

// Guide Section Component (Collapsible)
interface GuideSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function GuideSection({ icon, title, children, defaultOpen = false }: GuideSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className='overflow-hidden'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left'
      >
        <div className='flex items-center gap-3'>
          <div className='text-primary'>{icon}</div>
          <span className='font-medium text-foreground'>{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className='w-5 h-5 text-muted-foreground' />
        ) : (
          <ChevronDown className='w-5 h-5 text-muted-foreground' />
        )}
      </button>
      {isOpen && (
        <div className='px-4 pb-4 pt-0 border-t border-border'>
          <div className='pt-4'>{children}</div>
        </div>
      )}
    </Card>
  );
}
