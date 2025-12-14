"use client";

type Props = { csrf: string };

export default function LogoutButton({ csrf }: Props) {
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
