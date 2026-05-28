export default function PacientesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Pacientes</h1>
        <button className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Novo paciente
        </button>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Buscar paciente por nome ou CPF..."
        className="w-full mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      />

      {/* Empty state */}
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-slate-400 text-sm">Nenhum paciente cadastrado ainda.</p>
        <button className="mt-4 text-sky-600 text-sm font-medium hover:underline">
          Cadastrar primeiro paciente
        </button>
      </div>
    </div>
  );
}
