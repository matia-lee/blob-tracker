import { useState } from "react";
import { BlobTracker } from "../src/BlobTracker";

export function App() {
  const [threshold, setThreshold] = useState(20);
  const [minBlobArea, setMinBlobArea] = useState(10);
  const [edgeWidth, setEdgeWidth] = useState(2.5);
  const [blobWidth, setBlobWidth] = useState(3);
  const [showLabels, setShowLabels] = useState(true);
  const [labelSize, setLabelSize] = useState(12);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <BlobTracker
        src="/shibuya.mp4"
        threshold={threshold}
        minBlobArea={minBlobArea}
        edgeWidth={edgeWidth}
        blobWidth={blobWidth}
        showLabels={showLabels}
        labelFont={`${labelSize}px monospace`}
      />
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          background: "rgba(0,0,0,0.8)",
          padding: "12px 16px",
          fontFamily: "monospace",
          fontSize: "12px",
          color: "white",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <label>
          threshold: {threshold}
          <input type="range" min="0" max="255" value={threshold}
            onChange={(e) => setThreshold(+e.target.value)}
            style={{ width: "100%" }} />
        </label>
        <label>
          min blob area: {minBlobArea}
          <input type="range" min="0" max="500" value={minBlobArea}
            onChange={(e) => setMinBlobArea(+e.target.value)}
            style={{ width: "100%" }} />
        </label>
        <label>
          edge width: {edgeWidth}
          <input type="range" min="0.5" max="10" step="0.5" value={edgeWidth}
            onChange={(e) => setEdgeWidth(+e.target.value)}
            style={{ width: "100%" }} />
        </label>
        <label>
          blob width: {blobWidth}
          <input type="range" min="0.5" max="10" step="0.5" value={blobWidth}
            onChange={(e) => setBlobWidth(+e.target.value)}
            style={{ width: "100%" }} />
        </label>
        <label>
          <input type="checkbox" checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)} />
          {" "}labels
        </label>
        {showLabels && (
          <label>
            label size: {labelSize}px
            <input type="range" min="6" max="32" value={labelSize}
              onChange={(e) => setLabelSize(+e.target.value)}
              style={{ width: "100%" }} />
          </label>
        )}
      </div>
    </div>
  );
}
