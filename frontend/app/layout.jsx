import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import Link from "next/link";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Auth Starter UI",
  description: "Next.js frontend shell for the auth-first backend"
};

export default async function RootLayout({ children }) {
  const store = await cookies();
  const isAuthed = store.has("sid");
  const csrf = store.get("csrf_token")?.value ?? "";
  const brandHref = isAuthed ? "/home" : "/login";
  return (
    <html lang="en" data-bs-theme="dark">
      <body className="bg-dark text-light min-vh-100">
        <header className="border-bottom border-secondary sticky-top bg-body-tertiary">
          <nav className="navbar navbar-dark container d-flex align-items-center justify-content-between py-3">
            <Link className="navbar-brand fw-semibold mb-0" href={brandHref}>
              Auth Starter
            </Link>
            <ul className="navbar-nav flex-row align-items-center gap-2 mb-0">
              {!isAuthed && (
                <>
                  <li className="nav-item">
                    <Link className="nav-link px-2" href="/login">
                      Login
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link px-2" href="/register">
                      Register
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link px-2" href="/forgot-password">
                      Forgot password
                    </Link>
                  </li>
                </>
              )}
              <li className="nav-item">
                <Link className="nav-link px-2" href="/home">
                  Home
                </Link>
              </li>
              {isAuthed && (
                <li className="nav-item">
                  <Link className="nav-link px-2" href="/profile">
                    Profile
                  </Link>
                </li>
              )}
              {isAuthed && (
                <li className="nav-item">
                  <Link className="nav-link px-2" href="/account">
                    Manage account
                  </Link>
                </li>
              )}
            </ul>
            {isAuthed && <LogoutButton csrf={csrf} />}
          </nav>
        </header>
        <div className="container py-4">{children}</div>
      </body>
    </html>
  );
}

function LogoutButton({ csrf }) {
  if (typeof window === "undefined") return null;
  const handle = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "x-csrf-token": csrf } : {}
      });
    } finally {
      window.location.href = "/login";
    }
  };
  return (
    <button className="btn btn-outline-light btn-sm" type="button" onClick={handle}>
      Logout
    </button>
  );
}
