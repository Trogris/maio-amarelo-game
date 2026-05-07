import { useEffect, useRef, useState, useCallback } from "react";
import { getAllPlayers, getOrCreatePlayer, updateGameScore, updateQuizScore, getRanking, getPlayerRank, Player, getPlayerByEmail, createPlayer, isValidCorporateEmail } from "@/lib/database";
import { getPlayerRank as getPlayerRankFunc } from "@/lib/database";

// ============================================================
// DESIGN: "Urban Voxel Pop" - Maio Amarelo
// Sistema completo: entrada, 5 vidas, missão, quiz 1M, ranking
// ============================================================

const TILE_SIZE = 50;
const PLAYER_SIZE = 40;
const COLS = 9;
const VISIBLE_ROWS = 14;
const PLAYER_Y_OFFSET = 10;
const MAX_ROWS = 20; // Missão: atravessar 20 ruas
const MAX_LIVES = 5;

const SAFETY_MESSAGES = [
  "Respeite a faixa de pedestres!",
  "Olhe para os dois lados antes de atravessar.",
  "Não use o celular ao atravessar a rua.",
  "Respeite os sinais de trânsito.",
  "A pressa é inimiga da segurança.",
  "Pedestres têm prioridade na faixa.",
  "Atenção redobrada em dias de chuva!",
  "Seja visível: use roupas claras à noite.",
  "Velocidade mata. Reduza e salve vidas.",
  "Atravesse sempre na faixa de pedestres.",
  "Sinalize suas intenções no trânsito.",
  "Crianças e idosos precisam de mais atenção.",
  "Um segundo de distração pode custar uma vida.",
  "Respeitar o trânsito é respeitar a vida.",
  "Gentileza no trânsito salva vidas.",
];

// Quiz até 1 milhão (11 perguntas)
const QUIZ_QUESTIONS = [
  {
    question: "Qual a velocidade máxima em vias urbanas sem sinalização?",
    options: ["40 km/h", "50 km/h", "60 km/h", "80 km/h"],
    correct: 1,
    prize: 1000,
  },
  {
    question: "O que significa a faixa amarela contínua no centro da via?",
    options: ["Pode ultrapassar", "Proibido ultrapassar", "Via de mão única", "Área escolar"],
    correct: 1,
    prize: 2000,
  },
  {
    question: "Qual o significado do sinal amarelo do semáforo?",
    options: ["Acelerar para passar", "Atenção/Parar se possível", "Seguir em frente", "Dar ré"],
    correct: 1,
    prize: 3000,
  },
  {
    question: "Quem tem prioridade na faixa de pedestres?",
    options: ["Veículos", "Pedestres", "Ciclistas", "Motocicletas"],
    correct: 1,
    prize: 5000,
  },
  {
    question: "É permitido usar celular ao dirigir?",
    options: ["Sim, em vias lentas", "Apenas mensagens", "Não, é infração gravíssima", "Sim, com fone"],
    correct: 2,
    prize: 10000,
  },
  {
    question: "Qual a distância mínima para seguir outro veículo?",
    options: ["1 carro", "2 segundos", "5 metros", "Não há regra"],
    correct: 1,
    prize: 20000,
  },
  {
    question: "O que o Maio Amarelo representa?",
    options: ["Mês do trânsito", "Conscientização sobre segurança no trânsito", "Dia do motorista", "Semana da mobilidade"],
    correct: 1,
    prize: 50000,
  },
  {
    question: "Qual a principal causa de acidentes no trânsito?",
    options: ["Falha mecânica", "Condições da via", "Falta de atenção do condutor", "Clima"],
    correct: 2,
    prize: 100000,
  },
  {
    question: "Qual é a idade mínima para dirigir no Brasil?",
    options: ["16 anos", "17 anos", "18 anos", "21 anos"],
    correct: 2,
    prize: 300000,
  },
  {
    question: "O que fazer se o freio falhar enquanto dirige?",
    options: ["Usar o freio de mão gradualmente", "Desligar o motor", "Procurar um local seguro para parar", "Todas as anteriores"],
    correct: 3,
    prize: 500000,
  },
  {
    question: "Qual é o objetivo principal do Maio Amarelo?",
    options: ["Aumentar vendas de carros", "Reduzir acidentes de trânsito", "Arrecadar impostos", "Promover eventos"],
    correct: 1,
    prize: 1000000,
  },
];

type LaneType = "grass" | "road" | "crosswalk";
type ItemType = "helmet" | "sign" | "seatbelt" | "traffic_light" | "crosswalk" | "star";

interface Lane {
  type: LaneType;
  speed: number;
  direction: number;
  vehicles: Vehicle[];
  hasTrees: boolean[];
  hasPoles: boolean[];
  hasBushes: boolean[];
  items: Item[];
}

interface Vehicle {
  x: number;
  width: number;
  height: number;
  color: string;
  type: "car" | "truck" | "motorcycle" | "bus" | "cyclist" | "van";
  speed: number;
}

interface Item {
  x: number;
  col: number;
  row: number;
  type: ItemType;
  collected: boolean;
  points: number;
  tip: string;
}

const VEHICLE_COLORS = ["#E53935", "#1E88E5", "#FFFFFF", "#FDD835", "#7B1FA2", "#FF6D00", "#00897B"];

function generateLane(row: number, difficulty: number): Lane {
  const rand = Math.random();
  let type: LaneType;

  if (row % 4 === 0) {
    type = "crosswalk";
  } else if (rand < 0.25) {
    type = "grass";
  } else {
    type = "road";
  }

  const baseSpeed = 1 + difficulty * 0.4;
  const speed = type === "road" ? baseSpeed + Math.random() * 2 : 0;
  const direction = Math.random() > 0.5 ? 1 : -1;

  const vehicles: Vehicle[] = [];
  if (type === "road") {
    const numVehicles = Math.max(1, 1 + Math.floor(difficulty * 0.8) + (Math.random() > 0.5 ? 1 : 0));
    const spacing = (COLS * TILE_SIZE + 200) / numVehicles;
    for (let i = 0; i < numVehicles; i++) {
      const rand = Math.random();
      let vType: "car" | "truck" | "motorcycle" | "bus" | "cyclist" | "van";
      let width: number;
      let height: number;
      let vSpeed: number;
      
      if (rand < 0.4) {
        vType = "car";
        width = 50;
        height = 24;
        vSpeed = 1.5;
      } else if (rand < 0.55) {
        vType = "motorcycle";
        width = 30;
        height = 16;
        vSpeed = 2.5;
      } else if (rand < 0.65) {
        vType = "bus";
        width = 60;
        height = 28;
        vSpeed = 0.8;
      } else if (rand < 0.75) {
        vType = "truck";
        width = 70;
        height = 26;
        vSpeed = 1.2;
      } else if (rand < 0.85) {
        vType = "cyclist";
        width = 20;
        height = 16;
        vSpeed = 1.8;
      } else {
        vType = "van";
        width = 45;
        height = 24;
        vSpeed = 1.4;
      }
      
      vehicles.push({
        x: i * spacing + Math.random() * 50,
        width,
        height,
        color: VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)],
        type: vType,
        speed: vSpeed,
      });
    }
  }
  const hasPoles: boolean[] = [];
  const hasBushes: boolean[] = [];

  const hasTrees: boolean[] = [];
  if (type === "grass") {
    for (let i = 0; i < COLS; i++) {
      hasTrees.push(Math.random() > 0.7);
      hasPoles.push(Math.random() > 0.85);
      hasBushes.push(Math.random() > 0.75);
    }
  }

  const items: Item[] = [];
  if (type === "road" && Math.random() > 0.6) {
    const col = Math.floor(Math.random() * COLS);
    const rand = Math.random();
    let itemType: ItemType;
    let points: number;
    let tip: string;
    
    if (rand < 0.3) {
      itemType = "helmet";
      points = 30;
      tip = "Proteja sua cabeça!";
    } else if (rand < 0.6) {
      itemType = "seatbelt";
      points = 30;
      tip = "Use sempre o cinto!";
    } else if (rand < 0.8) {
      itemType = "traffic_light";
      points = 25;
      tip = "Respeite a sinalização!";
    } else if (rand < 0.95) {
      itemType = "crosswalk";
      points = 40;
      tip = "Use a faixa!";
    } else {
      itemType = "star";
      points = 50;
      tip = "Trânsito seguro é responsabilidade de todos!";
    }
    
    items.push({
      x: col * TILE_SIZE + TILE_SIZE / 2,
      col,
      row,
      type: itemType,
      collected: false,
      points,
      tip,
    });
  }

  return { type, speed, direction, vehicles, hasTrees, hasPoles, hasBushes, items };
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"login" | "menu" | "playing" | "gameover" | "won" | "quiz" | "ranking">("login");
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [playerEmail, setPlayerEmail] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerSector, setPlayerSector] = useState("");
  const [loginMode, setLoginMode] = useState<"first-access" | "email-only" | "auto-login">("first-access");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Game state
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [collectedItems, setCollectedItems] = useState(0);
  const [safetyMessage, setSafetyMessage] = useState("");
  const [rewardTip, setRewardTip] = useState("");
  const rewardTipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizTimer, setQuizTimer] = useState(20);
  const quizTimerRef = useRef<number>(0);

  // Ranking state
  const [ranking, setRanking] = useState<Player[]>([]);
  const [playerRank, setPlayerRank] = useState(0);

  // Game refs
  const playerRef = useRef({ col: 4, row: 0, x: 0, y: 0, animating: false });
  const lanesRef = useRef<Lane[]>([]);
  const cameraRef = useRef(0);
  const scoreRef = useRef(0);
  const maxRowRef = useRef(0);
  const collectedItemsRef = useRef(0);
  const gameLoopRef = useRef<number>(0);
  const gameActiveRef = useRef(false);
  const lastTimeRef = useRef(0);
  const shakeRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const collisionCooldownRef = useRef(0);
  const currentPlayerRef = useRef<typeof currentPlayer>(null);

  // Manter ref de currentPlayer sempre atualizada (evita closure stale no game loop)
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  // Inicializar login ao carregar a página
  useEffect(() => {
    const initializeLogin = async () => {
      const savedEmail = localStorage.getItem("maio_amarelo_email");
      if (savedEmail) {
        const player = await getPlayerByEmail(savedEmail);
        if (player) {
          setCurrentPlayer(player);
          setLoginMode("auto-login");
          setGameState("menu");
        } else {
          localStorage.removeItem("maio_amarelo_email");
          setLoginMode("email-only");
        }
      } else {
        setLoginMode("first-access");
      }
    };
    initializeLogin();
  }, []);

  const handleFirstAccessLogin = async () => {
    setLoginError("");
    if (!playerEmail.trim() || !playerName.trim() || !playerSector.trim()) {
      setLoginError("Preencha todos os campos");
      return;
    }
    if (!isValidCorporateEmail(playerEmail)) {
      setLoginError("Use seu email corporativo para participar");
      return;
    }
    setIsLoggingIn(true);
    try {
      const player = await createPlayer(playerEmail, playerName, playerSector);
      if (player) {
        localStorage.setItem("maio_amarelo_email", player.email);
        setCurrentPlayer(player);
        setGameState("menu");
      } else {
        setLoginError("Erro ao criar conta. Tente novamente.");
      }
    } catch (error) {
      setLoginError("Erro ao conectar. Tente novamente.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailOnlyLogin = async () => {
    setLoginError("");
    if (!playerEmail.trim()) {
      setLoginError("Digite seu email corporativo");
      return;
    }
    if (!isValidCorporateEmail(playerEmail)) {
      setLoginError("Use seu email corporativo para participar");
      return;
    }
    setIsLoggingIn(true);
    try {
      const player = await getPlayerByEmail(playerEmail);
      if (player) {
        localStorage.setItem("maio_amarelo_email", player.email);
        setCurrentPlayer(player);
        setGameState("menu");
      } else {
        setLoginError("Email não encontrado. Faça o cadastro primeiro.");
      }
    } catch (error) {
      setLoginError("Erro ao conectar. Tente novamente.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSwitchUser = () => {
    localStorage.removeItem("maio_amarelo_email");
    setCurrentPlayer(null);
    setPlayerEmail("");
    setPlayerName("");
    setPlayerSector("");
    setLoginError("");
    setLoginMode("email-only");
    setGameState("login");
  };

  // Inicializar o jogo
  const initGame = useCallback(() => {
    playerRef.current = {
      col: 4,
      row: 0,
      x: 4 * TILE_SIZE + TILE_SIZE / 2,
      y: 0,
      animating: false,
    };
    cameraRef.current = 0;
    scoreRef.current = 0;
    maxRowRef.current = 0;
    collectedItemsRef.current = 0;
    livesRef.current = MAX_LIVES;

    setLives(MAX_LIVES);
    setScore(0);
    setCollectedItems(0);

    const lanes: Lane[] = [];
    for (let i = 0; i < 3; i++) {
      lanes.push({
        type: "grass",
        speed: 0,
        direction: 1,
        vehicles: [],
        hasTrees: i === 0 ? Array(COLS).fill(false) : Array.from({ length: COLS }, () => Math.random() > 0.8),
        hasPoles: Array(COLS).fill(false),
        hasBushes: Array(COLS).fill(false),
        items: [],
      });
    }
    for (let i = 3; i < VISIBLE_ROWS + 20; i++) {
      lanes.push(generateLane(i, 0));
    }
    lanesRef.current = lanes;

    setGameState("playing");
    gameActiveRef.current = true;
    lastTimeRef.current = performance.now();
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    if (!gameActiveRef.current) return;

    const deltaTime = Math.min((timestamp - lastTimeRef.current) / 16.67, 3);
    lastTimeRef.current = timestamp;
    collisionCooldownRef.current -= 1;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const player = playerRef.current;
    const lanes = lanesRef.current;

    const lerpSpeed = 0.25;
    const targetX = player.col * TILE_SIZE + TILE_SIZE / 2;
    player.x += (targetX - player.x) * lerpSpeed;
    if (Math.abs(player.x - targetX) < 1) {
      player.x = targetX;
      player.animating = false;
    }

    const playerScreenY = Math.max(TILE_SIZE, canvas.height - (PLAYER_Y_OFFSET + 1) * TILE_SIZE);
    const targetCamera = player.row * TILE_SIZE - playerScreenY;
    cameraRef.current += (targetCamera - cameraRef.current) * 0.1;

    // Atualizar veículos
    for (const lane of lanes) {
      if (lane.type === "road") {
        for (const vehicle of lane.vehicles) {
          vehicle.x += lane.speed * lane.direction * deltaTime;
          const totalWidth = COLS * TILE_SIZE + 200;
          if (lane.direction === 1 && vehicle.x > totalWidth) {
            vehicle.x = -vehicle.width - 20;
          } else if (lane.direction === -1 && vehicle.x < -vehicle.width - 20) {
            vehicle.x = totalWidth;
          }
        }
      }
    }

    // Verificar colisão
    const playerRow = player.row;
    let gameEnded = false;
    if (playerRow >= 0 && playerRow < lanes.length) {
      const currentLane = lanes[playerRow];
      if (currentLane.type === "road") {
        const playerLeft = player.x - PLAYER_SIZE / 2 + 8;
        const playerRight = player.x + PLAYER_SIZE / 2 - 8;
        for (const vehicle of currentLane.vehicles) {
          if (playerRight > vehicle.x && playerLeft < vehicle.x + vehicle.width) {
            if (collisionCooldownRef.current <= 0) {
              livesRef.current -= 1;
              setLives(livesRef.current);
              shakeRef.current = 10;
              collisionCooldownRef.current = 30;
            }

            if (livesRef.current <= 0) {
              gameActiveRef.current = false;
              const finalScore = scoreRef.current + collectedItemsRef.current * 25;
              setSafetyMessage(SAFETY_MESSAGES[Math.floor(Math.random() * SAFETY_MESSAGES.length)]);
              setScore(finalScore);
              const p = currentPlayerRef.current;
              if (p) updateGameScore(p.id, finalScore).catch(console.error);
              setTimeout(() => setGameState("gameover"), 500);
              gameEnded = true;
            } else {
              // Reset posição do jogador após colisão
              player.row = 0;
              player.col = 4;
              player.x = 4 * TILE_SIZE + TILE_SIZE / 2;
              player.y = 0;
              cameraRef.current = 0;
              maxRowRef.current = 0;
            }
            break; // parar de checar outros veículos neste frame
          }
        }
      }

      if (!gameEnded) {
        // Verificar coleta de itens
        for (const item of currentLane.items) {
          if (!item.collected && item.row === playerRow && item.col === player.col) {
            item.collected = true;
            collectedItemsRef.current += 1;
            scoreRef.current += item.points;
            setCollectedItems(collectedItemsRef.current);
            setScore(scoreRef.current);
            setRewardTip(item.tip);
            if (rewardTipTimeoutRef.current) clearTimeout(rewardTipTimeoutRef.current);
            rewardTipTimeoutRef.current = setTimeout(() => setRewardTip(""), 1000);
          }
        }
      }
    }

    if (gameEnded) return;

    // Verificar vitória (20 ruas)
    if (player.row >= MAX_ROWS) {
      gameActiveRef.current = false;
      const finalScore = scoreRef.current + collectedItemsRef.current * 25 + livesRef.current * 100;
      setScore(finalScore);
      const p = currentPlayerRef.current;
      if (p) updateGameScore(p.id, finalScore).catch(console.error);
      setTimeout(() => setGameState("won"), 500);
      return;
    }

    if (shakeRef.current > 0) {
      shakeRef.current -= 0.5;
    }

    render(ctx, canvas);
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, []);

  const render = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const camera = cameraRef.current;
    const player = playerRef.current;
    const lanes = lanesRef.current;
    const shake = shakeRef.current;

    ctx.save();
    if (shake > 0) {
      ctx.translate(Math.random() * shake - shake / 2, Math.random() * shake - shake / 2);
    }

    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startRow = Math.max(0, Math.floor(camera / TILE_SIZE) - 2);
    const endRow = Math.min(lanes.length, startRow + VISIBLE_ROWS + 4);

    for (let i = startRow; i < endRow; i++) {
      const lane = lanes[i];
      const y = i * TILE_SIZE - camera;

      switch (lane.type) {
        case "grass":
          ctx.fillStyle = i % 2 === 0 ? "#4CAF50" : "#66BB6A";
          ctx.fillRect(0, y, canvas.width, TILE_SIZE);
          for (let col = 0; col < COLS; col++) {
            const colX = col * TILE_SIZE + TILE_SIZE / 2;
            if (lane.hasTrees[col]) {
              drawTree(ctx, colX, y + TILE_SIZE / 2);
            }
            if (lane.hasPoles[col]) {
              drawPole(ctx, colX + 15, y + TILE_SIZE / 2);
            }
            if (lane.hasBushes[col]) {
              drawBush(ctx, colX - 15, y + TILE_SIZE / 2);
            }
          }
          break;
        case "road":
          ctx.fillStyle = "#424242";
          ctx.fillRect(0, y, canvas.width, TILE_SIZE);
          ctx.fillStyle = "#BDBDBD";
          for (let dx = 0; dx < canvas.width; dx += 40) {
            ctx.fillRect(dx, y + TILE_SIZE / 2 - 1, 20, 2);
          }
          for (const vehicle of lane.vehicles) {
            drawVehicle(ctx, vehicle, y);
          }
          for (const item of lane.items) {
            if (!item.collected) {
              drawItem(ctx, item, y);
            }
          }
          break;
        case "crosswalk":
          ctx.fillStyle = "#424242";
          ctx.fillRect(0, y, canvas.width, TILE_SIZE);
          drawCrosswalk(ctx, y);
          break;
      }
    }

    const playerScreenY = Math.max(TILE_SIZE, canvas.height - (PLAYER_Y_OFFSET + 1) * TILE_SIZE) + TILE_SIZE / 2;
    drawPlayer(ctx, player.x, playerScreenY);

    // HUD removido - agora renderizado em barra HTML no topo

    ctx.restore();
  };

  const drawHearts = (ctx: CanvasRenderingContext2D, numHearts: number, x: number) => {
    for (let i = 0; i < MAX_LIVES; i++) {
      const heartX = x + i * 35;
      const heartY = 25;
      drawHeart(ctx, heartX, heartY, i < numHearts ? "#E53935" : "#666");
    }
  };

  const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.bezierCurveTo(x, y + 2, x - 6, y - 2, x - 8, y);
    ctx.bezierCurveTo(x - 10, y + 2, x - 10, y + 8, x, y + 16);
    ctx.bezierCurveTo(x + 10, y + 8, x + 10, y + 2, x + 8, y);
    ctx.bezierCurveTo(x + 6, y - 2, x, y + 2, x, y + 8);
    ctx.fill();
  };

  const drawTree = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = "#5D4037";
    ctx.fillRect(x - 4, y, 8, 15);
    ctx.fillStyle = "#2E7D32";
    ctx.beginPath();
    ctx.arc(x, y - 5, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#388E3C";
    ctx.beginPath();
    ctx.arc(x + 3, y - 2, 10, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawPole = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 18);
    ctx.stroke();
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(x, y - 20, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawTrafficLight = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = "#333";
    ctx.fillRect(x - 4, y - 12, 8, 18);
    ctx.fillStyle = "#E53935";
    ctx.beginPath();
    ctx.arc(x, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawBush = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = "#558B2F";
    ctx.beginPath();
    ctx.arc(x - 3, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3, y, 5, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawCrosswalk = (ctx: CanvasRenderingContext2D, y: number) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.fillRect(i * TILE_SIZE + 5 + (j % 2) * 6, y + 10 + Math.floor(j / 2) * 6, 4, 3);
      }
    }
  };

  const drawVehicle = (ctx: CanvasRenderingContext2D, vehicle: Vehicle, laneY: number) => {
    const y = laneY + TILE_SIZE / 2;
    ctx.fillStyle = vehicle.color;

    if (vehicle.type === "truck") {
      ctx.fillRect(vehicle.x, y - vehicle.height / 2, vehicle.width, vehicle.height);
      ctx.fillStyle = "#263238";
      ctx.fillRect(vehicle.x + vehicle.width - 15, y - vehicle.height / 2 + 2, 12, vehicle.height - 4);
      ctx.fillStyle = "#212121";
      ctx.fillRect(vehicle.x + 5, y - vehicle.height / 2 - 2, 10, 4);
      ctx.fillRect(vehicle.x + 5, y + vehicle.height / 2 - 2, 10, 4);
      ctx.fillRect(vehicle.x + vehicle.width - 20, y - vehicle.height / 2 - 2, 10, 4);
      ctx.fillRect(vehicle.x + vehicle.width - 20, y + vehicle.height / 2 - 2, 10, 4);
    } else if (vehicle.type === "bus") {
      ctx.fillRect(vehicle.x, y - vehicle.height / 2, vehicle.width, vehicle.height);
      ctx.fillStyle = "#87CEEB";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(vehicle.x + 5 + i * 18, y - vehicle.height / 2 + 4, 8, 8);
      }
      ctx.fillStyle = "#212121";
      ctx.fillRect(vehicle.x + 5, y + vehicle.height / 2 - 4, 8, 4);
      ctx.fillRect(vehicle.x + vehicle.width - 13, y + vehicle.height / 2 - 4, 8, 4);
    } else if (vehicle.type === "motorcycle") {
      ctx.fillRect(vehicle.x, y - vehicle.height / 2, vehicle.width, vehicle.height);
      ctx.fillStyle = "#212121";
      ctx.beginPath();
      ctx.arc(vehicle.x + 5, y, 4, 0, Math.PI * 2);
      ctx.arc(vehicle.x + vehicle.width - 5, y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (vehicle.type === "cyclist") {
      ctx.fillStyle = "#4CAF50";
      ctx.fillRect(vehicle.x, y - 4, vehicle.width, 8);
      ctx.fillStyle = "#212121";
      ctx.beginPath();
      ctx.arc(vehicle.x + 3, y, 3, 0, Math.PI * 2);
      ctx.arc(vehicle.x + vehicle.width - 3, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFA726";
      ctx.fillRect(vehicle.x + 6, y - 6, 8, 12);
    } else if (vehicle.type === "van") {
      ctx.fillRect(vehicle.x, y - vehicle.height / 2, vehicle.width, vehicle.height);
      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(vehicle.x + vehicle.width * 0.5, y - vehicle.height / 2 + 3, vehicle.width * 0.35, vehicle.height - 6);
      ctx.fillStyle = "#212121";
      ctx.fillRect(vehicle.x + 5, y - vehicle.height / 2 - 2, 8, 4);
      ctx.fillRect(vehicle.x + vehicle.width - 13, y - vehicle.height / 2 - 2, 8, 4);
    } else {
      ctx.fillRect(vehicle.x, y - vehicle.height / 2, vehicle.width, vehicle.height);
      ctx.fillStyle = "#B3E5FC";
      ctx.fillRect(vehicle.x + vehicle.width * 0.6, y - vehicle.height / 2 + 3, vehicle.width * 0.25, vehicle.height - 6);
      ctx.fillStyle = "#212121";
      ctx.fillRect(vehicle.x + 5, y - vehicle.height / 2 - 2, 8, 4);
      ctx.fillRect(vehicle.x + 5, y + vehicle.height / 2 - 2, 8, 4);
      ctx.fillRect(vehicle.x + vehicle.width - 13, y - vehicle.height / 2 - 2, 8, 4);
      ctx.fillRect(vehicle.x + vehicle.width - 13, y + vehicle.height / 2 - 2, 8, 4);
    }
  };

  const drawItem = (ctx: CanvasRenderingContext2D, item: Item, laneY: number) => {
    const y = laneY + TILE_SIZE / 2;
    const x = item.x;

    if (item.type === "helmet") {
      ctx.fillStyle = "#FF6D00";
      ctx.beginPath();
      ctx.arc(x, y - 5, 12, 0, Math.PI, true);
      ctx.fill();
      ctx.fillRect(x - 12, y - 5, 24, 8);
      ctx.fillStyle = "#FFB74D";
      ctx.beginPath();
      ctx.arc(x, y - 5, 8, 0, Math.PI, true);
      ctx.fill();
    } else if (item.type === "seatbelt") {
      ctx.fillStyle = "#FF6B6B";
      ctx.fillRect(x - 8, y - 3, 16, 6);
      ctx.fillStyle = "#FFB3B3";
      ctx.fillRect(x - 6, y - 2, 12, 4);
    } else if (item.type === "traffic_light") {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 4, y - 12, 8, 18);
      ctx.fillStyle = "#66BB6A";
      ctx.beginPath();
      ctx.arc(x, y - 3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === "crosswalk") {
      ctx.fillStyle = "#FDD835";
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillStyle = "#333";
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.fillRect(x - 6 + i * 6, y - 6 + j * 6, 4, 4);
        }
      }
    } else if (item.type === "star") {
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = x + 8 * Math.cos(angle);
        const py = y + 8 * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (item.type === "sign") {
      ctx.fillStyle = "#E53935";
      ctx.fillRect(x - 10, y - 14, 20, 20);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x - 8, y - 12, 16, 16);
      ctx.fillStyle = "#E53935";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.fillText("P", x, y - 4);
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#FFA726";
    ctx.fillRect(x - 12, y - 10, 24, 20);

    ctx.fillStyle = "#FFCC80";
    ctx.fillRect(x - 10, y - 24, 20, 16);

    ctx.fillStyle = "#5D4037";
    ctx.fillRect(x - 10, y - 26, 20, 6);

    ctx.fillStyle = "#212121";
    ctx.fillRect(x - 6, y - 18, 4, 4);
    ctx.fillRect(x + 2, y - 18, 4, 4);

    ctx.fillStyle = "#1565C0";
    ctx.fillRect(x - 10, y + 10, 9, 10);
    ctx.fillRect(x + 1, y + 10, 9, 10);
  };

  const movePlayer = useCallback((direction: "up" | "down" | "left" | "right") => {
    if (!gameActiveRef.current) return;
    const player = playerRef.current;

    switch (direction) {
      case "up":
        player.row += 1;
        while (lanesRef.current.length <= player.row + VISIBLE_ROWS) {
          const difficulty = Math.min(player.row / 8, 3);
          lanesRef.current.push(generateLane(lanesRef.current.length, difficulty));
        }
        const upLane = lanesRef.current[player.row];
        if (upLane.type === "grass" && upLane.hasTrees[player.col]) {
          player.row -= 1;
          return;
        }
        if (player.row > maxRowRef.current) {
          maxRowRef.current = player.row;
          scoreRef.current = maxRowRef.current;
          setScore(maxRowRef.current);
        }
        break;
      case "down":
        if (player.row > 0) {
          const downLane = lanesRef.current[player.row - 1];
          if (downLane.type === "grass" && downLane.hasTrees[player.col]) {
            return;
          }
          player.row -= 1;
        }
        break;
      case "left":
        if (player.col > 0) {
          const leftLane = lanesRef.current[player.row];
          if (leftLane.type === "grass" && leftLane.hasTrees[player.col - 1]) {
            return;
          }
          player.col -= 1;
        }
        break;
      case "right":
        if (player.col < COLS - 1) {
          const rightLane = lanesRef.current[player.row];
          if (rightLane.type === "grass" && rightLane.hasTrees[player.col + 1]) {
            return;
          }
          player.col += 1;
        }
        break;
    }

    player.animating = true;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== "playing") return;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          movePlayer("up");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          movePlayer("down");
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          movePlayer("left");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          movePlayer("right");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, movePlayer]);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;
      canvas.width = Math.min(COLS * TILE_SIZE + 50, container.clientWidth);
      canvas.height = Math.min((VISIBLE_ROWS + 1) * TILE_SIZE, container.clientHeight - 70);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [gameState]);

  // Quiz Timer
  useEffect(() => {
    if (gameState !== "quiz" || quizAnswered || quizFinished) return;

    setQuizTimer(20);
    quizTimerRef.current = window.setInterval(() => {
      setQuizTimer((prev) => {
        if (prev <= 1) {
          clearInterval(quizTimerRef.current);
          setQuizAnswered(true);
          setQuizCorrect(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(quizTimerRef.current);
  }, [gameState, quizIndex, quizAnswered, quizFinished]);

  const startQuiz = () => {
    setQuizIndex(0);
    setQuizScore(0);
    setQuizAnswered(false);
    setQuizCorrect(false);
    setQuizFinished(false);
    setGameState("quiz");
  };

  const answerQuiz = (optionIndex: number) => {
    if (quizAnswered) return;
    setQuizAnswered(true);
    const isCorrect = optionIndex === QUIZ_QUESTIONS[quizIndex].correct;
    setQuizCorrect(isCorrect);
    if (isCorrect) {
      setQuizScore((prev) => prev + QUIZ_QUESTIONS[quizIndex].prize);
    }
  };

  const nextQuestion = () => {
    if (quizIndex + 1 >= QUIZ_QUESTIONS.length) {
      setQuizFinished(true);
    } else {
      setQuizIndex((prev) => prev + 1);
      setQuizAnswered(false);
      setQuizCorrect(false);
    }
  };

  const openRanking = async () => {
    const allPlayers = await getRanking();
    setRanking(allPlayers);
    if (currentPlayer) {
      const rank = await getPlayerRankFunc(currentPlayer.id);
      setPlayerRank(rank);
    }
    setGameState("ranking");
  };

  const finishQuiz = async () => {
    if (currentPlayer) {
      await updateQuizScore(currentPlayer.id, quizScore);
      const updated = await getOrCreatePlayer(currentPlayer.name, currentPlayer.sector);
      if (updated) {
        setCurrentPlayer(updated);
      }
    }
    setGameState("menu");
  };

  // ============================================================
  // TELA DE LOGIN
  // ============================================================
  if (gameState === "login") {
    return (
      <div className="game-container login-screen">
        <div className="login-content">
          <h1 className="login-title">Travessia Segura</h1>
          <p className="login-subtitle">Maio Amarelo - Segurança no Trânsito</p>

          <div className="login-form">
            {loginMode === "first-access" && (
              <>
                <p className="login-mode-indicator">Primeiro acesso</p>
                <div className="form-group">
                  <label htmlFor="email">Email Corporativo</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="seu.email@empresa.com"
                    value={playerEmail}
                    onChange={(e) => setPlayerEmail(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleFirstAccessLogin()}
                    disabled={isLoggingIn}
                  />
                  <p className="form-help">Use seu email corporativo, não pessoal</p>
                </div>
                <div className="form-group">
                  <label htmlFor="name">Nome e Sobrenome</label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Digite seu nome completo"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleFirstAccessLogin()}
                    disabled={isLoggingIn}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="sector">Setor</label>
                  <input
                    id="sector"
                    type="text"
                    placeholder="Digite seu setor"
                    value={playerSector}
                    onChange={(e) => setPlayerSector(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleFirstAccessLogin()}
                    disabled={isLoggingIn}
                  />
                </div>
                {loginError && <p className="form-error">{loginError}</p>}
                <button className="btn-play" onClick={handleFirstAccessLogin} disabled={isLoggingIn || !playerEmail.trim() || !playerName.trim() || !playerSector.trim()}>
                  {isLoggingIn ? "ENTRANDO..." : "ENTRAR"}
                </button>
              </>
            )}
            {loginMode === "email-only" && (
              <>
                <p className="login-mode-indicator">Digite seu email para continuar</p>
                <div className="form-group">
                  <label htmlFor="email">Email Corporativo</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="seu.email@empresa.com"
                    value={playerEmail}
                    onChange={(e) => setPlayerEmail(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleEmailOnlyLogin()}
                    disabled={isLoggingIn}
                    autoFocus
                  />
                </div>
                {loginError && <p className="form-error">{loginError}</p>}
                <button className="btn-play" onClick={handleEmailOnlyLogin} disabled={isLoggingIn || !playerEmail.trim()}>
                  {isLoggingIn ? "ENTRANDO..." : "ENTRAR"}
                </button>
                <button className="btn-secondary" onClick={() => {
                  setLoginMode("first-access");
                  setPlayerEmail("");
                  setPlayerName("");
                  setPlayerSector("");
                  setLoginError("");
                }} disabled={isLoggingIn}>
                  Não tenho cadastro
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA INICIAL
  // ============================================================
  if (gameState === "menu") {
    return (
      <div className="game-container menu-screen">
        <div className="menu-content">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031119109/YnbKJJLfGRS8NCpXrb5yB2/maio-amarelo-logo-Tq9gHYquqAG7aGyvEAjafR.png"
            alt="Travessia Segura"
            className="menu-logo"
          />
          <h1 className="menu-title">Travessia Segura</h1>
          <p className="menu-subtitle">Maio Amarelo - Segurança no Trânsito</p>
          <p className="menu-player">Bem-vindo, {currentPlayer?.name}!</p>

          <div className="menu-stats">
            <div className="stat">
              <span className="stat-label">Jogo</span>
              <span className="stat-value">{currentPlayer?.gameScore || 0}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Quiz</span>
              <span className="stat-value">{currentPlayer?.quizScore || 0}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total</span>
              <span className="stat-value">{currentPlayer?.totalScore || 0}</span>
            </div>
          </div>

          <div className="menu-buttons">
            <button className="btn-play" onClick={initGame}>
              JOGAR
            </button>
            <button className="btn-quiz" onClick={startQuiz}>
              QUIZ
            </button>
            <button className="btn-ranking" onClick={openRanking}>
              RANKING
            </button>
          </div>

          <button className="btn-logout" onClick={handleSwitchUser}>
            Trocar usuário
          </button>
        </div>

        <div className="menu-bg-overlay" />
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031119109/YnbKJJLfGRS8NCpXrb5yB2/hero-banner-hskNyNjFFvT94kqkpvuQKb.webp"
          alt=""
          className="menu-bg-image"
        />
      </div>
    );
  }

  // ============================================================
  // TELA DE RANKING
  // ============================================================
  if (gameState === "ranking") {
    return (
      <div className="game-container ranking-screen">
        <div className="ranking-content">
          <h2 className="ranking-title">Ranking Geral</h2>

          <div className="podium">
            {ranking.length > 1 && (
              <div className="podium-item silver">
                <div className="medal">2</div>
                <div className="name">{ranking[1].name}</div>
                <div className="score">{ranking[1].totalScore}</div>
              </div>
            )}

            {ranking.length > 0 && (
              <div className="podium-item gold">
                <div className="medal">1</div>
                <div className="name">{ranking[0].name}</div>
                <div className="score">{ranking[0].totalScore}</div>
              </div>
            )}

            {ranking.length > 2 && (
              <div className="podium-item bronze">
                <div className="medal">3</div>
                <div className="name">{ranking[2].name}</div>
                <div className="score">{ranking[2].totalScore}</div>
              </div>
            )}
          </div>

          <div className="ranking-list">
            {ranking.map((player, idx) => (
              <div key={player.id} className={`ranking-item ${playerRank === idx + 1 ? "highlight" : ""}`}>
                <span className="rank">#{idx + 1}</span>
                <span className="name">{player.name}</span>
                <span className="sector">{player.sector}</span>
                <span className="score">{player.totalScore}</span>
              </div>
            ))}
          </div>

          <button className="btn-back" onClick={() => setGameState("menu")}>
            VOLTAR
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA DO QUIZ
  // ============================================================
  if (gameState === "quiz") {
    if (quizFinished) {
      return (
        <div className="game-container quiz-screen">
          <div className="quiz-content">
            <h2 className="quiz-title">Fim do Quiz</h2>
            <div className="quiz-result">
              <p className="quiz-score-text">
                Você acumulou: <strong>{quizScore.toLocaleString()}</strong> pontos
              </p>
              {quizScore >= 1000000 && (
                <p className="quiz-perfect">Parabéns! Você conquistou 1 MILHÃO!</p>
              )}
              {quizScore >= 500000 && quizScore < 1000000 && (
                <p className="quiz-good">Excelente desempenho! Muito conhecimento!</p>
              )}
              {quizScore < 500000 && (
                <p className="quiz-improve">Que tal estudar mais sobre segurança no trânsito?</p>
              )}
            </div>
            <div className="quiz-buttons">
              <button className="btn-play" onClick={finishQuiz}>
                VOLTAR AO MENU
              </button>
            </div>
          </div>
        </div>
      );
    }

    const currentQ = QUIZ_QUESTIONS[quizIndex];
    const accumulatedPrize = QUIZ_QUESTIONS.slice(0, quizIndex)
      .reduce((sum, q) => sum + q.prize, 0);

    return (
      <div className="game-container quiz-screen">
        <div className="quiz-content">
          <div className="quiz-header">
            <div className="quiz-info">
              <span className="quiz-counter">Pergunta {quizIndex + 1}/11</span>
              <span className="quiz-timer" style={{ color: quizTimer <= 3 ? "#E53935" : "#FDD835" }}>
                TEMPO: {quizTimer}s
              </span>
            </div>
            <div className="quiz-prize">
              Acumulado: <strong>{accumulatedPrize.toLocaleString()}</strong>
            </div>
          </div>

          <h2 className="quiz-question">{currentQ.question}</h2>

          <div className="quiz-options">
            {currentQ.options.map((option, idx) => (
              <button
                key={idx}
                className={`quiz-option ${
                  quizAnswered
                    ? idx === currentQ.correct
                      ? "correct"
                      : idx !== currentQ.correct && quizAnswered
                      ? "wrong"
                      : ""
                    : ""
                }`}
                onClick={() => answerQuiz(idx)}
                disabled={quizAnswered}
              >
                <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                <span className="option-text">{option}</span>
              </button>
            ))}
          </div>

          {quizAnswered && (
            <div className={`quiz-feedback ${quizCorrect ? "correct" : "wrong"}`}>
              {quizCorrect ? "CORRETO!" : "INCORRETO!"}
              {quizCorrect && <span className="prize-gained">+{currentQ.prize.toLocaleString()}</span>}
              <button className="btn-next" onClick={nextQuestion}>
                PRÓXIMA
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA DE VITÓRIA
  // ============================================================
  if (gameState === "won") {
    return (
      <div className="game-container gameover-screen">
        <div className="gameover-content">
          <h2 className="gameover-title" style={{ color: "#66BB6A" }}>Missão Cumprida!</h2>
          <div className="gameover-score">
            <span className="score-label">PONTUAÇÃO FINAL</span>
            <span className="score-value">{score}</span>
          </div>
          <div className="safety-message">
            <p>Você atravessou com segurança todas as 20 ruas!</p>
          </div>
          <div className="gameover-buttons">
            <button className="btn-play" onClick={initGame}>
              JOGAR NOVAMENTE
            </button>
            <button className="btn-quiz" onClick={() => setGameState("menu")}>
              MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA DE GAME OVER
  // ============================================================
  if (gameState === "gameover") {
    return (
      <div className="game-container gameover-screen">
        <div className="gameover-content">
          <h2 className="gameover-title">Fim de Jogo</h2>
          <div className="gameover-score">
            <span className="score-label">PONTUAÇÃO</span>
            <span className="score-value">{score}</span>
          </div>
          <div className="safety-message">
            <p>{safetyMessage}</p>
          </div>
          <div className="gameover-buttons">
            <button className="btn-play" onClick={initGame}>
              JOGAR NOVAMENTE
            </button>
            <button className="btn-quiz" onClick={() => setGameState("menu")}>
              MENU
            </button>
          </div>
        </div>
        <div className="gameover-bg-overlay" />
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031119109/YnbKJJLfGRS8NCpXrb5yB2/game-over-bg-WZi669myHiRJA4KdjfUZSq.webp"
          alt=""
          className="gameover-bg-image"
        />
      </div>
    );
  }

  // ============================================================
  // TELA DO JOGO
  // ============================================================
  return (
    <div className="game-container playing-screen">
      {/* HUD Bar - Fora da área de jogo */}
      <div className="hud-bar">
        <div className="hud-score">
          <div className="hud-label">SCORE</div>
          <div className="hud-value">{scoreRef.current}</div>
        </div>
        <div className="hud-lives">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <div key={i} className={`heart ${i < livesRef.current ? "full" : "empty"}`}>
              ♥
            </div>
          ))}
        </div>
        <div className="hud-progress">
          <div className="hud-label">PROGRESSO</div>
          <div className="hud-value">{Math.min(playerRef.current.row, MAX_ROWS)}/{MAX_ROWS}</div>
        </div>
      </div>
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} className="game-canvas" />
      </div>
      <div className="mobile-controls">
        <div className="controls-row">
          <button className="ctrl-btn" onPointerDown={() => movePlayer("up")}>
            ▲
          </button>
        </div>
        <div className="controls-row">
          <button className="ctrl-btn" onPointerDown={() => movePlayer("left")}>
            ◄
          </button>
          <button className="ctrl-btn" onPointerDown={() => movePlayer("down")}>
            ▼
          </button>
          <button className="ctrl-btn" onPointerDown={() => movePlayer("right")}>
            ►
          </button>
        </div>
      </div>
    </div>
  );
}
