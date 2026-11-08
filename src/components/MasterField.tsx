import type { Field } from "@/lib/master";

// Satu isian formulir master data (dipakai halaman Tambah dan Ubah).
export default function MasterField({ f, value }: { f: Field; value?: unknown }) {
  const id = `f_${f.name}`;
  if (f.type === "checkbox")
    return (
      <label style={{ color: "inherit", marginTop: 16 }}>
        <input type="checkbox" name={f.name} defaultChecked={!!value} />
        {f.label}
      </label>
    );
  return (
    <>
      <label htmlFor={id}>{f.label}</label>
      {f.type === "select" ? (
        <select id={id} name={f.name} required defaultValue={(value as string) ?? ""}>
          <option value="" disabled>Pilih…</option>
          {f.options!.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input
          id={id}
          name={f.name}
          type={f.type === "number" ? "number" : "text"}
          defaultValue={(value as string | number | undefined) ?? (f.type === "number" ? 0 : "")}
          required={f.type === "text"}
        />
      )}
    </>
  );
}
