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

  useEffect(() => {
    checkPushStatus();
  }, []);

  async function checkPushStatus() {
    try {
      if (!("serviceWorker" in navigator)) {
        setStatus("unsupported");
        return;
      }

      if (!("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }

      if (!("Notification" in window)) {
        setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
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
    } catch {
      setStatus("available");
    }
  }

  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator)) {
        setStatus("unsupported");
        return;
      }

      if (!("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }

      if (!("Notification" in window)) {
        setStatus("unsupported");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setStatus("available");
        return;
      }

      let permission =
        Notification.permission;

      if (permission === "default") {
        permission =
          await Notification.requestPermission();
      }

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
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        setStatus("available");
        return;
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();

      if (existingSubscription) {
        try {
          await existingSubscription.unsubscribe();
        } catch {}
      }

      const applicationServerKey =
        urlBase64ToUint8Array(publicKey);

      const subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

      const subscriptionJson =
        subscription.toJSON();

      if (
        !subscriptionJson.endpoint ||
        !subscriptionJson.keys?.p256dh ||
        !subscriptionJson.keys?.auth
      ) {
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
        setStatus("available");
        return;
      }

      setStatus("enabled");
    } catch {
      setStatus("available");
    }
  }

  if (status === "unsupported") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
        Este navegador não suporta Push.
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
        As notificações estão bloqueadas no navegador.
      </div>
    );
  }

  return (
    <div>

      <button
  type="button"
  onClick={enablePush}
  disabled={status === "loading" || status === "enabled"}
  className={
    status === "enabled"
      ? "w-full rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-extrabold text-green-700 sm:w-auto dark:border-green-900 dark:bg-green-950 dark:text-green-300"
      : "w-full rounded-xl bg-[#1687d9] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
  }
>
  {status === "enabled"
    ? "✅ Notificações ativadas"
    : status === "loading"
    ? "Verificando..."
    : "🔔 Ativar notificações no celular"}
</button>

    </div>
  );
}

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

  const base64 =
    (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) =>
      char.charCodeAt(0)
    )
  );
}