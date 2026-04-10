import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>Loading...</main>}>
      <LoginClient />
    </Suspense>
  );
}
