"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "../../lib/api";

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState(null);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [rolesInput, setRolesInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [auditLimit, setAuditLimit] = useState(50);

  useEffect(() => {
    (async () => {
      const res = await callApi("/api/auth/me");
      if (res.status === 200 && res.data && typeof res.data === "object") {
        setMe(res.data);
        if (!res.data.is_admin) {
          setStatus("You must be an admin to view this page.");
        }
      } else {
        router.push("/login");
      }
    })();
  }, [router]);

  const loadUsers = async () => {
    setStatus("Loading users...");
    const res = await callApi("/api/admin/users");
    if (res.status === 200 && res.data && typeof res.data === "object") {
      setUsers(res.data.users || []);
      setStatus(null);
    } else {
      setStatus(`Error (${res.status}): ${JSON.stringify(res.data)}`);
    }
  };

  const loadAudit = async () => {
    setStatus("Loading audit log...");
    const res = await callApi(`/api/admin/audit-log?limit=${auditLimit}`);
    if (res.status === 200 && res.data && typeof res.data === "object") {
      const events = res.data.entries || res.data.events || res.data.audit || [];
      setAudit(events);
      setStatus(null);
    } else {
      setStatus(`Error (${res.status}): ${JSON.stringify(res.data)}`);
    }
  };

  const updateRoles = async (userId) => {
    const roles = rolesInput
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (!roles.length) {
      setStatus("Enter at least one role.");
      return;
    }
    setStatus("Updating roles...");
    const res = await callApi(`/api/admin/users/${userId}/roles`, {
      method: "PUT",
      body: { roles }
    });
    if (res.status === 200) {
      setStatus("Roles updated.");
      loadUsers();
    } else {
      setStatus(`Error (${res.status}): ${JSON.stringify(res.data)}`);
    }
  };

  if (!me) {
    return (
      <main className="py-4">
        <div className="text-secondary small">Loading...</div>
      </main>
    );
  }

  if (!me.is_admin) {
    return (
      <main className="py-4">
        <div className="text-danger small">{status || "Forbidden"}</div>
      </main>
    );
  }

  return (
    <main className="py-4">
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card bg-body-tertiary border border-secondary-subtle h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center">
                <h1 className="h5 mb-0">Users</h1>
                <button className="btn btn-outline-light btn-sm" onClick={loadUsers}>
                  Refresh
                </button>
              </div>
              {users.length === 0 ? (
                <p className="text-secondary small mb-0">No users loaded.</p>
              ) : (
                <div className="list-group list-group-flush">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className={`list-group-item bg-body-tertiary border-secondary-subtle text-light small ${
                        selectedUserId === u.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedUserId(u.id)}
                      role="button"
                    >
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{u.username_display || u.username}</strong> ({u.email})
                        </div>
                        {u.is_admin && <span className="badge text-bg-info">admin</span>}
                      </div>
                      <div>
                        <strong>Roles:</strong> {(u.roles || []).join(", ") || "none"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedUserId && (
                <div className="vstack gap-2">
                  <label className="text-secondary small mb-0">Set roles (comma-separated)</label>
                  <input
                    className="form-control bg-dark text-light border-secondary"
                    value={rolesInput}
                    onChange={(e) => setRolesInput(e.target.value)}
                    placeholder="admin,user"
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => updateRoles(selectedUserId)}>
                    Update roles
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card bg-body-tertiary border border-secondary-subtle h-100">
            <div className="card-body d-flex flex-column gap-3">
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <h2 className="h5 mb-0">Audit log</h2>
                  <div className="d-flex align-items-center gap-2">
                    <select
                      className="form-select form-select-sm bg-dark text-light border-secondary"
                      style={{ width: "120px" }}
                      value={auditLimit}
                      onChange={(e) => {
                        setAuditLimit(Number(e.target.value));
                      }}
                    >
                      {[20, 50, 100, 200].map((n) => (
                        <option key={n} value={n}>
                          Last {n}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-outline-light btn-sm" onClick={loadAudit}>
                      Refresh
                    </button>
                  </div>
                </div>
              {audit.length === 0 ? (
                <p className="text-secondary small mb-0">No audit events loaded.</p>
              ) : (
                <div className="list-group list-group-flush">
                  {audit.map((e, idx) => (
                    <div key={idx} className="list-group-item bg-body-tertiary border-secondary-subtle text-light small">
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{e.event}</strong> {e.user_id ? `(user ${e.user_id})` : ""}
                        </div>
                        <span className="text-secondary">{e.ts || e.time || e.created_at}</span>
                      </div>
                      <div className="text-secondary small">
                        {e.ip ? `ip: ${e.ip} ` : ""}
                        {e.meta ? `meta: ${JSON.stringify(e.meta)}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {status && <p className="text-secondary small mt-3">{status}</p>}
    </main>
  );
}
