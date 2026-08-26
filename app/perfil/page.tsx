"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  languages: string[];
  pix_key: string;
  theme: "light" | "dark";
};

const LANGUAGES = [
  {
    value: "Português",
    label: "Português",
    flag: "/flags/br.png",
  },
  {
    value: "Inglês",
    label: "Inglês",
    flag: "/flags/us.png",
  },
  {
    value: "Espanhol",
    label: "Espanhol",
    flag: "/flags/es.png",
  },
  {
    value: "Francês",
    label: "Francês",
    flag: "/flags/fr.png",
  },
  {
    value: "Italiano",
    label: "Italiano",
    flag: "/flags/it.png",
  },
  {
    value: "Alemão",
    label: "Alemão",
    flag: "/flags/de.png",
  },
  {
    value: "Mandarim",
    label: "Mandarim",
    flag: "/flags/cn.png",
  },
  {
    value: "Japonês",
    label: "Japonês",
    flag: "/flags/jp.png",
  },
];

export default function PerfilPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  // ============================================
  // CAMPOS
  // ============================================

  const [phone, setPhone] =
    useState("");

  const [pixKey, setPixKey] =
    useState("");

  const [languages, setLanguages] =
    useState<string[]>([]);

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  // ============================================
  // APLICAR TEMA
  // ============================================

  function applyTheme(
    theme: "light" | "dark"
  ) {
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    );
  }

  // ============================================
  // FORMATA TELEFONE
  // ============================================

  function formatPhone(value: string) {
    const numbers = value
      .replace(/\D/g, "")
      .slice(0, 11);

    if (numbers.length === 0) {
      return "";
    }

    if (numbers.length <= 2) {
      return `(${numbers}`;
    }

    if (numbers.length <= 7) {
      return `(${numbers.slice(
        0,
        2
      )}) ${numbers.slice(2)}`;
    }

    return `(${numbers.slice(
      0,
      2
    )}) ${numbers.slice(
      2,
      7
    )}-${numbers.slice(7)}`;
  }

  function cleanPhone(value: string) {
    return value.replace(/\D/g, "");
  }

  // ============================================
  // CARREGA PERFIL
  // ============================================

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/";
        return;
      }

      // ------------------------------------------
      // PERFIL
      // ------------------------------------------

      const response = await fetch(
        "/api/profile",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Não foi possível carregar seu perfil."
        );

        setLoading(false);
        return;
      }

      // ------------------------------------------
      // TEMA DIRETO DO BANCO
      // ------------------------------------------

      const {
        data: themeData,
        error: themeError,
      } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", session.user.id)
        .single();

      if (themeError) {
        console.error(
          "ERRO AO CARREGAR TEMA:",
          themeError
        );
      }

      const savedTheme =
        themeData?.theme === "dark"
          ? "dark"
          : "light";

      applyTheme(savedTheme);

      // ------------------------------------------
      // SALVAR PERFIL NO ESTADO
      // ------------------------------------------

      setProfile({
        ...result,
        theme: savedTheme,
      });

      setPhone(
        formatPhone(
          result.phone || ""
        )
      );

      setPixKey(
        result.pix_key || ""
      );

      setLanguages(
        result.languages || []
      );
    } catch (error) {
      console.error(error);

      setError(
        "Ocorreu um erro ao carregar seu perfil."
      );
    }

    setLoading(false);
  }

  // ============================================
  // IDIOMAS
  // ============================================

  function toggleLanguage(
    language: string
  ) {
    setLanguages((current) =>
      current.includes(language)
        ? current.filter(
            (item) => item !== language
          )
        : [...current, language]
    );
  }

  // ============================================
  // SALVAR
  // ============================================

  async function saveProfile(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!profile) {
      return;
    }

    // ------------------------------------------
    // SENHA
    // ------------------------------------------

    if (
      password.length > 0 ||
      confirmPassword.length > 0
    ) {
      if (password.length < 6) {
        setError(
          "A senha precisa ter pelo menos 6 caracteres."
        );
        return;
      }

      if (
        password !== confirmPassword
      ) {
        setError(
          "As senhas não são iguais."
        );
        return;
      }
    }

    // ------------------------------------------
    // GUIA
    // ------------------------------------------

    if (
      profile.role === "guide" &&
      languages.length === 0
    ) {
      setError(
        "Selecione pelo menos um idioma."
      );
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError(
        "Sua sessão expirou. Faça login novamente."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/profile",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            password,
            phone:
              profile.role === "guide"
                ? cleanPhone(phone)
                : "",
            pix_key:
              profile.role === "guide"
                ? pixKey.trim()
                : "",
            languages:
              profile.role === "guide"
                ? languages
                : [],
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Não foi possível atualizar seu perfil."
        );

        setSaving(false);
        return;
      }

      const passwordChanged =
  password.length > 0;

if (passwordChanged) {
  await supabase.auth.signOut();

  window.location.href = "/";

  return;
}

setMessage(
  result.message ||
    "Perfil atualizado com sucesso!"
);

setPassword("");
setConfirmPassword("");

await loadProfile();
    } catch (error) {
      console.error(error);

      setError(
        "Ocorreu um erro ao atualizar seu perfil."
      );
    }

    setSaving(false);
  }

  // ============================================
  // CARREGANDO
  // ============================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-5 dark:bg-black">
        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c] dark:border-gray-700" />

          <p className="mt-4 text-sm font-semibold text-gray-500 dark:text-gray-300">
            Carregando seu perfil...
          </p>

        </div>
      </main>
    );
  }

  // ============================================
  // ERRO
  // ============================================

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-5 dark:bg-black">

        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl dark:border dark:border-gray-800 dark:bg-gray-900">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl dark:bg-red-950/40">
            ⚠️
          </div>

          <h1 className="mt-5 text-xl font-extrabold text-gray-900 dark:text-white">
            Não foi possível carregar seu perfil
          </h1>

          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error ||
              "Ocorreu um erro inesperado."}
          </p>

          <button
            type="button"
            onClick={loadProfile}
            className="mt-6 rounded-xl bg-[#1687d9] px-5 py-3 font-extrabold text-white transition hover:bg-[#0f75bd]"
          >
            Tentar novamente
          </button>

        </div>

      </main>
    );
  }

  const isAdmin =
    profile.role === "admin";

  // ============================================
  // PÁGINA
  // ============================================

  return (
    <main className="min-h-screen bg-[#f7f7fb] dark:bg-black">

      {/* FUNDO */}

      <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

      {/* HEADER */}

      <header className="relative z-10 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-black">

        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-6">

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
                Meu Perfil
              </h1>

              <p className="text-xs text-gray-500 dark:text-gray-300">
                Dados da sua conta
              </p>

            </div>

          </div>

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

        <div className="flex h-1">
          <div className="flex-1 bg-[#e91e8c]" />
          <div className="flex-1 bg-[#ffd21c]" />
          <div className="flex-1 bg-[#1687d9]" />
        </div>

      </header>

      {/* CONTEÚDO */}

      <section className="relative z-10 mx-auto max-w-4xl px-5 py-7 sm:px-6 sm:py-10">

        {/* TÍTULO */}

        <div className="mb-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

          <div className="p-6 sm:p-8">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-3xl dark:bg-blue-950/40">
                👤
              </div>

              <div>

                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                  {isAdmin
                    ? "Administrador"
                    : "Guia"}
                </p>

                <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Meu perfil
                </h2>

                <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-300 sm:text-base">
                  Consulte seus dados e mantenha suas informações atualizadas.
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* MENSAGEM */}

        {message && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            {message}
          </div>
        )}

        {/* ERRO */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {/* FORMULÁRIO */}

        <form
          onSubmit={saveProfile}
          className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >

          <div className="h-1 bg-[#1687d9]" />

          <div className="p-6 sm:p-8">

            {/* DADOS BÁSICOS */}

            <div>

              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Dados pessoais
              </h3>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                Algumas informações são somente para visualização.
              </p>

            </div>

            <div className="mt-6 grid gap-5">

              {/* NOME */}

              <div>

                <label className="mb-2 block text-sm font-bold text-gray-800 dark:text-gray-100">
                  Nome
                </label>

                <input
                  type="text"
                  value={profile.name}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-600 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                />

              </div>

              {/* EMAIL */}

              <div>

                <label className="mb-2 block text-sm font-bold text-gray-800 dark:text-gray-100">
                  E-mail
                </label>

                <input
                  type="email"
                  value={profile.email}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-600 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                />

              </div>

              {/* GUIA — TELEFONE */}

              {!isAdmin && (
                <div>

                  <label className="mb-2 block text-sm font-bold text-gray-800 dark:text-gray-100">
                    Telefone
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        formatPhone(
                          event.target.value
                        )
                      )
                    }
                    maxLength={15}
                    placeholder="(21) 99999-9999"
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50 dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-blue-950"
                  />

                </div>
              )}

              {/* GUIA — PIX */}

              {!isAdmin && (
                <div>

                  <label className="mb-2 block text-sm font-bold text-gray-800 dark:text-gray-100">
                    Chave PIX
                  </label>

                  <input
                    type="text"
                    value={pixKey}
                    onChange={(event) =>
                      setPixKey(
                        event.target.value
                      )
                    }
                    placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatória"
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50 dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-blue-950"
                  />

                  <p className="mt-2 text-xs font-medium text-gray-400 dark:text-gray-500">
                    Chave utilizada para receber pagamentos.
                  </p>

                </div>
              )}

              {/* GUIA — IDIOMAS */}

              {!isAdmin && (
                <div>

                  <label className="mb-3 block text-sm font-bold text-gray-800 dark:text-gray-100">
                    Idiomas
                  </label>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                    {LANGUAGES.map(
                      (language) => {

                        const selected =
                          languages.includes(
                            language.value
                          );

                        return (
                          <label
                            key={
                              language.value
                            }
                            className={[
                              "cursor-pointer rounded-xl border-2 p-3 text-sm font-medium transition",
                              selected
                                ? "border-[#e91e8c] bg-pink-50 font-bold text-[#c91678] dark:bg-pink-950/30 dark:text-pink-300"
                                : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-black dark:text-gray-200 hover:border-[#1687d9] hover:bg-blue-50 dark:hover:bg-gray-900",
                            ].join(" ")}
                          >

                            <input
                              type="checkbox"
                              checked={
                                selected
                              }
                              onChange={() =>
                                toggleLanguage(
                                  language.value
                                )
                              }
                              className="mr-2 accent-[#e91e8c]"
                            />

                            <span className="inline-flex items-center gap-2">

                              <img
                                src={
                                  language.flag
                                }
                                alt=""
                                className="h-4 w-6 rounded-sm object-cover"
                              />

                              <span>
                                {
                                  language.label
                                }
                              </span>

                            </span>

                          </label>
                        );
                      }
                    )}

                  </div>

                </div>
              )}

              {/* SENHA */}

              <div className="border-t border-gray-100 pt-6 dark:border-gray-800">

                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                  Segurança
                </h3>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                  {isAdmin
                    ? "Altere a senha da sua conta de administrador."
                    : "Altere a senha utilizada para entrar na sua conta."}
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">

                  {/* NOVA SENHA */}

                  <div>

                    <label className="mb-2 block text-sm font-bold text-gray-800 dark:text-gray-100">
                      Nova senha
                    </label>

                    <input
                      type="password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50 dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-blue-950 [color-scheme:light] dark:[color-scheme:dark] autofill:bg-black"
                    />

                  </div>

                  {/* CONFIRMAR */}

                  <div>

                    <label className="mb-2 block text-sm font-bold text-gray-800 dark:text-gray-100">
                      Confirmar nova senha
                    </label>

                    <input
                      type="password"
                      value={
                        confirmPassword
                      }
                      onChange={(event) =>
                        setConfirmPassword(
                          event.target.value
                        )
                      }
                      minLength={6}
                      placeholder="Digite novamente"
                      autoComplete="new-password"
                      className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50 dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-blue-950"
                    />

                  </div>

                </div>

                <p className="mt-3 text-xs font-medium text-gray-400 dark:text-gray-500">
                  Deixe os campos vazios caso não queira alterar a senha.
                </p>

              </div>

            </div>

            {/* SALVAR */}

            <button
              type="submit"
              disabled={saving}
              className="mt-7 w-full rounded-xl bg-[#1687d9] px-5 py-3.5 font-extrabold text-white shadow-md shadow-blue-200 transition hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Salvando..."
                : "Salvar alterações"}
            </button>

          </div>

        </form>

        {/* RODAPÉ */}

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
              RMS Labs
            </span>
          </p>

        </footer>

      </section>

    </main>
  );
}