// GameEngine.ts - Motor de jogo com sprites e renderização otimizada

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  hudHeight: number;
  tileSize: number;
  cols: number;
  visibleRows: number;
}

export interface SpriteAssets {
  player: HTMLImageElement | null;
  car: HTMLImageElement | null;
  motorcycle: HTMLImageElement | null;
  bus: HTMLImageElement | null;
  truck: HTMLImageElement | null;
}

export interface GameState {
  playerCol: number;
  playerRow: number;
  playerAnimationFrame: number;
  score: number;
  lives: number;
  gameOver: boolean;
  won: boolean;
  screenShake: number;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;
  private sprites: SpriteAssets;
  private gameState: GameState;

  constructor(
    canvas: HTMLCanvasElement,
    config: GameConfig,
    sprites: SpriteAssets
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.config = config;
    this.sprites = sprites;
    this.gameState = {
      playerCol: Math.floor(config.cols / 2),
      playerRow: config.visibleRows - 2,
      playerAnimationFrame: 0,
      score: 0,
      lives: 5,
      gameOver: false,
      won: false,
      screenShake: 0,
    };
  }

  // Carregar sprites
  loadSprites(spriteUrls: {
    player: string;
    car: string;
    motorcycle: string;
    bus: string;
    truck: string;
  }): Promise<void> {
    return Promise.all([
      this.loadImage(spriteUrls.player, "player"),
      this.loadImage(spriteUrls.car, "car"),
      this.loadImage(spriteUrls.motorcycle, "motorcycle"),
      this.loadImage(spriteUrls.bus, "bus"),
      this.loadImage(spriteUrls.truck, "truck"),
    ]).then(() => {});
  }

  private loadImage(url: string, type: keyof SpriteAssets): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.sprites[type] = img;
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load sprite: ${type}`);
        resolve();
      };
      img.src = url;
    });
  }

  // Renderizar sprite do jogador
  renderPlayer(x: number, y: number): void {
    if (this.sprites.player) {
      this.ctx.drawImage(
        this.sprites.player,
        x - this.config.tileSize / 2,
        y - this.config.tileSize / 2,
        this.config.tileSize,
        this.config.tileSize
      );
    } else {
      // Fallback: desenhar bloco amarelo
      this.ctx.fillStyle = "#FFD700";
      this.ctx.fillRect(
        x - this.config.tileSize / 2,
        y - this.config.tileSize / 2,
        this.config.tileSize,
        this.config.tileSize
      );
    }
  }

  // Renderizar sprite de veículo
  renderVehicle(
    type: "car" | "motorcycle" | "bus" | "truck",
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const spriteKey = type as keyof SpriteAssets;
    if (this.sprites[spriteKey]) {
      this.ctx.drawImage(
        this.sprites[spriteKey],
        x - width / 2,
        y - height / 2,
        width,
        height
      );
    } else {
      // Fallback: desenhar bloco colorido
      const colors: Record<string, string> = {
        car: "#FF0000",
        motorcycle: "#0066FF",
        bus: "#FF9900",
        truck: "#808080",
      };
      this.ctx.fillStyle = colors[type] || "#999";
      this.ctx.fillRect(x - width / 2, y - height / 2, width, height);
    }
  }

  // Aplicar screen shake
  applyScreenShake(): void {
    if (this.gameState.screenShake > 0) {
      const shake = Math.random() * this.gameState.screenShake - this.gameState.screenShake / 2;
      this.ctx.translate(shake, 0);
      this.gameState.screenShake *= 0.9;
    }
  }

  // Renderizar efeito de brilho (coleta de recompensa)
  renderGlowEffect(x: number, y: number, intensity: number): void {
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 30);
    gradient.addColorStop(0, `rgba(255, 215, 0, ${intensity})`);
    gradient.addColorStop(1, "rgba(255, 215, 0, 0)");
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 30, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Renderizar parallax background
  renderParallaxBackground(cameraY: number): void {
    // Camada de fundo distante (se houver)
    this.ctx.fillStyle = "#87CEEB";
    this.ctx.fillRect(0, 0, this.canvas.width, this.config.hudHeight);

    // Camada de céu
    const skyOffset = (cameraY * 0.1) % this.canvas.height;
    this.ctx.fillStyle = "#E0F6FF";
    this.ctx.fillRect(0, this.config.hudHeight, this.canvas.width, this.canvas.height - this.config.hudHeight);
  }

  // Renderizar HUD
  renderHUD(score: number, lives: number, progress: number, maxProgress: number): void {
    // Fundo da barra HUD
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.config.hudHeight);

    // Score
    this.ctx.fillStyle = "#FFD700";
    this.ctx.font = "bold 18px Arial, sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText(`Score: ${score}`, 20, 30);

    // Vidas (corações)
    this.ctx.textAlign = "center";
    for (let i = 0; i < lives; i++) {
      this.renderHeart(this.canvas.width / 2 + (i - lives / 2) * 30, 25, 12);
    }

    // Progresso
    this.ctx.textAlign = "right";
    this.ctx.fillText(`${progress}/${maxProgress}`, this.canvas.width - 20, 30);

    // Barra de progresso
    const barWidth = 150;
    const barHeight = 10;
    const barX = this.canvas.width - barWidth - 20;
    const barY = 40;
    const progressPercent = progress / maxProgress;

    this.ctx.strokeStyle = "#FFD700";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    this.ctx.fillStyle = "#FFD700";
    this.ctx.fillRect(barX, barY, barWidth * progressPercent, barHeight);
  }

  // Renderizar coração (vida)
  private renderHeart(x: number, y: number, size: number): void {
    this.ctx.fillStyle = "#FF0000";
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + size / 2);
    this.ctx.bezierCurveTo(
      x - size / 2,
      y - size / 4,
      x - size / 2,
      y - size / 2,
      x - size / 4,
      y - size / 2
    );
    this.ctx.bezierCurveTo(
      x,
      y - size / 1.2,
      x,
      y - size / 1.2,
      x + size / 4,
      y - size / 2
    );
    this.ctx.bezierCurveTo(
      x + size / 2,
      y - size / 2,
      x + size / 2,
      y - size / 4,
      x,
      y + size / 2
    );
    this.ctx.fill();
  }

  // Renderizar joystick virtual (mobile)
  renderVirtualJoystick(x: number, y: number, radius: number, activeDirection: string | null): void {
    // Fundo do joystick
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Borda do joystick
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Botão do joystick
    const knobRadius = radius / 3;
    let knobX = x;
    let knobY = y;

    if (activeDirection) {
      const distance = radius * 0.6;
      switch (activeDirection) {
        case "up":
          knobY -= distance;
          break;
        case "down":
          knobY += distance;
          break;
        case "left":
          knobX -= distance;
          break;
        case "right":
          knobX += distance;
          break;
      }
    }

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    this.ctx.beginPath();
    this.ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Atualizar estado do jogo
  updateGameState(newState: Partial<GameState>): void {
    this.gameState = { ...this.gameState, ...newState };
  }

  getGameState(): GameState {
    return this.gameState;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  // Trigger screen shake
  triggerScreenShake(intensity: number = 5): void {
    this.gameState.screenShake = Math.max(this.gameState.screenShake, intensity);
  }

  // Limpar canvas
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
