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
    <main>
      <canvas id="liquid-bottle-canvas"></canvas>
    </main>
  );
}

export default App;
