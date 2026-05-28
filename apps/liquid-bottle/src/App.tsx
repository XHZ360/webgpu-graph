import { useEffect } from "react";
import { run } from "./scene";

if (import.meta.hot) {
  import.meta.hot.accept("./scene", (mod) => {
    mod?.run?.();
  });
}

function App() {
  useEffect(() => {
    run();
  }, []);
  return (
    <main style={{ width: "100%", height: "100%" }}>
      <canvas id="liquid-bottle-canvas" style={{ width: "100%", height: "100%" }}></canvas>
    </main>
  );
}

export default App;
