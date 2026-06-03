import { auth } from '@/auth';
import { WeekCalendar } from '@/components/agenda/WeekCalendar';

export default async function AgendaPage() {
  const session = await auth();
  const isOwner = session?.user?.role === 'owner';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Agenda</h1>
      </div>
      <WeekCalendar isOwner={isOwner} />
    </div>
  );
}
