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
    <main className="liquid-bottle-stage">
      <canvas id="liquid-bottle-canvas" className="liquid-bottle-canvas"></canvas>
    </main>
  );
}

export default App;
