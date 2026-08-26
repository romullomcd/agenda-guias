self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data
      ? event.data.json()
      : {};
  } catch {
    data = {
      title: "Agenda de Guias",
      body: event.data
        ? event.data.text()
        : "Você recebeu uma nova notificação.",
    };
  }

  const title =
    data.title ||
    "Agenda de Guias";

  const options = {
    body:
      data.body ||
      "Você recebeu uma nova notificação.",
    icon:
      data.icon ||
      "/icon.png",
    badge:
      data.badge ||
      "/icon.png",
    data:
      data.url ||
      "/dashboard",
    tag:
      data.tag ||
      "agenda-guias",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const url =
      event.notification.data ||
      "/dashboard";

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clientList) => {
          for (
            const client of clientList
          ) {
            if ("focus" in client) {
              client.navigate(url);
              return client.focus();
            }
          }

          if (
            clients.openWindow
          ) {
            return clients.openWindow(
              url
            );
          }
        })
    );
  }
);