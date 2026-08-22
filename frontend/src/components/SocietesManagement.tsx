import React, { useState } from "react";
import { Societe, AppUser } from "../types";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Power,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Landmark
} from "lucide-react";

interface SocietesManagementProps {
  societes: Societe[];
  currentUser: AppUser | null;
  // Permissions effectives de la session (l'autorité reste côté serveur :
  // exigerPermission("societes.gerer") protège les routes mutantes).
  permissions?: string[];
  onRefresh: () => Promise<void>;
  addNotification: (
    title: string,
    description: string,
    type: "alerte" | "info",
    targetTab?: string
  ) => void;
}

interface FormulaireSociete {
  nom: string;
  codeCourt: string;
  adresse: string;
  ville: string;
  telephone: string;
  email: string;
  identifiantLegal: string;
  notes: string;
}

const FORMULAIRE_VIDE: FormulaireSociete = {
  nom: "",
  codeCourt: "",
  adresse: "",
  ville: "",
  telephone: "",
  email: "",
  identifiantLegal: "",
  notes: "",
};

export default function SocietesManagement({
  societes,
  currentUser,
  permissions = [],
  onRefresh,
  addNotification,
}: SocietesManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSociete, setEditingSociete] = useState<Societe | null>(null);
  const [formData, setFormData] = useState<FormulaireSociete>(FORMULAIRE_VIDE);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canManage = permissions.includes("societes.gerer");

  const filteredSocietes = societes.filter((s) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      s.nom.toLowerCase().includes(q) ||
      s.codeCourt.toLowerCase().includes(q) ||
      (s.ville ?? "").toLowerCase().includes(q) ||
      (s.identifiantLegal ?? "").toLowerCase().includes(q);
    const matchStatut =
      statutFilter === "ALL" || (statutFilter === "ACTIVE" ? s.actif : !s.actif);
    return matchSearch && matchStatut;
  });

  const handleOpenCreate = () => {
    setEditingSociete(null);
    setFormData(FORMULAIRE_VIDE);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (societe: Societe) => {
    setEditingSociete(societe);
    setFormData({
      nom: societe.nom,
      codeCourt: societe.codeCourt,
      adresse: societe.adresse ?? "",
      ville: societe.ville ?? "",
      telephone: societe.telephone ?? "",
      email: societe.email ?? "",
      identifiantLegal: societe.identifiantLegal ?? "",
      notes: societe.notes ?? "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveSociete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim() || !formData.codeCourt.trim()) {
      setFormError("Le nom et le code court sont obligatoires.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const res = editingSociete
        ? await fetch(`/api/societes/${editingSociete.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          })
        : await fetch("/api/societes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Erreur lors de l'enregistrement de la société.");
      }

      setIsModalOpen(false);
      addNotification(
        editingSociete ? "Société Mise à Jour" : "Nouvelle Société Créée",
        `« ${formData.nom} » a été ${editingSociete ? "mise à jour" : "ajoutée au référentiel"} avec succès.`,
        "info",
        "societes"
      );
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActif = async (societe: Societe) => {
    const nextActif = !societe.actif;
    if (!window.confirm(
      nextActif
        ? `Réactiver la société « ${societe.nom} » ?`
        : `Désactiver la société « ${societe.nom} » ? Elle restera visible dans le référentiel (aucune suppression physique).`
    )) {
      return;
    }
    try {
      const res = await fetch(`/api/societes/${societe.id}/statut`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: nextActif }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || "Erreur lors du changement de statut.");
        return;
      }
      addNotification(
        nextActif ? "Société Réactivée" : "Société Désactivée",
        result.message,
        "info",
        "societes"
      );
      await onRefresh();
    } catch (err) {
      alert("Erreur réseau");
    }
  };

  const activesCount = societes.filter((s) => s.actif).length;

  return (
    <div className="space-y-6" id="societes-module">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Building2 className="text-indigo-600" size={22} />
              Référentiel des Sociétés du Groupe
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Étiquette organisationnelle pour filtrer les utilisateurs et le matériel. Tout le monde voit toutes les
            données ; aucune suppression physique n'est possible, une société fermée est simplement désactivée.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          disabled={!canManage}
          title={!canManage ? "Action réservée aux administrateurs" : ""}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs transition shrink-0 ${
            canManage
              ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          <Plus size={15} />
          <span>Nouvelle Société</span>
        </button>
      </div>

      {/* Cartes indicateurs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sociétés Référencées</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{societes.length}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Entités du groupe</p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Entités Actives</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{activesCount}</h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-0.5">Rattachement autorisé</p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Entités Désactivées</p>
              <h3 className="text-2xl font-black text-amber-700 mt-1">{societes.length - activesCount}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Conservées pour l'historique</p>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Power size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher par nom, code court, ville ou ICE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
          />
        </div>
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
          className="bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 px-3 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="ALL">Tous les Statuts</option>
          <option value="ACTIVE">Actives</option>
          <option value="INACTIVE">Désactivées</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-5">Référence</th>
                <th className="py-3 px-4">Société</th>
                <th className="py-3 px-4">Coordonnées</th>
                <th className="py-3 px-4">Identifiant Legal (ICE)</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSocietes.map((societe) => (
                <tr key={societe.id} className={`hover:bg-slate-50/60 transition ${!societe.actif ? "opacity-60 bg-slate-50/30" : ""}`}>
                  <td className="py-3.5 px-5">
                    <span className="font-mono text-[11px] font-bold text-slate-500">{societe.reference}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <p className="font-extrabold text-slate-900">{societe.nom}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{societe.codeCourt}</p>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5 text-[11px] text-slate-600">
                      {societe.ville && (
                        <p className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-slate-400 shrink-0" /> {societe.ville}
                          {societe.adresse && <span className="text-slate-400 truncate max-w-[160px]">— {societe.adresse}</span>}
                        </p>
                      )}
                      {societe.telephone && (
                        <p className="flex items-center gap-1.5">
                          <Phone size={11} className="text-slate-400 shrink-0" /> {societe.telephone}
                        </p>
                      )}
                      {societe.email && (
                        <p className="flex items-center gap-1.5 truncate">
                          <Mail size={11} className="text-slate-400 shrink-0" /> {societe.email}
                        </p>
                      )}
                      {!societe.ville && !societe.telephone && !societe.email && (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {societe.identifiantLegal ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                        <Landmark size={12} className="text-slate-400" />
                        {societe.identifiantLegal}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        societe.actif
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${societe.actif ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {societe.actif ? "Active" : "Désactivée"}
                    </span>
                  </td>

                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(societe)}
                        disabled={!canManage}
                        title={!canManage ? "Non autorisé" : "Modifier la société"}
                        className={`p-1.5 rounded-lg border text-slate-600 border-slate-200 transition ${
                          canManage ? "hover:bg-slate-100 hover:text-indigo-600 cursor-pointer" : "opacity-40 cursor-not-allowed"
                        }`}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActif(societe)}
                        disabled={!canManage}
                        title={
                          !canManage
                            ? "Non autorisé"
                            : societe.actif
                            ? "Désactiver la société"
                            : "Réactiver la société"
                        }
                        className={`p-1.5 rounded-lg border transition ${
                          societe.actif
                            ? "text-slate-500 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
                            : "text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                        } ${!canManage ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <Power size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredSocietes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                    Aucune société ne correspond à vos critères de recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création / modification */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveSociete} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl my-8">
            {/* En-tête */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingSociete ? `Modifier ${editingSociete.nom}` : "Créer une Nouvelle Société"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Le code court identifie l'entité dans les filtres (ex. DSA pour Distra SA).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Corps */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {formError && (
                <div className="sm:col-span-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nom / Raison sociale *</label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  placeholder="Ex. Distra SA"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Code Court *</label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={formData.codeCourt}
                  onChange={(e) => setFormData({ ...formData, codeCourt: e.target.value.toUpperCase() })}
                  placeholder="Ex. DSA"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Adresse</label>
                <input
                  type="text"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  placeholder="45 Boulevard Zerktouni, 5e étage"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Ville</label>
                <input
                  type="text"
                  value={formData.ville}
                  onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                  placeholder="Ex. Casablanca"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="+212 5 XX XX XX XX"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@societe.ma"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Identifiant Legal (ICE)</label>
                <input
                  type="text"
                  value={formData.identifiantLegal}
                  onChange={(e) => setFormData({ ...formData, identifiantLegal: e.target.value })}
                  placeholder="001234567000045"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Notes internes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Précisions éventuelles"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Pied */}
            <div className="p-6 pt-0 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                  isSaving
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                }`}
              >
                <CheckCircle2 size={14} />
                <span>{editingSociete ? "Sauvegarder les Modifications" : "Créer la Société"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
