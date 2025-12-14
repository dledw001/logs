"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiHint, callApi } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setStatus("Creating account...");
    const res = await callApi("/api/auth/register", {
      method: "POST",
      body: { username, email, password }
    });
    if (res.status === 201) {
      setStatus("Registered. Redirecting to login...");
      window.location.href = "/login";
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
              <h1 className="h4 mb-2">Register</h1>
              <p className="text-secondary mb-4 small">API target: {apiHint()}</p>
              <form className="vstack gap-3" onSubmit={submit}>
                <div>
                  <input
                    className="form-control bg-dark text-light border-secondary"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <input
                    className="form-control bg-dark text-light border-secondary"
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoComplete="email"
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
                    autoComplete="new-password"
                  />
                </div>
                <button className="btn btn-primary" type="submit">
                  Create account
                </button>
              </form>
              {status && <p className="text-secondary small mt-3">{status}</p>}
            </div>
          </div>
          <div className="card bg-body-tertiary border border-secondary-subtle mt-3">
            <div className="card-body d-flex align-items-center justify-content-between">
              <span className="text-secondary small">Already registered?</span>
              <button className="btn btn-outline-light btn-sm" onClick={() => router.push("/login")}>
                Go to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
