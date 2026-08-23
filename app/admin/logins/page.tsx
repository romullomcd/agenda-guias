"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LoginUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  active: boolean | null;
  last_sign_in_at: string | null;
};

type Theme = "light" | "dark";

export default function AdminLogins() {
  const [users, setUsers] =
    useState<LoginUser[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [accessDenied, setAccessDenied] =
    useState(false);

  const [search, setSearch] =
    useState("");

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
  // VERIFICAR ACESSO + CARREGAR LOGINS
  // ============================================================

  useEffect(() => {
    checkAccessAndLoadLogins();
  }, []);

  async function checkAccessAndLoadLogins() {
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
        "❌ ERRO AO VERIFICAR USUÁRIO:",
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
        "❌ ERRO AO VERIFICAR PERMISSÃO:",
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
        "⚠️ ACESSO NEGADO À PÁGINA DE LOGINS:",
        user.id
      );

      setAccessDenied(true);
      setLoading(false);
      return;
    }

    // ==========================================================
    // É ADMIN
    // ==========================================================

    await loadLogins();
  }

  // ============================================================
  // CARREGAR LOGINS
  // ============================================================

  async function loadLogins() {
    console.log(
      "=========================================="
    );

    console.log(
      "🔐 CARREGANDO ÚLTIMOS LOGINS"
    );

    console.log(
      "=========================================="
    );

    const {
      data,
      error,
    } = await supabase.rpc(
      "get_user_login_info"
    );

    if (error) {
      console.error(
        "❌ ERRO AO CARREGAR LOGINS:",
        error
      );

      setLoading(false);
      return;
    }

    console.log(
      "✅ LOGINS CARREGADOS:",
      data
    );

    setUsers(
      (data || []) as LoginUser[]
    );

    setLoading(false);
  }

  // ============================================================
  // PESQUISA
  // ============================================================

  const filteredUsers = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    if (!term) {
      return users.slice(0, 10);
    }

    return users
      .filter((user) => {
        const name =
          user.name
            ?.toLowerCase() || "";

        const email =
          user.email
            ?.toLowerCase() || "";

        return (
          name.includes(term) ||
          email.includes(term)
        );
      })
      .slice(0, 10);
  }, [users, search]);

  // ============================================================
  // FORMATAR DATA
  // ============================================================

  function formatLastLogin(
    value: string | null
  ) {
    if (!value) {
      return "Nunca entrou";
    }

    const date =
      new Date(value);

    return date.toLocaleString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // ============================================================
  // TEMPO RELATIVO
  // ============================================================

  function formatRelativeTime(
    value: string | null
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    const now =
      new Date();

    const difference =
      now.getTime() -
      date.getTime();

    const minutes = Math.floor(
      difference /
        (1000 * 60)
    );

    if (minutes < 1) {
      return "agora mesmo";
    }

    if (minutes < 60) {
      return `há ${minutes} ${
        minutes === 1
          ? "minuto"
          : "minutos"
      }`;
    }

    const hours = Math.floor(
      minutes / 60
    );

    if (hours < 24) {
      return `há ${hours} ${
        hours === 1
          ? "hora"
          : "horas"
      }`;
    }

    const days = Math.floor(
      hours / 24
    );

    if (days < 30) {
      return `há ${days} ${
        days === 1
          ? "dia"
          : "dias"
      }`;
    }

    return "";
  }

  // ============================================================
  // ÍCONE DO USUÁRIO
  // ============================================================

  function getInitial(
    name: string | null
  ) {
    if (!name) {
      return "?";
    }

    return name
      .charAt(0)
      .toUpperCase();
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
  // PÁGINA
  // ============================================================

  return (
    <main className="min-h-screen bg-[#f7f7fb] dark:bg-black">

      {/* ====================================================== */}
      {/* DECORAÇÃO */}
      {/* ====================================================== */}

      <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ffd21c] opacity-[0.04] blur-3xl" />

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <header className="relative z-10 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-black">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">

          {/* LOGO */}

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
                Controle de acessos
              </p>

            </div>

          </div>

          {/* VOLTAR */}

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

        {/* FAIXA */}

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

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-3xl dark:bg-blue-950/40">
                🔐
              </div>

              <div>

                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                  Administração
                </p>

                <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Últimos acessos
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-300 sm:text-base">
                  Acompanhe quando cada usuário acessou a Agenda de Guias pela última vez.
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* ==================================================== */}
        {/* CARD */}
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
            {/* PESQUISA */}
            {/* ================================================= */}

            <div className="mb-6">

              <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200">
                Pesquisar usuário
              </label>

              <div className="relative">

                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                  🔎
                </span>

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Digite o nome ou e-mail..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-900 dark:focus:ring-blue-950"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    aria-label="Limpar pesquisa"
                  >
                    ✕
                  </button>
                )}

              </div>

              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {search
                  ? `Pesquisando por "${search}"`
                  : "Mostrando os 10 usuários com acesso mais recente."}
              </p>

            </div>

            {/* ================================================= */}
            {/* LISTA */}
            {/* ================================================= */}

            {filteredUsers.length ===
            0 ? (

              <div className="rounded-2xl bg-gray-50 px-5 py-12 text-center dark:bg-gray-800">

                <div className="text-4xl">
                  🔎
                </div>

                <h3 className="mt-4 text-lg font-extrabold text-gray-800 dark:text-white">
                  Nenhum usuário encontrado
                </h3>

                <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-300">
                  Tente pesquisar por outro nome ou e-mail.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {filteredUsers.map(
                  (
                    user,
                    index
                  ) => {

                    const relative =
                      formatRelativeTime(
                        user.last_sign_in_at
                      );

                    return (
                      <div
                        key={user.id}
                        className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 transition hover:border-blue-100 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-900 dark:hover:bg-gray-800 sm:flex-row sm:items-center sm:p-5"
                      >

                        {/* POSIÇÃO */}

                        <div className="flex items-center gap-3 sm:w-[55px] sm:shrink-0 sm:flex-col sm:gap-1">

                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-[#1687d9] dark:bg-blue-950/40">
                            {index + 1}
                          </div>

                          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 sm:hidden">
                            posição
                          </span>

                        </div>

                        {/* AVATAR */}

                        <div
                          className={[
                            "hidden h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white sm:flex",
                            user.role === "admin"
                              ? "bg-[#1687d9]"
                              : "bg-[#e91e8c]",
                          ].join(" ")}
                        >
                          {getInitial(
                            user.name
                          )}
                        </div>

                        {/* USUÁRIO */}

                        <div className="min-w-0 flex-1">

                          <div className="flex items-start justify-between gap-3">

                            <div className="min-w-0">

                              <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white sm:text-base">
                                {user.name ||
                                  "Sem nome"}
                              </p>

                              <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-300 sm:text-sm">
                                {user.email ||
                                  "E-mail não informado"}
                              </p>

                            </div>

                            <div
                              className={[
                                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide",
                                user.role ===
                                  "admin"
                                  ? "bg-blue-50 text-[#1687d9] dark:bg-blue-950/40"
                                  : "bg-pink-50 text-[#e91e8c] dark:bg-pink-950/40",
                              ].join(" ")}
                            >
                              {user.role ===
                              "admin"
                                ? "Admin"
                                : "Guia"}
                            </div>

                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">

                            <span
                              className={[
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
                                user.active
                                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                                  : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
                              ].join(" ")}
                            >
                              <span>
                                {user.active
                                  ? "🟢"
                                  : "🔴"}
                              </span>

                              {user.active
                                ? "Ativo"
                                : "Inativo"}
                            </span>

                            {relative && (
                              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                {relative}
                              </span>
                            )}

                          </div>

                        </div>

                        {/* ÚLTIMO LOGIN */}

                        <div className="border-t border-gray-100 pt-3 text-left dark:border-gray-700 sm:w-[190px] sm:shrink-0 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">

                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            Último login
                          </p>

                          <p className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                            {user.last_sign_in_at
                              ? formatLastLogin(
                                  user.last_sign_in_at
                                )
                              : "Nunca entrou"}
                          </p>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            )}

            {/* ================================================= */}
            {/* ATUALIZAR */}
            {/* ================================================= */}

            <button
              type="button"
              onClick={() =>
                loadLogins()
              }
              className="mt-5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-extrabold text-gray-700 transition dark:border-gray-700 dark:bg-black dark:text-gray-200 hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] dark:hover:bg-gray-900"
            >
              🔄 Atualizar acessos
            </button>

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
              Machado's
            </span>
          </p>

        </footer>

      </section>

    </main>
  );
}