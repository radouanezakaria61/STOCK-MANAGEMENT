import { useState, useEffect } from "react";
import { Vendor, AppUser, ITStockItem, StockMovement, MaterialAssignment } from "./types";
import DashboardOverview from "./components/DashboardOverview";
import SuppliersDirectory from "./components/SuppliersDirectory";
import UserManagement from "./components/UserManagement";
import ITStockManagement from "./components/ITStockManagement";
import MaterialAssignmentModule from "./components/MaterialAssignmentModule";
import {
  LayoutDashboard,
  Users2,
  RefreshCw,
  UserCheck,
  Bell,
  BellOff,
  AlertCircle,
  Info,
  Shield,
  ChevronDown,
  CheckCircle2,
  Boxes,
  FileCheck2,
  Calendar
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // États du parc IT
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [stockItems, setStockItems] = useState<ITStockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [assignments, setAssignments] = useState<MaterialAssignment[]>([]);

  // Flux de notifications en français
  const [notifications, setNotifications] = useState<any[]>([
    {
      id: "notif-1",
      title: "Alerte Stock IT Critique",
      description: "Les cartouches HP LaserJet sont sous le seuil d'alerte minimal (4 unités restantes).",
      timestamp: new Date(Date.now() - 1000 * 60 * 50),
      type: "alerte",
      unread: true,
      targetTab: "stock"
    },
    {
      id: "notif-2",
      title: "Nouveau Fournisseur Enregistré",
      description: "Le fournisseur 'INK SERVICES' a validé l'ensemble de ses documents de conformité.",
      timestamp: new Date(Date.now() - 1000 * 60 * 110),
      type: "info",
      unread: false,
      targetTab: "suppliers"
    }
  ]);

  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  // Helper pour ajouter une notification
  const addNotification = (
    title: string,
    description: string,
    type: "alerte" | "info",
    targetTab?: string
  ) => {
    const newNotif = {
      id: `notif-${Date.now()}`,
      title,
      description,
      timestamp: new Date(),
      type,
      unread: true,
      targetTab
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // 1. Récupération du jeu de données consolidé du parc IT au montage
  const fetchSourcingData = async () => {
    try {
      const response = await fetch("/api/data");
      if (response.ok) {
        const payload = await response.json();
        const { vendors, users, stockItems, stockMovements, assignments } = payload.data;
        setVendors(vendors);
        setUsers(users);
        setCurrentUser((prev) => prev ?? users[0] ?? null);
        setStockItems(stockItems);
        setStockMovements(stockMovements);
        setAssignments(assignments);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des données:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSourcingData();
  }, []);

  // Changement d'utilisateur de session
  const handleSwitchUser = (user: AppUser) => {
    setCurrentUser(user);
    setShowUserMenu(false);
    addNotification(
      "Session Utilisateur Active Modifiée",
      `Vous agissez désormais sous l'identité de ${user.name} (${user.role}).`,
      "info"
    );
  };

  // 2. Mutations POST
  const handleAddVendor = async (vendorData: any) => {
    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendorData),
      });
      if (response.ok) {
        await fetchSourcingData();
        addNotification(
          "Nouveau Fournisseur Référencé",
          `L'entreprise "${vendorData.name}" a été intégrée avec succès à l'annuaire.`,
          "info",
          "suppliers"
        );
      } else {
        const errorMsg = await response.json();
        alert(errorMsg.error || "Échec de création du fournisseur.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateVendorRating = async (id: string, updates: any) => {
    try {
      const response = await fetch(`/api/vendors/${id}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        await fetchSourcingData();
        addNotification(
          "Profil Fournisseur Mis à Jour",
          `Les scores de performance et niveau de risque ont été réévalués.`,
          "info",
          "suppliers"
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* PANneau LATÉRAL DE NAVIGATION REPLIABLE */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0">
        
        {/* En-tête de marque */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-base">
            A
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-wider text-slate-100 leading-none">Parc Informatique</h1>
            <p className="text-[10px] text-slate-400 mt-1">Plateforme de Gestion</p>
          </div>
        </div>

        {/* Liens de navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { id: "dashboard", label: "Tableau de Bord", icon: LayoutDashboard },
            { id: "stock", label: "Stock IT & Matériels", icon: Boxes },
            { id: "assignments", label: "Affectations & Décharges", icon: FileCheck2 },
            { id: "suppliers", label: "Annuaire Fournisseurs", icon: Users2 },
            { id: "users", label: "Utilisateurs & Rôles", icon: Shield },
          ].map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left text-xs px-3.5 py-2.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <IconComp size={16} />
                  <span>{tab.label}</span>
                </div>
                {tab.id === "stock" && stockItems.length > 0 && (
                  <span className="text-[10px] bg-slate-800 text-emerald-300 px-1.5 py-0.2 rounded-md font-bold">
                    {stockItems.length}
                  </span>
                )}
                {tab.id === "assignments" && assignments.length > 0 && (
                  <span className="text-[10px] bg-slate-800 text-indigo-300 px-1.5 py-0.2 rounded-md font-bold">
                    {assignments.filter(a => a.status === "Active").length}
                  </span>
                )}
                {tab.id === "users" && users.length > 0 && (
                  <span className="text-[10px] bg-slate-800 text-purple-300 px-1.5 py-0.2 rounded-md font-bold">
                    {users.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Contexte métadonnées en bas */}
        <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 space-y-2">
          <div className="flex items-center gap-1.5 uppercase font-semibold">
            <UserCheck size={11} className="text-indigo-500" />
            <span>Session Sécurisée RBAC</span>
          </div>
          {currentUser ? (
            <p className="leading-relaxed">
              Connecté : <strong className="text-slate-300">{currentUser.name}</strong> ({currentUser.role}). Devise : Dirham Marocain (MAD).
            </p>
          ) : (
            <p className="leading-relaxed">
              Connecté à la base de données PostgreSQL. Devise officielle : Dirham Marocain (MAD).
            </p>
          )}
        </div>

      </aside>

      {/* STRUCTURE PRINCIPALE DES VUES */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* BARRE D'ÉTAT SUPÉRIEURE AVEC NOTIFICATIONS & SÉLECTEUR DE SESSION */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 relative z-30">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 uppercase">
              {
                {
                  dashboard: "Vue d'Ensemble du Parc Informatique",
                  stock: "Gestion du Stock IT, Actifs & Dotations Collaborateurs",
                  assignments: "Affectations, Décharges & Restitutions de Matériel (DSI)",
                  suppliers: "Répertoire & Évaluation des Fournisseurs Partenaires",
                  users: "Gestion des Utilisateurs, Rôles & Habilitations (RBAC)",
                }[activeTab]
              }
            </h2>
          </div>
          <div className="flex items-center flex-wrap gap-3 text-xs font-semibold text-slate-500">
            
            {/* SÉLECTEUR D'UTILISATEUR & PROFIL */}
            {currentUser && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                    showUserMenu
                      ? "bg-purple-50 border-purple-300 text-purple-900 ring-2 ring-purple-100"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                  title="Changer de session utilisateur pour tester les rôles et permissions"
                >
                  <div className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black flex items-center justify-center text-[10px] shrink-0">
                    {currentUser.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-slate-800 leading-tight flex items-center gap-1.5">
                      <span>{currentUser.name}</span>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                          currentUser.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : currentUser.role === "PROCUREMENT_MANAGER"
                            ? "bg-indigo-100 text-indigo-800"
                            : currentUser.role === "BUYER"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {currentUser.role}
                      </span>
                    </p>
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {/* MENU DÉROULANT DE CHANGEMENT D'UTILISATEUR */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50 text-slate-800">
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-slate-100">
                      <p className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Session Active</p>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{currentUser.name}</p>
                      <p className="text-[11px] text-slate-500">{currentUser.jobTitle}</p>
                      <div className="mt-2 pt-2 border-t border-purple-100 flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-500">Plafond engagé :</span>
                        <strong className="text-purple-900 font-bold">
                          {currentUser.spendingLimitMAD > 0
                            ? `${currentUser.spendingLimitMAD.toLocaleString()} MAD`
                            : "Sans autorisation"}
                        </strong>
                      </div>
                    </div>

                    <div className="p-2 border-b border-slate-100">
                      <p className="text-[9.5px] font-bold text-slate-400 uppercase px-2 py-1 tracking-wider">
                        Changer de profil (Simulation RBAC)
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {users.map((u) => {
                          const isSelected = u.id === currentUser.id;
                          return (
                            <button
                              key={u.id}
                              onClick={() => handleSwitchUser(u)}
                              className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                isSelected ? "bg-purple-100 text-purple-900 font-bold" : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div>
                                <p className="font-bold leading-tight flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {u.status !== "Actif" && (
                                    <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-extrabold">
                                      {u.status}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400">{u.jobTitle || u.role}</p>
                              </div>
                              {isSelected && <CheckCircle2 size={14} className="text-purple-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-2 bg-slate-50">
                      <button
                        onClick={() => {
                          setActiveTab("users");
                          setShowUserMenu(false);
                        }}
                        className="w-full py-1.5 px-2.5 text-center text-xs font-bold text-purple-700 hover:bg-purple-100/60 rounded-xl transition cursor-pointer"
                      >
                        Gérer tous les utilisateurs & droits
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CLOCHE DE NOTIFICATIONS EN TEMPS RÉEL */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className={`p-2 rounded-xl border transition-all flex items-center justify-center relative hover:bg-slate-100 cursor-pointer ${
                  showNotificationDropdown ? "bg-slate-100 border-slate-300 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
                title="Notifications d'Activité"
              >
                <Bell size={15} className={notifications.some(n => n.unread) ? "text-indigo-600 animate-pulse" : ""} />
                {notifications.some(n => n.unread) && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-extrabold text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white">
                    {notifications.filter(n => n.unread).length}
                  </span>
                )}
              </button>

              {/* CONTENEUR DÉROULANT */}
              {showNotificationDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden text-slate-800 z-50">
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Flux d'Alertes</span>
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 font-black text-[9px] px-2 py-0.5 rounded-full">
                        {notifications.filter(n => n.unread).length} En attente
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-bold uppercase transition cursor-pointer"
                      >
                        Tout marquer lu
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifications([])}
                        className="text-slate-400 hover:text-rose-600 font-bold uppercase transition cursor-pointer"
                      >
                        Effacer
                      </button>
                    </div>
                  </div>

                  {/* LISTE DÉFILANTE */}
                  <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <BellOff className="mx-auto text-slate-300" size={24} />
                        <p className="text-xs font-bold text-slate-500">Aucune alerte en attente</p>
                        <p className="text-[10px]">Toutes les actions prioritaires ont été traitées.</p>
                      </div>
                    ) : (
                      notifications.map((item) => {
                        let iconColor = "bg-blue-50 text-blue-600 border-blue-100";
                        let IconComp = Info;

                        if (item.type === "alerte") {
                          iconColor = "bg-rose-50 text-rose-600 border-rose-100";
                          IconComp = AlertCircle;
                        }

                        // Calcul du temps écoulé
                        const minsElapsed = Math.max(1, Math.round((Date.now() - new Date(item.timestamp).getTime()) / (1000 * 60)));
                        let timeLabel = `Il y a ${minsElapsed} min`;
                        if (minsElapsed >= 60) {
                          timeLabel = `Il y a ${Math.round(minsElapsed / 60)} h`;
                        }

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setNotifications(prev =>
                                prev.map(n => (n.id === item.id ? { ...n, unread: false } : n))
                              );
                              if (item.targetTab) {
                                setActiveTab(item.targetTab);
                              }
                              setShowNotificationDropdown(false);
                            }}
                            className={`p-3 flex gap-3 cursor-pointer text-left transition items-start ${
                              item.unread ? "bg-indigo-50/15 hover:bg-indigo-50/25" : "hover:bg-slate-50/50"
                            }`}
                          >
                            <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center border shrink-0 ${iconColor}`}>
                              <IconComp size={15} />
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1.5">
                                <h4 className={`text-xs truncate transition leading-tight ${
                                  item.unread ? "font-black text-slate-900" : "font-semibold text-slate-600"
                                }`}>
                                  {item.title}
                                </h4>
                                {item.unread && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-1"></span>
                                )}
                              </div>
                              <p className="text-[10.5px] text-slate-500 leading-relaxed truncate-2-lines break-words">
                                {item.description}
                              </p>
                              <span className="text-[9.5px] text-slate-400 font-bold block pt-0.5">
                                {timeLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <Calendar size={14} className="text-slate-400" />
              <span>Juin 2026</span>
            </div>
            {loading && (
              <span className="flex items-center gap-1.5 text-indigo-600">
                <RefreshCw size={12} className="animate-spin" />
                Synchronisation...
              </span>
            )}
          </div>
        </header>

        {/* ESPACE DE TRAVAIL CENTRAL */}
        <div className="p-6 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500 font-semibold">Chargement des données du parc IT...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {activeTab === "dashboard" && (
                <DashboardOverview
                  vendors={vendors}
                  users={users}
                  stockItems={stockItems}
                  stockMovements={stockMovements}
                  assignments={assignments}
                  onSelectTab={setActiveTab}
                />
              )}
              {activeTab === "stock" && (
                <ITStockManagement
                  stockItems={stockItems}
                  stockMovements={stockMovements}
                  currentUser={currentUser}
                  onRefresh={fetchSourcingData}
                  onSelectTab={setActiveTab}
                />
              )}
              {activeTab === "assignments" && (
                <MaterialAssignmentModule
                  assignments={assignments}
                  stockItems={stockItems}
                  users={users}
                  currentUser={currentUser}
                  onRefresh={fetchSourcingData}
                  onSelectTab={setActiveTab}
                />
              )}
              {activeTab === "suppliers" && (
                <SuppliersDirectory
                  vendors={vendors}
                  currentUser={currentUser}
                  onAddVendor={handleAddVendor}
                  onUpdateVendorRating={handleUpdateVendorRating}
                />
              )}
              {activeTab === "users" && (
                <UserManagement
                  users={users}
                  currentUser={currentUser}
                  onUpdateUsers={setUsers}
                  onSwitchUser={handleSwitchUser}
                />
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
