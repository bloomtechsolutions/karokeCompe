import { redirect } from "next/navigation";
import { Header, NavLink } from "@/components/Header";
import { getCurrentProfile } from "@/lib/data";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile?.active) redirect(profile.role === "admin" ? "/admin" : "/judge");

  return (
    <>
      <Header right={<NavLink href="/">Dashboard</NavLink>} />
      <main className="mx-auto max-w-sm px-4 py-12">
        <div className="card">
          <h1 className="text-xl font-bold">Judge &amp; organiser sign in</h1>
          <p className="mt-1 mb-5 text-sm text-muted">
            Audience members don&apos;t need to sign in — just open the voting page during the final.
          </p>
          <LoginForm />
        </div>
      </main>
    </>
  );
}
