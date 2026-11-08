// Master data yang dikelola Admin / Admin Keuangan di Back Office.
// Pecahan, lingkungan, dan jenis kantong sengaja BUKAN master data (konstanta di kode dan SQL).
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
};

export const MASTER: Record<string, MasterDef> = {
  misa: {
    title: "Misa",
    table: "misa",
    fields: [
      { name: "nama", label: "Nama", type: "text", editable: true },
      { name: "pilih_bulan", label: "Minta bulan (Jumat Pertama)", type: "checkbox", editable: true },
      { name: "urutan", label: "Urutan", type: "number", editable: true },
    ],
    order: [{ col: "urutan", asc: true }, { col: "nama", asc: true }],
  },
};
