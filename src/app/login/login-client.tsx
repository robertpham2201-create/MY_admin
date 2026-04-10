"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = useMemo(() => sp.get("next") || "/admin/report", [sp]);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
        return;
      }
      router.push(nextPath);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui", maxWidth: 520 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Login</h1>
      <p style={{ color: "#555", marginBottom: 12 }}>Nhap API key de vao admin.</p>
      <label style={{ display: "block" }}>
        API Key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ width: "100%" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </label>
      <button onClick={submit} disabled={loading} style={{ padding: 10, marginTop: 12, width: "100%" }}>
        {loading ? "..." : "Sign in"}
      </button>
      {error ? <div style={{ marginTop: 12, color: "#b91c1c" }}>{error}</div> : null}
    </main>
  );
}
