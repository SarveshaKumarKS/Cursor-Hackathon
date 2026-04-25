// Hero animation that fires once per session when the first vouch lands.

export default function CrowningCeremony({ leaderName }) {
  return (
    <div className="ceremony-overlay" role="status" aria-live="polite">
      <div className="ceremony-card">
        <div className="crown-drop">👑</div>
        <div className="ceremony-subtitle">All hail</div>
        <div className="ceremony-title">{leaderName}</div>
        <div className="ceremony-subtitle">is the first Tribe Leader</div>
      </div>
    </div>
  );
}
