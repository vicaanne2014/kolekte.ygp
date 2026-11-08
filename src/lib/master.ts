// Master data yang dikelola Admin / Admin Keuangan di Back Office.
// Pecahan dan jenis kantong sengaja BUKAN master data (konstanta di kode dan SQL).
export type Field = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  options?: { v: string; l: string }[];
  editable: boolean; // false = hanya diisi saat tambah
};

export type MasterDef = {
  title: string;
  table: string;
  fields: Field[];
  order: { col: string; asc: boolean }[];
  newestFirst?: boolean; // urut terbaru di atas (tanpa urutan manual); tabel harus tanpa kolom rahasia
};

export const MASTER: Record<string, MasterDef> = {
  lingkungan: {
    title: "Lingkungan / Wilayah",
    table: "lingkungan",
    fields: [
      { name: "nama", label: "Nama (mis. Sta. Veronica, OMK, WKRI)", type: "text", editable: true },
      { name: "urutan", label: "Urutan", type: "number", editable: true },
    ],
    order: [{ col: "urutan", asc: true }, { col: "nama", asc: true }],
  },
  misa: {
    title: "Misa",
    table: "misa",
    fields: [
      { name: "nama", label: "Nama (mis. Minggu Biasa XXI)", type: "text", editable: true },
      {
        name: "jenis", label: "Jenis", type: "select", editable: true,
        options: [
          { v: "MINGGU", l: "Minggu (pilih Sabtu Sore / Minggu 1 / Minggu 2)" },
          { v: "JUMAT_PERTAMA", l: "Jumat Pertama (satu misa)" },
        ],
      },
    ],
    order: [],
    newestFirst: true, // Misa: yang terakhir ditambahkan di paling atas, tanpa kolom urutan
  },
};
