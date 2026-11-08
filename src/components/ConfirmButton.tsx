"use client";

// Tombol submit dengan konfirmasi sebelum aksi berbahaya (hapus, reset).
export default function ConfirmButton({
  children, message, className,
}: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
