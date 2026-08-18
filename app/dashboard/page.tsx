"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Calendar from "@/components/Calendar";
import AdminCalendar from "@/components/AdminCalendar";

type Profile = {
name: string;
role: "admin" | "guide";
};

export default function Dashboard() {
const [profile, setProfile] = useState<Profile | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
loadProfile();
}, []);

async function loadProfile() {
const {
data: { user },
} = await supabase.auth.getUser();


if (!user) {
  window.location.href = "/";
  return;
}

const { data, error } = await supabase
  .from("profiles")
  .select("name, role")
  .eq("id", user.id)
  .single();

if (error || !data) {
  console.error(error);
  setLoading(false);
  return;
}

setProfile(data);
setLoading(false);


}

async function handleLogout() {
await supabase.auth.signOut();
window.location.href = "/";
}

if (loading) {
return ( <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb]"> <div className="text-center"> <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c]" /> <p className="mt-4 text-sm text-gray-500">
Carregando... </p> </div> </main>
);
}

if (!profile) {
return ( <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-6"> <div className="rounded-3xl bg-white p-8 text-center shadow-xl"> <p className="text-gray-600">
Não foi possível carregar seu perfil. </p> </div> </main>
);
}

const isAdmin = profile.role === "admin";

return ( <main className="min-h-screen bg-[#f7f7fb]">


  {/* Decoração de fundo */}

  <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

  <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

  <div className="pointer-events-none fixed left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ffd21c] opacity-[0.04] blur-3xl" />

  {/* HEADER */}

  <header className="relative z-10 border-b border-gray-100 bg-white">

    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">

      {/* Marca */}

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
            {isAdmin
              ? "Painel administrativo"
              : "Minha agenda"}
          </p>
        </div>

      </div>

      {/* Usuário */}

      <div className="flex items-center gap-3">

        <div className="hidden text-right sm:block">

          <p className="text-sm font-bold text-gray-900">
            {profile.name}
          </p>

          <p className="text-xs text-gray-500">
            {isAdmin ? "Administrador" : "Guia"}
          </p>

        </div>

        <div
          className={
            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white " +
            (isAdmin
              ? "bg-[#1687d9]"
              : "bg-[#e91e8c]")
          }
        >
          {profile.name.charAt(0).toUpperCase()}
        </div>

        <button
          onClick={handleLogout}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:px-4"
        >
          Sair
        </button>

      </div>

    </div>

    {/* Faixa das cores da empresa */}

    <div className="flex h-1">

      <div className="flex-1 bg-[#e91e8c]" />
      <div className="flex-1 bg-[#ffd21c]" />
      <div className="flex-1 bg-[#1687d9]" />

    </div>

  </header>

  {/* CONTEÚDO */}

  <section className="relative z-10 mx-auto max-w-7xl px-5 py-7 sm:px-6 sm:py-9">

   

    {/* ADMIN */}

    {isAdmin ? (
      <>

        {/* Gerenciamento */}

        <div className="mb-6 overflow-hidden rounded-3xl bg-white shadow-sm">

          <div className="h-1 bg-[#1687d9]" />

          <div className="p-6 sm:p-7">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                  👥
                </div>

                <div>

                  <h3 className="text-lg font-bold text-gray-900 sm:text-xl">
                    Gerenciamento de guias
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Cadastre, edite e gerencie os guias da equipe.
                  </p>

                </div>

              </div>

              <button
                onClick={() => {
                  window.location.href = "/guias";
                }}
                className="rounded-xl bg-[#1687d9] px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-[#0f75bd] hover:shadow-lg"
              >
                Gerenciar guias
              </button>

            </div>

          </div>

        </div>

        {/* Calendário administrativo */}

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">

          <div className="flex h-1">

            <div className="flex-1 bg-[#e91e8c]" />
            <div className="flex-1 bg-[#ffd21c]" />
            <div className="flex-1 bg-[#1687d9]" />

          </div>

          <div className="p-2 sm:p-4">

            <AdminCalendar />

          </div>

        </div>

      </>

    ) : (

      /* GUIA */

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">

        <div className="flex h-1">

          <div className="flex-1 bg-[#e91e8c]" />
          <div className="flex-1 bg-[#ffd21c]" />
          <div className="flex-1 bg-[#1687d9]" />

        </div>

        <div className="p-2 sm:p-4">

          <Calendar />

        </div>

      </div>

    )}

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
