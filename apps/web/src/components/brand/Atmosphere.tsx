/** Fixed background layers on every screen: violet glows, drifting fog and film grain. */
export function Atmosphere() {
  return (
    <div aria-hidden="true">
      <div className="gs-glow" />
      <div className="gs-fog" />
      <div className="gs-grain" />
    </div>
  );
}
