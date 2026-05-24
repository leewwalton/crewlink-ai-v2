import { Suspense } from "react";
import MessagesClient from "./MessagesClient";

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell">
          <main className="app-main">
            <div className="container">
              <p className="muted">Loading messages…</p>
            </div>
          </main>
        </div>
      }
    >
      <MessagesClient />
    </Suspense>
  );
}
