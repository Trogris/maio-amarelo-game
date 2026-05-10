import { useState, useEffect, useRef, useCallback } from "react";
import { updateVofScore } from "../lib/database";
import type { Player } from "../lib/database";

// ============================================================
// AFIRMAÇÕES - VERDADEIRO OU FALSO RELÂMPAGO
// ============================================================
interface Statement {
  text: string;
  answer: boolean;
  explanation: string;
}

const STATEMENTS: Statement[] = [
  {
    text: "Usar o cinto de segurança pode reduzir em até 45% o risco de morte em acidentes.",
    answer: true,
    explanation: "Correto! O cinto é o principal equipamento de segurança veicular.",
  },
  {
    text: "No Brasil, é permitido dirigir após consumir pequenas quantidades de álcool.",
    answer: false,
    explanation: "Errado! A Lei Seca estabelece tolerância zero para álcool ao volante.",
  },
  {
    text: "Falar ao celular segurando-o aumenta em 4 vezes o risco de acidente.",
    answer: true,
    explanation: "Correto! A distração ao volante é uma das principais causas de acidentes.",
  },
  {
    text: "Pedestres têm prioridade sobre veículos mesmo fora da faixa de pedestres.",
    answer: false,
    explanation: "Errado! A prioridade do pedestre é garantida apenas na faixa de pedestres.",
  },
  {
    text: "O capacete reduz em até 40% o risco de morte em acidentes de motocicleta.",
    answer: true,
    explanation: "Correto! O capacete é equipamento obrigatório e salva vidas.",
  },
  {
    text: "Ao ver o sinal amarelo, o motorista deve acelerar para não parar no cruzamento.",
    answer: false,
    explanation: "Errado! O amarelo indica atenção e parar se possível, não acelerar.",
  },
  {
    text: "Crianças menores de 10 anos devem ser transportadas exclusivamente no banco traseiro.",
    answer: true,
    explanation: "Correto! É obrigação legal para garantir a segurança infantil.",
  },
  {
    text: "Dirigir com sono é tão perigoso quanto dirigir alcoolizado.",
    answer: true,
    explanation: "Correto! A sonolência compromete os reflexos e a atenção assim como o álcool.",
  },
  {
    text: "O limite de velocidade padrão em vias urbanas no Brasil é de 60 km/h.",
    answer: true,
    explanation: "Correto! O CTB define 60 km/h como limite padrão em vias urbanas.",
  },
  {
    text: "O uso de farol baixo durante o dia é obrigatório apenas em rodovias.",
    answer: false,
    explanation: "Errado! O farol baixo diurno é obrigatório em rodovias, mas recomendado sempre.",
  },
];

const TIME_PER_QUESTION = 5;

interface Props {
  player: Player | null;
  onExit: () => void;
}

type Phase = "playing" | "feedback" | "finished";

export default function TrueOrFalseGame({ player, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [timer, setTimer] = useState(TIME_PER_QUESTION);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [userAnswer, setUserAnswer] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeAtAnswerRef = useRef(TIME_PER_QUESTION);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleAnswer = useCallback(
    (answer: boolean) => {
      if (phase !== "playing") return;
      stopTimer();
      timeAtAnswerRef.current = timer;
      const current = STATEMENTS[index];
      const isCorrect = answer === current.answer;
      const timeBonus = isCorrect ? timeAtAnswerRef.current * 2 : 0;
      const points = isCorrect ? 10 + timeBonus : 0;
      setUserAnswer(answer);
      setPhase("feedback");
      if (isCorrect) {
        setCorrect((c) => c + 1);
        setScore((s) => s + points);
      }
    },
    [phase, timer, index, stopTimer]
  );

  // timeout sem resposta
  useEffect(() => {
    if (phase !== "playing") return;
    setTimer(TIME_PER_QUESTION);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          stopTimer();
          setUserAnswer(null);
          setPhase("feedback");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return stopTimer;
  }, [index, phase, stopTimer]);

  const next = useCallback(() => {
    if (index >= STATEMENTS.length - 1) {
      setPhase("finished");
      if (player) {
        const finalScore = score + (userAnswer === STATEMENTS[index].answer ? 0 : 0);
        updateVofScore(player.id, score).catch(console.error);
      }
    } else {
      setIndex((i) => i + 1);
      setUserAnswer(null);
      setPhase("playing");
    }
  }, [index, player, score, userAnswer]);

  const restart = () => {
    setIndex(0);
    setPhase("playing");
    setTimer(TIME_PER_QUESTION);
    setScore(0);
    setCorrect(0);
    setUserAnswer(null);
  };

  const current = STATEMENTS[index];
  const pct = Math.round((correct / STATEMENTS.length) * 100);
  const timerPct = (timer / TIME_PER_QUESTION) * 100;
  const timerColor = timer <= 2 ? "#E53935" : timer <= 3 ? "#FF9800" : "#FDD835";

  // ── TELA FINAL ──────────────────────────────────────────
  if (phase === "finished") {
    return (
      <div className="game-container tf-screen">
        <div className="tf-content">
          <h2 className="tf-title">Resultado Final</h2>

          <div className="tf-result-circle">
            <span className="tf-result-pct">{pct}%</span>
            <span className="tf-result-label">de acertos</span>
          </div>

          <div className="tf-result-stats">
            <div className="tf-stat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#66BB6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{correct} acertos</span>
            </div>
            <div className="tf-stat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#E53935" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span>{STATEMENTS.length - correct} erros</span>
            </div>
            <div className="tf-stat tf-stat-score">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#FDD835" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="#FDD835" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{score} pontos</span>
            </div>
          </div>

          {pct === 100 && (
            <p className="tf-message perfect">Perfeito! Você é um especialista em segurança!</p>
          )}
          {pct >= 70 && pct < 100 && (
            <p className="tf-message good">Muito bem! Continue praticando para a pontuação máxima.</p>
          )}
          {pct < 70 && (
            <p className="tf-message improve">Que tal revisar as regras de segurança no trânsito?</p>
          )}

          <div className="tf-buttons">
            <button className="btn-play" onClick={restart}>JOGAR NOVAMENTE</button>
            <button className="btn-quiz" onClick={onExit}>VOLTAR AO MENU</button>
          </div>
        </div>
      </div>
    );
  }

  // ── TELA DE JOGO ────────────────────────────────────────
  const isCorrectAnswer = userAnswer === current.answer;
  const timedOut = phase === "feedback" && userAnswer === null;

  return (
    <div className="game-container tf-screen">
      <div className="tf-content">
        {/* Header */}
        <div className="tf-header">
          <div className="tf-progress-text">{index + 1} / {STATEMENTS.length}</div>
          <div className="tf-score-display">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#FDD835" strokeWidth="2" />
              <path d="M12 7v5l3 3" stroke="#FDD835" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {score} pts
          </div>
          <button className="btn-quit-quiz" onClick={onExit}>Sair</button>
        </div>

        {/* Barra de progresso das perguntas */}
        <div className="tf-progress-bar-wrap">
          <div
            className="tf-progress-bar-fill"
            style={{ width: `${((index) / STATEMENTS.length) * 100}%` }}
          />
        </div>

        {/* Timer */}
        <div className="tf-timer-wrap">
          <div
            className="tf-timer-fill"
            style={{
              width: `${phase === "feedback" ? 0 : timerPct}%`,
              background: timerColor,
              transition: phase === "playing" ? "width 1s linear, background 0.3s" : "none",
            }}
          />
          {phase === "playing" && (
            <span className="tf-timer-text" style={{ color: timerColor }}>{timer}s</span>
          )}
        </div>

        {/* Afirmação */}
        <div
          className={`tf-statement ${
            phase === "feedback"
              ? timedOut
                ? "tf-timeout"
                : isCorrectAnswer
                ? "tf-correct"
                : "tf-wrong"
              : ""
          }`}
        >
          <p>{current.text}</p>
        </div>

        {/* Feedback */}
        {phase === "feedback" && (
          <div className={`tf-feedback ${timedOut ? "timeout" : isCorrectAnswer ? "correct" : "wrong"}`}>
            {timedOut ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#FF9800" strokeWidth="2" />
                  <path d="M12 7v5l3 3" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Tempo esgotado!
              </>
            ) : isCorrectAnswer ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#66BB6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Correto! +{10 + timeAtAnswerRef.current * 2} pts
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#E53935" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Incorreto!
              </>
            )}
          </div>
        )}

        {phase === "feedback" && (
          <p className="tf-explanation">{current.explanation}</p>
        )}

        {/* Botões de resposta */}
        <div className="tf-answer-buttons">
          <button
            className={`tf-btn tf-btn-true ${phase === "feedback" ? (current.answer === true ? "tf-btn-correct-ans" : userAnswer === true ? "tf-btn-wrong-ans" : "tf-btn-dim") : ""}`}
            onClick={() => handleAnswer(true)}
            disabled={phase === "feedback"}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            VERDADEIRO
          </button>
          <button
            className={`tf-btn tf-btn-false ${phase === "feedback" ? (current.answer === false ? "tf-btn-correct-ans" : userAnswer === false ? "tf-btn-wrong-ans" : "tf-btn-dim") : ""}`}
            onClick={() => handleAnswer(false)}
            disabled={phase === "feedback"}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            FALSO
          </button>
        </div>

        {phase === "feedback" && (
          <button className="tf-btn-next" onClick={next}>
            {index >= STATEMENTS.length - 1 ? "VER RESULTADO" : "PRÓXIMA"}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
