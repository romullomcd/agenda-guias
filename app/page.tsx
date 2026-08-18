"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Não foi possível entrar.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Não foi possível verificar seu acesso.");
      setLoading(false);
      return;
    }

    if (!profile.active) {
      await supabase.auth.signOut();
      setError(
        "Seu acesso está desativado. Entre em contato com o administrador."
      );
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f7fb] px-6 py-10">

      {/* Fundo colorido */}

      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#e91e8c] opacity-20 blur-3xl" />

      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#1687d9] opacity-20 blur-3xl" />

      <div className="absolute right-20 top-20 h-32 w-32 rounded-full bg-[#ffd21c] opacity-30 blur-3xl" />

      {/* Conteúdo */}

      <div className="relative z-10 w-full max-w-md">

        {/* Logo */}

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

        {/* Card */}

        <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-gray-200/70">

          <h2 className="text-2xl font-bold text-gray-900">
            Bem-vindo! 👋
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Entre com seus dados para continuar.
          </p>

          <form
            onSubmit={handleLogin}
            className="mt-7 space-y-5"
          >

            {/* Email */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                E-mail
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 placeholder:text-gray-500 outline-none transition focus:border-[#e91e8c] focus:bg-white focus:ring-4 focus:ring-pink-100"
              />

            </div>

            {/* Senha */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Senha
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Digite sua senha"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 placeholder:text-gray-500 outline-none transition focus:border-[#e91e8c] focus:bg-white focus:ring-4 focus:ring-pink-100"
              />

            </div>

            {/* Erro */}

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            {/* Botão */}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#e91e8c] px-5 py-3.5 font-bold text-white shadow-lg shadow-pink-200 transition hover:bg-[#d81780] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

          </form>

          {/* Cores da empresa */}

          <div className="mt-7 flex justify-center gap-2">

            <span className="h-2.5 w-2.5 rounded-full bg-[#e91e8c]" />

            <span className="h-2.5 w-2.5 rounded-full bg-[#1687d9]" />

            <span className="h-2.5 w-2.5 rounded-full bg-[#ffd21c]" />

          </div>

        </div>

        {/* Rodapé */}

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