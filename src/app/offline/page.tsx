export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Keine Verbindung</h1>
      <p>Diese Seite ist offline nicht verfügbar. Bereits geöffnete Schnellerfassungen funktionieren weiter; erfasste Feststellungen werden auf dem Gerät gespeichert und automatisch synchronisiert, sobald wieder eine Verbindung besteht.</p>
    </main>
  );
}
