// Product CRUD service

import { getDb } from '../lib/db';
import type { Product, CreateProductInput, UpdateProductInput } from '../types';

export interface ProductTemplate {
  name: string;
  description: string;
  price: number;
  field: string;
}

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  // Pengembangan Perangkat Lunak
  {
    field: 'Pengembangan Perangkat Lunak',
    name: 'Pengembangan Website',
    description:
      'Desain dan pengembangan website kustom termasuk tata letak responsif, integrasi CMS, dan deployment.',
    price: 2500,
  },
  {
    field: 'Pengembangan Perangkat Lunak',
    name: 'Pengembangan Aplikasi Mobile',
    description:
      'Pengembangan aplikasi mobile native atau lintas platform lengkap dengan desain UI/UX dan rilis ke app store.',
    price: 5000,
  },
  {
    field: 'Pengembangan Perangkat Lunak',
    name: 'Integrasi API',
    description:
      'Integrasi API pihak ketiga, pengembangan middleware kustom, dan penyiapan sinkronisasi data.',
    price: 1500,
  },
  // Desain & Kreatif
  {
    field: 'Desain & Kreatif',
    name: 'Logo & Identitas Brand',
    description:
      'Desain logo profesional lengkap dengan panduan brand, palet warna, dan spesifikasi tipografi.',
    price: 800,
  },
  {
    field: 'Desain & Kreatif',
    name: 'Desain UI/UX',
    description:
      'Desain antarmuka dan pengalaman pengguna termasuk wireframe, prototipe, dan design system.',
    price: 2000,
  },
  {
    field: 'Desain & Kreatif',
    name: 'Grafis Media Sosial',
    description:
      'Template posting media sosial, banner, dan paket konten visual yang dibuat khusus.',
    price: 500,
  },
  // Pemasaran
  {
    field: 'Pemasaran',
    name: 'Optimasi SEO',
    description:
      'Audit SEO teknis dan konten, riset kata kunci, optimasi on-page, dan pelacakan performa.',
    price: 1200,
  },
  {
    field: 'Pemasaran',
    name: 'Strategi Konten',
    description:
      'Pembuatan kalender konten, riset topik, panduan editorial, dan strategi distribusi.',
    price: 1500,
  },
  {
    field: 'Pemasaran',
    name: 'Kampanye Email',
    description:
      'Desain kampanye email marketing, copywriting, setup automasi, dan pelacakan analitik.',
    price: 800,
  },
  // Konsultasi
  {
    field: 'Konsultasi',
    name: 'Sesi Strategi Bisnis',
    description:
      'Sesi konsultasi strategis satu-satu yang membahas analisis bisnis, peluang pertumbuhan, dan rencana aksi.',
    price: 300,
  },
  {
    field: 'Konsultasi',
    name: 'Audit Teknis',
    description:
      'Tinjauan menyeluruh atas infrastruktur teknis, kualitas codebase, keamanan, dan rekomendasi perbaikan.',
    price: 2000,
  },
  {
    field: 'Konsultasi',
    name: 'Workshop Pelatihan',
    description:
      'Workshop pelatihan kustom sesuai topik yang mencakup materi, latihan, dan sumber lanjutan.',
    price: 1000,
  },
  // Pendidikan
  {
    field: 'Pendidikan',
    name: 'Kuliah Tamu',
    description:
      'Sesi kuliah tamu dari ahli pada topik tertentu lengkap dengan materi presentasi dan tanya jawab.',
    price: 500,
  },
  {
    field: 'Pendidikan',
    name: 'Modul Kursus Online',
    description:
      'Modul pembelajaran online mandiri berisi video, latihan, kuis, dan sertifikat.',
    price: 3000,
  },
  {
    field: 'Pendidikan',
    name: 'Mentoring 1-on-1',
    description:
      'Sesi mentoring personal untuk arahan karier, pengembangan skill, dan umpan balik proyek.',
    price: 150,
  },
];

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export const productService = {
  // Get all products
  async getAll(): Promise<Product[]> {
    const db = await getDb();
    return db.select<Product[]>(`
      SELECT 
        id,
        name,
        description,
        price,
        sku,
        created_at as createdAt,
        updated_at as updatedAt
      FROM products
      ORDER BY name ASC
    `);
  },

  // Get product by ID
  async getById(id: string): Promise<Product | null> {
    const db = await getDb();
    const result = await db.select<Product[]>(
      `
      SELECT 
        id,
        name,
        description,
        price,
        sku,
        created_at as createdAt,
        updated_at as updatedAt
      FROM products
      WHERE id = $1
    `,
      [id],
    );

    return result[0] || null;
  },

  // Create product
  async create(input: CreateProductInput): Promise<Product> {
    const db = await getDb();
    const id = generateId();
    const timestamp = now();

    await db.execute(
      `
      INSERT INTO products (id, name, description, price, sku, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [id, input.name, input.description || '', input.price, input.sku || '', timestamp, timestamp],
    );

    return {
      id,
      name: input.name,
      description: input.description || '',
      price: input.price,
      sku: input.sku || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },

  // Update product
  async update(id: string, input: UpdateProductInput): Promise<Product | null> {
    const db = await getDb();
    const existing = await this.getById(id);

    if (!existing) return null;

    const updated = {
      ...existing,
      ...input,
      updatedAt: now(),
    };

    await db.execute(
      `
      UPDATE products SET
        name = $1,
        description = $2,
        price = $3,
        sku = $4,
        updated_at = $5
      WHERE id = $6
    `,
      [updated.name, updated.description, updated.price, updated.sku, updated.updatedAt, id],
    );

    return updated;
  },

  // Delete product
  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    await db.execute('DELETE FROM products WHERE id = $1', [id]);
    return true;
  },
};
