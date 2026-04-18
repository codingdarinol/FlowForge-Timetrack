// Client data model

export type Currency = 'IDR' | 'USD';

export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: 'IDR', label: 'Rupiah (Rp)', symbol: 'Rp' },
  { value: 'USD', label: 'Dolar AS ($)', symbol: '$' },
];

export interface Client {
  id: string;
  name: string;
  email: string;
  address: string;
  phone: string;
  vatNumber: string;
  hourlyRate: number;
  currency: Currency;
  notes: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface ClientWithStats extends Client {
  totalHours: number;
  totalBillable: number;
  projectCount: number;
}

export type CreateClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClientInput = Partial<CreateClientInput>;
