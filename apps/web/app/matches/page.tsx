import { Suspense } from "react";
import MatchesPageClient from "./MatchesPageClient";

export default function MatchesPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell">
          <main className="app-main">
            <div className="container">
              <p className="muted">Loading matches…</p>
            </div>
          </main>
        </div>
      }
    >
      <MatchesPageClient />
    </Suspense>
  );
}
