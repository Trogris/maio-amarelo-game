import { useEffect, useRef, useState, useCallback } from "react";
import TrueOrFalseGame from "./TrueOrFalseGame";
import { updateGameScore, updateQuizScore, getRanking, Player, getPlayerByEmail, createPlayer, isValidCorporateEmail } from "@/lib/database";

// ============================================================
// DESIGN: "Urban Voxel Pop" - Maio Amarelo
// Sistema completo: entrada, 5 vidas, missão, quiz 1M, ranking
// ============================================================

const TILE_SIZE = 50;
const PLAYER_SIZE = 40;
const COLS = 9;
const VISIBLE_ROWS = 14;
const PLAYER_Y_OFFSET = 2;
const MAX_ROWS = 40;
const MAX_LIVES = 5;
const CROSSWALK_WIDTH = 2;
const MAX_ROAD_LANES = 3;
const PENALTY_POINTS = 10;

const CROSSWALK_PENALTY_MESSAGES = [
  "Use a faixa! É mais seguro.",
  "Na faixa você tem prioridade!",
  "Atravessar fora da faixa é perigoso!",
  "A faixa protege você. Sempre use-a!",
  "Respeite a faixa de pedestres!",
];

const SAFETY_MESSAGES = [
  "Cinto de segurança salva vidas.",
  "Se beber, não dirija.",
  "No trânsito, enxergar o outro é salvar vidas.",
  "Álcool e direção não combinam.",
  "Cada km/h acima do limite aumenta o risco de acidente. Respeite a sinalização.",
];

// ============================================================
// CAMPANHA 3 DIAS
// ADMIN: altere CAMPAIGN_START para iniciar a campanha
// ============================================================
const CAMPAIGN_START = "2026-05-15"; // formato YYYY-MM-DD

// ADMIN: emails com acesso irrestrito para testes
const ADMIN_EMAILS = [
  "charles.andrade@fiscaltech.com.br",
  "cwa.andrade@fiscaltech.com.br",
];

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

function getTodayBrasilia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function getCampaignDay(): number {
  const today = getTodayBrasilia();
  const startMs = new Date(CAMPAIGN_START + "T12:00:00-03:00").getTime();
  const todayMs = new Date(today + "T12:00:00-03:00").getTime();
  const diff = Math.round((todayMs - startMs) / 86400000);
  if (diff < 0) return 0;   // antes da campanha
  if (diff > 2) return -1;  // campanha encerrada
  return diff + 1;           // 1, 2 ou 3
}

function getDaysUntilCampaign(): number {
  const today = getTodayBrasilia();
  const startMs = new Date(CAMPAIGN_START + "T12:00:00-03:00").getTime();
  const todayMs = new Date(today + "T12:00:00-03:00").getTime();
  return Math.ceil((startMs - todayMs) / 86400000);
}

function wasPlayedToday(activity: "jogo" | "quiz" | "vof"): boolean {
  return localStorage.getItem(`maio26_${activity}_${getTodayBrasilia()}`) === "done";
}

function markPlayedToday(activity: "jogo" | "quiz" | "vof"): void {
  localStorage.setItem(`maio26_${activity}_${getTodayBrasilia()}`, "done");
}


// Quiz — 100 pts por acerto (11 perguntas, máx 1.100 pts)
const QUIZ_QUESTIONS = [
  {
    question: "Conforme o CTB, é obrigatório o uso do cinto de segurança para:",
    options: ["Apenas o condutor do veículo", "O condutor e os passageiros dianteiros", "O condutor e todos os passageiros, em qualquer assento", "Somente em rodovias e vias acima de 60 km/h"],
    correct: 2,
    prize: 100,
    explanation: "O CTB exige o uso do cinto para o condutor e todos os passageiros, em qualquer assento e em qualquer via.",
  },
  {
    question: "Ultrapassar onde há faixa amarela contínua no centro da via configura qual infração?",
    options: ["Infração leve – 3 pontos", "Infração média – 4 pontos", "Infração grave – 5 pontos", "Infração gravíssima – 7 pontos"],
    correct: 3,
    prize: 100,
    explanation: "Ultrapassar com faixa amarela contínua é infração gravíssima, gerando 7 pontos na CNH e multa de R$ 293,47.",
  },
  {
    question: "Qual o significado do sinal amarelo do semáforo?",
    options: ["Acelerar para passar", "Atenção: reduzir e parar se possível", "Seguir em frente normalmente", "Dar ré com cuidado"],
    correct: 1,
    prize: 100,
    explanation: "O amarelo indica atenção: o condutor deve reduzir a velocidade e parar com segurança antes do cruzamento.",
  },
  {
    question: "De acordo com o CTB, é proibido estacionar a menos de qual distância de uma esquina?",
    options: ["3 metros", "5 metros", "7 metros", "10 metros"],
    correct: 1,
    prize: 100,
    explanation: "O CTB proíbe estacionar a menos de 5 metros de esquinas e entroncamentos, garantindo visibilidade e segurança.",
  },
  {
    question: "É permitido usar celular ao dirigir?",
    options: ["Sim, em vias de baixa velocidade", "Apenas para mensagens rápidas", "Não, é infração gravíssima", "Sim, se usar fone de ouvido"],
    correct: 2,
    prize: 100,
    explanation: "Usar o celular ao volante é infração gravíssima com multa de R$ 293,47 e 7 pontos na CNH.",
  },
  {
    question: "Ao se aproximar de faixa de pedestres sem semáforo, o condutor deve:",
    options: ["Manter a velocidade, pois a preferência é dos veículos", "Apenas reduzir a velocidade, sem obrigação de parar", "Ceder passagem ao pedestre que estiver atravessando ou prestes a atravessar", "Buzinar para avisar o pedestre e prosseguir"],
    correct: 2,
    prize: 100,
    explanation: "O CTB determina que o condutor deve ceder passagem ao pedestre que esteja atravessando ou prestes a atravessar a faixa.",
  },
  {
    question: "O que o Maio Amarelo representa?",
    options: ["Mês do trânsito", "Movimento de conscientização sobre segurança no trânsito", "Dia do motorista", "Semana da mobilidade urbana"],
    correct: 1,
    prize: 100,
    explanation: "O Maio Amarelo é um movimento mundial de conscientização para reduzir mortes e lesões no trânsito.",
  },
  {
    question: "Qual é a principal causa de acidentes de trânsito?",
    options: ["Falhas mecânicas nos veículos", "Condições climáticas adversas", "O fator humano: imprudência, negligência e imperícia", "Má conservação das vias públicas"],
    correct: 2,
    prize: 100,
    explanation: "O fator humano é responsável por mais de 90% dos acidentes de trânsito no Brasil.",
  },
  {
    question: "Para conduzir veículos da categoria B, o candidato deve ter no mínimo:",
    options: ["16 anos de idade", "17 anos de idade", "18 anos de idade", "21 anos de idade"],
    correct: 2,
    prize: 100,
    explanation: "Para a categoria B, o CTB exige idade mínima de 18 anos. Apenas para ciclomotores (ACC) a idade mínima é 16 anos.",
  },
  {
    question: "Dirigir sob influência de álcool sujeita o condutor a:",
    options: ["Multa e suspensão da CNH por 6 meses", "Multa e suspensão da CNH por 12 meses", "Detenção de 6 meses a 3 anos, multa e suspensão ou cassação da CNH", "Apenas advertência e multa na primeira infração"],
    correct: 2,
    prize: 100,
    explanation: "Dirigir sob efeito de álcool é crime (Art. 306 do CTB), sujeito a detenção de 6 meses a 3 anos, multa e suspensão da habilitação.",
  },
  {
    question: "Qual é o objetivo principal do Maio Amarelo?",
    options: ["Aumentar as vendas de veículos", "Reduzir o número de mortes e lesões no trânsito", "Arrecadar impostos para estradas", "Promover eventos culturais"],
    correct: 1,
    prize: 100,
    explanation: "O Maio Amarelo busca reduzir mortes e lesões no trânsito por meio da educação e conscientização da sociedade.",
  },
];

type LaneType = "grass" | "road";
type ItemType = "coin";

interface Lane {
  type: LaneType;
  speed: number;
  direction: number;
  vehicles: Vehicle[];
  hasTrees: boolean[];
  hasPoles: boolean[];
  hasBushes: boolean[];
  items: Item[];
  crosswalkStart: number; // col inicial da faixa (-1 se grass)
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

function generateLane(row: number, difficulty: number, crosswalkStart: number = 3, consecutiveRoads: number = 0): Lane {
  const rand = Math.random();
  let type: LaneType;

  // Força canteiro após MAX_ROAD_LANES faixas seguidas de rua
  if (consecutiveRoads >= MAX_ROAD_LANES) {
    type = "grass";
  } else {
    const grassChance = Math.max(0.06, 0.28 - difficulty * 0.07);
    type = rand < grassChance ? "grass" : "road";
  }

  const baseSpeed = 0.5 + difficulty * 0.6;
  const speed = type === "road" ? baseSpeed + Math.random() * (0.8 + difficulty * 0.15) : 0;
  const direction = Math.random() > 0.5 ? 1 : -1;

  const vehicles: Vehicle[] = [];
  if (type === "road") {
    const minVehicles = 1 + Math.floor(difficulty * 0.7);
    const maxVehicles = 2 + Math.floor(difficulty * 1.4);
    const numVehicles = minVehicles + Math.floor(Math.random() * (maxVehicles - minVehicles + 1));
    const totalWidth = COLS * TILE_SIZE + 200;
    const spacingMult = Math.max(0.45, 1 - difficulty * 0.18);
    const spacing = (totalWidth / numVehicles) * spacingMult;
    const speedMult = 1 + difficulty * 0.35;

    for (let i = 0; i < numVehicles; i++) {
      const r = Math.random();
      let vType: "car" | "truck" | "motorcycle" | "bus" | "cyclist" | "van";
      let width: number, height: number, vSpeed: number;
      if (r < 0.38)      { vType = "car";        width = 50; height = 24; vSpeed = 1.5; }
      else if (r < 0.53) { vType = "motorcycle"; width = 30; height = 16; vSpeed = 2.5; }
      else if (r < 0.63) { vType = "bus";        width = 60; height = 28; vSpeed = 0.9; }
      else if (r < 0.73) { vType = "truck";      width = 70; height = 26; vSpeed = 1.2; }
      else if (r < 0.83) { vType = "cyclist";    width = 20; height = 16; vSpeed = 1.8; }
      else               { vType = "van";         width = 45; height = 24; vSpeed = 1.4; }
      vehicles.push({
        x: i * spacing + Math.random() * 30,
        width, height,
        color: VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)],
        type: vType,
        speed: vSpeed * speedMult,
      });
    }
  }

  const hasTrees: boolean[] = [];
  const hasPoles: boolean[] = [];
  const hasBushes: boolean[] = [];
  if (type === "grass") {
    for (let i = 0; i < COLS; i++) {
      // Nunca duas árvores em colunas adjacentes — garante caminho lateral livre
      const prevTree = i > 0 && hasTrees[i - 1];
      hasTrees.push(!prevTree && Math.random() > 0.7);
      hasPoles.push(Math.random() > 0.85);
      hasBushes.push(Math.random() > 0.75);
    }
  }

  const cwStart = type === "road" ? crosswalkStart : -1;

  // Moedas ficam sobre a faixa
  const items: Item[] = [];
  if (type === "road") {
    const numCoins = Math.random() > 0.4 ? (Math.random() > 0.5 ? 2 : 1) : 0;
    for (let c = 0; c < numCoins; c++) {
      const coinOffset = Math.floor(Math.random() * CROSSWALK_WIDTH);
      const col = cwStart + coinOffset;
      const alreadyHere = items.some(it => it.col === col);
      if (!alreadyHere) {
        items.push({ x: col * TILE_SIZE + TILE_SIZE / 2, col, row, type: "coin", collected: false, points: 10, tip: "+10 moedas!" });
      }
    }
  }

  return { type, speed, direction, vehicles, hasTrees, hasPoles, hasBushes, items, crosswalkStart: cwStart };
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"login" | "menu" | "playing" | "gameover" | "won" | "quiz" | "ranking" | "trueorfalse" | "played-today">("login");
  const [campaignDay, setCampaignDay] = useState(() => getCampaignDay());
  const [playedToday, setPlayedToday] = useState({ jogo: false, quiz: false, vof: false });
  const [playedTodayInfo, setPlayedTodayInfo] = useState<{ activity: string; score: number } | null>(null);
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
  const [coins, setCoins] = useState(0);
  const [safetyMessage, setSafetyMessage] = useState("");
  const [rewardTip, setRewardTip] = useState("");
  const [penaltyTip, setPenaltyTip] = useState("");
  const rewardTipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const penaltyTipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState<number | null>(null);
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
  const coinsRef = useRef(0);
  const gameLoopRef = useRef<number>(0);
  const gameActiveRef = useRef(false);
  const lastTimeRef = useRef(0);
  const shakeRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const collisionCooldownRef = useRef(0);
  const currentPlayerRef = useRef<typeof currentPlayer>(null);
  const explosionRef = useRef<{ frame: number; x: number; y: number } | null>(null);
  const crosswalkColRef = useRef(1 + Math.floor(Math.random() * (COLS - CROSSWALK_WIDTH - 1)));

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
        setLoginMode("email-only");
      }
    };
    initializeLogin();
  }, []);

  // Atualizar estado da campanha ao entrar no menu
  useEffect(() => {
    if (gameState === "menu") {
      setCampaignDay(getCampaignDay());
      setPlayedToday({
        jogo: wasPlayedToday("jogo"),
        quiz: wasPlayedToday("quiz"),
        vof: wasPlayedToday("vof"),
      });
    }
  }, [gameState]);

  const handleActivityClick = (activity: "jogo" | "quiz" | "vof") => {
    const admin = isAdmin(currentPlayer?.email);
    if (!admin && wasPlayedToday(activity)) {
      const score = activity === "jogo"
        ? currentPlayer?.gameScore ?? 0
        : activity === "quiz"
        ? currentPlayer?.quizScore ?? 0
        : currentPlayer?.vofScore ?? 0;
      setPlayedTodayInfo({ activity, score });
      setGameState("played-today");
    } else {
      if (activity === "jogo") initGame();
      else if (activity === "quiz") startQuiz();
      else setGameState("trueorfalse");
    }
  };

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
        // Email não cadastrado — abre formulário completo com email já preenchido
        setLoginMode("first-access");
        setLoginError("Email não encontrado. Complete o cadastro abaixo.");
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
    setCoins(0);
    coinsRef.current = 0;
    explosionRef.current = null;

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
        crosswalkStart: 0,
      });
    }
    const randCW = () => 1 + Math.floor(Math.random() * (COLS - CROSSWALK_WIDTH - 1));
    let consec = 0;
    let sectionCW = randCW();
    for (let i = 3; i < VISIBLE_ROWS + 20; i++) {
      if (consec === 0) {
        sectionCW = randCW();
        // Encontrar crosswalk da seção anterior para limpar corredor lateral
        let prevRoadCW = sectionCW;
        for (let k = lanes.length - 1; k >= 0; k--) {
          if (lanes[k].type === "road") { prevRoadCW = lanes[k].crosswalkStart; break; }
        }
        const corridorMin = Math.min(prevRoadCW, sectionCW);
        const corridorMax = Math.max(prevRoadCW + CROSSWALK_WIDTH - 1, sectionCW + CROSSWALK_WIDTH - 1);
        for (let k = lanes.length - 1; k >= 0 && lanes[k].type === "grass"; k--) {
          for (let c = Math.max(0, corridorMin - 1); c <= Math.min(COLS - 1, corridorMax + 1); c++) {
            lanes[k].hasTrees[c] = false;
          }
        }
      }
      const lane = generateLane(i, 0, sectionCW, consec);
      consec = lane.type === "road" ? consec + 1 : 0;
      lanes.push(lane);
      // Quando termina a seção (próxima seria grama), registrar para limpar saída
      if (lane.type === "grass" && lanes.length > 1) {
        const prev = lanes[lanes.length - 2];
        if (prev.type === "road") {
          for (let c = Math.max(0, prev.crosswalkStart - 1); c <= Math.min(COLS - 1, prev.crosswalkStart + 2); c++) {
            lane.hasTrees[c] = false;
          }
        }
      }
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

    const playerScreenY = canvas.height - (PLAYER_Y_OFFSET + 1) * TILE_SIZE;
    const targetCamera = playerScreenY + player.row * TILE_SIZE;
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
              const finalScore = scoreRef.current + collectedItemsRef.current * 25;
              setSafetyMessage(SAFETY_MESSAGES[Math.floor(Math.random() * SAFETY_MESSAGES.length)]);
              setScore(finalScore);
              const p = currentPlayerRef.current;
              if (p) updateGameScore(p.id, finalScore).then(updated => { if (updated) setCurrentPlayer(updated); }).catch(console.error);
              markPlayedToday("jogo");
              // iniciar animação de explosão
              const pyScreen = canvas.height - (PLAYER_Y_OFFSET + 1) * TILE_SIZE + TILE_SIZE / 2;
              explosionRef.current = { frame: 0, x: player.x, y: pyScreen };
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
            if (item.type === "coin") {
              coinsRef.current += 1;
              setCoins(coinsRef.current);
            }
            setRewardTip(item.tip);
            if (rewardTipTimeoutRef.current) clearTimeout(rewardTipTimeoutRef.current);
            rewardTipTimeoutRef.current = setTimeout(() => setRewardTip(""), 1000);
          }
        }
      }
    }

    if (gameEnded) {
      // rodar loop apenas para a animação de explosão
      render(ctx, canvas);
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Verificar vitória (40 ruas)
    if (player.row >= MAX_ROWS) {
      gameActiveRef.current = false;
      const finalScore = scoreRef.current + collectedItemsRef.current * 25 + livesRef.current * 100;
      setScore(finalScore);
      const p = currentPlayerRef.current;
      if (p) updateGameScore(p.id, finalScore).then(updated => { if (updated) setCurrentPlayer(updated); }).catch(console.error);
      markPlayedToday("jogo");
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

    const startRow = Math.max(0, Math.floor((camera - canvas.height) / TILE_SIZE) - 2);
    const endRow = Math.min(lanes.length, Math.ceil(camera / TILE_SIZE) + 2);

    for (let i = startRow; i < endRow; i++) {
      const lane = lanes[i];
      const y = camera - i * TILE_SIZE;

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
          // Linha tracejada central (omite na área da faixa de pedestres)
          ctx.fillStyle = "#BDBDBD";
          const cwX0 = lane.crosswalkStart * TILE_SIZE;
          const cwX1 = cwX0 + CROSSWALK_WIDTH * TILE_SIZE;
          for (let dx = 0; dx < canvas.width; dx += 40) {
            if (dx + 20 <= cwX0 || dx >= cwX1) {
              ctx.fillRect(dx, y + TILE_SIZE / 2 - 1, 20, 2);
            }
          }
          // Faixa de pedestres na posição da lane
          drawCrosswalk(ctx, y, lane.crosswalkStart);
          for (const vehicle of lane.vehicles) {
            drawVehicle(ctx, vehicle, y);
          }
          for (const item of lane.items) {
            if (!item.collected) {
              drawItem(ctx, item, y);
            }
          }
          break;
      }
    }

    const playerScreenY = canvas.height - (PLAYER_Y_OFFSET + 1) * TILE_SIZE + TILE_SIZE / 2;
    drawPlayer(ctx, player.x, playerScreenY);

    // explosão + GAME OVER
    if (explosionRef.current) {
      const exp = explosionRef.current;
      exp.frame++;
      const f = exp.frame;
      // partículas
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const dist = f * 3.5;
        const alpha = Math.max(0, 1 - f / 45);
        ctx.fillStyle = `rgba(255,${180 - i * 10},0,${alpha})`;
        ctx.beginPath();
        ctx.arc(exp.x + Math.cos(angle) * dist, exp.y + Math.sin(angle) * dist, Math.max(0, 5 - f / 10), 0, Math.PI * 2);
        ctx.fill();
      }
      // anéis expansivos
      for (let r = 0; r < 3; r++) {
        const delay = r * 8;
        const rf = Math.max(0, f - delay);
        const alpha = Math.max(0, 1 - rf / 30);
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, rf * 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,${220 - r * 60},0,${alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      // texto GAME OVER
      if (f > 18) {
        const ta = Math.min(1, (f - 18) / 10);
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${Math.min(52, 28 + (f - 18) * 2)}px Arial`;
        ctx.fillStyle = `rgba(255,30,30,${ta})`;
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
        ctx.restore();
      }
      if (f >= 55) {
        explosionRef.current = null;
        gameActiveRef.current = false;
        setGameState("gameover");
      }
    }

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

  const drawCrosswalk = (ctx: CanvasRenderingContext2D, y: number, cwStart: number) => {
    const x0 = cwStart * TILE_SIZE;
    const w = CROSSWALK_WIDTH * TILE_SIZE;
    const stripeH = 10;
    const gap = 7;
    const totalUsed = stripeH * 4 + gap * 3;
    const offsetY = (TILE_SIZE - totalUsed) / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x0 + 2, y + offsetY + i * (stripeH + gap), w - 4, stripeH);
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

    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFA000";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", x, y);
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

  const applyRoadPenalty = useCallback((row: number, col: number) => {
    const lane = lanesRef.current[row];
    if (lane?.type === "road" && lane.crosswalkStart >= 0) {
      const safeStart = lane.crosswalkStart;
      const safeEnd = lane.crosswalkStart + CROSSWALK_WIDTH - 1;
      if (col < safeStart || col > safeEnd) {
        scoreRef.current = Math.max(0, scoreRef.current - PENALTY_POINTS);
        setScore(scoreRef.current);
        const msg = CROSSWALK_PENALTY_MESSAGES[Math.floor(Math.random() * CROSSWALK_PENALTY_MESSAGES.length)];
        setPenaltyTip(msg);
        if (penaltyTipTimeoutRef.current) clearTimeout(penaltyTipTimeoutRef.current);
        penaltyTipTimeoutRef.current = setTimeout(() => setPenaltyTip(""), 2500);
      }
    }
  }, []);

  const movePlayer = useCallback((direction: "up" | "down" | "left" | "right") => {
    if (!gameActiveRef.current) return;
    const player = playerRef.current;

    switch (direction) {
      case "up": {
        const nextRow = player.row + 1;
        if (lanesRef.current.length > nextRow) {
          const upLaneCheck = lanesRef.current[nextRow];
          if (upLaneCheck.type === "grass" && upLaneCheck.hasTrees[player.col]) {
            return;
          }
        }
        player.row += 1;
        while (lanesRef.current.length <= player.row + VISIBLE_ROWS) {
          const difficulty = Math.min(player.row / 4, 3);
          const last = lanesRef.current;
          let consec = 0;
          for (let k = last.length - 1; k >= 0 && last[k].type === "road"; k--) consec++;
          const prevCW = last.length > 0 ? last[last.length - 1].crosswalkStart : 1;
          const sectionCW = consec === 0
            ? 1 + Math.floor(Math.random() * (COLS - CROSSWALK_WIDTH - 1))
            : prevCW;
          if (consec === 0) {
            // Encontrar crosswalk da seção anterior para limpar corredor lateral
            let prevRoadCW = sectionCW;
            for (let k = last.length - 1; k >= 0; k--) {
              if (last[k].type === "road") { prevRoadCW = last[k].crosswalkStart; break; }
            }
            const corridorMin = Math.min(prevRoadCW, sectionCW);
            const corridorMax = Math.max(prevRoadCW + CROSSWALK_WIDTH - 1, sectionCW + CROSSWALK_WIDTH - 1);
            for (let k = last.length - 1; k >= 0 && last[k].type === "grass"; k--) {
              for (let c = Math.max(0, corridorMin - 1); c <= Math.min(COLS - 1, corridorMax + 1); c++) {
                last[k].hasTrees[c] = false;
              }
            }
          }
          const newLane = generateLane(lanesRef.current.length, difficulty, sectionCW, consec);
          lanesRef.current.push(newLane);
          if (newLane.type === "grass" && last.length > 0 && last[last.length - 1].type === "road") {
            const exitCW = last[last.length - 1].crosswalkStart;
            for (let c = Math.max(0, exitCW - 1); c <= Math.min(COLS - 1, exitCW + 2); c++) {
              newLane.hasTrees[c] = false;
            }
          }
        }
        applyRoadPenalty(player.row, player.col);
        if (player.row > maxRowRef.current) {
          maxRowRef.current = player.row;
          scoreRef.current = maxRowRef.current;
          setScore(scoreRef.current);
        }
        break;
      }
      case "down":
        if (player.row > 0) {
          const downLane = lanesRef.current[player.row - 1];
          if (downLane.type === "grass" && downLane.hasTrees[player.col]) {
            return;
          }
          player.row -= 1;
          applyRoadPenalty(player.row, player.col);
        }
        break;
      case "left":
        if (player.col > 0) {
          const leftLane = lanesRef.current[player.row];
          if (leftLane.type === "grass" && leftLane.hasTrees[player.col - 1]) {
            return;
          }
          player.col -= 1;
          applyRoadPenalty(player.row, player.col);
        }
        break;
      case "right":
        if (player.col < COLS - 1) {
          const rightLane = lanesRef.current[player.row];
          if (rightLane.type === "grass" && rightLane.hasTrees[player.col + 1]) {
            return;
          }
          player.col += 1;
          applyRoadPenalty(player.row, player.col);
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
      const maxH = container.clientHeight;
      canvas.width = Math.min(COLS * TILE_SIZE, container.clientWidth);
      canvas.height = Math.min((VISIBLE_ROWS + 1) * TILE_SIZE, maxH);
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
    setQuizSelectedAnswer(optionIndex);
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
      setQuizSelectedAnswer(null);
    }
  };

  const openRanking = async () => {
    const allPlayers = await getRanking();
    setRanking(allPlayers);
    if (currentPlayer) {
      const rank = allPlayers.findIndex(p => p.id === currentPlayer.id) + 1;
      setPlayerRank(rank > 0 ? rank : 0);
    }
    setGameState("ranking");
  };

  const quitGame = useCallback(() => {
    gameActiveRef.current = false;
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    explosionRef.current = null;
    const finalScore = scoreRef.current + collectedItemsRef.current * 25;
    if (currentPlayerRef.current) {
      updateGameScore(currentPlayerRef.current.id, finalScore).then(updated => { if (updated) setCurrentPlayer(updated); }).catch(console.error);
    }
    markPlayedToday("jogo");
    setGameState("menu");
  }, []);

  const finishQuiz = async () => {
    if (currentPlayer) {
      const updated = await updateQuizScore(currentPlayer.id, quizScore);
      if (updated) setCurrentPlayer(updated);
    }
    markPlayedToday("quiz");
    setGameState("menu");
  };

  // ============================================================
  // TELA DE LOGIN
  // ============================================================
  if (gameState === "login") {
    return (
      <div className="login-screen">
        {/* Área superior — fundo azul Maio Amarelo */}
        <div className="login-hero">
          <div className="login-maio-heading">
            <span className="login-maio-script">maio</span>
            <span className="login-maio-bold">Amarelo</span>
          </div>
          <p className="login-hero-tagline">
            No <strong>trânsito</strong>, enxergar o outro é <strong>salvar vidas.</strong>
          </p>
        </div>

        {/* Onda separadora */}
        <div className="login-wave">
          <svg viewBox="0 0 500 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,0 Q125,60 250,30 Q375,0 500,40 L500,60 L0,60 Z" fill="#FDD835"/>
            <path d="M0,10 Q125,65 250,38 Q375,8 500,48 L500,60 L0,60 Z" fill="#ffffff"/>
          </svg>
        </div>

        {/* Área inferior — card branco */}
        <div className="login-bottom">
          <div className="login-card">
            {/* Logos */}
            <div className="login-logos">
              {/* Instituto — recriado em CSS para máxima nitidez */}
              <div className="logo-instituto-css">
                <span className="logo-instituto-arrows">{">>"}</span>
                <div className="logo-instituto-text">
                  <span className="logo-instituto-line1">INSTITUTO</span>
                  <span className="logo-instituto-line2">MOTORISTA</span>
                  <span className="logo-instituto-line3">DO AMANHÃ</span>
                </div>
              </div>
              <div className="login-logos-divider" />
              <img src="/logo-fiscaltech-crop.svg" alt="FiscalTech" className="login-logo-fiscaltech" />
            </div>

            {/* Formulário */}
            <div className="login-form-area">
              <div className="login-form">
                {loginMode === "first-access" && (
                  <>
                    <p className="login-mode-indicator">Primeiro acesso</p>
                    <div className="form-group">
                      <label htmlFor="email">Email Corporativo</label>
                      <input id="email" type="email" placeholder="seu.email@empresa.com"
                        value={playerEmail} onChange={(e) => setPlayerEmail(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleFirstAccessLogin()} disabled={isLoggingIn} />
                      <p className="form-help">Use seu email corporativo, não pessoal</p>
                    </div>
                    <div className="form-group">
                      <label htmlFor="name">Nome e Sobrenome</label>
                      <input id="name" type="text" placeholder="Digite seu nome completo"
                        value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleFirstAccessLogin()} disabled={isLoggingIn} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="sector">Área</label>
                      <input id="sector" type="text" placeholder="Digite sua área"
                        value={playerSector} onChange={(e) => setPlayerSector(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleFirstAccessLogin()} disabled={isLoggingIn} />
                    </div>
                    {loginError && <p className="form-error">{loginError}</p>}
                    <button className="btn-login" onClick={handleFirstAccessLogin}
                      disabled={isLoggingIn || !playerEmail.trim() || !playerName.trim() || !playerSector.trim()}>
                      {isLoggingIn ? "ENTRANDO..." : "ENTRAR →"}
                    </button>
                  </>
                )}
                {loginMode === "email-only" && (
                  <>
                    <p className="login-mode-indicator">Digite seu email para continuar</p>
                    <div className="form-group">
                      <label htmlFor="email">Email Corporativo</label>
                      <input id="email" type="email" placeholder="seu.email@empresa.com"
                        value={playerEmail} onChange={(e) => setPlayerEmail(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleEmailOnlyLogin()}
                        disabled={isLoggingIn} autoFocus />
                    </div>
                    {loginError && <p className="form-error">{loginError}</p>}
                    <button className="btn-login" onClick={handleEmailOnlyLogin} disabled={isLoggingIn || !playerEmail.trim()}>
                      {isLoggingIn ? "ENTRANDO..." : "ENTRAR →"}
                    </button>
                    <button className="btn-secondary" onClick={() => {
                      setLoginMode("first-access"); setPlayerEmail(""); setPlayerName(""); setPlayerSector(""); setLoginError("");
                    }} disabled={isLoggingIn}>Não tenho cadastro</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA "JÁ JOGOU HOJE"
  // ============================================================
  if (gameState === "played-today") {
    const actLabel =
      playedTodayInfo?.activity === "jogo" ? "Jogo" :
      playedTodayInfo?.activity === "quiz" ? "Quiz" : "Verdadeiro ou Falso";
    return (
      <div className="game-container menu-screen">
        <div className="menu-content">
          <div className="played-today-card">
            <div className="played-today-icon">🏆</div>
            <h2 className="played-today-title">Você já jogou hoje!</h2>
            <p className="played-today-activity">{actLabel}</p>
            <div className="played-today-score">
              <span className="played-today-label">Sua melhor pontuação</span>
              <strong className="played-today-pts">
                {(playedTodayInfo?.score || 0).toLocaleString('pt-BR')} pts
              </strong>
            </div>
            <p className="played-today-message">Volte amanhã para o próximo desafio! 💪</p>
            <button className="btn-ranking" onClick={openRanking}>VER RANKING</button>
            <button className="btn-back" onClick={() => setGameState("menu")} style={{ marginTop: "0.5rem" }}>VOLTAR</button>
          </div>
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
  // TELA INICIAL
  // ============================================================
  if (gameState === "menu") {
    const daysLeft = getDaysUntilCampaign();
    const admin = isAdmin(currentPlayer?.email);

    // Admin tem acesso irrestrito; demais seguem o dia da campanha
    const jogoAvailable  = admin || campaignDay === 1;
    const quizAvailable  = admin || campaignDay === 2;
    const vofAvailable   = admin || campaignDay === 3;
    const inCampaign     = campaignDay >= 1 && campaignDay <= 3;

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
              <span className="stat-value">{(currentPlayer?.gameScore || 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Quiz</span>
              <span className="stat-value">{(currentPlayer?.quizScore || 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="stat">
              <span className="stat-label">V ou F</span>
              <span className="stat-value">{(currentPlayer?.vofScore || 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total</span>
              <span className="stat-value">{(currentPlayer?.totalScore || 0).toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Banner da campanha */}
          {campaignDay === 0 && (
            <div className="campaign-banner campaign-upcoming">
              A campanha começa em {daysLeft === 1 ? "1 dia" : `${daysLeft} dias`}!
            </div>
          )}
          {inCampaign && (
            <div className="campaign-banner campaign-active">
              {`Missão ${campaignDay} de 3 — ${campaignDay === 1 ? "Jogo" : campaignDay === 2 ? "Quiz" : "V ou F"}`}
            </div>
          )}
          {campaignDay === -1 && (
            <div className="campaign-banner campaign-ended">
              Campanha encerrada. Obrigado por participar!
            </div>
          )}

          <div className="menu-buttons">
            {/* JOGAR */}
            {jogoAvailable ? (
              <button
                className={`btn-play ${playedToday.jogo ? "btn-played" : ""}`}
                onClick={() => handleActivityClick("jogo")}
              >
                JOGAR
              </button>
            ) : (
              <button className="btn-play btn-locked" disabled>
                JOGAR
              </button>
            )}

            {/* QUIZ */}
            {quizAvailable ? (
              <button
                className={`btn-quiz ${playedToday.quiz ? "btn-played" : ""}`}
                onClick={() => handleActivityClick("quiz")}
              >
                QUIZ
              </button>
            ) : (
              <button className="btn-quiz btn-locked" disabled>
                QUIZ
              </button>
            )}

            {/* V OU F */}
            {vofAvailable ? (
              <button
                className={`btn-quiz btn-tf ${playedToday.vof ? "btn-played" : ""}`}
                onClick={() => handleActivityClick("vof")}
              >
                V ou F
              </button>
            ) : (
              <button className="btn-quiz btn-tf btn-locked" disabled>
                V ou F
              </button>
            )}

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
  // VERDADEIRO OU FALSO RELÂMPAGO
  // ============================================================
  if (gameState === "trueorfalse") {
    return <TrueOrFalseGame player={currentPlayer} onExit={async () => {
      markPlayedToday("vof");
      const email = localStorage.getItem("maio_amarelo_email");
      if (email) {
        const updated = await getPlayerByEmail(email);
        if (updated) setCurrentPlayer(updated);
      }
      setGameState("menu");
    }} />;
  }

  // ============================================================
  if (gameState === "ranking") {
    return (
      <div className="game-container ranking-screen">
        <div className="ranking-content">
          <h2 className="ranking-title">Ranking Geral</h2>

          <div className="podium">
            {ranking.length > 1 && (
              <div className="podium-item silver">
                <div className="medal">🥈</div>
                <div className="name">{ranking[1].name}</div>
                <div className="score">{ranking[1].totalScore.toLocaleString('pt-BR')}</div>
              </div>
            )}

            {ranking.length > 0 && (
              <div className="podium-item gold">
                <div className="medal">🥇</div>
                <div className="name">{ranking[0].name}</div>
                <div className="score">{ranking[0].totalScore.toLocaleString('pt-BR')}</div>
              </div>
            )}

            {ranking.length > 2 && (
              <div className="podium-item bronze">
                <div className="medal">🥉</div>
                <div className="name">{ranking[2].name}</div>
                <div className="score">{ranking[2].totalScore.toLocaleString('pt-BR')}</div>
              </div>
            )}
          </div>

          <div className="ranking-list">
            {ranking.slice(0, 5).map((player, idx) => (
              <div key={player.id} className={`ranking-item ${playerRank === idx + 1 ? "highlight" : ""}`}>
                <span className="rank">#{idx + 1}</span>
                <span className="name">{player.name}</span>
                <span className="sector">{player.sector}</span>
                <span className="score">{player.totalScore.toLocaleString('pt-BR')}</span>
              </div>
            ))}
            {playerRank > 5 && currentPlayer && (
              <>
                <div className="ranking-separator">• • •</div>
                <div className="ranking-item highlight">
                  <span className="rank">#{playerRank}</span>
                  <span className="name">{currentPlayer.name}</span>
                  <span className="sector">{currentPlayer.sector}</span>
                  <span className="score">{currentPlayer.totalScore.toLocaleString('pt-BR')}</span>
                </div>
              </>
            )}
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
                Você acumulou: <strong>{quizScore.toLocaleString('pt-BR')}</strong> pontos
              </p>
              {quizScore >= 1100 && (
                <p className="quiz-perfect">Perfeito! Você acertou tudo!</p>
              )}
              {quizScore >= 700 && quizScore < 1100 && (
                <p className="quiz-good">Excelente desempenho! Muito conhecimento!</p>
              )}
              {quizScore < 700 && (
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
              Acumulado: <strong>{accumulatedPrize.toLocaleString('pt-BR')}</strong>
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
                      : idx === quizSelectedAnswer
                      ? "wrong"
                      : "dim"
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
              <div className="quiz-feedback-top">
                {quizCorrect ? "✓ CORRETO!" : "✗ INCORRETO!"}
                {quizCorrect && <span className="prize-gained">+{currentQ.prize.toLocaleString('pt-BR')}</span>}
              </div>
              <p className="quiz-explanation">{currentQ.explanation}</p>
              <button className="btn-next" onClick={nextQuestion}>
                PRÓXIMA →
              </button>
            </div>
          )}

          <button className="btn-quit-quiz" onClick={finishQuiz}>
            Sair do Quiz
          </button>
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
            <span className="score-value">{score.toLocaleString('pt-BR')}</span>
          </div>
          <div className="safety-message">
            <p>Você atravessou com segurança todas as {MAX_ROWS} ruas!</p>
          </div>
          <div className="gameover-buttons">
            <button className="btn-play" onClick={() => handleActivityClick("jogo")}>
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
            <span className="score-value">{score.toLocaleString('pt-BR')}</span>
          </div>
          <div className="safety-message">
            <p>{safetyMessage}</p>
          </div>
          <div className="gameover-buttons">
            <button className="btn-play" onClick={() => handleActivityClick("jogo")}>
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
          <div className="hud-value">{score.toLocaleString('pt-BR')}</div>
        </div>
        <div className="hud-coins">
          <div className="hud-label hud-coin-icon">●</div>
          <div className="hud-value hud-coins-value">{coins}</div>
        </div>
        <div className="hud-lives">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <div key={i} className={`heart ${i < lives ? "full" : "empty"}`}>
              ♥
            </div>
          ))}
        </div>
        <div className="hud-progress">
          <div className="hud-label">RUAS</div>
          <div className="hud-value">{Math.min(playerRef.current.row, MAX_ROWS)}/{MAX_ROWS}</div>
        </div>
        <button className="btn-quit-game" onClick={quitGame}>✕ <span className="quit-label">Sair</span></button>
      </div>
      {penaltyTip && (
        <div className="penalty-banner">
          ⚠ {penaltyTip} <span className="penalty-pts">-{PENALTY_POINTS} pts</span>
        </div>
      )}
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
