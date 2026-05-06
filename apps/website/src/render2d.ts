export interface ParticleCanvasRendererOptions {
  canvas: HTMLCanvasElement;
  worldWidth: number;
  worldHeight: number;
  particleRadius?: number;
  boundaryMode?: number;
  boundaryHalfHeight?: number;
  boundaryBezierNeckWidth?: number;
  boundaryBezierTopWidth?: number;
  boundaryBezierBottomWidth?: number;
}

const BACKGROUND_START = "rgba(12, 22, 32, 0.45)";
const BACKGROUND_END = "rgba(12, 22, 32, 0.8)";
const BOUNDARY_COLOR = "rgba(255, 205, 115, 0.9)";
const DEFAULT_PARTICLE_RADIUS = 0.02;
const BEZIER_DASH_PATTERN = [8, 6];
const BEZIER_STEPS = 80;

function boundaryBezierEase(t: number): number {
  const oneMinusT = 1 - t;
  return 3 * oneMinusT * oneMinusT * t * 0.72 + 3 * oneMinusT * t * t * 0.98 + t * t * t;
}

export class ParticleCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly particleRadius: number;
  private readonly boundaryMode: number;
  private readonly boundaryHalfHeight: number;
  private readonly boundaryBezierNeckWidth: number;
  private readonly boundaryBezierTopWidth: number;
  private readonly boundaryBezierBottomWidth: number;
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
    this.boundaryMode = options.boundaryMode ?? 0;
    this.boundaryHalfHeight = options.boundaryHalfHeight ?? this.worldHeight * 0.425;
    this.boundaryBezierNeckWidth = options.boundaryBezierNeckWidth ?? this.worldWidth * 0.45;
    this.boundaryBezierTopWidth = options.boundaryBezierTopWidth ?? this.worldWidth * 0.8;
    this.boundaryBezierBottomWidth = options.boundaryBezierBottomWidth ?? this.worldWidth * 0.8;
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

    const width = Math.max(1, this.canvas.clientWidth || this.canvas.width);
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.height);
    const ctx = this.context;

    ctx.clearRect(0, 0, width, height);
    this.drawBackground(width, height);
    this.drawBoundaryGuide(width, height);
    this.drawParticles(positions, width, height);
  }

  private drawBackground(width: number, height: number): void {
    const ctx = this.context;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, BACKGROUND_START);
    gradient.addColorStop(1, BACKGROUND_END);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const time = performance.now() * 0.001;
    ctx.globalCompositeOperation = "lighter";

    ctx.fillStyle = `rgba(66, 221, 185, ${0.18 + Math.sin(time) * 0.04})`;
    ctx.beginPath();
    ctx.arc(width * 0.25, height * 0.2, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 205, 115, ${0.14 + Math.cos(time * 1.3) * 0.05})`;
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.75, 160, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
  }

  private drawBoundaryGuide(width: number, height: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = BOUNDARY_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(this.boundaryMode === 1 ? BEZIER_DASH_PATTERN : []);

    if (this.boundaryMode === 1) {
      const centerX = this.worldWidth * 0.5;
      const centerY = this.worldHeight * 0.5;
      const yMin = Math.max(0, centerY - this.boundaryHalfHeight);
      const yMax = Math.min(this.worldHeight, centerY + this.boundaryHalfHeight);
      const maxHalfWidth = this.worldWidth * 0.5;
      const neckHalfWidth = Math.min(this.boundaryBezierNeckWidth * 0.5, maxHalfWidth);
      const topHalfWidth = Math.min(this.boundaryBezierTopWidth * 0.5, maxHalfWidth);
      const bottomHalfWidth = Math.min(this.boundaryBezierBottomWidth * 0.5, maxHalfWidth);

      ctx.beginPath();
      for (let index = 0; index <= BEZIER_STEPS; index += 1) {
        const t = index / BEZIER_STEPS;
        const worldY = yMin + (yMax - yMin) * t;
        const localY =
          this.boundaryHalfHeight > 0 ? Math.abs(worldY - centerY) / this.boundaryHalfHeight : 0;
        const eased = boundaryBezierEase(localY);
        const targetHalfWidth = worldY >= centerY ? topHalfWidth : bottomHalfWidth;
        const xOffset = neckHalfWidth + (targetHalfWidth - neckHalfWidth) * eased;
        const [x, y] = this.toCanvasPoint(centerX - xOffset, worldY, width, height);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      for (let index = BEZIER_STEPS; index >= 0; index -= 1) {
        const t = index / BEZIER_STEPS;
        const worldY = yMin + (yMax - yMin) * t;
        const localY =
          this.boundaryHalfHeight > 0 ? Math.abs(worldY - centerY) / this.boundaryHalfHeight : 0;
        const eased = boundaryBezierEase(localY);
        const targetHalfWidth = worldY >= centerY ? topHalfWidth : bottomHalfWidth;
        const xOffset = neckHalfWidth + (targetHalfWidth - neckHalfWidth) * eased;
        const [x, y] = this.toCanvasPoint(centerX + xOffset, worldY, width, height);
        ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeRect(0, 0, width, height);
    }

    ctx.restore();
  }

  private drawParticles(positions: Float32Array, width: number, height: number): void {
    const ctx = this.context;
    const scaleX = width / this.worldWidth;
    const scaleY = height / this.worldHeight;
    const particleRadiusPx = this.particleRadius * Math.min(scaleX, scaleY);

    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < positions.length; index += 2) {
      const [x, y] = this.toCanvasPoint(positions[index], positions[index + 1], width, height);
      const hue = 165 + Math.sin((x + y) * 0.02) * 25;
      ctx.fillStyle = `hsla(${hue}, 88%, 73%, 0.76)`;
      ctx.beginPath();
      ctx.arc(x, y, particleRadiusPx, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
  }

  private syncCanvasSize(): void {
    const dpr =
      typeof window === "undefined" ? 1 : Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = this.canvas.getBoundingClientRect();
    const displayWidth = Math.max(1, Math.floor(rect.width * dpr));
    const displayHeight = Math.max(1, Math.floor(rect.height * dpr));

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private toCanvasPoint(wx: number, wy: number, width: number, height: number): [number, number] {
    return [(wx / this.worldWidth) * width, height - (wy / this.worldHeight) * height];
  }
}
