import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.clinicId) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100" style={{ fontFamily: "var(--font-sora)" }}>
            Neuvvia
          </h1>
          <p className="mt-3 text-base italic text-zinc-500 dark:text-zinc-400" style={{ fontFamily: "var(--font-brand)" }}>
            One Step Ahead of the Day
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
