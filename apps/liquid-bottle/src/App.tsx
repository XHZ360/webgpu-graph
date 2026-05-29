import { useEffect } from "react";
import { run, stop } from "./scene";

if (import.meta.hot) {
  import.meta.hot.accept("./scene", (mod) => {
    mod?.run?.();
  });
  import.meta.hot.dispose(() => {
    stop();
  });
}

function App() {
  useEffect(() => {
    void run();
    return () => {
      stop();
    };
  }, []);
  return (
    <main style={{ width: "100%", height: "100%" }}>
      <canvas id="liquid-bottle-canvas" style={{ width: "100%", height: "100%" }}></canvas>
    </main>
  );
}

export default App;
