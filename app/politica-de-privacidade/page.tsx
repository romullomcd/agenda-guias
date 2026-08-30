"use client";

import { useState } from "react";

export default function PoliticaDePrivacidade() {
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
                  ? "Política de Privacidade"
                  : "Privacy Policy"}
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

            <div className="flex shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">

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
                  1. Sobre esta política
                </h2>

                <p className="mt-2">
                  Esta Política de Privacidade explica como o sistema
                  Agenda WayToKnowRio trata as informações utilizadas
                  para autenticação, gerenciamento de agenda e integração
                  com serviços do Google.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  2. Informações utilizadas
                </h2>

                <p className="mt-2">
                  O sistema pode utilizar informações necessárias para a
                  identificação e funcionamento da conta, incluindo nome,
                  endereço de e-mail e informações relacionadas às agendas,
                  tours e disponibilidades cadastradas no sistema.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  3. Integração com o Google
                </h2>

                <p className="mt-2">
                  O sistema pode utilizar serviços do Google para permitir
                  integração com o Google Calendar e consulta de contatos,
                  de acordo com as permissões autorizadas pelo usuário.
                </p>

                <p className="mt-2">
                  As informações acessadas por meio das APIs do Google são
                  utilizadas somente para fornecer as funcionalidades
                  relacionadas à integração autorizada pelo usuário.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  4. Uso das informações
                </h2>

                <p className="mt-2">
                  As informações são utilizadas para autenticação,
                  funcionamento da agenda, gerenciamento de tours,
                  disponibilidade de guias e integração com os serviços
                  autorizados.
                </p>

                <p className="mt-2">
                  As informações não são vendidas ou disponibilizadas para
                  terceiros para fins de publicidade.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  5. Compartilhamento
                </h2>

                <p className="mt-2">
                  Informações podem ser enviadas aos serviços necessários
                  para executar funcionalidades solicitadas pelo usuário,
                  incluindo os serviços do Google quando a integração estiver
                  autorizada.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  6. Segurança
                </h2>

                <p className="mt-2">
                  São adotadas medidas técnicas e administrativas razoáveis
                  para proteger as informações utilizadas pelo sistema.
                  Nenhum sistema conectado à internet pode garantir
                  segurança absoluta.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  7. Exclusão e revogação de acesso
                </h2>

                <p className="mt-2">
                  O usuário pode revogar a autorização concedida ao Google
                  a qualquer momento por meio das configurações da própria
                  conta Google. A utilização do sistema também pode ser
                  interrompida pelo administrador responsável.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  8. Alterações nesta política
                </h2>

                <p className="mt-2">
                  Esta política poderá ser atualizada quando necessário para
                  refletir alterações no sistema, nas integrações ou nas
                  obrigações legais aplicáveis.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  9. Contato
                </h2>

                <p className="mt-2">
                  Para dúvidas relacionadas a esta política ou ao tratamento
                  das informações, entre em contato pelo endereço:
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
                  1. About this policy
                </h2>

                <p className="mt-2">
                  This Privacy Policy explains how the Agenda
                  WayToKnowRio system handles the information used for
                  authentication, agenda management, and integration
                  with Google services.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  2. Information we use
                </h2>

                <p className="mt-2">
                  The system may use information necessary for account
                  identification and operation, including name, email
                  address, and information related to schedules, tours,
                  and guide availability registered in the system.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  3. Google integration
                </h2>

                <p className="mt-2">
                  The system may use Google services to provide
                  integration with Google Calendar and access to
                  contacts, according to the permissions authorized
                  by the user.
                </p>

                <p className="mt-2">
                  Information accessed through Google APIs is used only
                  to provide the features related to the integration
                  authorized by the user.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  4. Use of information
                </h2>

                <p className="mt-2">
                  Information is used for authentication, agenda
                  operation, tour management, guide availability
                  management, and integration with authorized services.
                </p>

                <p className="mt-2">
                  Information is not sold or made available to third
                  parties for advertising purposes.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  5. Sharing of information
                </h2>

                <p className="mt-2">
                  Information may be sent to services necessary to
                  perform features requested by the user, including
                  Google services when the integration is authorized.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  6. Security
                </h2>

                <p className="mt-2">
                  Reasonable technical and administrative measures are
                  adopted to protect the information used by the system.
                  No internet-connected system can guarantee absolute
                  security.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  7. Deletion and access revocation
                </h2>

                <p className="mt-2">
                  Users may revoke the authorization granted to Google
                  at any time through their Google account settings.
                  Use of the system may also be discontinued by the
                  responsible administrator.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  8. Changes to this policy
                </h2>

                <p className="mt-2">
                  This policy may be updated when necessary to reflect
                  changes to the system, integrations, or applicable
                  legal requirements.
                </p>

              </section>

              <section>

                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                  9. Contact
                </h2>

                <p className="mt-2">
                  For questions regarding this policy or the handling
                  of information, please contact:
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