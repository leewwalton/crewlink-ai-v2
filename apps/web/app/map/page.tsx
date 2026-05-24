import { pilots, requests } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import NetworkGlobeMap from "../components/NetworkGlobeMap";

export default function MapPage() {
  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Live network map</span>
              <h1>See pilot supply around active demand.</h1>
              <p className="muted">
                Rotate and zoom the globe to explore pilot locations and open
                staffing requests. Green markers are available crew; amber
                markers are operator demand.
              </p>
            </div>
          </div>

          <NetworkGlobeMap pilots={pilots} requests={requests} />
        </div>
      </main>
    </div>
  );
}
