
"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

      const formData = new FormData(event.currentTarget);

      const cleanEmail = String(
        formData.get("email") ?? ""
      )
        .trim()
        .toLowerCase();

      const formPassword = String(
        formData.get("password") ?? ""
      );

      console.log("==========================================");
      console.log("🔐 INICIANDO LOGIN");
      console.log("📧 E-MAIL:", cleanEmail);
      console.log(
        "🔑 SENHA RECEBIDA:",
        formPassword.length > 0
      );
      console.log("==========================================");

      // ========================================================
      // VALIDAR E-MAIL
      // ========================================================

      if (!cleanEmail) {
        setError("Digite seu e-mail.");
        setLoading(false);
        return;
      }

      // ========================================================
      // VALIDAR SENHA
      // ========================================================

      if (!formPassword) {
        setError("Digite sua senha.");
        setLoading(false);
        return;
      }

      // ========================================================
      // LOGIN SUPABASE
      // ========================================================

      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f7fb] px-6 py-10">

      {/* FUNDO */}

      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#e91e8c] opacity-20 blur-3xl" />

      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#1687d9] opacity-20 blur-3xl" />

      <div className="absolute right-20 top-20 h-32 w-32 rounded-full bg-[#ffd21c] opacity-30 blur-3xl" />

      {/* CONTEÚDO */}

      <div className="relative z-10 w-full max-w-md">

        {/* LOGO */}

        <div className="mb-8 text-center">

          <div className="mb-6 flex justify-center">

            <div className="flex h-28 w-72 items-center justify-center rounded-3xl bg-[#e91e8c] shadow-xl shadow-pink-200">

              <img
                src="/logo-branca.png"
                alt="Way To Know Rio"
                className="max-h-20 max-w-[230px] object-contain"
              />

            </div>

          </div>

          <h1 className="text-3xl font-extrabold text-gray-900">
            Agenda de Guias
          </h1>

          <p className="mt-2 text-gray-500">
            Gerencie a disponibilidade da sua equipe.
          </p>

        </div>

        {/* CARD */}

        <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-gray-200/70">

          <h2 className="text-2xl font-bold text-gray-900">
            Bem-vindo! 👋
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Entre com seus dados para continuar.
          </p>

          {/* FORMULÁRIO */}

          <form
            onSubmit={handleLogin}
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
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                required
                autoComplete="email"
                placeholder="seu@email.com"
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 placeholder:text-gray-500 outline-none transition focus:border-[#e91e8c] focus:bg-white focus:ring-4 focus:ring-pink-100 disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* SENHA */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Senha
              </label>

              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                required
                autoComplete="current-password"
                placeholder="Digite sua senha"
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 placeholder:text-gray-500 outline-none transition focus:border-[#e91e8c] focus:bg-white focus:ring-4 focus:ring-pink-100 disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* ERRO */}

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
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

          {/* CORES */}

          <div className="mt-7 flex justify-center gap-2">

            <span className="h-2.5 w-2.5 rounded-full bg-[#e91e8c]" />

            <span className="h-2.5 w-2.5 rounded-full bg-[#1687d9]" />

            <span className="h-2.5 w-2.5 rounded-full bg-[#ffd21c]" />

          </div>

        </div>

        {/* RODAPÉ */}

        <div className="mt-8 text-center">

          <p className="text-xs text-gray-400">
            © 2026 Way To Know Rio
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Desenvolvido por{" "}
            <span className="font-semibold text-[#e91e8c]">
              Machado's
            </span>
          </p>

        </div>

      </div>

    </main>
  );
}

