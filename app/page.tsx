
"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // ========================================================
      // PEGAR DADOS DIRETAMENTE DO FORMULÁRIO
      // ========================================================

      const formData =
        new FormData(event.currentTarget);

      const cleanEmail = String(
        formData.get("email") ?? ""
      )
        .trim()
        .toLowerCase();

      const formPassword = String(
        formData.get("password") ?? ""
      );

      console.log(
        "=========================================="
      );

      console.log(
        "🔐 INICIANDO LOGIN"
      );

      console.log(
        "📧 E-MAIL:",
        cleanEmail
      );

      console.log(
        "🔑 SENHA RECEBIDA:",
        formPassword.length > 0
      );

      console.log(
        "=========================================="
      );

      // ========================================================
      // VALIDAR E-MAIL
      // ========================================================

      if (!cleanEmail) {
        setError(
          "Digite seu e-mail."
        );

        setLoading(false);

        return;
      }

      // ========================================================
      // VALIDAR SENHA
      // ========================================================

      if (!formPassword) {
        setError(
          "Digite sua senha."
        );

        setLoading(false);

        return;
      }

      // ========================================================
      // LOGIN SUPABASE
      // ========================================================

      const {
        data,
        error: loginError,
      } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: formPassword,
        });

      // ========================================================
      // ERRO DO LOGIN
      // ========================================================

      if (loginError) {
        console.error(
          "=========================================="
        );

        console.error(
          "❌ ERRO REAL DO SUPABASE NO LOGIN"
        );

        console.error(
          "MESSAGE:",
          loginError.message
        );

        console.error(
          "STATUS:",
          loginError.status
        );

        console.error(
          "NAME:",
          loginError.name
        );

        console.error(
          "ERROR COMPLETO:",
          loginError
        );

        console.error(
          "=========================================="
        );

        const message =
          loginError.message.toLowerCase();

        if (
          message.includes(
            "invalid login credentials"
          )
        ) {
          setError(
            "E-mail ou senha incorretos."
          );
        } else if (
          message.includes(
            "missing email"
          ) ||
          message.includes(
            "missing email or phone"
          )
        ) {
          setError(
            "Digite seu e-mail."
          );
        } else {
          setError(
            loginError.message ||
              "Não foi possível realizar o login."
          );
        }

        setLoading(false);

        return;
      }

      // ========================================================
      // VERIFICAR USUÁRIO
      // ========================================================

      const user = data.user;

      if (!user) {
        console.error(
          "❌ LOGIN REALIZADO, MAS USUÁRIO NÃO RETORNADO"
        );

        console.error(
          "LOGIN DATA:",
          data
        );

        setError(
          "Não foi possível identificar seu usuário."
        );

        setLoading(false);

        return;
      }

      console.log(
        "✅ LOGIN SUPABASE REALIZADO"
      );

      console.log(
        "👤 USER ID:",
        user.id
      );

      console.log(
        "📧 USER EMAIL:",
        user.email
      );

      console.log(
        "🔐 SESSION RECEBIDA:",
        !!data.session
      );

      // ========================================================
      // GARANTIR QUE EXISTE SESSÃO
      // ========================================================

      if (!data.session) {
        console.warn(
          "⚠️ LOGIN RETORNOU USUÁRIO, MAS NÃO RETORNOU SESSÃO"
        );

        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          console.error(
            "❌ ERRO AO RECUPERAR SESSÃO:",
            sessionError
          );

          await supabase.auth.signOut();

          setError(
            "Não foi possível estabelecer sua sessão. Tente novamente."
          );

          setLoading(false);

          return;
        }

        if (!sessionData.session) {
          console.error(
            "❌ NENHUMA SESSÃO DISPONÍVEL APÓS LOGIN"
          );

          await supabase.auth.signOut();

          setError(
            "Não foi possível estabelecer sua sessão. Tente novamente."
          );

          setLoading(false);

          return;
        }

        console.log(
          "✅ SESSÃO RECUPERADA"
        );
      }

      // ========================================================
      // VERIFICAR PERFIL
      // ========================================================

      console.log(
        "📋 VERIFICANDO PERFIL..."
      );

      const {
        data: profile,
        error: profileError,
      } =
        await supabase
          .from("profiles")
          .select("active")
          .eq(
            "id",
            user.id
          )
          .single();

      // ========================================================
      // ERRO AO VERIFICAR PERFIL
      // ========================================================

      if (profileError) {
        console.error(
          "=========================================="
        );

        console.error(
          "❌ ERRO AO VERIFICAR PERFIL"
        );

        console.error(
          "MESSAGE:",
          profileError.message
        );

        console.error(
          "DETAILS:",
          profileError.details
        );

        console.error(
          "HINT:",
          profileError.hint
        );

        console.error(
          "CODE:",
          profileError.code
        );

        console.error(
          "ERROR COMPLETO:",
          profileError
        );

        console.error(
          "=========================================="
        );

        await supabase.auth.signOut();

        setError(
          "Não foi possível verificar seu acesso."
        );

        setLoading(false);

        return;
      }

      // ========================================================
      // PERFIL NÃO ENCONTRADO
      // ========================================================

      if (!profile) {
        console.error(
          "❌ PERFIL NÃO ENCONTRADO"
        );

        await supabase.auth.signOut();

        setError(
          "Seu perfil não foi encontrado."
        );

        setLoading(false);

        return;
      }

      console.log(
        "✅ PERFIL ENCONTRADO:",
        profile
      );

      // ========================================================
      // VERIFICAR SE ESTÁ ATIVO
      // ========================================================

      if (!profile.active) {
        console.warn(
          "⚠️ USUÁRIO DESATIVADO"
        );

        await supabase.auth.signOut();

        setError(
          "Seu acesso está desativado. Entre em contato com o administrador."
        );

        setLoading(false);

        return;
      }

      // ========================================================
      // LOGIN CONCLUÍDO
      // ========================================================

      console.log(
        "=========================================="
      );

      console.log(
        "✅ LOGIN COMPLETO COM SUCESSO"
      );

      console.log(
        "👤 USER:",
        user.id
      );

      console.log(
        "📧 EMAIL:",
        user.email
      );

      console.log(
        "🟢 PERFIL ATIVO:",
        profile.active
      );

      console.log(
        "➡️ REDIRECIONANDO PARA /dashboard"
      );

      console.log(
        "=========================================="
      );

      // ========================================================
      // REDIRECIONAR
      // ========================================================

      window.location.replace(
        "/dashboard"
      );
    } catch (error) {
      console.error(
        "=========================================="
      );

      console.error(
        "❌ ERRO INESPERADO NO LOGIN"
      );

      console.error(
        error
      );

      console.error(
        "=========================================="
      );

      setError(
        "Ocorreu um erro ao entrar. Tente novamente."
      );

      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#f7f7fb] px-5 py-8 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-10">

      {/* ======================================================
         FUNDO
      ====================================================== */}

      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#e91e8c] opacity-20 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#1687d9] opacity-20 blur-3xl" />

      <div className="pointer-events-none absolute right-20 top-20 h-32 w-32 rounded-full bg-[#ffd21c] opacity-30 blur-3xl" />

      {/* ======================================================
         CONTEÚDO
      ====================================================== */}

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col">

        {/* ====================================================
           LOGO
        ==================================================== */}

        <div className="mb-7 text-center sm:mb-8">

          <div className="mb-5 flex justify-center sm:mb-6">

            <div className="flex h-24 w-full max-w-[288px] items-center justify-center rounded-3xl bg-[#e91e8c] shadow-xl shadow-pink-200 sm:h-28">

              <img
                src="/logo-branca.png"
                alt="Way To Know Rio"
                className="max-h-16 max-w-[210px] object-contain sm:max-h-20 sm:max-w-[230px]"
              />

            </div>

          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Agenda de Guias
          </h1>

          <p className="mt-2 text-sm text-gray-500 sm:text-base">
            Gerencie a disponibilidade da sua equipe.
          </p>

        </div>

        {/* ====================================================
           CARD
        ==================================================== */}

        <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-gray-200/70 sm:p-8">

          <h2 className="text-2xl font-bold text-gray-900">
            Bem-vindo! 👋
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Entre com seus dados para continuar.
          </p>

          {/* ==================================================
             FORMULÁRIO
          ================================================== */}

          <form
            onSubmit={
              handleLogin
            }
            className="mt-7 space-y-5"
          >

            {/* EMAIL */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                E-mail
              </label>

              <input
                type="email"
                name="email"
                value={email}
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target.value
                  )
                }
                required
                autoComplete="email"
                placeholder="seu@email.com"
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-[#e91e8c] focus:bg-white focus:ring-4 focus:ring-pink-100 disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* SENHA */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Senha
              </label>

              <div className="relative">

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  value={password}
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  required
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 pr-12 text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-[#e91e8c] focus:bg-white focus:ring-4 focus:ring-pink-100 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 3l18 18"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.58 10.58a2 2 0 002.84 2.84"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.88 4.24A9.77 9.77 0 0112 4c5.05 0 8.55 4.42 9.5 6.5a10.5 10.5 0 01-2.03 2.98"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.61 6.61C4.62 7.93 3.25 9.7 2.5 10.5 3.45 12.58 7 17 12 17c1.61 0 3.08-.43 4.39-1.16"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />
                    </svg>
                  )}
                </button>

              </div>

            </div>

            {/* ERRO */}

            {error && (
              <div className="break-words rounded-xl bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-600">
                {error}
              </div>
            )}

            {/* BOTÃO */}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#e91e8c] px-5 py-3.5 font-bold text-white shadow-lg shadow-pink-200 transition hover:bg-[#d81780] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Entrando..."
                : "Entrar"}
            </button>

          </form>

          {/* ==================================================
             CORES
          ================================================== */}

          <div className="mt-7 flex justify-center gap-2">

            <span className="h-2.5 w-2.5 rounded-full bg-[#e91e8c]" />

            <span className="h-2.5 w-2.5 rounded-full bg-[#1687d9]" />

            <span className="h-2.5 w-2.5 rounded-full bg-[#ffd21c]" />

          </div>

        </div>

        {/* ====================================================
           RODAPÉ
        ==================================================== */}

        <footer className="mt-7 pb-4 text-center sm:mt-8 sm:pb-0">

          <p className="text-xs leading-5 text-gray-400">
            © 2026 Way To Know Rio
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-400">
            Desenvolvido por{" "}
            <span className="font-semibold text-[#e91e8c]">
              RMS Labs
            </span>
          </p>

        </footer>

      </div>

    </main>
  );
}

