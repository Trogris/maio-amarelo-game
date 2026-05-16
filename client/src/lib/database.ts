// ============================================================
// CAMADA DE ABSTRAÇÃO DE DADOS - SUPABASE
// Integração com Supabase para ranking global
// ============================================================

import { createClient } from "@supabase/supabase-js";

export interface Player {
  id: number;
  email: string;
  name: string;
  sector: string;
  gameScore: number;
  quizScore: number;
  vofScore: number;
  totalScore: number;
  createdAt: string;
  updatedAt: string;
}

// Inicializar cliente Supabase
const supabaseUrl = "https://ykkiufgrulbczkwobyay.supabase.co";
const supabaseAnonKey = "sb_publishable_j6cQ-OMtcl5nsN6v6QlPrg_olPVVbey";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Emails particulares bloqueados
const BLOCKED_DOMAINS = [
  "@gmail.com",
  "@hotmail.com",
  "@yahoo.com",
  "@outlook.com",
  "@live.com",
  "@icloud.com",
  "@protonmail.com",
];

// Validar email corporativo
export function isValidCorporateEmail(email: string): boolean {
  const lowerEmail = email.toLowerCase().trim();
  return !BLOCKED_DOMAINS.some((domain) => lowerEmail.endsWith(domain));
}

function mapRow(row: any): Player {
  return {
    id: row.id,
    email: row.email,
    name: row.nome,
    sector: row.setor,
    gameScore: row.pontuacao_jogo ?? 0,
    quizScore: row.pontuacao_quiz ?? 0,
    vofScore: row.pontuacao_vof ?? 0,
    totalScore: row.pontuacao_total ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Obter todos os jogadores
export async function getAllPlayers(): Promise<Player[]> {
  try {
    const { data, error } = await supabase
      .from("jogadores")
      .select("*")
      .order("pontuacao_total", { ascending: false });

    if (error) {
      console.error("Erro ao buscar jogadores:", error);
      return [];
    }

    return (data || []).map(mapRow);
  } catch (error) {
    console.error("Erro na função getAllPlayers:", error);
    return [];
  }
}

// Buscar jogador por email
export async function getPlayerByEmail(email: string): Promise<Player | null> {
  try {
    const { data, error } = await supabase
      .from("jogadores")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !data) return null;
    return mapRow(data);
  } catch (error) {
    console.error("Erro na função getPlayerByEmail:", error);
    return null;
  }
}

// Criar novo jogador (primeiro acesso)
export async function createPlayer(
  email: string,
  name: string,
  sector: string
): Promise<Player | null> {
  try {
    const { data, error } = await supabase
      .from("jogadores")
      .insert([
        {
          email: email.toLowerCase().trim(),
          nome: name,
          setor: sector,
          pontuacao_jogo: 0,
          pontuacao_quiz: 0,
          pontuacao_vof: 0,
          pontuacao_total: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return getPlayerByEmail(email);
      console.error("Erro ao criar jogador:", error.code, error.message);
      return null;
    }

    return mapRow(data);
  } catch (error) {
    console.error("Erro na função createPlayer:", error);
    return null;
  }
}

// Obter jogador por nome + setor (compatibilidade)
export async function getOrCreatePlayer(
  name: string,
  sector: string
): Promise<Player | null> {
  try {
    const { data: existing } = await supabase
      .from("jogadores")
      .select("*")
      .eq("nome", name)
      .eq("setor", sector)
      .single();

    if (existing) return mapRow(existing);

    const { data: newPlayer, error: insertError } = await supabase
      .from("jogadores")
      .insert([
        {
          nome: name,
          setor: sector,
          pontuacao_jogo: 0,
          pontuacao_quiz: 0,
          pontuacao_vof: 0,
          pontuacao_total: 0,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar jogador:", insertError);
      return null;
    }

    return mapRow(newPlayer);
  } catch (error) {
    console.error("Erro na função getOrCreatePlayer:", error);
    return null;
  }
}

// Limites máximos de pontuação por atividade (proteção contra manipulação)
const MAX_GAME_SCORE  = 5000;  // jogo: ~40 ruas × moedas + bônus de vidas
const MAX_QUIZ_SCORE  = 1100;  // quiz: 11 perguntas × 100 pts
const MAX_VOF_SCORE   = 1000;  // V ou F: 10 perguntas × 100 pts

// Atualizar pontuação do jogo (manter a maior)
export async function updateGameScore(
  playerId: number,
  score: number
): Promise<Player | null> {
  try {
    const { data: player, error: selectError } = await supabase
      .from("jogadores")
      .select("*")
      .eq("id", playerId)
      .single();

    if (selectError || !player) return null;

    const clampedScore = Math.min(Math.max(0, score), MAX_GAME_SCORE);
    const newGameScore = Math.max(clampedScore, player.pontuacao_jogo ?? 0);
    const newTotal = newGameScore + (player.pontuacao_quiz ?? 0) + (player.pontuacao_vof ?? 0);

    const { data: updated, error: updateError } = await supabase
      .from("jogadores")
      .update({ pontuacao_jogo: newGameScore, pontuacao_total: newTotal, updated_at: new Date().toISOString() })
      .eq("id", playerId)
      .select()
      .single();

    if (updateError) { console.error("Erro ao atualizar pontuação do jogo:", updateError); return null; }
    return mapRow(updated);

  } catch (error) {
    console.error("Erro na função updateGameScore:", error);
    return null;
  }
}

// Atualizar pontuação do quiz (manter a maior)
export async function updateQuizScore(
  playerId: number,
  score: number
): Promise<Player | null> {
  try {
    const { data: player, error: selectError } = await supabase
      .from("jogadores")
      .select("*")
      .eq("id", playerId)
      .single();

    if (selectError || !player) return null;

    const clampedScore = Math.min(Math.max(0, score), MAX_QUIZ_SCORE);
    const newQuizScore = Math.max(clampedScore, player.pontuacao_quiz ?? 0);
    const newTotal = (player.pontuacao_jogo ?? 0) + newQuizScore + (player.pontuacao_vof ?? 0);

    const { data: updated, error: updateError } = await supabase
      .from("jogadores")
      .update({ pontuacao_quiz: newQuizScore, pontuacao_total: newTotal, updated_at: new Date().toISOString() })
      .eq("id", playerId)
      .select()
      .single();

    if (updateError) { console.error("Erro ao atualizar pontuação do quiz:", updateError); return null; }
    return mapRow(updated);
  } catch (error) {
    console.error("Erro na função updateQuizScore:", error);
    return null;
  }
}

// Atualizar pontuação do V ou F (manter a maior)
export async function updateVofScore(
  playerId: number,
  score: number
): Promise<Player | null> {
  try {
    const { data: player, error: selectError } = await supabase
      .from("jogadores")
      .select("*")
      .eq("id", playerId)
      .single();

    if (selectError || !player) return null;

    const clampedScore = Math.min(Math.max(0, score), MAX_VOF_SCORE);
    const newVofScore = Math.max(clampedScore, player.pontuacao_vof ?? 0);
    const newTotal = (player.pontuacao_jogo ?? 0) + (player.pontuacao_quiz ?? 0) + newVofScore;

    const { data: updated, error: updateError } = await supabase
      .from("jogadores")
      .update({ pontuacao_vof: newVofScore, pontuacao_total: newTotal, updated_at: new Date().toISOString() })
      .eq("id", playerId)
      .select()
      .single();

    if (updateError) { console.error("Erro ao atualizar pontuação do V ou F:", updateError); return null; }
    return mapRow(updated);
  } catch (error) {
    console.error("Erro na função updateVofScore:", error);
    return null;
  }
}

// Obter ranking ordenado por pontuação total
export async function getRanking(): Promise<Player[]> {
  return getAllPlayers();
}

// Obter posição do jogador no ranking
export async function getPlayerRank(playerId: number): Promise<number> {
  try {
    const ranking = await getRanking();
    return ranking.findIndex((p) => p.id === playerId) + 1;
  } catch (error) {
    console.error("Erro na função getPlayerRank:", error);
    return 0;
  }
}

// Obter jogador por ID
export async function getPlayer(playerId: number): Promise<Player | null> {
  try {
    const { data, error } = await supabase
      .from("jogadores")
      .select("*")
      .eq("id", playerId)
      .single();

    if (error || !data) return null;
    return mapRow(data);
  } catch (error) {
    console.error("Erro na função getPlayer:", error);
    return null;
  }
}
