import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">Access the ads analytics dashboard</p>
      </div>
      <LoginForm />
      <p className="text-muted-foreground/70 text-center text-xs">
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
