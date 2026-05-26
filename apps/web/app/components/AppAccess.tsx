"use client";

import RequireAuth from "./RequireAuth";
import RequireRole from "./RequireRole";

type AppAccessProps = {
  area: "operator" | "pilot" | "shared" | "admin";
  children: React.ReactNode;
  authMessage?: string;
  roleMessage?: string;
};

export default function AppAccess({
  area,
  children,
  authMessage,
  roleMessage,
}: AppAccessProps) {
  return (
    <RequireAuth loadingMessage={authMessage}>
      <RequireRole area={area} loadingMessage={roleMessage}>
        {children}
      </RequireRole>
    </RequireAuth>
  );
}
