export const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// "Minggu 1" atau "Jumat Pertama · Maret"
export const misaLabel = (nama: string, bulan?: number | null) =>
  bulan ? `${nama} · ${BULAN[bulan - 1]}` : nama;

// Konstanta (bukan master data). Harus sama dengan valid_nilai() dan valid_lingkungan() di SQL.
export const PECAHAN = [100000, 75000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const;

export const LINGKUNGAN = [
  "Sta. Felisitas",
  "St. Edmund",
  "St. Hieronimus",
  "St. Fransiscus Xaverius",
  "Sta. Veronica",
  "Sta. Maria Ratu Rosari",
  "Sta. Maria Medali Wasiat",
] as const;

export const SECTIONS = [
  { tipe: "RED", label: "Kantong Merah" },
  { tipe: "YELLOW", label: "Kantong Kuning" },
  { tipe: "PARKIR", label: "Parkir" },
  { tipe: "INTENSI", label: "Intensi" },
] as const;

export type Tipe = (typeof SECTIONS)[number]["tipe"];
export const isTipe = (s: string): s is Tipe => SECTIONS.some((x) => x.tipe === s);

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Menunggu review",
  APPROVED: "Disetujui",
  IN_PROGRESS: "Sedang diisi",
  READY_FOR_REVIEW: "Siap direview",
  RETURNED: "Dikembalikan",
  CLOSED: "Selesai",
  BELUM: "Belum diisi",
};

export const rp = (n: number | string | null | undefined) =>
  "Rp" + new Intl.NumberFormat("id-ID").format(Number(n ?? 0));

const ERRORS: Record<string, string> = {
  NAMA_INVALID: "Nama harus 2–60 karakter.",
  TANGGAL_INVALID: "Tanggal tidak valid (maksimal besok).",
  LINGKUNGAN_INVALID: "Lingkungan tidak valid.",
  MISA_INVALID: "Misa tidak valid.",
  BULAN_INVALID: "Pilih bulan (1–12) untuk Jumat Pertama.",
  TIPE_INVALID: "Bagian tidak valid.",
  LINES_INVALID: "Data isian tidak valid.",
  SESSION_NOT_FOUND: "Sesi tidak ditemukan.",
  SESSION_CLOSED: "Sesi sudah selesai dan tidak bisa diubah.",
  SECTION_LOCKED: "Bagian ini sudah disubmit/disetujui dan terkunci.",
  QTY_INVALID: "Jumlah harus bilangan bulat 0–1.000.000.",
  DENOM_INVALID: "Pecahan tidak valid.",
  LINE_DUPLICATE: "Ada baris pecahan ganda.",
  EMPTY_CONFLICT: "Bagian ditandai kosong tetapi ada jumlah terisi.",
  SECTION_EMPTY: "Isi minimal satu pecahan, atau centang 'Kosong'.",
  SECTION_NOT_DRAFT: "Bagian ini bukan Draft.",
  SECTION_NOT_SUBMITTED: "Ada bagian yang statusnya sudah berubah. Muat ulang daftar lalu coba lagi.",
  IDS_REQUIRED: "Tidak ada bagian yang dipilih.",
  NOTE_REQUIRED: "Catatan wajib diisi (minimal 3 karakter).",
  SECTIONS_REQUIRED: "Pilih minimal satu bagian yang disetujui untuk dibuka ulang.",
  NOT_READY: "Sesi belum siap direview.",
  TOTAL_MISMATCH: "Total tidak cocok. Hubungi pengembang.",
  FORBIDDEN: "Hanya Admin Keuangan yang boleh melakukan ini.",
  LOGIN_FAILED: "Email atau password salah, atau bukan pengguna Back Office.",
  MASTER_ERROR: "Gagal menyimpan. Pastikan data valid dan tidak kembar.",
};
export const errMsg = (code?: string) => (code ? ERRORS[code] ?? code : "");
