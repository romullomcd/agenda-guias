"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PushStatus =
  | "loading"
  | "available"
  | "enabled"
  | "denied"
  | "unsupported";

export default function PushNotifications() {
  const [status, setStatus] =
    useState<PushStatus>("loading");

  const [debug, setDebug] =
    useState<string[]>([]);

  function addDebug(message: string) {
    console.log(message);

    setDebug((current) => [
      ...current,
      `${new Date().toLocaleTimeString()} - ${message}`,
    ]);
  }

  useEffect(() => {
    checkPushStatus();
  }, []);

  async function checkPushStatus() {
    try {
      addDebug("Iniciando verificação...");

      if (
        !("serviceWorker" in navigator)
      ) {
        addDebug(
          "ERRO: Service Worker não suportado."
        );
        setStatus("unsupported");
        return;
      }

      if (!("PushManager" in window)) {
        addDebug(
          "ERRO: PushManager não suportado."
        );
        setStatus("unsupported");
        return;
      }

      if (!("Notification" in window)) {
        addDebug(
          "ERRO: Notifications não suportado."
        );
        setStatus("unsupported");
        return;
      }

      addDebug(
        `Permissão atual: ${Notification.permission}`
      );

      if (
        Notification.permission ===
        "denied"
      ) {
        addDebug(
          "ERRO: notificações estão bloqueadas."
        );
        setStatus("denied");
        return;
      }

      const registration =
        await navigator.serviceWorker.ready;

      addDebug(
        `Service Worker pronto: ${registration.scope}`
      );

      const subscription =
        await registration.pushManager.getSubscription();

      if (subscription) {
        addDebug(
          "Subscription local encontrada."
        );
        setStatus("enabled");
      } else {
        addDebug(
          "Nenhuma Subscription local encontrada."
        );
        setStatus("available");
      }
    } catch (error) {
      addDebug(
        `ERRO NA VERIFICAÇÃO: ${String(error)}`
      );

      setStatus("available");
    }
  }

  async function enablePush() {
    setDebug([]);

    try {
      addDebug(
        "========== INICIANDO ATIVAÇÃO =========="
      );

      if (
        !("serviceWorker" in navigator)
      ) {
        addDebug(
          "ERRO: Service Worker não suportado."
        );
        setStatus("unsupported");
        return;
      }

      if (!("PushManager" in window)) {
        addDebug(
          "ERRO: PushManager não suportado."
        );
        setStatus("unsupported");
        return;
      }

      if (!("Notification" in window)) {
        addDebug(
          "ERRO: Notifications não suportado."
        );
        setStatus("unsupported");
        return;
      }

      addDebug(
        "Suporte ao Push confirmado."
      );

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        addDebug(
          `ERRO Supabase Auth: ${userError.message}`
        );
      }

      if (!user) {
        addDebug(
          "ERRO: usuário não autenticado."
        );
        setStatus("available");
        return;
      }

      addDebug(
        `Usuário encontrado: ${user.id}`
      );

      let permission =
        Notification.permission;

      addDebug(
        `Permissão antes do pedido: ${permission}`
      );

      if (
        permission ===
        "default"
      ) {
        addDebug(
          "Solicitando permissão..."
        );

        permission =
          await Notification.requestPermission();

        addDebug(
          `Resposta da permissão: ${permission}`
        );
      }

      if (
        permission !==
        "granted"
      ) {
        addDebug(
          "Permissão não concedida."
        );

        setStatus(
          permission ===
            "denied"
            ? "denied"
            : "available"
        );

        return;
      }

      addDebug(
        "Permissão concedida."
      );

      const registration =
        await navigator.serviceWorker.ready;

      addDebug(
        `Service Worker pronto: ${registration.scope}`
      );

      const publicKey =
        process.env
          .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      addDebug(
        `VAPID public key encontrada: ${
          publicKey
            ? "SIM"
            : "NÃO"
        }`
      );

      if (!publicKey) {
        addDebug(
          "ERRO: NEXT_PUBLIC_VAPID_PUBLIC_KEY não encontrada no build."
        );

        setStatus("available");
        return;
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();

      if (existingSubscription) {
        addDebug(
          "Subscription antiga encontrada."
        );

        try {
          const removed =
            await existingSubscription.unsubscribe();

          addDebug(
            `Subscription antiga removida: ${removed}`
          );
        } catch (error) {
          addDebug(
            `Aviso ao remover subscription antiga: ${String(error)}`
          );
        }
      } else {
        addDebug(
          "Nenhuma subscription antiga."
        );
      }

      addDebug(
        "Criando nova subscription..."
      );

      const applicationServerKey =
        urlBase64ToUint8Array(
          publicKey
        );

      addDebug(
        `Chave convertida. Bytes: ${applicationServerKey.length}`
      );

      const subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

      addDebug(
        "✅ Subscription criada."
      );

      const subscriptionJson =
        subscription.toJSON();

      addDebug(
        `Endpoint recebido: ${
          subscriptionJson.endpoint
            ? "SIM"
            : "NÃO"
        }`
      );

      addDebug(
        `p256dh recebido: ${
          subscriptionJson.keys?.p256dh
            ? "SIM"
            : "NÃO"
        }`
      );

      addDebug(
        `auth recebido: ${
          subscriptionJson.keys?.auth
            ? "SIM"
            : "NÃO"
        }`
      );

      if (
        !subscriptionJson.endpoint ||
        !subscriptionJson.keys?.p256dh ||
        !subscriptionJson.keys?.auth
      ) {
        addDebug(
          "ERRO: subscription incompleta."
        );

        setStatus("available");
        return;
      }

      addDebug(
        "Enviando subscription para Supabase..."
      );

      const {
        data,
        error: saveError,
      } =
        await supabase
          .from(
            "push_subscriptions"
          )
          .upsert(
            {
              user_id:
                user.id,
              endpoint:
                subscriptionJson.endpoint,
              p256dh:
                subscriptionJson.keys
                  .p256dh,
              auth:
                subscriptionJson.keys
                  .auth,
              user_agent:
                navigator.userAgent,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                "user_id,endpoint",
            }
          )
          .select();

      if (saveError) {
        addDebug(
          `❌ ERRO SUPABASE: ${saveError.message}`
        );

        addDebug(
          `Código: ${saveError.code || "sem código"}`
        );

        addDebug(
          `Detalhes: ${saveError.details || "sem detalhes"}`
        );

        addDebug(
          `Hint: ${saveError.hint || "sem hint"}`
        );

        setStatus("available");
        return;
      }

      addDebug(
        `✅ Supabase salvou. Registros retornados: ${
          data?.length || 0
        }`
      );

      addDebug(
        "========== PUSH ATIVADO =========="
      );

      setStatus("enabled");
    } catch (error) {
      addDebug(
        `❌ ERRO GERAL: ${String(error)}`
      );

      if (
        error instanceof Error
      ) {
        addDebug(
          `Mensagem: ${error.message}`
        );
      }

      setStatus("available");
    }
  }

  if (
    status ===
    "unsupported"
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
        Este navegador não suporta Push.
      </div>
    );
  }

  if (
    status ===
    "denied"
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
        As notificações estão bloqueadas no navegador.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={enablePush}
        disabled={
          status === "loading"
        }
        className="w-full rounded-xl bg-[#1687d9] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {status === "enabled"
          ? "🔔 Testar novamente"
          : status === "loading"
          ? "Verificando..."
          : "🔔 Ativar notificações no celular"}
      </button>

      {debug.length > 0 && (
        <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-gray-950 p-3 text-left font-mono text-[11px] leading-relaxed text-green-300">
          {debug.map(
            (message, index) => (
              <div
                key={index}
                className="break-words"
              >
                {message}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (4 -
        (base64String.length % 4)) %
        4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map(
      (char) =>
        char.charCodeAt(0)
    )
  );
}