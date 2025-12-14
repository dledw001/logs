"use client";

import { useState } from "react";
import { callApi } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [statusReq, setStatusReq] = useState(null);
  const [statusComplete, setStatusComplete] = useState(null);

  const submitRequest = async (e) => {
    e.preventDefault();
    setStatusReq("Requesting reset...");
    const res = await callApi("/api/auth/password-reset/request", {
      method: "POST",
      body: { identifier }
    });
    setStatusReq(`Response (${res.status}): ${JSON.stringify(res.data)}`);
  };

  const submitComplete = async (e) => {
    e.preventDefault();
    setStatusComplete("Submitting new password...");
    const res = await callApi("/api/auth/password-reset/complete", {
      method: "POST",
      body: { token, password: newPassword }
    });
    setStatusComplete(`Response (${res.status}): ${JSON.stringify(res.data)}`);
  };

  return (
    <main className="py-4">
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card bg-body-tertiary border border-secondary-subtle h-100">
            <div className="card-body">
              <h1 className="h5 mb-3">Forgot password</h1>
              <form className="vstack gap-3" onSubmit={submitRequest}>
                <input
                  className="form-control bg-dark text-light border-secondary"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Username or email"
                  autoComplete="username"
                />
                <button className="btn btn-primary" type="submit">
                  Send reset link/token
                </button>
              </form>
              {statusReq && <p className="text-secondary small mt-3 mb-0">{statusReq}</p>}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card bg-body-tertiary border border-secondary-subtle h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">Complete reset</h2>
              <form className="vstack gap-3" onSubmit={submitComplete}>
                <input
                  className="form-control bg-dark text-light border-secondary"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Reset token"
                  autoComplete="one-time-code"
                />
                <input
                  className="form-control bg-dark text-light border-secondary"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <button className="btn btn-primary" type="submit">
                  Update password
                </button>
              </form>
              {statusComplete && <p className="text-secondary small mt-3 mb-0">{statusComplete}</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
