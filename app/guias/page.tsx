"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Guide = {
id: string;
name: string;
role: string;
active: boolean;
languages: string[];
};

const LANGUAGES = [
{ value: "Português", label: "🇧🇷 Português" },
{ value: "Inglês", label: "🇺🇸 Inglês" },
{ value: "Espanhol", label: "🇪🇸 Espanhol" },
{ value: "Francês", label: "🇫🇷 Francês" },
{ value: "Italiano", label: "🇮🇹 Italiano" },
{ value: "Alemão", label: "🇩🇪 Alemão" },
{ value: "Mandarim", label: "🇨🇳 Mandarim" },
{ value: "Japonês", label: "🇯🇵 Japonês" },
];

export default function GuiasPage() {
const [guides, setGuides] = useState<Guide[]>([]);
const [loading, setLoading] = useState(true);

const [showForm, setShowForm] = useState(false);
const [editingGuide, setEditingGuide] = useState<Guide | null>(null);

const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [languages, setLanguages] = useState<string[]>([]);

const [message, setMessage] = useState("");
const [error, setError] = useState("");
const [saving, setSaving] = useState(false);

useEffect(() => {
loadGuides();
}, []);

async function loadGuides() {
setLoading(true);


const { data, error } = await supabase
  .from("profiles")
  .select("id, name, role, active, languages")
  .eq("role", "guide")
  .order("name");

if (error) {
  console.error(error);
  setError("Não foi possível carregar os guias.");
} else {
  setGuides(data || []);
}

setLoading(false);


}

function toggleLanguage(language: string) {
setLanguages((current) =>
current.includes(language)
? current.filter((item) => item !== language)
: [...current, language]
);
}

function clearForm() {
setName("");
setEmail("");
setPassword("");
setLanguages([]);
setEditingGuide(null);
setShowForm(false);
}

function openCreateForm() {
setMessage("");
setError("");


setName("");
setEmail("");
setPassword("");
setLanguages([]);
setEditingGuide(null);
setShowForm(true);


}

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
  setError("Sua sessão expirou. Faça login novamente.");
  return;
}

const response = await fetch(`/api/guides/${guide.id}`, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});

const result = await response.json();

if (!response.ok) {
  setError(
    result.error || "Não foi possível carregar os dados do guia."
  );
  return;
}

setEmail(result.email || "");
setShowForm(true);


}

async function createGuide(event: React.FormEvent) {
event.preventDefault();


setMessage("");
setError("");

if (password.length < 6) {
  setError("A senha precisa ter pelo menos 6 caracteres.");
  return;
}

if (languages.length === 0) {
  setError("Selecione pelo menos um idioma.");
  return;
}

const {
  data: { session },
} = await supabase.auth.getSession();

if (!session) {
  setError("Sua sessão expirou. Faça login novamente.");
  return;
}

setSaving(true);

const response = await fetch("/api/guides", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    name,
    email,
    password,
    languages,
  }),
});

const result = await response.json();

setSaving(false);

if (!response.ok) {
  setError(result.error || "Não foi possível criar o guia.");
  return;
}

setMessage("Guia criado com sucesso!");

clearForm();
await loadGuides();


}

async function updateGuide(event: React.FormEvent) {
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
  setError("Selecione pelo menos um idioma.");
  return;
}

if (password.length > 0 && password.length < 6) {
  setError("A nova senha precisa ter pelo menos 6 caracteres.");
  return;
}

const {
  data: { session },
} = await supabase.auth.getSession();

if (!session) {
  setError("Sua sessão expirou. Faça login novamente.");
  return;
}

setSaving(true);

const response = await fetch("/api/guides/update", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    guideId: editingGuide.id,
    name,
    email,
    password,
    languages,
  }),
});

const result = await response.json();

setSaving(false);

if (!response.ok) {
  setError(result.error || "Não foi possível atualizar o guia.");
  return;
}

setMessage("Dados do guia atualizados com sucesso!");

clearForm();
await loadGuides();


}

async function toggleGuide(guide: Guide) {
setError("");
setMessage("");


const {
  data: { session },
} = await supabase.auth.getSession();

if (!session) {
  setError("Sua sessão expirou. Faça login novamente.");
  return;
}

const response = await fetch("/api/guides/status", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    guideId: guide.id,
    active: !guide.active,
  }),
});

const result = await response.json();

if (!response.ok) {
  setError(result.error || "Não foi possível alterar o status.");
  return;
}

setMessage(
  guide.active
    ? `${guide.name} foi desativado.`
    : `${guide.name} foi ativado.`
);

await loadGuides();


}

return ( <main className="min-h-screen bg-[#f7f7fb]">


  {/* DECORAÇÃO DE FUNDO */}

  <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

  <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

  <div className="pointer-events-none fixed left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ffd21c] opacity-[0.04] blur-3xl" />

  {/* HEADER */}

  <header className="relative z-10 border-b border-gray-100 bg-white">

    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">

      {/* MARCA */}

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

      {/* VOLTAR */}

      <button
        onClick={() => {
          window.location.href = "/dashboard";
        }}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] sm:px-4"
      >
        ← Voltar
      </button>

    </div>

    {/* FAIXA DAS CORES DA EMPRESA */}

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

          <div className="w-fit rounded-2xl bg-blue-50 px-4 py-3 text-[#1687d9]">

            <p className="text-xs font-semibold uppercase tracking-wider">
              Equipe
            </p>

            <p className="mt-1 font-bold">
              {guides.length} {guides.length === 1 ? "guia" : "guias"}
            </p>

          </div>

        </div>

      </div>

    </div>

    {/* BOTÃO ADICIONAR */}

    <div className="mb-6 flex justify-end">

      <button
        onClick={showForm ? clearForm : openCreateForm}
        className="rounded-xl bg-[#e91e8c] px-5 py-3 font-extrabold text-white shadow-md shadow-pink-200 transition hover:bg-[#d91880]"
      >
        {showForm ? "Cancelar" : "+ Adicionar guia"}
      </button>

    </div>

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
                {editingGuide ? "Editar guia" : "Novo guia"}
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                {editingGuide
                  ? "Atualize os dados do guia."
                  : "Cadastre um novo guia na equipe."}
              </p>

            </div>

          </div>

          <form
            onSubmit={editingGuide ? updateGuide : createGuide}
            className="mt-6 grid gap-5"
          >

            {/* NOME */}

            <div>

              <label className="mb-2 block text-sm font-bold text-gray-800">
                Nome
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-50"
                placeholder="guia@email.com"
              />

            </div>

            {/* SENHA */}

            <div>

              <label className="mb-2 block text-sm font-bold text-gray-800">
                {editingGuide ? "Nova senha" : "Senha inicial"}
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

                {LANGUAGES.map((language) => (
                  <label
                    key={language.value}
                    className={[
                      "cursor-pointer rounded-xl border-2 p-3 text-sm font-medium transition",
                      languages.includes(language.value)
                        ? "border-[#e91e8c] bg-pink-50 font-bold text-[#c91678]"
                        : "border-gray-200 bg-white text-gray-700 hover:border-[#1687d9] hover:bg-blue-50",
                    ].join(" ")}
                  >

                    <input
                      type="checkbox"
                      checked={languages.includes(language.value)}
                      onChange={() =>
                        toggleLanguage(language.value)
                      }
                      className="mr-2 accent-[#e91e8c]"
                    />

                    {language.label}

                  </label>
                ))}

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

      ) : guides.length === 0 ? (

        <div className="p-10 text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-50 text-2xl">
            👤
          </div>

          <p className="mt-4 font-bold text-gray-700">
            Nenhum guia cadastrado ainda.
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Clique em “Adicionar guia” para começar.
          </p>

        </div>

      ) : (

        <div className="divide-y divide-gray-100">

          {guides.map((guide) => (

            <div
              key={guide.id}
              className="flex flex-col gap-5 p-6 transition hover:bg-gray-50 md:flex-row md:items-center md:justify-between"
            >

              {/* INFORMAÇÕES */}

              <div>

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 font-extrabold text-[#1687d9]">
                    {guide.name.charAt(0).toUpperCase()}
                  </div>

                  <div>

                    <h3 className="font-extrabold text-gray-900">
                      {guide.name}
                    </h3>

                    <p className="mt-0.5 text-sm font-medium text-gray-500">
                      Guia
                    </p>

                  </div>

                </div>

                {/* IDIOMAS */}

                <div className="mt-4 flex flex-wrap gap-2">

                  {guide.languages?.length > 0 ? (

                    guide.languages.map((language) => (

                      <span
                        key={language}
                        className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-bold text-yellow-700 ring-1 ring-yellow-200"
                      >
                        {language}
                      </span>

                    ))

                  ) : (

                    <span className="text-xs font-medium text-gray-400">
                      Nenhum idioma informado
                    </span>

                  )}

                </div>

              </div>

              {/* AÇÕES */}

              <div className="flex flex-wrap items-center gap-3">

                <span
                  className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${
                    guide.active
                      ? "bg-green-100 text-green-700 ring-1 ring-green-200"
                      : "bg-red-100 text-red-700 ring-1 ring-red-200"
                  }`}
                >
                  {guide.active ? "Ativo" : "Inativo"}
                </span>

                <button
                  onClick={() => openEditForm(guide)}
                  className="rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
                >
                  ✏️ Editar
                </button>

                <button
                  onClick={() => toggleGuide(guide)}
                  className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                    guide.active
                      ? "border-2 border-red-200 bg-white text-red-600 hover:bg-red-50"
                      : "bg-[#e91e8c] text-white shadow-sm shadow-pink-200 hover:bg-[#d91880]"
                  }`}
                >
                  {guide.active ? "Desativar" : "Ativar"}
                </button>

              </div>

            </div>

          ))}

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
