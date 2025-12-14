"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "../../lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await callApi("/api/auth/me");
      if (res.status === 200 && res.data && typeof res.data === "object") {
        setMe(res.data);
      } else {
        setStatus("Not authenticated");
        router.push("/login");
      }
    })();
  }, [router]);

  return (
    <main className="py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="card bg-body-tertiary border border-secondary-subtle">
            <div className="card-body">
              <h1 className="h5 mb-3">Profile</h1>
              {me ? (
                <div className="vstack gap-2 small text-light-emphasis">
                  <div>
                    <strong>Username:</strong> {me.username_display || me.username}
                  </div>
                  <div>
                    <strong>Email:</strong> {me.email}
                  </div>
                  <div>
                    <strong>Email verified:</strong> {me.email_verified_at ? "Yes" : "No"}
                  </div>
                  <div>
                    <strong>Roles:</strong> {(me.roles || []).join(", ") || "none"}
                  </div>
                  <div>
                    <strong>Created:</strong> {me.created_at}
                  </div>
                </div>
              ) : (
                <p className="text-secondary small mb-0">{status || "Loading..."}</p>
              )}
              <div className="d-flex gap-2 mt-3">
                <button className="btn btn-outline-light btn-sm" onClick={() => router.push("/account")}>
                  Change password
                </button>
                <button className="btn btn-outline-light btn-sm" onClick={() => router.push("/home")}>
                  Back to home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
