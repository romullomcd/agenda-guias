"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Guide = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  languages: string[];
  phone: string;
  email: string;
};

const LANGUAGES = [
  { value: "Português", label: "🇧🇷 Português", flag: "🇧🇷" },
  { value: "Inglês", label: "🇺🇸 Inglês", flag: "🇺🇸" },
  { value: "Espanhol", label: "🇪🇸 Espanhol", flag: "🇪🇸" },
  { value: "Francês", label: "🇫🇷 Francês", flag: "🇫🇷" },
  { value: "Italiano", label: "🇮🇹 Italiano", flag: "🇮🇹" },
  { value: "Alemão", label: "🇩🇪 Alemão", flag: "🇩🇪" },
  { value: "Mandarim", label: "🇨🇳 Mandarim", flag: "🇨🇳" },
  { value: "Japonês", label: "🇯🇵 Japonês", flag: "🇯🇵" },
];

const ITEMS_PER_PAGE = 10;

export default function GuiasPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  // Controle de acesso
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Formulário
  const [showForm, setShowForm] = useState(false);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  // Mensagens
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingGuideId, setDeletingGuideId] =
    useState<string | null>(null);

  // Busca e paginação
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    checkAccess();
  }, []);

  // ============================================
  // FORMATA TELEFONE
  // ============================================

  function formatPhone(value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 11);

    if (numbers.length === 0) {
      return "";
    }

    if (numbers.length <= 2) {
      return `(${numbers}`;
    }

    if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }

    return `(${numbers.slice(0, 2)}) ${numbers.slice(
      2,
      7
    )}-${numbers.slice(7)}`;
  }

  // ============================================
  // LIMPA TELEFONE PARA SALVAR
  // ============================================

  function cleanPhone(value: string) {
    return value.replace(/\D/g, "");
  }

  // ============================================
  // VERIFICA ACESSO
  // ============================================

  async function checkAccess() {
    setCheckingAccess(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } = await supabase
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
      setCheckingAccess(false);
      return;
    }

    if (profile?.role !== "admin") {
      setIsAdmin(false);
      setAccessDenied(true);
      setCheckingAccess(false);
      return;
    }

    setIsAdmin(true);
    setAccessDenied(false);
    setCheckingAccess(false);

    await loadGuides();
  }

  // ============================================
  // CARREGA GUIAS
  // ============================================

  async function loadGuides() {
    setLoading(true);
    setError("");

    try {
      const { data, error: guidesError } = await supabase
        .from("profiles")
        .select(
          "id, name, role, active, languages, phone"
        )
        .eq("role", "guide")
        .order("name");

      if (guidesError) {
        console.error(guidesError);
        setError("Não foi possível carregar os guias.");
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "Sua sessão expirou. Faça login novamente."
        );
        setLoading(false);
        return;
      }

      const guidesWithEmail = await Promise.all(
        (data || []).map(async (guide) => {
          try {
            const response = await fetch(
              `/api/guides/${guide.id}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              }
            );

            const result = await response.json();

            return {
              ...guide,
              email: result.email || "",
              phone: guide.phone || "",
            };
          } catch (fetchError) {
            console.error(
              `Erro ao buscar dados do guia ${guide.id}:`,
              fetchError
            );

            return {
              ...guide,
              email: "",
              phone: guide.phone || "",
            };
          }
        })
      );

      setGuides(guidesWithEmail);
      setCurrentPage(1);
    } catch (loadError) {
      console.error(loadError);
      setError("Não foi possível carregar os guias.");
    }

    setLoading(false);
  }

  // ============================================
  // IDIOMAS
  // ============================================

  function toggleLanguage(language: string) {
    setLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language]
    );
  }

  // ============================================
  // PEGA BANDEIRA DO IDIOMA
  // ============================================

  function getLanguageFlag(language: string) {
    const found = LANGUAGES.find(
      (item) => item.value === language
    );

    return found?.flag || "🌐";
  }

  // ============================================
  // LIMPA FORMULÁRIO
  // ============================================

  function clearForm() {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setLanguages([]);
    setEditingGuide(null);
    setShowForm(false);
  }

  // ============================================
  // ABRE FORMULÁRIO DE CRIAÇÃO
  // ============================================

  function openCreateForm() {
    setMessage("");
    setError("");

    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setLanguages([]);
    setEditingGuide(null);
    setShowForm(true);
  }

  // ============================================
  // EDITAR GUIA
  // ============================================

  async function openEditForm(guide: Guide) {
    setMessage("");
    setError("");

    setEditingGuide(guide);
    setName(guide.name);
    setLanguages(guide.languages || []);
    setPassword("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError(
        "Sua sessão expirou. Faça login novamente."
      );
      return;
    }

    const response = await fetch(
      `/api/guides/${guide.id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error ||
          "Não foi possível carregar os dados do guia."
      );
      return;
    }

    setEmail(result.email || "");

    setPhone(
      formatPhone(result.phone || "")
    );

    setShowForm(true);
  }

  // ============================================
  // CRIAR GUIA
  // ============================================

  async function createGuide(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!name.trim()) {
      setError("O nome é obrigatório.");
      return;
    }

    if (!email.trim()) {
      setError("O e-mail é obrigatório.");
      return;
    }

    if (password.length < 6) {
      setError(
        "A senha precisa ter pelo menos 6 caracteres."
      );
      return;
    }

    if (languages.length === 0) {
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

    const response = await fetch(
      "/api/guides",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          email,
          phone: cleanPhone(phone),
          password,
          languages,
        }),
      }
    );

    const result = await response.json();

    setSaving(false);

    if (!response.ok) {
      setError(
        result.error ||
          "Não foi possível criar o guia."
      );
      return;
    }

    setMessage(
      "Guia criado com sucesso!"
    );

    clearForm();

    await loadGuides();
  }

  // ============================================
  // ATUALIZAR GUIA
  // ============================================

  async function updateGuide(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!editingGuide) {
      return;
    }

    setMessage("");
    setError("");

    if (!name.trim()) {
      setError("O nome é obrigatório.");
      return;
    }

    if (!email.trim()) {
      setError("O e-mail é obrigatório.");
      return;
    }

    if (languages.length === 0) {
      setError(
        "Selecione pelo menos um idioma."
      );
      return;
    }

    if (
      password.length > 0 &&
      password.length < 6
    ) {
      setError(
        "A nova senha precisa ter pelo menos 6 caracteres."
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

    const response = await fetch(
      "/api/guides/update",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          guideId: editingGuide.id,
          name,
          email,
          phone: cleanPhone(phone),
          password,
          languages,
        }),
      }
    );

    const result = await response.json();

    setSaving(false);

    if (!response.ok) {
      setError(
        result.error ||
          "Não foi possível atualizar o guia."
      );
      return;
    }

    setMessage(
      "Dados do guia atualizados com sucesso!"
    );

    clearForm();

    await loadGuides();
  }

  // ============================================
  // ATIVAR / DESATIVAR
  // ============================================

  async function toggleGuide(guide: Guide) {
    setError("");
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError(
        "Sua sessão expirou. Faça login novamente."
      );
      return;
    }

    const response = await fetch(
      "/api/guides/status",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          guideId: guide.id,
          active: !guide.active,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error ||
          "Não foi possível alterar o status."
      );
      return;
    }

    setMessage(
      guide.active
        ? `${guide.name} foi desativado.`
        : `${guide.name} foi ativado.`
    );

    await loadGuides();
  }

  // ============================================
  // DELETAR GUIA
  // ============================================

  async function deleteGuide(guide: Guide) {
    const confirmed = window.confirm(
      `Tem certeza que deseja deletar o guia "${guide.name}"?\n\nEssa ação não poderá ser desfeita.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setDeletingGuideId(guide.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "Sua sessão expirou. Faça login novamente."
        );
        setDeletingGuideId(null);
        return;
      }

      const response = await fetch(
        `/api/guides/${guide.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const responseText = await response.text();

let result: any = {};

if (responseText) {
  try {
    result = JSON.parse(responseText);
  } catch {
    result = {};
  }
}

if (!response.ok) {
  setError(
    result.error ||
      "Não foi possível deletar o guia."
  );
  setDeletingGuideId(null);
  return;
}

      setMessage(
        `O guia "${guide.name}" foi deletado com sucesso.`
      );

      setDeletingGuideId(null);

      await loadGuides();
    } catch (deleteError) {
      console.error(deleteError);

      setError(
        "Ocorreu um erro ao tentar deletar o guia."
      );

      setDeletingGuideId(null);
    }
  }

  // ============================================
  // FILTRO DE BUSCA
  // ============================================

  const filteredGuides = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    if (!searchValue) {
      return guides;
    }

    return guides.filter((guide) => {
      const name =
        guide.name?.toLowerCase() || "";

      const email =
        guide.email?.toLowerCase() || "";

      const phone =
        guide.phone?.toLowerCase() || "";

      const formattedPhone =
        formatPhone(
          guide.phone || ""
        ).toLowerCase();

      return (
        name.includes(searchValue) ||
        email.includes(searchValue) ||
        phone.includes(searchValue) ||
        formattedPhone.includes(searchValue)
      );
    });
  }, [guides, search]);

  // ============================================
  // PAGINAÇÃO
  // ============================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredGuides.length /
        ITEMS_PER_PAGE
    )
  );

  const paginatedGuides = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      ITEMS_PER_PAGE;

    return filteredGuides.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [filteredGuides, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ============================================
  // VERIFICANDO ACESSO
  // ============================================

  if (checkingAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-5">
        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c]" />

          <p className="mt-4 text-sm font-semibold text-gray-500">
            Verificando acesso...
          </p>

        </div>
      </main>
    );
  }

  // ============================================
  // ACESSO NEGADO
  // ============================================

  if (accessDenied || !isAdmin) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f7fb] px-5">

        <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

        <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">

          <div className="flex h-1">
            <div className="flex-1 bg-[#e91e8c]" />
            <div className="flex-1 bg-[#ffd21c]" />
            <div className="flex-1 bg-[#1687d9]" />
          </div>

          <div className="p-8 text-center sm:p-10">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-4xl">
              🔒
            </div>

            <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
              Acesso restrito
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-500">
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

  // ============================================
  // PÁGINA ADMINISTRATIVA
  // ============================================

  return (
    <main className="min-h-screen bg-[#f7f7fb]">

      {/* DECORAÇÃO DE FUNDO */}

      <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ffd21c] opacity-[0.04] blur-3xl" />

      {/* HEADER */}

      <header className="relative z-10 border-b border-gray-100 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e91e8c] shadow-md shadow-pink-200">

              <img
                src="/logo-branca.png"
                alt="Way To Know Rio"
                className="max-h-8 max-w-[38px] object-contain"
              />

            </div>

            <div>

              <h1 className="text-lg font-extrabold leading-tight text-gray-900 sm:text-xl">
                Agenda de Guias
              </h1>

              <p className="text-xs text-gray-500">
                Gerenciamento de guias
              </p>

            </div>

          </div>

          <button
            onClick={() => {
              window.location.href =
                "/dashboard";
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] sm:px-4"
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

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-7 sm:px-6 sm:py-9">

        {/* TÍTULO */}

        <div className="mb-6 overflow-hidden rounded-3xl bg-white shadow-sm">

          <div className="p-6 sm:p-8">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                  👥
                </div>

                <div>

                  <p className="text-sm font-medium text-gray-400">
                    Administração
                  </p>

                  <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">
                    Gerenciamento de guias
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
                    Cadastre, edite e gerencie os guias que fazem parte da equipe.
                  </p>

                </div>

              </div>

              <div className="w-fit rounded-2xl bg-blue-50 px-4 py-3 text-[#1687d9]">

                <p className="text-xs font-semibold uppercase tracking-wider">
                  Equipe
                </p>

                <p className="mt-1 font-bold">
                  {guides.length}{" "}
                  {guides.length === 1
                    ? "guia"
                    : "guias"}
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* BUSCA + BOTÃO */}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div className="relative w-full sm:max-w-md">

            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
              🔎
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Buscar por nome, e-mail ou telefone..."
              className="w-full rounded-xl border-2 border-gray-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 transition hover:text-gray-700"
              >
                ✕
              </button>
            )}

          </div>

          <button
            onClick={
              showForm
                ? clearForm
                : openCreateForm
            }
            className="rounded-xl bg-[#e91e8c] px-5 py-3 font-extrabold text-white shadow-md shadow-pink-200 transition hover:bg-[#d91880]"
          >
            {showForm
              ? "Cancelar"
              : "+ Adicionar guia"}
          </button>

        </div>

        {/* RESULTADO DA BUSCA */}

        {!loading && search && (
          <div className="mb-4 text-sm font-medium text-gray-500">
            {filteredGuides.length === 0
              ? "Nenhum guia encontrado."
              : `${filteredGuides.length} ${
                  filteredGuides.length === 1
                    ? "guia encontrado"
                    : "guias encontrados"
                }`}
          </div>
        )}

        {/* FORMULÁRIO */}

        {showForm && (
          <div className="mb-6 overflow-hidden rounded-3xl bg-white shadow-sm">

            <div className="h-1 bg-[#1687d9]" />

            <div className="p-6 sm:p-7">

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                  👤
                </div>

                <div>

                  <h3 className="text-lg font-bold text-gray-900 sm:text-xl">
                    {editingGuide
                      ? "Editar guia"
                      : "Novo guia"}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {editingGuide
                      ? "Atualize os dados do guia."
                      : "Cadastre um novo guia na equipe."}
                  </p>

                </div>

              </div>

              <form
                onSubmit={
                  editingGuide
                    ? updateGuide
                    : createGuide
                }
                className="mt-6 grid gap-5"
              >

                {/* NOME */}

                <div>

                  <label className="mb-2 block text-sm font-bold text-gray-800">
                    Nome
                  </label>

                  <input
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50"
                    placeholder="Nome do guia"
                  />

                </div>

                {/* EMAIL */}

                <div>

                  <label className="mb-2 block text-sm font-bold text-gray-800">
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50"
                    placeholder="guia@email.com"
                  />

                </div>

                {/* TELEFONE */}

                <div>

                  <label className="mb-2 block text-sm font-bold text-gray-800">
                    Telefone
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        formatPhone(
                          e.target.value
                        )
                      )
                    }
                    maxLength={15}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50"
                    placeholder="(21) 99999-9999"
                  />

                  <p className="mt-2 text-xs font-medium text-gray-400">
                    Você pode digitar somente os números.
                  </p>

                </div>

                {/* SENHA */}

                <div>

                  <label className="mb-2 block text-sm font-bold text-gray-800">
                    {editingGuide
                      ? "Nova senha"
                      : "Senha inicial"}
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    required={!editingGuide}
                    minLength={6}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50"
                    placeholder={
                      editingGuide
                        ? "Deixe vazio para manter a senha atual"
                        : "Mínimo 6 caracteres"
                    }
                  />

                  {editingGuide && (
                    <p className="mt-2 text-xs font-medium text-gray-500">
                      Preencha somente se quiser trocar a senha.
                    </p>
                  )}

                </div>

                {/* IDIOMAS */}

                <div>

                  <label className="mb-3 block text-sm font-bold text-gray-800">
                    Idiomas
                  </label>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                    {LANGUAGES.map(
                      (language) => (

                        <label
                          key={language.value}
                          className={[
                            "cursor-pointer rounded-xl border-2 p-3 text-sm font-medium transition",
                            languages.includes(
                              language.value
                            )
                              ? "border-[#e91e8c] bg-pink-50 font-bold text-[#c91678]"
                              : "border-gray-200 bg-white text-gray-700 hover:border-[#1687d9] hover:bg-blue-50",
                          ].join(" ")}
                        >

                          <input
                            type="checkbox"
                            checked={languages.includes(
                              language.value
                            )}
                            onChange={() =>
                              toggleLanguage(
                                language.value
                              )
                            }
                            className="mr-2 accent-[#e91e8c]"
                          />

                          {language.label}

                        </label>

                      )
                    )}

                  </div>

                </div>

                {/* SALVAR */}

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 rounded-xl bg-[#1687d9] px-5 py-3 font-extrabold text-white shadow-md shadow-blue-200 transition hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Salvando..."
                    : editingGuide
                    ? "Salvar alterações"
                    : "Criar guia"}
                </button>

              </form>

            </div>

          </div>
        )}

        {/* MENSAGEM */}

        {message && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-700">
            {message}
          </div>
        )}

        {/* ERRO */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* LISTA DE GUIAS */}

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">

          <div className="flex h-1">
            <div className="flex-1 bg-[#e91e8c]" />
            <div className="flex-1 bg-[#ffd21c]" />
            <div className="flex-1 bg-[#1687d9]" />
          </div>

          {loading ? (

            <div className="p-10 text-center">

              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c]" />

              <p className="mt-4 text-sm font-medium text-gray-500">
                Carregando guias...
              </p>

            </div>

          ) : filteredGuides.length === 0 ? (

            <div className="p-10 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-50 text-2xl">
                {search
                  ? "🔎"
                  : "👤"}
              </div>

              <p className="mt-4 font-bold text-gray-700">
                {search
                  ? "Nenhum guia encontrado."
                  : "Nenhum guia cadastrado ainda."}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {search
                  ? "Tente buscar por outro nome, e-mail ou telefone."
                  : "Clique em “Adicionar guia” para começar."}
              </p>

            </div>

          ) : (

            <div className="divide-y divide-gray-100">

              {paginatedGuides.map(
                (guide) => (

                  <div
                    key={guide.id}
                    className="flex flex-col gap-5 p-6 transition hover:bg-gray-50 md:flex-row md:items-center md:justify-between"
                  >

                    {/* INFORMAÇÕES */}

                    <div className="min-w-0">

                      {/* NOME */}

                      <div className="flex items-center gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-extrabold text-[#1687d9]">
                          {guide.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">

                          <h3 className="font-extrabold text-gray-900">
                            {guide.name}
                          </h3>

                          <p className="mt-0.5 text-sm font-medium text-gray-500">
                            Guia
                          </p>

                        </div>

                      </div>

                      {/* CONTATO */}

                      <div className="mt-3 space-y-1">

                        {guide.email && (
                          <p className="truncate text-sm font-medium text-gray-500">
                            📧 {guide.email}
                          </p>
                        )}

                        {guide.phone && (
                          <p className="text-sm font-medium text-gray-500">
                            📱{" "}
                            {formatPhone(
                              guide.phone
                            )}
                          </p>
                        )}

                      </div>

                      {/* IDIOMAS */}

                      <div className="mt-4 flex flex-wrap gap-2">

                        {guide.languages?.length > 0 ? (

                          guide.languages.map(
                            (language) => (

                              <span
                                key={language}
                                className="rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-bold text-yellow-700 ring-1 ring-yellow-200"
                              >
                                {getLanguageFlag(
                                  language
                                )}{" "}
                                {language}
                              </span>

                            )
                          )

                        ) : (

                          <span className="text-xs font-medium text-gray-400">
                            Nenhum idioma informado
                          </span>

                        )}

                      </div>

                    </div>

                    {/* AÇÕES */}

                    <div className="flex flex-wrap items-center gap-3">

                      {/* STATUS */}

                      <span
                        className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${
                          guide.active
                            ? "bg-green-100 text-green-700 ring-1 ring-green-200"
                            : "bg-red-100 text-red-700 ring-1 ring-red-200"
                        }`}
                      >
                        {guide.active
                          ? "Ativo"
                          : "Inativo"}
                      </span>

                      {/* EDITAR */}

                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(
                            guide
                          )
                        }
                        className="rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
                      >
                        ✏️ Editar
                      </button>

                      {/* ATIVAR / DESATIVAR */}

                      <button
                        type="button"
                        onClick={() =>
                          toggleGuide(
                            guide
                          )
                        }
                        className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                          guide.active
                            ? "border-2 border-red-200 bg-white text-red-600 hover:bg-red-50"
                            : "bg-[#e91e8c] text-white shadow-sm shadow-pink-200 hover:bg-[#d91880]"
                        }`}
                      >
                        {guide.active
                          ? "Desativar"
                          : "Ativar"}
                      </button>

{/* DELETAR */}

<button
  type="button"
  onClick={() =>
    deleteGuide(guide)
  }
  disabled={deletingGuideId === guide.id}
  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {deletingGuideId === guide.id
    ? "Deletando..."
    : "🗑️ Deletar"}
</button>
                    </div>

                  </div>

                )
              )}

            </div>

          )}

          {/* PAGINAÇÃO */}

          {!loading &&
            filteredGuides.length >
              ITEMS_PER_PAGE && (

              <div className="border-t border-gray-100 px-5 py-4 sm:px-6">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <p className="text-sm font-medium text-gray-500">

                    Mostrando{" "}

                    <span className="font-bold text-gray-700">
                      {(currentPage - 1) *
                        ITEMS_PER_PAGE +
                        1}
                    </span>

                    {" "}até{" "}

                    <span className="font-bold text-gray-700">
                      {Math.min(
                        currentPage *
                          ITEMS_PER_PAGE,
                        filteredGuides.length
                      )}
                    </span>

                    {" "}de{" "}

                    <span className="font-bold text-gray-700">
                      {filteredGuides.length}
                    </span>

                  </p>

                  <div className="flex items-center gap-2">

                    <button
                      type="button"
                      disabled={
                        currentPage === 1
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.max(
                              1,
                              page - 1
                            )
                        )
                      }
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Anterior
                    </button>

                    <div className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#1687d9] px-3 text-sm font-extrabold text-white">
                      {currentPage}
                    </div>

                    <button
                      type="button"
                      disabled={
                        currentPage ===
                        totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.min(
                              totalPages,
                              page + 1
                            )
                        )
                      }
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Próxima →
                    </button>

                  </div>

                </div>

              </div>

            )}

        </div>

        {/* RODAPÉ */}

        <footer className="mt-12 pb-5 text-center">

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