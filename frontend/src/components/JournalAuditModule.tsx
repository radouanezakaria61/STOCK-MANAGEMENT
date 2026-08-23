import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  History,
  Loader2,
  ScrollText
} from "lucide-react";
import type { EntreeJournalAudit, ReponseJournalAudit } from "../types";

// H4 (Phase 1) — écran « Journal d'Audit ». L'accès est protégé SERVEUR
// (permission audit.consulter exigée par GET /api/audit) ; ici, l'onglet
// n'est même pas affiché sans la permission, et toute réponse 403 est gérée.

// Miroir des codes d'action du backend (lib/journal-audit.ts). Valeurs
// d'énumération stables : une action inconnue reste consultable via la
// saisie libre.
const ACTIONS_AUDIT = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "PASSWORD_CHANGED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DISABLED",
  "ROLE_CHANGED",
  "COMPANY_CREATED",
  "COMPANY_UPDATED",
  "STOCK_ITEM_CREATED",
  "STOCK_ITEM_UPDATED",
  "STOCK_ENTRY",
  "STOCK_ADJUSTMENT",
  "ASSIGNMENT_CREATED",
  "ASSIGNMENT_CANCELLED",
  "RETURN_CREATED",
  "REASSIGNMENT_CREATED",
  "CONFIDENTIAL_REVEALED",
  "MAINTENANCE_STARTED",
  "MAINTENANCE_COMPLETED",
  "ITEM_RETIRED"
] as const;

interface FiltresAudit {
  action: string;
  identifiant: string;
  utilisateurId: string;
  entite: string;
  dateDebut: string;
  dateFin: string;
}

const FILTRES_VIDES: FiltresAudit = {
  action: "",
  identifiant: "",
  utilisateurId: "",
  entite: "",
  dateDebut: "",
  dateFin: ""
};

function couleurAction(action: string): string {
  if (action.includes("FAILED")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (action.startsWith("LOGIN") || action === "LOGOUT") return "bg-slate-100 text-slate-600 border-slate-200";
  if (action === "CONFIDENTIAL_REVEALED") return "bg-amber-50 text-amber-700 border-amber-200";
  if (action.startsWith("STOCK")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (action.startsWith("USER") || action === "ROLE_CHANGED") return "bg-purple-50 text-purple-700 border-purple-200";
  if (action.startsWith("MAINTENANCE") || action === "ITEM_RETIRED") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
}

function JSONCompact({ valeur }: { valeur: unknown }) {
  if (valeur == null) return <span className="text-slate-400">—</span>;
  return (
    <pre className="text-[10.5px] leading-relaxed bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
      {JSON.stringify(valeur, null, 2)}
    </pre>
  );
}

export default function JournalAuditModule({ permissions }: { permissions: string[] }) {
  const [filtres, setFiltres] = useState<FiltresAudit>(FILTRES_VIDES);
  const [filtresActifs, setFiltresActifs] = useState<FiltresAudit>(FILTRES_VIDES);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<ReponseJournalAudit | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);

  // Le filtre « utilisateur » liste les comptes seulement si le spectateur
  // a lui-même accès à l'annuaire ; sinon, recherche par identifiant saisi.
  const peutListerUtilisateurs = permissions.includes("utilisateurs.consulter");
  const [utilisateurs, setUtilisateurs] = useState<{ id: string; name: string; username?: string }[]>([]);

  useEffect(() => {
    if (!peutListerUtilisateurs) return;
    let vivant = true;
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (vivant && p?.data) setUtilisateurs(p.data);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [peutListerUtilisateurs]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limite", "25");
      const f = filtresActifs;
      if (f.action) params.set("action", f.action);
      if (f.identifiant) params.set("identifiant", f.identifiant);
      if (f.utilisateurId) params.set("utilisateurId", f.utilisateurId);
      if (f.entite) params.set("entite", f.entite);
      if (f.dateDebut) params.set("dateDebut", f.dateDebut);
      if (f.dateFin) params.set("dateFin", f.dateFin);
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.status === 403) {
        setErreur("Accès refusé : la permission « audit.consulter » est requise.");
        return;
      }
      if (!res.ok) {
        setErreur("Impossible de charger le journal d'audit.");
        return;
      }
      const payload = await res.json();
      setDonnees(payload.data as ReponseJournalAudit);
    } catch {
      setErreur("Erreur réseau lors du chargement du journal.");
    } finally {
      setChargement(false);
    }
  }, [page, filtresActifs]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const appliquerFiltres = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setLigneOuverte(null);
    setFiltresActifs(filtres);
  };

  const reinitialiserFiltres = () => {
    setFiltres(FILTRES_VIDES);
    setFiltresActifs(FILTRES_VIDES);
    setPage(1);
  };

  const champClasse =
    "text-xs rounded-lg border border-slate-300 px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500";

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <ScrollText size={18} className="text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Journal d'audit — traçabilité complète</h3>
            <p className="text-[11px] text-slate-500">
              Écriture seule, immuable. Consultation tracée et réservée aux habilitations « audit.consulter ».
            </p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <form onSubmit={appliquerFiltres} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          <Filter size={12} /> Filtres
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <select
            className={champClasse}
            value={filtres.action}
            onChange={(e) => setFiltres({ ...filtres, action: e.target.value })}
            title="Type d'action"
          >
            <option value="">Toutes les actions</option>
            {ACTIONS_AUDIT.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {peutListerUtilisateurs ? (
            <select
              className={champClasse}
              value={filtres.utilisateurId}
              onChange={(e) => setFiltres({ ...filtres, utilisateurId: e.target.value })}
              title="Utilisateur"
            >
              <option value="">Tous les utilisateurs</option>
              {utilisateurs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.username ? ` (${u.username})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={champClasse}
              placeholder="Identifiant tenté…"
              value={filtres.identifiant}
              onChange={(e) => setFiltres({ ...filtres, identifiant: e.target.value })}
              maxLength={190}
            />
          )}

          <input
            className={champClasse}
            placeholder="Type d'entité (ex. Affectation)"
            value={filtres.entite}
            onChange={(e) => setFiltres({ ...filtres, entite: e.target.value })}
            maxLength={60}
          />
          <input
            type="date"
            className={champClasse}
            title="Date de début"
            value={filtres.dateDebut}
            onChange={(e) => setFiltres({ ...filtres, dateDebut: e.target.value })}
          />
          <input
            type="date"
            className={champClasse}
            title="Date de fin"
            value={filtres.dateFin}
            onChange={(e) => setFiltres({ ...filtres, dateFin: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer"
          >
            Appliquer
          </button>
          <button
            type="button"
            onClick={reinitialiserFiltres}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Réinitialiser
          </button>
        </div>
      </form>

      {/* Résultats */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {erreur && (
          <div className="px-4 py-3 text-xs font-semibold text-rose-700 bg-rose-50 border-b border-rose-100">{erreur}</div>
        )}
        {chargement ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <p className="text-xs font-semibold">Chargement du journal…</p>
          </div>
        ) : !donnees || donnees.items.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
            <History size={22} className="text-slate-300" />
            <p className="text-xs font-bold text-slate-500">Aucun événement ne correspond à ces filtres.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                    <th className="px-4 py-2.5"></th>
                    <th className="px-4 py-2.5">Date &amp; heure</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Utilisateur</th>
                    <th className="px-4 py-2.5">Entité</th>
                    <th className="px-4 py-2.5">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {donnees.items.map((entree) => {
                    const ouverte = ligneOuverte === entree.id;
                    const qui = entree.utilisateur
                      ? `${entree.utilisateur.name} (${entree.utilisateur.username})`
                      : entree.identifiantTente
                        ? `${entree.identifiantTente} — compte inconnu`
                        : "—";
                    return (
                      <tr key={entree.id} className={ouverte ? "bg-indigo-50/30" : "hover:bg-slate-50/70"}>
                        <td className="pl-4 py-2.5 w-8 align-top">
                          <button
                            type="button"
                            onClick={() => setLigneOuverte(ouverte ? null : entree.id)}
                            className="p-1 rounded-md hover:bg-slate-200 text-slate-400 cursor-pointer"
                            title={ouverte ? "Replier le détail" : "Examiner avant / après"}
                          >
                            {ouverte ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] font-semibold text-slate-600 whitespace-nowrap align-top">
                          {new Date(entree.creeLe).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <span className={`inline-block text-[9.5px] font-black px-2 py-0.5 rounded-md border ${couleurAction(entree.action)}`}>
                            {entree.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-700 align-top">{qui}</td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-600 align-top">
                          {entree.entite ?? "—"}
                          {entree.entiteId && (
                            <span className="block text-[9px] text-slate-400 font-mono truncate max-w-[180px]" title={entree.entiteId}>
                              {entree.entiteId.slice(0, 13)}…
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-500 font-mono align-top">{entree.adresseIp ?? "—"}</td>
                      </tr>
                    );
                  }).flatMap((ligne, index) => {
                    const entree = donnees.items[index];
                    if (!entree || ligneOuverte !== entree.id) return [ligne];
                    return [
                      ligne,
                      <tr key={`${entree.id}-detail`} className="bg-indigo-50/20">
                        <td colSpan={6} className="px-6 pb-5 pt-1">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1.5">Détails</p>
                              <JSONCompact valeur={entree.details} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1.5">Avant</p>
                              <JSONCompact valeur={entree.valeursAvant} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1.5">Après</p>
                              <JSONCompact valeur={entree.valeursApres} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ];
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">
                Page {donnees.pagination.page} / {donnees.pagination.pages} — {donnees.pagination.total} événement(s)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={donnees.pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={donnees.pagination.page >= donnees.pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
