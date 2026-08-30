"use client";

import { useState } from "react";

export default function TermosDeServico() {
  const [language, setLanguage] = useState<
    "pt" | "en"
  >("pt");

  const isPortuguese =
    language === "pt";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-800 dark:bg-black dark:text-gray-100 sm:px-6 sm:py-10">

      <div className="mx-auto w-full max-w-3xl">

        {/* ======================================================
           VOLTAR AO LOGIN
        ====================================================== */}

        <div className="mb-4">

          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-white hover:text-[#e91e8c] dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-[#e91e8c]"
          >

            <span aria-hidden="true">
              ←
            </span>

            {isPortuguese
              ? "Voltar ao login"
              : "Back to login"}

          </a>

        </div>

        {/* ======================================================
           CABEÇALHO
        ====================================================== */}

        <div className="mb-5 overflow-hidden rounded-3xl bg-[#e91e8c] shadow-xl">

          <div className="flex items-center justify-center px-6 py-8 sm:py-10">

            <img
              src="https://agenda.waytoknowrio.com/logo-branca.png"
              alt="Way To Know Rio"
              className="max-h-16 max-w-[240px] object-contain sm:max-h-20 sm:max-w-[280px]"
            />

          </div>

        </div>

        {/* ======================================================
           CARD
        ====================================================== */}

        <div className="rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-950 sm:p-10">

          {/* ====================================================
             TÍTULO + IDIOMA
          ==================================================== */}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            <div>

              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                {isPortuguese
                  ? "Termos de Serviço"
                  : "Terms of Service"}
              </h1>

              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {isPortuguese
                  ? "Última atualização: 30 de agosto de 2026"
                  : "Last updated: August 30, 2026"}
              </p>

            </div>

            {/* ==================================================
               SELETOR DE IDIOMA
            ================================================== */}

            <div className="flex w-fit shrink-0 self-start rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900 sm:self-auto">

              <button
                type="button"
                onClick={() =>
                  setLanguage("pt")
                }
                className={[
                  "rounded-lg px-3 py-2 text-xs font-extrabold transition",
                  isPortuguese
                    ? "bg-[#e91e8c] text-white shadow-sm"
                    : "text-gray-500 hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
                ].join(" ")}
              >
                Português
              </button>

              <button
                type="button"
                onClick={() =>
                  setLanguage("en")
                }
                className={[
                  "rounded-lg px-3 py-2 text-xs font-extrabold transition",
                  !isPortuguese
                    ? "bg-[#e91e8c] text-white shadow-sm"
                    : "text-gray-500 hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
                ].join(" ")}
              >
                English
              </button>

            </div>

          </div>

          {/* ====================================================
             CONTEÚDO
          ==================================================== */}

          {isPortuguese ? (
            <div className="mt-8 space-y-7 text-sm leading-7 sm:text-base">

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  1. Aceitação
                </h2>

                <p className="mt-2">
                  Ao utilizar o Agenda WayToKnowRio, o usuário concorda
                  com estes Termos de Serviço e com a Política de
                  Privacidade aplicável ao sistema.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  2. Uso do sistema
                </h2>

                <p className="mt-2">
                  O sistema é destinado ao gerenciamento de agendas,
                  disponibilidades, guias, tours e integrações relacionadas
                  às atividades da operação.
                </p>

                <p className="mt-2">
                  O usuário deve fornecer informações corretas e utilizar
                  o sistema de acordo com sua finalidade.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  3. Conta e autenticação
                </h2>

                <p className="mt-2">
                  O usuário é responsável pela segurança de sua conta e
                  pelas ações realizadas utilizando suas credenciais.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  4. Integrações com terceiros
                </h2>

                <p className="mt-2">
                  Algumas funcionalidades dependem de serviços de terceiros,
                  incluindo o Google. A utilização dessas integrações está
                  sujeita também aos termos e políticas dos respectivos
                  provedores.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  5. Disponibilidade
                </h2>

                <p className="mt-2">
                  O sistema pode sofrer interrupções, manutenção,
                  atualizações ou indisponibilidades decorrentes de falhas
                  próprias ou de serviços de terceiros.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  6. Uso indevido
                </h2>

                <p className="mt-2">
                  Não é permitido utilizar o sistema para atividades
                  ilícitas, tentar obter acesso não autorizado, interferir
                  no funcionamento da aplicação ou utilizar dados de forma
                  incompatível com sua finalidade.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  7. Alterações dos termos
                </h2>

                <p className="mt-2">
                  Estes termos podem ser atualizados para refletir mudanças
                  no sistema, nas integrações ou nas exigências legais.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  8. Contato
                </h2>

                <p className="mt-2">
                  Para dúvidas sobre estes termos, entre em contato:
                </p>

                <p className="mt-2 font-bold text-[#e91e8c]">
                  adtodosossantos@gmail.com
                </p>

              </section>

            </div>
          ) : (
            <div className="mt-8 space-y-7 text-sm leading-7 sm:text-base">

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  1. Acceptance
                </h2>

                <p className="mt-2">
                  By using Agenda WayToKnowRio, the user agrees to these
                  Terms of Service and to the Privacy Policy applicable
                  to the system.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  2. Use of the system
                </h2>

                <p className="mt-2">
                  The system is intended for managing schedules, guide
                  availability, guides, tours, and integrations related
                  to the operation.
                </p>

                <p className="mt-2">
                  Users must provide accurate information and use the
                  system according to its intended purpose.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  3. Account and authentication
                </h2>

                <p className="mt-2">
                  Users are responsible for the security of their accounts
                  and for actions performed using their credentials.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  4. Third-party integrations
                </h2>

                <p className="mt-2">
                  Some features depend on third-party services, including
                  Google. Use of these integrations is also subject to the
                  terms and policies of the respective providers.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  5. Availability
                </h2>

                <p className="mt-2">
                  The system may experience interruptions, maintenance,
                  updates, or unavailability resulting from failures
                  affecting the application or third-party services.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  6. Prohibited use
                </h2>

                <p className="mt-2">
                  Users may not use the system for unlawful activities,
                  attempt unauthorized access, interfere with the operation
                  of the application, or use data in a manner incompatible
                  with its intended purpose.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  7. Changes to the terms
                </h2>

                <p className="mt-2">
                  These terms may be updated to reflect changes to the
                  system, integrations, or applicable legal requirements.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  8. Contact
                </h2>

                <p className="mt-2">
                  For questions regarding these terms, please contact:
                </p>

                <p className="mt-2 font-bold text-[#e91e8c]">
                  adtodosossantos@gmail.com
                </p>

              </section>

            </div>
          )}

        </div>

        {/* ======================================================
           RODAPÉ
        ====================================================== */}

        <footer className="mt-6 pb-4 text-center">

          <p className="text-xs leading-5 text-gray-400">
            © 2026 Way To Know Rio
          </p>

        </footer>

      </div>

    </main>
  );
}