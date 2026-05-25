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
              <h1>Map</h1>
            </div>
          </div>

          <NetworkGlobeMap pilots={pilots} requests={requests} />
        </div>
      </main>
    </div>
  );
}
