import React, { useState } from "react";
import { AppUser, Societe, UserRole } from "../types";
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Phone,
  Edit2,
  Trash2,
  LogIn,
  Lock,
  Unlock,
  ShieldCheck,
  CheckCircle2,
  Shield,
  Building2
} from "lucide-react";

interface UserManagementProps {
  users: AppUser[];
  societes: Societe[];
  currentUser: AppUser | null;
  onUpdateUsers: (users: AppUser[]) => void;
  onSwitchUser: (user: AppUser) => void;
  onRefresh: () => Promise<void>;
}

const ROLE_LABELS: Record<UserRole, { title: string; badge: string; color: string; desc: string }> = {
  ADMIN: {
    title: "Administrateur Global",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    color: "text-purple-700",
    desc: "Contrôle total du système : comptes, référentiel sociétés et parc informatique.",
  },
  AUDITOR: {
    title: "Auditeur & Contrôleur",
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    color: "text-sky-700",
    desc: "Consultation en lecture seule de l'ensemble du parc et des mouvements.",
  },
  UTILISATEUR: {
    title: "Utilisateur Parc IT",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    color: "text-emerald-700",
    desc: "Gestion courante du parc : stock IT, affectations et dotations.",
  },
};

const DEPARTMENTS = [
  "Technologies de l'Information",
  "Ressources Humaines & Moyens Généraux",
  "Ventes & Marketing",
  "Chaîne Logistique & Approvisionnements",
  "Direction Générale & Finance",
];

export default function UserManagement({
  users,
  societes,
  currentUser,
  onUpdateUsers,
  onSwitchUser,
  onRefresh,
}: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [societeFilter, setSocieteFilter] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    department: string;
    jobTitle: string;
    role: UserRole;
    status: "Actif" | "Inactif" | "Suspendu";
    societeId: string;
  }>({
    name: "",
    email: "",
    phone: "",
    department: DEPARTMENTS[0],
    jobTitle: "",
    role: "UTILISATEUR",
    status: "Actif",
    societeId: "",
  });

  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Seuls les administrateurs gèrent les comptes (RBAC serveur au chantier 3)
  const canManage = currentUser?.role === "ADMIN";

  const libelleSociete = (user: AppUser) => user.societe?.nom ?? "Non rattaché";

  // Complète un utilisateur renvoyé par l'API avec sa société déjà chargée côté client
  const enrichir = (u: AppUser): AppUser => ({
    ...u,
    societe: societes.find((s) => s.id === u.societeId) ?? null,
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      department: DEPARTMENTS[0],
      jobTitle: "",
      role: "UTILISATEUR",
      status: "Actif",
      societeId: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      department: user.department,
      jobTitle: user.jobTitle,
      role: user.role,
      status: user.status,
      societeId: user.societeId ?? "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Submit User form
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError("Le nom complet et l'adresse email sont obligatoires.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const corps = { ...formData, societeId: formData.societeId || null };
      const res = editingUser
        ? await fetch(`/api/users/${editingUser.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corps),
          })
        : await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corps),
          });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Erreur lors de l'enregistrement");
      }

      const utilisateurEnrichi = enrichir(result.data);
      const updatedUsers = editingUser
        ? users.map((u) => (u.id === editingUser.id ? utilisateurEnrichi : u))
        : [utilisateurEnrichi, ...users];
      onUpdateUsers(updatedUsers);

      // Si l'utilisateur édité est la session active, on bascule dessus
      if (editingUser && currentUser?.id === editingUser.id) {
        onSwitchUser(utilisateurEnrichi);
      }

      setIsModalOpen(false);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle user active/inactive status
  const handleToggleStatus = async (user: AppUser) => {
    const nextStatus = user.status === "Actif" ? "Inactif" : "Actif";
    try {
      const res = await fetch(`/api/users/${user.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || "Erreur lors du changement de statut");
        return;
      }
      const updated = users.map((u) => (u.id === user.id ? enrichir(result.data) : u));
      onUpdateUsers(updated);

      if (currentUser?.id === user.id) {
        onSwitchUser(enrichir(result.data));
      }
      await onRefresh();
    } catch {
      alert("Erreur réseau");
    }
  };

  // Delete user
  const handleDeleteUser = async (user: AppUser) => {
    if (!window.confirm(`Confirmez-vous la suppression du compte de ${user.name} ?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || "Erreur lors de la suppression");
        return;
      }
      const updated = users.filter((u) => u.id !== user.id);
      onUpdateUsers(updated);

      if (currentUser?.id === user.id && updated.length > 0) {
        onSwitchUser(updated[0]);
      }
      await onRefresh();
    } catch {
      alert("Erreur réseau");
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchDept = deptFilter === "ALL" || u.department === deptFilter;
    const matchStatus = statusFilter === "ALL" || u.status === statusFilter;
    const matchSociete =
      societeFilter === "ALL" || (societeFilter === "NONE" ? !u.societeId : u.societeId === societeFilter);

    return matchSearch && matchRole && matchDept && matchStatus && matchSociete;
  });

  const activeCount = users.filter((u) => u.status === "Actif").length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="space-y-6" id="user-management-module">
      {/* Top Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="text-purple-600" size={22} />
              Gestion des Utilisateurs & Contrôle d'Accès (RBAC)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Créez, modifiez et gérez les comptes collaborateurs, leurs rôles applicatifs, leurs statuts d'activité et leur
            société de rattachement.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          disabled={!canManage}
          title={!canManage ? "Action réservée aux administrateurs" : ""}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs transition ${
            canManage
              ? "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          <UserPlus size={15} />
          <span>Nouvel Utilisateur</span>
        </button>
      </div>

      {/* Security Status Banner for Active Session */}
      {currentUser && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border border-purple-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
              {currentUser.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Session Active :</span>
                <span className="text-sm font-black text-slate-900">{currentUser.name}</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${ROLE_LABELS[currentUser.role]?.badge}`}>
                  {ROLE_LABELS[currentUser.role]?.title}
                </span>
                {currentUser.status !== "Actif" && (
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-rose-200">
                    Compte {currentUser.status}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {currentUser.jobTitle} • {currentUser.department} • Société :{" "}
                <strong className="text-slate-800">{libelleSociete(currentUser)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <ShieldCheck size={16} className="text-purple-600" />
            <span>
              Habilitation serveur :{" "}
              <strong className="text-purple-900">{canManage ? "Administration complète" : "Consultation & gestion parc"}</strong>
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Utilisateurs</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{users.length}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{DEPARTMENTS.length} départements couverts</p>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Comptes Actifs</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{activeCount}</h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                {Math.round((activeCount / (users.length || 1)) * 100)}% d'activité
              </p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Administrateurs</p>
              <h3 className="text-2xl font-black text-purple-700 mt-1">{adminCount}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Superviseurs sécurité</p>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Shield size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sociétés du Référentiel</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{societes.length}</h3>
              <p className="text-[11px] text-indigo-600 font-bold mt-0.5">
                {societes.filter((s) => s.actif).length} actives
              </p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher par nom, email, poste ou direction..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 px-3 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="ALL">Tous les Rôles</option>
            <option value="ADMIN">Administrateurs</option>
            <option value="AUDITOR">Auditeurs</option>
            <option value="UTILISATEUR">Utilisateurs</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 px-3 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 max-w-[200px]"
          >
            <option value="ALL">Toutes les Directions</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={societeFilter}
            onChange={(e) => setSocieteFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 px-3 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 max-w-[190px]"
          >
            <option value="ALL">Toutes les Sociétés</option>
            {societes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
            <option value="NONE">Non rattaché</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 px-3 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="ALL">Tous Statuts</option>
            <option value="Actif">Actif</option>
            <option value="Inactif">Inactif</option>
            <option value="Suspendu">Suspendu</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-5">Utilisateur & Contact</th>
                <th className="py-3 px-4">Direction & Poste</th>
                <th className="py-3 px-4">Rôle</th>
                <th className="py-3 px-4">Société</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.map((user) => {
                const isCurrent = currentUser?.id === user.id;
                const initials = user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2);

                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-slate-50/60 transition ${
                      isCurrent ? "bg-purple-50/30" : ""
                    } ${user.status === "Inactif" ? "opacity-60 bg-slate-50/30" : ""}`}
                  >
                    {/* User info */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-extrabold flex items-center justify-center text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900">{user.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-black">
                                Vous
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail size={11} /> {user.email}
                            </span>
                            {user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={11} /> {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Dept and Job Title */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-800">{user.jobTitle}</p>
                      <p className="text-[11px] text-slate-500 truncate max-w-[180px]" title={user.department}>
                        {user.department}
                      </p>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          ROLE_LABELS[user.role]?.badge
                        }`}
                      >
                        {ROLE_LABELS[user.role]?.title}
                      </span>
                    </td>

                    {/* Société */}
                    <td className="py-3.5 px-4">
                      {user.societe ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                          <Building2 size={12} className="text-indigo-500" />
                          {libelleSociete(user)}
                          {!user.societe.actif && (
                            <span className="text-[9px] text-amber-700 font-black">(inactive)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          user.status === "Actif"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : user.status === "Inactif"
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.status === "Actif" ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {user.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Switch to this user for role testing */}
                        <button
                          type="button"
                          onClick={() => onSwitchUser(user)}
                          title="Se connecter avec cette session pour tester les habilitations"
                          className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            isCurrent
                              ? "bg-purple-600 text-white border-purple-600"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
                          }`}
                        >
                          <LogIn size={13} />
                          <span className="hidden xl:inline">{isCurrent ? "Actif" : "Tester"}</span>
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(user)}
                          disabled={!canManage}
                          title={!canManage ? "Non autorisé" : "Modifier l'utilisateur"}
                          className={`p-1.5 rounded-lg border text-slate-600 border-slate-200 transition ${
                            canManage ? "hover:bg-slate-100 hover:text-indigo-600 cursor-pointer" : "opacity-40 cursor-not-allowed"
                          }`}
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Toggle Active/Inactive */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={!canManage}
                          title={
                            !canManage
                              ? "Non autorisé"
                              : user.status === "Actif"
                              ? "Désactiver le compte"
                              : "Réactiver le compte"
                          }
                          className={`p-1.5 rounded-lg border transition ${
                            user.status === "Actif"
                              ? "text-slate-500 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
                              : "text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                          } ${!canManage ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {user.status === "Actif" ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          disabled={!canManage}
                          title={!canManage ? "Non autorisé" : "Supprimer"}
                          className={`p-1.5 rounded-lg border text-slate-400 border-slate-200 transition ${
                            canManage ? "hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 cursor-pointer" : "opacity-40 cursor-not-allowed"
                          }`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                    Aucun utilisateur ne correspond à vos critères de recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveUser}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl my-8"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingUser ? `Modifier ${editingUser.name}` : "Créer un Nouvel Utilisateur"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Les habilitations sont portées par le rôle ; le RBAC serveur sera activé au chantier authentification.
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

            {/* Body */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {formError && (
                <div className="sm:col-span-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Prénom Nom"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Email professionnel *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="prenom.nom@entreprise.ma"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+212 6 XX XX XX XX"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Fonction</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  placeholder="Ex. Technicien Support IT"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Département *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Rôle applicatif *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r].title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{ROLE_LABELS[formData.role].desc}</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Société de rattachement</label>
                <select
                  value={formData.societeId}
                  onChange={(e) => setFormData({ ...formData, societeId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="">— Non rattaché —</option>
                  {societes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom} ({s.codeCourt}){!s.actif ? " — inactive" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Étiquette organisationnelle : les données restent visibles par tous, les listes se filtrent par société.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Statut du compte</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as "Actif" | "Inactif" | "Suspendu" })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                  <option value="Suspendu">Suspendu</option>
                </select>
              </div>
            </div>

            {/* Footer */}
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
                    : "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
                }`}
              >
                <CheckCircle2 size={14} />
                <span>{editingUser ? "Sauvegarder les Modifications" : "Créer l'Utilisateur"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
