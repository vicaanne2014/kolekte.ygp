"use client";

import { useEffect, useRef } from "react";

// Input nama (tanpa login). Diingat di perangkat agar tidak mengetik berulang.
export default function NameField({ label, defaultValue }: { label: string; defaultValue?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kolekte_nama");
      if (saved && ref.current && !ref.current.value) ref.current.value = saved;
    } catch {}
  }, []);
  return (
    <>
      <label htmlFor="nama">{label}</label>
      <input
        ref={ref}
        id="nama"
        name="nama"
        required
        minLength={2}
        maxLength={60}
        autoComplete="name"
        defaultValue={defaultValue}
        onChange={(e) => {
          try { localStorage.setItem("kolekte_nama", e.target.value); } catch {}
        }}
      />
    </>
  );
}
