"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiHint, callApi } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setStatus("Signing in...");
    const res = await callApi("/api/auth/login", {
      method: "POST",
      body: { identifier, password }
    });
    if (res.status === 200) {
      setStatus("Logged in, redirecting...");
      window.location.href = "/home";
    } else {
      setStatus(`Failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
  };

  return (
    <main className="py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="card bg-body-tertiary border border-secondary-subtle">
            <div className="card-body">
              <h1 className="h4 mb-2">Login</h1>
              <p className="text-secondary mb-4 small">API target: {apiHint()}</p>
              <form className="vstack gap-3" onSubmit={submit}>
                <div>
                  <input
                    className="form-control bg-dark text-light border-secondary"
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Username or email address"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <input
                    className="form-control bg-dark text-light border-secondary"
                    id="password"
                    type="password"
                    value={password}
                    placeholder="Password"
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <button className="btn btn-primary" type="submit">
                  Sign in
                </button>
              </form>
              {status && <p className="text-secondary small mt-3">{status}</p>}
            </div>
          </div>
          <div className="card bg-body-tertiary border border-secondary-subtle mt-3">
            <div className="card-body d-flex align-items-center justify-content-between">
              <span className="text-secondary small">Need an account?</span>
              <button className="btn btn-outline-light btn-sm" onClick={() => router.push("/register")}>
                Go to register
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
