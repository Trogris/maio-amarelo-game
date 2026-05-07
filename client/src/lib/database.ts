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

    return (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.nome,
      sector: row.setor,
      gameScore: row.pontuacao_jogo,
      quizScore: row.pontuacao_quiz,
      totalScore: row.pontuacao_total,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
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

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.nome,
      sector: data.setor,
      gameScore: data.pontuacao_jogo,
      quizScore: data.pontuacao_quiz,
      totalScore: data.pontuacao_total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
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
          pontuacao_total: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      // Email já cadastrado — buscar jogador existente
      if (error.code === "23505") {
        return getPlayerByEmail(email);
      }
      console.error("Erro ao criar jogador:", error.code, error.message);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.nome,
      sector: data.setor,
      gameScore: data.pontuacao_jogo,
      quizScore: data.pontuacao_quiz,
      totalScore: data.pontuacao_total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
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
    // Tentar buscar jogador existente
    const { data: existing, error: selectError } = await supabase
      .from("jogadores")
      .select("*")
      .eq("nome", name)
      .eq("setor", sector)
      .single();

    if (existing) {
      return {
        id: existing.id,
        email: existing.email,
        name: existing.nome,
        sector: existing.setor,
        gameScore: existing.pontuacao_jogo,
        quizScore: existing.pontuacao_quiz,
        totalScore: existing.pontuacao_total,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      };
    }

    // Se não existe, criar novo jogador
    const { data: newPlayer, error: insertError } = await supabase
      .from("jogadores")
      .insert([
        {
          nome: name,
          setor: sector,
          pontuacao_jogo: 0,
          pontuacao_quiz: 0,
          pontuacao_total: 0,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar jogador:", insertError);
      return null;
    }

    return {
      id: newPlayer.id,
      email: newPlayer.email,
      name: newPlayer.nome,
      sector: newPlayer.setor,
      gameScore: newPlayer.pontuacao_jogo,
      quizScore: newPlayer.pontuacao_quiz,
      totalScore: newPlayer.pontuacao_total,
      createdAt: newPlayer.created_at,
      updatedAt: newPlayer.updated_at,
    };
  } catch (error) {
    console.error("Erro na função getOrCreatePlayer:", error);
    return null;
  }
}

// Atualizar pontuação do jogo (manter a maior)
export async function updateGameScore(
  playerId: number,
  score: number
): Promise<Player | null> {
  try {
    // Buscar jogador atual
    const { data: player, error: selectError } = await supabase
      .from("jogadores")
      .select("*")
      .eq("id", playerId)
      .single();

    if (selectError || !player) {
      console.error("Erro ao buscar jogador:", selectError);
      return null;
    }

    // Manter a maior pontuação
    const newGameScore = Math.max(score, player.pontuacao_jogo);
    const newTotalScore = newGameScore + player.pontuacao_quiz;

    const { data: updated, error: updateError } = await supabase
      .from("jogadores")
      .update({
        pontuacao_jogo: newGameScore,
        pontuacao_total: newTotalScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", playerId)
      .select()
      .single();

    if (updateError) {
      console.error("Erro ao atualizar pontuação do jogo:", updateError);
      return null;
    }

    return {
      id: updated.id,
      email: updated.email,
      name: updated.nome,
      sector: updated.setor,
      gameScore: updated.pontuacao_jogo,
      quizScore: updated.pontuacao_quiz,
      totalScore: updated.pontuacao_total,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
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
    // Buscar jogador atual
    const { data: player, error: selectError } = await supabase
      .from("jogadores")
      .select("*")
      .eq("id", playerId)
      .single();

    if (selectError || !player) {
      console.error("Erro ao buscar jogador:", selectError);
      return null;
    }

    // Manter a maior pontuação
    const newQuizScore = Math.max(score, player.pontuacao_quiz);
    const newTotalScore = player.pontuacao_jogo + newQuizScore;

    const { data: updated, error: updateError } = await supabase
      .from("jogadores")
      .update({
        pontuacao_quiz: newQuizScore,
        pontuacao_total: newTotalScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", playerId)
      .select()
      .single();

    if (updateError) {
      console.error("Erro ao atualizar pontuação do quiz:", updateError);
      return null;
    }

    return {
      id: updated.id,
      email: updated.email,
      name: updated.nome,
      sector: updated.setor,
      gameScore: updated.pontuacao_jogo,
      quizScore: updated.pontuacao_quiz,
      totalScore: updated.pontuacao_total,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  } catch (error) {
    console.error("Erro na função updateQuizScore:", error);
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

    if (error || !data) {
      console.error("Erro ao buscar jogador:", error);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.nome,
      sector: data.setor,
      gameScore: data.pontuacao_jogo,
      quizScore: data.pontuacao_quiz,
      totalScore: data.pontuacao_total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error("Erro na função getPlayer:", error);
    return null;
  }
}
