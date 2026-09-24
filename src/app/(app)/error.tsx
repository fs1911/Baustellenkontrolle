"use client";

import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert tone="error" title="Die Seite konnte nicht geladen werden.">
        Bitte versuchen Sie es erneut. Falls das Problem bestehen bleibt, melden Sie sich beim Support
        {error.digest ? ` (Referenz: ${error.digest})` : ""}.
      </Alert>
      <Button onClick={reset}>Erneut versuchen</Button>
    </div>
  );
}
