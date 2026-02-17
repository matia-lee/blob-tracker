import { useState } from "react";
import { BlobTracker } from "../src/BlobTracker";

export function App() {
  const [threshold, setThreshold] = useState(30);
  const [minBlobArea, setMinBlobArea] = useState(10);
  const [edgeWidth, setEdgeWidth] = useState(2.5);
  const [blobWidth, setBlobWidth] = useState(4);
  const [showLabels, setShowLabels] = useState(true);
  const [labelSize, setLabelSize] = useState(12);
  const [edgeStyle, setEdgeStyle] = useState<"solid" | "dashed" | "dotted">("dotted");
  const [blobStyle, setBlobStyle] = useState<"rect" | "corners">("corners");
  const [cornerLength, setCornerLength] = useState(0.25);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <BlobTracker
        src="/subway.mp4"
        threshold={threshold}
        minBlobArea={minBlobArea}
        edgeColor={{ r: 255, g: 255, b: 255, a: 1 }}
        edgeWidth={edgeWidth}
        blobColor={{ r: 255, g: 255, b: 255, a: 1 }}
        blobWidth={blobWidth}
        showLabels={showLabels}
        labelColor={{ r: 255, g: 255, b: 255, a: 1 }}
        labelFont={`${labelSize}px monospace`}
        edgeStyle={edgeStyle}
        blobStyle={blobStyle}
        cornerLength={cornerLength}
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
        <label>
          edge style:{" "}
          <select value={edgeStyle}
            onChange={(e) => setEdgeStyle(e.target.value as "solid" | "dashed" | "dotted")}
            style={{ background: "#333", color: "white", border: "1px solid #555", padding: "2px 4px" }}>
            <option value="solid">solid</option>
            <option value="dashed">dashed</option>
            <option value="dotted">dotted</option>
          </select>
        </label>
        <label>
          blob style:{" "}
          <select value={blobStyle}
            onChange={(e) => setBlobStyle(e.target.value as "rect" | "corners")}
            style={{ background: "#333", color: "white", border: "1px solid #555", padding: "2px 4px" }}>
            <option value="rect">rect</option>
            <option value="corners">corners</option>
          </select>
        </label>
        {blobStyle === "corners" && (
          <label>
            corner length: {cornerLength}
            <input type="range" min="0.1" max="0.5" step="0.05" value={cornerLength}
              onChange={(e) => setCornerLength(+e.target.value)}
              style={{ width: "100%" }} />
          </label>
        )}
      </div>
    </div>
  );
}
