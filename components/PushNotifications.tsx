"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PushNotifications() {
  const [status, setStatus] = useState<
    "loading" | "available" | "enabled" | "denied" | "unsupported"
  >("loading");

  useEffect(() => {
    async function checkPush() {
      try {
        if (
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          setStatus("unsupported");
          return;
        }

        const permission =
          Notification.permission;

        if (permission === "denied") {
          setStatus("denied");
          return;
        }

        const registration =
          await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager.getSubscription();

        if (subscription) {
          setStatus("enabled");
        } else {
          setStatus("available");
        }
      } catch (error) {
        console.error(
          "Erro ao verificar Push:",
          error
        );

        setStatus("available");
      }
    }

    checkPush();
  }, []);

  async function enablePush() {
    try {
      setStatus("loading");

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "Usuário não autenticado para ativar Push."
        );

        setStatus("available");
        return;
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(
          permission === "denied"
            ? "denied"
            : "available"
        );
        return;
      }

      const registration =
        await navigator.serviceWorker.ready;

      const publicKey =
        process.env
          .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        console.error(
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY não encontrada."
        );

        setStatus("available");
        return;
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();

      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(
              publicKey
            ),
        }));

      const subscriptionJson =
        subscription.toJSON();

      if (
        !subscriptionJson.endpoint ||
        !subscriptionJson.keys?.p256dh ||
        !subscriptionJson.keys?.auth
      ) {
        console.error(
          "Subscription Push inválida."
        );

        setStatus("available");
        return;
      }

      const { error: saveError } =
        await supabase
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,
              endpoint:
                subscriptionJson.endpoint,
              p256dh:
                subscriptionJson.keys.p256dh,
              auth:
                subscriptionJson.keys.auth,
              user_agent:
                navigator.userAgent,
                updated_at:
                  new Date().toISOString(),
            },
            {
              onConflict:
                "user_id,endpoint",
            }
          );

      if (saveError) {
        console.error(
          "Erro ao salvar subscription Push:",
          saveError
        );

        setStatus("available");
        return;
      }

      setStatus("enabled");

      console.log(
        "✅ Push ativado com sucesso."
      );
    } catch (error) {
      console.error(
        "Erro ao ativar Push:",
        error
      );

      setStatus("available");
    }
  }

  if (status === "unsupported") {
    return null;
  }

  if (status === "enabled") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
        🔔 Notificações do celular ativadas
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
        🔕 Notificações bloqueadas no navegador
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={enablePush}
      disabled={status === "loading"}
      className="w-full rounded-xl bg-[#1687d9] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {status === "loading"
        ? "Ativando notificações..."
        : "🔔 Ativar notificações no celular"}
    </button>
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
    (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map(
      (char) =>
        char.charCodeAt(0)
    )
  );
}