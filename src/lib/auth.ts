import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { db } from "./admin";

export async function authClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // dipanggil dari Server Component: pembaruan cookie ditangani middleware
          }
        },
      },
    }
  );
}

export type BoUser = { id: string; email: string; role: "ADMIN" | "ADMIN_KEUANGAN" };

export async function getBoUser(): Promise<BoUser | null> {
  const auth = await authClient();
  const { data } = await auth.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await db.from("bo_user").select("role").eq("user_id", data.user.id).maybeSingle();
  if (!row) return null;
  return { id: data.user.id, email: data.user.email ?? "", role: row.role };
}

export async function requireBo(): Promise<BoUser> {
  const u = await getBoUser();
  if (!u) redirect("/admin/login");
  return u;
}
