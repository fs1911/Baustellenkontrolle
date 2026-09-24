import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      title="Nicht gefunden oder keine Berechtigung"
      description="Der Eintrag existiert nicht oder Sie haben keinen Zugriff darauf."
      action={<ButtonLink href="/dashboard">Zur Übersicht</ButtonLink>}
    />
  );
}
