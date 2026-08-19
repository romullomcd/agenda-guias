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
  // VERIFICAR ACESSO + CARREGAR RANKING
  // ============================================================

  useEffect(() => {
    checkAccessAndLoadRanking();
  }, [currentMonth]);

  async function checkAccessAndLoadRanking() {
    setLoading(true);
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
    // VERIFICAR ROLE
    // ==========================================================

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
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
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-5">

        <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

        <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

        <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">

          {/* FAIXA */}

          <div className="flex h-1">

            <div className="flex-1 bg-[#e91e8c]" />
            <div className="flex-1 bg-[#ffd21c]" />
            <div className="flex-1 bg-[#1687d9]" />

          </div>

          <div className="p-7 text-center sm:p-9">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-4xl">
              🔒
            </div>

            <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
              Acesso restrito
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Esta área é exclusiva para administradores.
              Você não possui permissão para visualizar o
              ranking de guias.
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
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb]">

        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c]" />

          <p className="mt-4 text-sm font-medium text-gray-500">
            Verificando acesso...
          </p>

        </div>

      </main>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="min-h-screen bg-[#f7f7fb]">

      {/* ====================================================== */}
      {/* FUNDO */}
      {/* ====================================================== */}

      <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

      {/* ====================================================== */}
      {/* CONTEÚDO */}
      {/* ====================================================== */}

      <section className="relative z-10 mx-auto max-w-5xl px-5 py-7 sm:px-6 sm:py-10">

        {/* CABEÇALHO */}

        <div className="mb-6 flex items-center gap-3">

          <button
            type="button"
            onClick={() => {
              window.location.href =
                "/dashboard";
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-bold text-gray-700 shadow-sm transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
          >
            ←
          </button>

          <div>

            <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
              🏆 Ranking de Guias
            </h1>

            <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">
              Quantidade de vezes que cada guia foi escalado no mês.
            </p>

          </div>

        </div>

        {/* CARD */}

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">

          {/* FAIXA */}

          <div className="flex h-1">

            <div className="flex-1 bg-[#e91e8c]" />
            <div className="flex-1 bg-[#ffd21c]" />
            <div className="flex-1 bg-[#1687d9]" />

          </div>

          <div className="p-5 sm:p-7">

            {/* NAVEGAÇÃO */}

            <div className="mb-6 flex items-center justify-between rounded-2xl bg-gray-50 p-2 sm:p-3">

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
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-extrabold text-gray-800 shadow-sm transition hover:border-[#e91e8c] hover:bg-pink-50 hover:text-[#e91e8c]"
              >
                ←
              </button>

              <div className="text-center">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Ranking mensal
                </p>

                <h2 className="mt-0.5 text-lg font-extrabold capitalize text-gray-900 sm:text-2xl">
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
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-extrabold text-gray-800 shadow-sm transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
              >
                →
              </button>

            </div>

            {/* INFORMAÇÃO */}

            <div className="mb-6 rounded-2xl bg-blue-50 px-4 py-3">

              <p className="text-sm font-semibold text-blue-800">

                📊 Mostrando as escalas realizadas em{" "}

                <span className="font-extrabold capitalize">
                  {monthName}
                </span>

              </p>

            </div>

            {/* RANKING */}

            {ranking.length === 0 ? (

              <div className="rounded-2xl bg-gray-50 px-5 py-12 text-center">

                <div className="text-4xl">
                  🏆
                </div>

                <h3 className="mt-4 text-lg font-extrabold text-gray-800">
                  Nenhuma escala neste mês
                </h3>

                <p className="mt-2 text-sm font-medium text-gray-500">
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
                            ? "border-yellow-200 bg-yellow-50"
                            : position === 2
                            ? "border-gray-200 bg-gray-50"
                            : position === 3
                            ? "border-orange-200 bg-orange-50"
                            : "border-gray-100 bg-white hover:bg-gray-50",
                        ].join(" ")}
                      >

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-extrabold shadow-sm sm:h-12 sm:w-12">

                          {getPositionIcon(
                            position
                          )}

                        </div>

                        <div className="min-w-0 flex-1">

                          <p className="truncate text-sm font-extrabold text-gray-900 sm:text-base">

                            {getGuideFlags(
                              item.guide
                            )}{" "}

                            {item.guide.name}

                          </p>

                          <p className="mt-1 text-xs font-medium text-gray-500">

                            {item.guide.active
                              ? "Guia ativo"
                              : "Guia inativo"}

                          </p>

                        </div>

                        <div className="text-right">

                          <p className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
                            {item.count}
                          </p>

                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 sm:text-xs">

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

            {/* EXPANDIR */}

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
                  className="mt-5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-extrabold text-gray-700 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
                >
                  {expanded
                    ? "Ocultar guias"
                    : `Mostrar todos (${ranking.length})`}
                </button>
              )}

          </div>

        </div>

        {/* RODAPÉ */}

        <footer className="mt-10 pb-5 text-center">

          <div className="mb-4 flex justify-center gap-2">

            <span className="h-2 w-8 rounded-full bg-[#e91e8c]" />
            <span className="h-2 w-8 rounded-full bg-[#1687d9]" />
            <span className="h-2 w-8 rounded-full bg-[#ffd21c]" />

          </div>

          <p className="text-xs text-gray-400">
            © 2026 Way To Know Rio
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Desenvolvido por{" "}
            <span className="font-semibold text-[#e91e8c]">
              Machado's
            </span>
          </p>

        </footer>

      </section>

    </main>
  );
}