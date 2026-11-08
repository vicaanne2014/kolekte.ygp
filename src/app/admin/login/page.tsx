import { login } from "@/app/actions";
import Msg from "@/components/Msg";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main>
      <h1>Kolekte — Back Office</h1>
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
