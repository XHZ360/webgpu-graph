export interface ParticleCanvasRendererOptions {
  canvas: HTMLCanvasElement;
  worldWidth: number;
  worldHeight: number;
  particleRadius?: number;
}

const BACKGROUND_COLOR = "#08111f";
const PARTICLE_COLOR = "#7dd3fc";
const BORDER_COLOR = "rgba(148, 163, 184, 0.32)";
const DEFAULT_PARTICLE_RADIUS = 0.02;
const VIEW_PADDING = 12;

export class ParticleCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly particleRadius: number;
  private readonly resizeObserver: ResizeObserver | null;

  constructor(options: ParticleCanvasRendererOptions) {
    const context = options.canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to acquire a 2D rendering context.");
    }

    this.canvas = options.canvas;
    this.context = context;
    this.worldWidth = options.worldWidth;
    this.worldHeight = options.worldHeight;
    this.particleRadius = options.particleRadius ?? DEFAULT_PARTICLE_RADIUS;
    this.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            this.syncCanvasSize();
          });

    this.syncCanvasSize();
    this.resizeObserver?.observe(this.canvas);
  }

  render(positions: Float32Array): void {
    this.syncCanvasSize();

    const { width, height } = this.canvas;
    const ctx = this.context;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    const drawableWidth = Math.max(1, width - VIEW_PADDING * 2);
    const drawableHeight = Math.max(1, height - VIEW_PADDING * 2);
    const scaleX = drawableWidth / this.worldWidth;
    const scaleY = drawableHeight / this.worldHeight;
    const particleRadiusPx = Math.max(1.5, this.particleRadius * Math.min(scaleX, scaleY));

    ctx.fillStyle = PARTICLE_COLOR;
    ctx.beginPath();

    for (let index = 0; index < positions.length; index += 2) {
      const x = VIEW_PADDING + positions[index] * scaleX;
      const y = height - VIEW_PADDING - positions[index + 1] * scaleY;
      ctx.moveTo(x + particleRadiusPx, y);
      ctx.arc(x, y, particleRadiusPx, 0, Math.PI * 2);
    }

    ctx.fill();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
  }

  private syncCanvasSize(): void {
    const dpr = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
    const clientWidth = Math.max(
      1,
      Math.round(this.canvas.clientWidth || this.canvas.width || 960),
    );
    const clientHeight = Math.max(
      1,
      Math.round(this.canvas.clientHeight || this.canvas.height || 540),
    );
    const displayWidth = Math.max(1, Math.round(clientWidth * dpr));
    const displayHeight = Math.max(1, Math.round(clientHeight * dpr));

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
  }
}
