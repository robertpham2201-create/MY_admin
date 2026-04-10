import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0f1a] p-6 text-slate-200">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
