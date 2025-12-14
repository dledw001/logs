"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "../../lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("Updating password...");
    const res = await callApi("/api/auth/password/change", {
      method: "POST",
      body: { current_password: currentPassword, new_password: newPassword }
    });
    if (res.status === 204) {
      setStatus("Password changed. Please sign in again.");
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
              <h1 className="h5 mb-3">Manage account</h1>
              <p className="text-secondary small mb-3">
                Change your password. This will revoke other sessions.
              </p>
              <form className="vstack gap-3" onSubmit={submit}>
                <input
                  className="form-control bg-dark text-light border-secondary"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  autoComplete="current-password"
                />
                <input
                  className="form-control bg-dark text-light border-secondary"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <div className="d-flex gap-2">
                  <button className="btn btn-primary" type="submit">
                    Update password
                  </button>
                  <button
                    className="btn btn-outline-light"
                    type="button"
                    onClick={() => router.push("/home")}
                  >
                    Back to home
                  </button>
                </div>
              </form>
              {status && <p className="text-secondary small mt-3 mb-0">{status}</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
