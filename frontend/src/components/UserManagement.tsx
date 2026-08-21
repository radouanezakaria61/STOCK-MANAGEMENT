import React, { useState } from "react";
import { AppUser, UserRole, UserPermissions } from "../types";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Lock,
  Unlock,
  KeyRound,
  DollarSign,
  Building,
  Mail,
  Phone,
  Briefcase,
  Layers,
  ArrowRight,
  LogIn,
  Eye,
  Check,
  X,
  Sparkles,
} from "lucide-react";

interface UserManagementProps {
  users: AppUser[];
  currentUser: AppUser | null;
  onUpdateUsers: (users: AppUser[]) => void;
  onSwitchUser: (user: AppUser) => void;
}

const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  ADMIN: {
    canCreatePO: true,
    canApprovePO: true,
    canManageVendors: true,
    canEvaluateBids: true,
    canGenerateContracts: true,
    canManageUsers: true,
    canViewBudgets: true,
  },
  PROCUREMENT_MANAGER: {
    canCreatePO: true,
    canApprovePO: true,
    canManageVendors: true,
    canEvaluateBids: true,
    canGenerateContracts: true,
    canManageUsers: false,
    canViewBudgets: true,
  },
  BUYER: {
    canCreatePO: true,
    canApprovePO: false,
    canManageVendors: false,
    canEvaluateBids: true,
    canGenerateContracts: false,
    canManageUsers: false,
    canViewBudgets: true,
  },
  AUDITOR: {
    canCreatePO: false,
    canApprovePO: false,
    canManageVendors: false,
    canEvaluateBids: false,
    canGenerateContracts: false,
    canManageUsers: false,
    canViewBudgets: true,
  },
};

const ROLE_LABELS: Record<UserRole, { title: string; badge: string; color: string; desc: string }> = {
  ADMIN: {
    title: "Administrateur Global",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    color: "text-purple-700",
    desc: "Contrôle total du système, gestion des utilisateurs et validation sans limite.",
  },
  PROCUREMENT_MANAGER: {
    title: "Responsable Achats",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
    color: "text-indigo-700",
    desc: "Validation des commandes, gestion des fournisseurs et contrats.",
  },
  BUYER: {
    title: "Acheteur / Approvisionneur",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    color: "text-emerald-700",
    desc: "Création des demandes d'achat et comparaison des offres fournisseurs.",
  },
  AUDITOR: {
    title: "Auditeur & Contrôleur",
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    color: "text-sky-700",
    desc: "Consultation en lecture seule, audit financier et contrôle budgétaire.",
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
  currentUser,
  onUpdateUsers,
  onSwitchUser,
}: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewTab, setViewTab] = useState<"list" | "matrix">("list");

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
    spendingLimitMAD: number;
    permissions: UserPermissions;
  }>({
    name: "",
    email: "",
    phone: "",
    department: DEPARTMENTS[0],
    jobTitle: "",
    role: "BUYER",
    status: "Actif",
    spendingLimitMAD: 50000,
    permissions: { ...DEFAULT_PERMISSIONS.BUYER },
  });

  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Check if current user has rights to manage users
  const canManage = currentUser?.permissions?.canManageUsers ?? true;

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      department: DEPARTMENTS[0],
      jobTitle: "",
      role: "BUYER",
      status: "Actif",
      spendingLimitMAD: 50000,
      permissions: { ...DEFAULT_PERMISSIONS.BUYER },
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
      spendingLimitMAD: user.spendingLimitMAD,
      permissions: { ...user.permissions },
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Role change in form auto-configures default permissions
  const handleRoleChange = (newRole: UserRole) => {
    const defaultPerms = DEFAULT_PERMISSIONS[newRole];
    const defaultLimit =
      newRole === "ADMIN" ? 1000000 : newRole === "PROCUREMENT_MANAGER" ? 300000 : newRole === "BUYER" ? 50000 : 0;

    setFormData((prev) => ({
      ...prev,
      role: newRole,
      spendingLimitMAD: defaultLimit,
      permissions: { ...defaultPerms },
    }));
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
      if (editingUser) {
        // Update user
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || "Erreur lors de la mise à jour");
        }

        const updatedUsers = users.map((u) => (u.id === editingUser.id ? result.data : u));
        onUpdateUsers(updatedUsers);

        // If updated user is current active user, refresh
        if (currentUser?.id === editingUser.id) {
          onSwitchUser(result.data);
        }
      } else {
        // Create user
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || "Erreur lors de la création");
        }

        onUpdateUsers([result.data, ...users]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Une erreur est survenue.");
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
      const updated = users.map((u) => (u.id === user.id ? result.data : u));
      onUpdateUsers(updated);

      if (currentUser?.id === user.id) {
        onSwitchUser(result.data);
      }
    } catch (err: any) {
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
    } catch (err: any) {
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

    return matchSearch && matchRole && matchDept && matchStatus;
  });

  const activeCount = users.filter((u) => u.status === "Actif").length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const totalLimitMAD = users
    .filter((u) => u.status === "Actif")
    .reduce((acc, u) => acc + (u.spendingLimitMAD || 0), 0);

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
            Créez, modifiez et gérez les comptes collaborateurs, leurs habilitations décisionnelles, statuts d'activité
            et plafonds de validation en Dirhams Marocains (MAD).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setViewTab("list")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewTab === "list" ? "bg-white text-purple-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Liste des Comptes
            </button>
            <button
              onClick={() => setViewTab("matrix")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewTab === "matrix" ? "bg-white text-purple-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Matrice des Droits
            </button>
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
                {currentUser.jobTitle} • {currentUser.department} • Plafond :{" "}
                <strong className="text-slate-800">
                  {currentUser.spendingLimitMAD > 0 ? `${currentUser.spendingLimitMAD.toLocaleString("fr-FR")} MAD` : "Non autorisé"}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <ShieldCheck size={16} className="text-purple-600" />
            <span>
              Droits actifs :{" "}
              <strong className="text-purple-900">
                {Object.values(currentUser.permissions || {}).filter(Boolean).length}/7 habilitations
              </strong>
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
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Capacité d'Engagement</p>
              <h3 className="text-xl font-black text-slate-800 mt-1">
                {(totalLimitMAD / 1000).toFixed(0)} k MAD
              </h3>
              <p className="text-[11px] text-indigo-600 font-bold mt-0.5">Plafond cumulé actif</p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign size={18} />
            </div>
          </div>
        </div>
      </div>

      {viewTab === "list" ? (
        <>
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
                <option value="PROCUREMENT_MANAGER">Responsables Achats</option>
                <option value="BUYER">Acheteurs</option>
                <option value="AUDITOR">Auditeurs</option>
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
                    <th className="py-3 px-4">Rôle & Droits</th>
                    <th className="py-3 px-4 text-right">Plafond (MAD)</th>
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

                    const permissionsCount = Object.values(user.permissions || {}).filter(Boolean).length;

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

                        {/* Role & Permissions count */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                              ROLE_LABELS[user.role]?.badge
                            }`}
                          >
                            {ROLE_LABELS[user.role]?.title}
                          </span>
                          <p className="text-[10px] text-slate-400 font-semibold mt-1">
                            {permissionsCount}/7 permissions accordées
                          </p>
                        </td>

                        {/* Spending Limit */}
                        <td className="py-3.5 px-4 text-right font-black text-slate-800">
                          {user.spendingLimitMAD > 0 ? (
                            <span>{user.spendingLimitMAD.toLocaleString("fr-FR")} MAD</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Sans droit</span>
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
                              title="Se connecter avec cette session pour tester les permissions"
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
        </>
      ) : (
        /* Matrix View: Compare Roles and Permissions */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Matrice Comparative des Habilitations par Rôle
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Vue d'ensemble des droits accordés par défaut selon les profils métiers du système d'achats.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4">Module / Habilitation</th>
                  <th className="py-3 px-4 text-center">Administrateur</th>
                  <th className="py-3 px-4 text-center">Resp. Achats</th>
                  <th className="py-3 px-4 text-center">Acheteur</th>
                  <th className="py-3 px-4 text-center">Auditeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Émettre des Demandes d'Achat (DA)</td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Valider & Signer les Bons de Commande</td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Référencer & Noter les Fournisseurs</td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Évaluation des Offres Fournisseurs (IA)</td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Générer & Auditer les Contrats SLA</td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Administrer les Utilisateurs & Rôles</td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-slate-300"><X size={16} className="mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Consulter les Budgets & Données Recharts</td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                  <td className="py-3 px-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="py-3 px-4 text-slate-800">Plafond d'Engagement Conseillé</td>
                  <td className="py-3 px-4 text-center text-purple-700">1 000 000 MAD</td>
                  <td className="py-3 px-4 text-center text-indigo-700">300 000 MAD</td>
                  <td className="py-3 px-4 text-center text-emerald-700">50 000 MAD</td>
                  <td className="py-3 px-4 text-center text-slate-400">0 MAD (Lecture)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  {editingUser ? <Edit2 size={18} /> : <UserPlus size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingUser ? "Modifier le Compte Utilisateur" : "Créer un Nouvel Utilisateur"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingUser
                      ? "Ajustez les informations, habilitations et limites de dépenses."
                      : "Remplissez les informations d'identification et attribuez un profil d'autorisations."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom Complet <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Youssef El Amrani"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Professionnel <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ex: y.elamrani@entreprise.ma"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone de Contact</label>
                  <input
                    type="tel"
                    placeholder="ex: +212 6 61 00 00 00"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Intitulé du Poste</label>
                  <input
                    type="text"
                    placeholder="ex: Acheteur Équipements IT"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Direction / Département</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500/20"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rôle Système</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-purple-900 focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="ADMIN">Administrateur Global (ADMIN)</option>
                    <option value="PROCUREMENT_MANAGER">Responsable Achats (PROCUREMENT_MANAGER)</option>
                    <option value="BUYER">Acheteur / Approvisionneur (BUYER)</option>
                    <option value="AUDITOR">Auditeur & Contrôleur (AUDITOR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plafond d'Engagement (MAD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    value={formData.spendingLimitMAD}
                    onChange={(e) => setFormData({ ...formData, spendingLimitMAD: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Montant max pour approbation directe de bon de commande.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Statut du Compte</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as "Actif" | "Inactif" | "Suspendu" })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="Actif">Actif (Accès autorisé)</option>
                    <option value="Inactif">Inactif (Désactivé)</option>
                    <option value="Suspendu">Suspendu (Temporairement bloqué)</option>
                  </select>
                </div>
              </div>

              {/* Permissions Matrix Checkboxes */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <KeyRound size={14} className="text-purple-600" />
                    Autorisations & Habilitations Granulaires :
                  </label>
                  <span className="text-[10.5px] text-slate-400 font-medium">
                    (Pré-configuré selon le rôle sélectionné)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canCreatePO}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCreatePO: e.target.checked },
                        })
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Émettre des Demandes d'Achat (DA)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canApprovePO}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canApprovePO: e.target.checked },
                        })
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Valider & Signer les Bons de Commande</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canManageVendors}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageVendors: e.target.checked },
                        })
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Gérer le Référentiel Fournisseurs</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canEvaluateBids}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canEvaluateBids: e.target.checked },
                        })
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Lancer l'Évaluation des Offres IA</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canGenerateContracts}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canGenerateContracts: e.target.checked },
                        })
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Rédiger & Auditer les Contrats SLA</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canManageUsers}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageUsers: e.target.checked },
                        })
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="font-bold text-purple-900">Administrer les Utilisateurs & Rôles</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canViewBudgets}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewBudgets: e.target.checked },
                        })
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Consulter les Tableaux de Bord Budgétaires (Recharts)</span>
                  </label>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <span>Enregistrement...</span>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>{editingUser ? "Sauvegarder les Modifications" : "Créer l'Utilisateur"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
