import { ChangeEvent } from 'react';
import { Product } from '../../types';
import { formatCurrency } from '../../lib/formatters';

interface QuerySelectProps {
  products: Product[];
  onSelect: (product: Product) => void;
}

export function QuerySelect({ products, onSelect }: QuerySelectProps) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    if (!productId) return;

    const product = products.find((p) => p.id === productId);
    if (product) {
      onSelect(product);
    }
    // Reset selection
    e.target.value = '';
  };

  return (
    <select
      className='h-8 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary'
      onChange={handleChange}
      defaultValue=''
    >
      <option value='' disabled>
        Tambah item tersimpan...
      </option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({formatCurrency(p.price)})
        </option>
      ))}
    </select>
  );
}
