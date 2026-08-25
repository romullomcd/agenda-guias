"use client";

import { useEffect, useMemo, useState } from "react";

import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";

import { ptBR } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

type Guide = {
  id: string;
  name: string;
  active: boolean;
  languages: string[];
};

type RankingItem = {
  guide: Guide;
  count: number;
};

type Theme = "light" | "dark";

const LANGUAGE_FLAGS: Record<string, string> = {
  Português: "🇧🇷",
  Inglês: "🇺🇸",
  Espanhol: "🇪🇸",
  Francês: "🇫🇷",
  Italiano: "🇮🇹",
  Alemão: "🇩🇪",
  Mandarim: "🇨🇳",
  Japonês: "🇯🇵",
};

export default function GuideRanking() {
  const [currentMonth, setCurrentMonth] =
    useState(new Date());

  const [guides, setGuides] =
    useState<Guide[]>([]);

  const [ranking, setRanking] =
    useState<RankingItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [expanded, setExpanded] =
    useState(false);

  const [accessDenied, setAccessDenied] =
    useState(false);

  // ============================================================
  // APLICAR TEMA
  // ============================================================

  function applyTheme(
    theme: Theme
  ) {
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    );
  }

  // ============================================================
  // VERIFICAR ACESSO + CARREGAR RANKING
  // ============================================================

  useEffect(() => {
    checkAccessAndLoadRanking();
  }, [currentMonth]);

  async function checkAccessAndLoadRanking() {
    setAccessDenied(false);

    // ==========================================================
    // USUÁRIO AUTENTICADO
    // ==========================================================

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(
        "ERRO AO VERIFICAR USUÁRIO:",
        userError
      );

      setAccessDenied(true);
      setLoading(false);

      return;
    }

    // ==========================================================
    // NÃO ESTÁ LOGADO
    // ==========================================================

    if (!user) {
      setAccessDenied(true);
      setLoading(false);

      return;
    }

    // ==========================================================
    // VERIFICAR ROLE + TEMA
    // ==========================================================

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role, theme")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(
        "ERRO AO VERIFICAR PERMISSÃO:",
        profileError
      );

      setAccessDenied(true);
      setLoading(false);

      return;
    }

    // ==========================================================
    // APLICAR TEMA SALVO NO BANCO
    // ==========================================================

    const savedTheme: Theme =
      profile?.theme === "dark"
        ? "dark"
        : "light";

    applyTheme(savedTheme);

    // ==========================================================
    // NÃO É ADMIN
    // ==========================================================

    if (profile?.role !== "admin") {
      console.warn(
        "ACESSO NEGADO AO RANKING:",
        user.id
      );

      setAccessDenied(true);
      setLoading(false);

      return;
    }

    // ==========================================================
    // É ADMIN → CARREGAR RANKING
    // ==========================================================

    await loadRanking();
  }

  // ============================================================
  // CARREGAR RANKING
  // ============================================================

  async function loadRanking() {
    const firstDay = format(
      startOfMonth(currentMonth),
      "yyyy-MM-dd"
    );

    const lastDay = format(
      endOfMonth(currentMonth),
      "yyyy-MM-dd"
    );

    // ==========================================================
    // GUIAS
    // ==========================================================

    const {
      data: guidesData,
      error: guidesError,
    } = await supabase
      .from("profiles")
      .select(
        "id, name, active, languages"
      )
      .eq("role", "guide")
      .order("name");

    if (guidesError) {
      console.error(
        "ERRO AO CARREGAR GUIAS:",
        guidesError
      );

      setLoading(false);

      return;
    }

    const loadedGuides =
      (guidesData || []) as Guide[];

    setGuides(loadedGuides);

    // ==========================================================
    // ESCALAS DO MÊS
    // ==========================================================

    const {
      data: availabilityData,
      error: availabilityError,
    } = await supabase
      .from("availability")
      .select(
        "id, guide_id, date, status"
      )
      .eq(
        "status",
        "escalated"
      )
      .gte(
        "date",
        firstDay
      )
      .lte(
        "date",
        lastDay
      );

    if (availabilityError) {
      console.error(
        "ERRO AO CARREGAR ESCALAS:",
        availabilityError
      );

      setLoading(false);

      return;
    }

    // ==========================================================
    // CONTAR ESCALAS POR GUIA
    // ==========================================================

    const counts =
      new Map<string, number>();

    (availabilityData || []).forEach(
      (item) => {
        const current =
          counts.get(
            item.guide_id
          ) || 0;

        counts.set(
          item.guide_id,
          current + 1
        );
      }
    );

    // ==========================================================
    // MONTAR RANKING
    // ==========================================================

    const rankingData =
      loadedGuides
        .map((guide) => ({
          guide,
          count:
            counts.get(
              guide.id
            ) || 0,
        }))
        .filter(
          (item) =>
            item.count > 0
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    setRanking(
      rankingData
    );

    setLoading(false);
  }

  // ============================================================
  // MÊS
  // ============================================================

  const monthName = format(
    currentMonth,
    "MMMM yyyy",
    {
      locale: ptBR,
    }
  );

  // ============================================================
  // RANKING VISÍVEL
  // ============================================================

  const visibleRanking =
    useMemo(() => {
      if (expanded) {
        return ranking;
      }

      return ranking.slice(
        0,
        3
      );
    }, [
      ranking,
      expanded,
    ]);

  // ============================================================
  // BANDEIRAS
  // ============================================================

  function getGuideFlags(
    guide: Guide
  ) {
    if (
      !guide.languages ||
      guide.languages.length === 0
    ) {
      return "🌐";
    }

    return guide.languages
      .map(
        (language) =>
          LANGUAGE_FLAGS[
            language
          ] || "🌐"
      )
      .join(" ");
  }

  // ============================================================
  // POSIÇÃO
  // ============================================================

  function getPositionIcon(
    position: number
  ) {
    if (position === 1) {
      return "🥇";
    }

    if (position === 2) {
      return "🥈";
    }

    if (position === 3) {
      return "🥉";
    }

    return `${position}º`;
  }

  // ============================================================
  // ACESSO NEGADO
  // ============================================================

  if (!loading && accessDenied) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f7fb] px-5 dark:bg-black">

        <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

        <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">

          <div className="flex h-1">
            <div className="flex-1 bg-[#e91e8c]" />
            <div className="flex-1 bg-[#ffd21c]" />
            <div className="flex-1 bg-[#1687d9]" />
          </div>

          <div className="p-8 text-center sm:p-10">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-4xl dark:bg-red-950/40">
              🔒
            </div>

            <h1 className="mt-6 text-2xl font-extrabold text-gray-900 dark:text-white">
              Acesso restrito
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-300">
              Esta página é exclusiva para administradores da Agenda de Guias.
            </p>

            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/dashboard";
              }}
              className="mt-7 w-full rounded-xl bg-[#1687d9] px-5 py-3 font-extrabold text-white shadow-md shadow-blue-200 transition hover:bg-[#0f75bd]"
            >
              Voltar para o dashboard
            </button>

          </div>

        </div>

      </main>
    );
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] dark:bg-black">

        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c] dark:border-gray-700" />

          <p className="mt-4 text-sm font-semibold text-gray-500 dark:text-gray-300">
            Verificando acesso...
          </p>

        </div>

      </main>
    );
  }

  // ============================================================
  // PÁGINA ADMINISTRATIVA
  // ============================================================

  return (
    <main className="min-h-screen bg-[#f7f7fb] dark:bg-black">

      {/* ====================================================== */}
      {/* DECORAÇÃO DE FUNDO */}
      {/* ====================================================== */}

      <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ffd21c] opacity-[0.04] blur-3xl" />

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <header className="relative z-10 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-black">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">

          {/* LOGO + TÍTULO */}

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e91e8c] shadow-md shadow-pink-200">

              <img
                src="/logo-branca.png"
                alt="Way To Know Rio"
                className="max-h-8 max-w-[38px] object-contain"
              />

            </div>

            <div>

              <h1 className="text-lg font-extrabold leading-tight text-gray-900 dark:text-white sm:text-xl">
                Agenda de Guias
              </h1>

              <p className="text-xs text-gray-500 dark:text-gray-300">
                Ranking de guias
              </p>

            </div>

          </div>

          {/* BOTÃO VOLTAR */}

          <button
            type="button"
            onClick={() => {
              window.location.href =
                "/dashboard";
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition dark:border-gray-700 dark:text-gray-300 hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] dark:hover:bg-gray-900 sm:px-4"
          >
            ← Voltar
          </button>

        </div>

        {/* FAIXA COLORIDA */}

        <div className="flex h-1">
          <div className="flex-1 bg-[#e91e8c]" />
          <div className="flex-1 bg-[#ffd21c]" />
          <div className="flex-1 bg-[#1687d9]" />
        </div>

      </header>

      {/* ====================================================== */}
      {/* CONTEÚDO */}
      {/* ====================================================== */}

      <section className="relative z-10 mx-auto max-w-5xl px-5 py-7 sm:px-6 sm:py-9">

        {/* ==================================================== */}
        {/* TÍTULO */}
        {/* ==================================================== */}

        <div className="mb-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

          <div className="p-6 sm:p-8">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-50 text-3xl dark:bg-yellow-950/40">
                🏆
              </div>

              <div>

                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                  Administração
                </p>

                <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Ranking de Guias
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-300 sm:text-base">
                  Confira a quantidade de vezes que cada guia foi escalado no mês.
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* ==================================================== */}
        {/* CARD DO RANKING */}
        {/* ==================================================== */}

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

          {/* FAIXA */}

          <div className="flex h-1">

            <div className="flex-1 bg-[#e91e8c]" />
            <div className="flex-1 bg-[#ffd21c]" />
            <div className="flex-1 bg-[#1687d9]" />

          </div>

          <div className="p-5 sm:p-7">

            {/* ================================================= */}
            {/* NAVEGAÇÃO DO MÊS */}
            {/* ================================================= */}

            <div className="mb-6 flex items-center justify-between rounded-2xl bg-gray-50 p-2 dark:bg-gray-800 sm:p-3">

              <button
                type="button"
                onClick={() => {
                  setCurrentMonth(
                    subMonths(
                      currentMonth,
                      1
                    )
                  );

                  setExpanded(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-extrabold text-gray-800 shadow-sm transition dark:border-gray-700 dark:bg-black dark:text-gray-100 hover:border-[#e91e8c] hover:bg-pink-50 hover:text-[#e91e8c] dark:hover:bg-gray-900"
              >
                ←
              </button>

              <div className="text-center">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Ranking mensal
                </p>

                <h2 className="mt-0.5 text-lg font-extrabold capitalize text-gray-900 dark:text-white sm:text-2xl">
                  {monthName}
                </h2>

              </div>

              <button
                type="button"
                onClick={() => {
                  setCurrentMonth(
                    addMonths(
                      currentMonth,
                      1
                    )
                  );

                  setExpanded(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-extrabold text-gray-800 shadow-sm transition dark:border-gray-700 dark:bg-black dark:text-gray-100 hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] dark:hover:bg-gray-900"
              >
                →
              </button>

            </div>

            {/* ================================================= */}
            {/* INFORMAÇÃO */}
            {/* ================================================= */}

            <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">

              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">

                📊 Mostrando as escalas realizadas em{" "}

                <span className="font-extrabold capitalize">
                  {monthName}
                </span>

              </p>

            </div>

            {/* ================================================= */}
            {/* RANKING */}
            {/* ================================================= */}

            {ranking.length === 0 ? (

              <div className="rounded-2xl bg-gray-50 px-5 py-12 text-center dark:bg-gray-800">

                <div className="text-4xl">
                  🏆
                </div>

                <h3 className="mt-4 text-lg font-extrabold text-gray-800 dark:text-white">
                  Nenhuma escala neste mês
                </h3>

                <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-300">
                  Ainda não existem guias escalados em{" "}
                  <span className="capitalize">
                    {monthName}
                  </span>.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {visibleRanking.map(
                  (
                    item,
                    index
                  ) => {

                    const position =
                      index + 1;

                    return (
                      <div
                        key={
                          item.guide.id
                        }
                        className={[
                          "flex items-center gap-3 rounded-2xl border p-4 transition sm:p-5",
                          position === 1
                            ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30"
                            : position === 2
                            ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                            : position === 3
                            ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30"
                            : "border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800",
                        ].join(" ")}
                      >

                        {/* POSIÇÃO */}

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-extrabold shadow-sm dark:bg-black sm:h-12 sm:w-12">
                          {getPositionIcon(
                            position
                          )}
                        </div>

                        {/* GUIA */}

                        <div className="min-w-0 flex-1">

                          <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white sm:text-base">

                            {getGuideFlags(
                              item.guide
                            )}{" "}

                            {item.guide.name}

                          </p>

                          <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">

                            {item.guide.active
                              ? "Guia ativo"
                              : "Guia inativo"}

                          </p>

                        </div>

                        {/* QUANTIDADE */}

                        <div className="text-right">

                          <p className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">
                            {item.count}
                          </p>

                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 sm:text-xs">
                            {item.count ===
                            1
                              ? "escala"
                              : "escalas"}
                          </p>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            )}

            {/* ================================================= */}
            {/* EXPANDIR */}
            {/* ================================================= */}

            {!loading &&
              ranking.length >
                3 && (

                <button
                  type="button"
                  onClick={() =>
                    setExpanded(
                      (current) =>
                        !current
                    )
                  }
                  className="mt-5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-extrabold text-gray-700 transition dark:border-gray-700 dark:bg-black dark:text-gray-200 hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] dark:hover:bg-gray-900"
                >
                  {expanded
                    ? "Ocultar guias"
                    : `Mostrar todos (${ranking.length})`}
                </button>

              )}

          </div>

        </div>

        {/* ==================================================== */}
        {/* RODAPÉ */}
        {/* ==================================================== */}

        <footer className="mt-12 pb-5 text-center">

          <div className="mb-4 flex justify-center gap-2">

            <span className="h-2 w-8 rounded-full bg-[#e91e8c]" />
            <span className="h-2 w-8 rounded-full bg-[#1687d9]" />
            <span className="h-2 w-8 rounded-full bg-[#ffd21c]" />

          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            © 2026 Way To Know Rio
          </p>

          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Desenvolvido por{" "}
            <span className="font-semibold text-[#e91e8c]">
              MCD
            </span>
          </p>

        </footer>

      </section>

    </main>
  );
}