import { operators } from "@crewlink/domain";
import AppNav from "../components/AppNav";

export default function ProfilePage() {
  const operator = operators[0];

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Operator profile</span>
              <h1>{operator.organization}</h1>
              <p className="muted">
                Account profile fields are ready for Cognito identity claims and
                DynamoDB persistence.
              </p>
            </div>
          </div>

          <section className="grid">
            <div className="card panel" style={{ gridColumn: "span 7" }}>
              <h2>Organization</h2>
              <div className="list">
                <p>
                  <b>Contact:</b> {operator.contactName}
                </p>
                <p>
                  <b>Email:</b> {operator.email}
                </p>
                <p>
                  <b>Status:</b> {operator.status}
                </p>
              </div>
            </div>
            <div className="card panel" style={{ gridColumn: "span 5" }}>
              <h2>Operating profile</h2>
              <div className="chips">
                {[...operator.fleetTypes, ...operator.operatingRegions].map((chip) => (
                  <span className="pill" key={chip}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
