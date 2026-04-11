import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6 text-slate-700">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
