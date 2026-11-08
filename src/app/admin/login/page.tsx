import { redirect } from "next/navigation";
import { getBoUser } from "@/lib/auth";
import { login } from "@/app/actions";
import Msg from "@/components/Msg";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getBoUser()) redirect("/admin");
  const { e } = await searchParams;
  return (
    <main>
      <div className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Logo Paroki Santo Yohanes Gabriel Perboyre" />
        <h1>Kolekte — Back Office</h1>
        <p className="muted">Paroki Santo Yohanes Gabriel Perboyre</p>
      </div>
      <Msg e={e} />
      <form action={login} className="card">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username" />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
        <div className="actions"><button type="submit">Masuk</button></div>
      </form>
    </main>
  );
}
