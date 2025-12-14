"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiHint, callApi } from "../../lib/api";

type Me = {
  id: number;
  username: string;
  username_display: string;
  email: string;
  roles: string[];
};

type Session = {
  id: number;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at?: string | null;
  user_agent?: string;
  ip?: string;
};

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await callApi("/api/auth/me");
      if (res.status === 200 && res.data && typeof res.data === "object") {
        setMe(res.data as Me);
      } else {
        setStatus("Not logged in");
      }
    })();
  }, []);

  const fetchSessions = async () => {
    setStatus("Loading sessions...");
    const res = await callApi("/api/auth/sessions");
    if (res.status === 200 && res.data && typeof res.data === "object") {
      const data = res.data as { sessions: Session[] };
      setSessions(data.sessions || []);
      setStatus("Sessions loaded");
    } else {
      setStatus(`Failed (${res.status})`);
    }
  };

  const logout = async () => {
    await callApi("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const filteredSessions = showRevoked ? sessions : sessions.filter((s) => !s.revoked_at);

  if (!me && status === "Not logged in") {
    return (
      <main className="py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="card bg-body-tertiary border border-secondary-subtle">
              <div className="card-body d-flex flex-column gap-2">
                <div className="h5 mb-0">Not logged in</div>
                <button className="btn btn-primary" onClick={() => router.push("/login")}>
                  Go to login
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="py-4">
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card bg-body-tertiary border border-secondary-subtle h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <h1 className="h4 mb-1">Welcome</h1>
                </div>
                <button className="btn btn-outline-light btn-sm" onClick={logout}>
                  Logout
                </button>
              </div>
              {me && (
                <div className="small text-light-emphasis">
                  <div>
                    <strong>User:</strong> {me.username_display || me.username}
                  </div>
                  <div>
                    <strong>Email:</strong> {me.email}
                  </div>
                  <div>
                    <strong>Roles:</strong> {(me.roles || []).join(", ") || "none"}
                  </div>
                </div>
              )}
              {status && <p className="text-secondary small mb-0">{status}</p>}
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" onClick={fetchSessions}>
                  Manage account (sessions)
                </button>
                <button className="btn btn-outline-light btn-sm" onClick={() => router.push("/docs")}>
                  View docs
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card bg-body-tertiary border border-secondary-subtle h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center">
                <h2 className="h5 mb-0">Sessions</h2>
              {sessions.length > 0 && (
                <button
                  className="btn btn-outline-light btn-sm"
                  onClick={() =>
                    callApi("/api/auth/sessions/revoke-others", { method: "POST" }).then(fetchSessions)
                  }
                >
                  Revoke other sessions
                </button>
              )}
            </div>
              {sessions.length === 0 ? (
                <p className="text-secondary small mb-0">No sessions loaded.</p>
              ) : (
                <>
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-secondary small">
                      Showing {filteredSessions.length} of {sessions.length} sessions
                    </span>
                    <div className="form-check form-switch ms-auto">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showRevoked"
                        checked={showRevoked}
                        onChange={(e) => setShowRevoked(e.target.checked)}
                      />
                      <label className="form-check-label text-secondary small" htmlFor="showRevoked">
                        Show revoked
                      </label>
                    </div>
                  </div>
                  <div className="list-group list-group-flush">
                    {filteredSessions.map((s) => (
                      <div
                        key={s.id}
                        className="list-group-item bg-body-tertiary border-secondary-subtle text-light small"
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong>ID:</strong> {s.id}
                          </div>
                          {s.revoked_at ? (
                            <span className="badge text-bg-danger-subtle text-danger-emphasis">Revoked</span>
                          ) : (
                            <span className="badge text-bg-success-subtle text-success-emphasis">Active</span>
                          )}
                        </div>
                        <div>
                          <strong>Last seen:</strong> {s.last_seen_at}
                        </div>
                        <div>
                          <strong>Expires:</strong> {s.expires_at}
                        </div>
                        {s.user_agent && (
                          <div>
                            <strong>UA:</strong> {s.user_agent}
                          </div>
                        )}
                        {s.ip && (
                          <div>
                            <strong>IP:</strong> {s.ip}
                          </div>
                        )}
                        {s.revoked_at && (
                          <div className="text-secondary small mt-1">
                            <strong>Revoked at:</strong> {s.revoked_at}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
