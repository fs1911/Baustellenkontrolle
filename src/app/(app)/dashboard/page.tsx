import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/feedback";

export default async function DashboardPage() {
  const user = await requireUser();
  return <PageHeader title="Dashboard" description={`Willkommen, ${user.fullName}`} />;
}
