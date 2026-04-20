import { Modal } from './Modal';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? 'Cmd' : 'Ctrl';

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Timer',
    shortcuts: [
      { keys: [mod, 'Shift', 'S'], description: 'Mulai / lanjutkan timer' },
      { keys: [mod, 'Shift', 'P'], description: 'Jeda timer' },
      { keys: [mod, 'Shift', 'X'], description: 'Hentikan timer dan simpan' },
    ],
  },
  {
    title: 'Aplikasi',
    shortcuts: [
      { keys: [mod, 'Shift', 'W'], description: 'Tampilkan/sembunyikan widget mengambang' },
      { keys: [mod, 'Shift', 'M'], description: 'Aktifkan/nonaktifkan suara' },
      { keys: [mod, 'K'], description: 'Buka pencarian global' },
    ],
  },
  {
    title: 'Dialog',
    shortcuts: [
      { keys: ['Esc'], description: 'Tutup modal / dialog' },
      { keys: ['?'], description: 'Tampilkan bantuan ini' },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title='Pintasan Keyboard' size='md'>
      <div className='space-y-6'>
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className='text-sm font-semibold text-muted-foreground mb-2'>{group.title}</h3>
            <div className='space-y-2'>
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.description} className='flex items-center justify-between'>
                  <span className='text-sm'>{shortcut.description}</span>
                  <div className='flex items-center gap-1'>
                    {shortcut.keys.map((key, i) => (
                      <span key={i}>
                        <kbd className='px-2 py-1 text-xs font-mono bg-secondary border border-border rounded-md'>
                          {key}
                        </kbd>
                        {i < shortcut.keys.length - 1 && (
                          <span className='mx-0.5 text-muted-foreground'>+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
