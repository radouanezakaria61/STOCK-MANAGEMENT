import React, { useState, useEffect } from "react";
import { MaterialAssignment, ITStockItem, AppUser, ReturnCause, EquipmentReturnCondition, TelecomOperator, AssignedResourceType, OperationType, RestitutedDeviceCondition } from "../types";
import { exportAssignmentToPDF, exportReturnToPDF, exportDistraSimSmartphoneToPDF } from "../utils/pdfGenerator";
import {
  FileCheck2,
  Plus,
  Printer,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  User,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Shield,
  Laptop,
  CheckSquare,
  Square,
  HelpCircle,
  FileText,
  Clock,
  ArrowRight,
  UserCheck,
  X,
  Send,
  Trash2,
  ShieldCheck,
  Download,
  Eye,
  Info,
  Smartphone,
  Radio,
  Hash,
  MapPin,
  Check,
  Monitor,
  Cpu,
  HardDrive,
  PackageCheck,
  SlidersHorizontal
} from "lucide-react";

interface MaterialAssignmentModuleProps {
  assignments: MaterialAssignment[];
  stockItems: ITStockItem[];
  users: AppUser[];
  currentUser: AppUser | null;
  onRefresh: () => void;
  onSelectTab?: (tab: string) => void;
}

export default function MaterialAssignmentModule({
  assignments,
  stockItems,
  users,
  currentUser,
  onRefresh,
  onSelectTab
}: MaterialAssignmentModuleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"all" | "active" | "returned">("all");
  const [selectedAssignmentForPrint, setSelectedAssignmentForPrint] = useState<MaterialAssignment | null>(null);
  const [selectedAssignmentForReturn, setSelectedAssignmentForReturn] = useState<MaterialAssignment | null>(null);
  const [selectedAssignmentForReturnPrint, setSelectedAssignmentForReturnPrint] = useState<MaterialAssignment | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Global Escape key listener to close modals easily
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedAssignmentForPrint(null);
        setSelectedAssignmentForReturnPrint(null);
        setSelectedAssignmentForReturn(null);
        setShowCreateModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mode Selection for New Assignment
  const [assignmentTemplateType, setAssignmentTemplateType] = useState<"DISTRA_SIM_SMARTPHONE" | "STANDARD_DSI_EQUIPMENT">("DISTRA_SIM_SMARTPHONE");

  // Common Form State for New Assignment
  const [formBeneficiaryName, setFormBeneficiaryName] = useState("");
  const [formBeneficiaryEmail, setFormBeneficiaryEmail] = useState("");
  const [formBeneficiaryPhone, setFormBeneficiaryPhone] = useState("");
  const [formBeneficiaryCin, setFormBeneficiaryCin] = useState("");
  const [formBeneficiaryJob, setFormBeneficiaryJob] = useState("");
  const [formBeneficiaryDept, setFormBeneficiaryDept] = useState("BU - Comm");
  const [formBeneficiarySite, setFormBeneficiarySite] = useState("Berrechid");
  const [formAssignedDate, setFormAssignedDate] = useState(new Date().toISOString().split("T")[0]);
  const [formAuthorizedBy, setFormAuthorizedBy] = useState(currentUser?.name || "Directeur Systèmes d'Information");
  const [formDsiTitle, setFormDsiTitle] = useState("Département Systèmes D'Information");
  const [formNotes, setFormNotes] = useState("");

  // Distra SIM & Smartphone Form State
  const [formResourceType, setFormResourceType] = useState<AssignedResourceType>("Carte SIM + SmartPhone");
  const [formSimOperator, setFormSimOperator] = useState<TelecomOperator>("IAM");
  const [formSimPhoneNumber, setFormSimPhoneNumber] = useState("");
  const [formSimPuk, setFormSimPuk] = useState("");
  const [formSimPin, setFormSimPin] = useState("");
  const [formDeviceBrand, setFormDeviceBrand] = useState("HP");
  const [formDeviceImei, setFormDeviceImei] = useState("");
  const [formDeviceModel, setFormDeviceModel] = useState("15-AY002NK");
  const [formDeviceConfiguration, setFormDeviceConfiguration] = useState("4 GB | 500 GB");
  const [formOperationType, setFormOperationType] = useState<OperationType>("AFFECTATION");
  const [formRestitutionPreviousDevice, setFormRestitutionPreviousDevice] = useState<"OUI" | "NON">("NON");
  const [formRestitatedDeviceCondition, setFormRestitatedDeviceCondition] = useState<RestitutedDeviceCondition>("Non applicable");
  const [formIncidentRemarks, setFormIncidentRemarks] = useState("INCIDENT / PANNE");

  // Distra IT Equipment Form State
  const [formEquipmentType, setFormEquipmentType] = useState("Ordinateur / PC");
  const [formEquipmentCpu, setFormEquipmentCpu] = useState("Intel i7");
  const [formEquipmentRam, setFormEquipmentRam] = useState("8");
  const [formEquipmentStorage, setFormEquipmentStorage] = useState("256");
  const [formEquipmentAcquisitionDate, setFormEquipmentAcquisitionDate] = useState("2021-12-06");
  const [formHasKeyboard, setFormHasKeyboard] = useState(false);
  const [formHasMouse, setFormHasMouse] = useState(false);
  const [formHasUsbAdapter, setFormHasUsbAdapter] = useState(false);
  
  // Selected stock items for standard assignment: array of { stockItemId, condition, accessories: string[] }
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemAccessoriesMap, setItemAccessoriesMap] = useState<{ [id: string]: string[] }>({});
  const [itemConditionMap, setItemConditionMap] = useState<{ [id: string]: "Neuf / Excellent état" | "Très bon état" | "Bon état" }>({});
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockCategoryFilter, setStockCategoryFilter] = useState("Tous");

  // Form State for Return Process
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnCause, setReturnCause] = useState<ReturnCause>("Départ collaborateur (Fin de contrat / Démission)");
  const [customReturnCause, setCustomReturnCause] = useState("");
  const [equipmentCondition, setEquipmentCondition] = useState<EquipmentReturnCondition>("Bon état d'usage");
  const [accessoriesReturned, setAccessoriesReturned] = useState<string[]>([]);
  const [dataWiped, setDataWiped] = useState(true);
  const [bitlockerUnlocked, setBitlockerUnlocked] = useState(true);
  const [technicalDiagnosis, setTechnicalDiagnosis] = useState("Équipement inspecté par la DSI. Fonctionnement normal, aucun dommage critique.");
  const [actionTaken, setActionTaken] = useState<"Remise en stock disponible" | "Envoi en maintenance / SAV" | "Mise au rebut">("Remise en stock disponible");
  const [inspectedBy, setInspectedBy] = useState(currentUser?.name || "Zakaria Radouane (DSI)");
  const [returnNotes, setReturnNotes] = useState("");

  // Available stock items for assignment (quantity > 0 and not allocated)
  const availableStock = stockItems.filter(item => (item.availableQty > 0 || item.status === "En Stock"));

  // Filtered available stock based on live search query and category
  const filteredAvailableStock = availableStock.filter(item => {
    const matchesCat = stockCategoryFilter === "Tous" || item.category === stockCategoryFilter;
    if (!matchesCat) return false;

    if (!stockSearchQuery.trim()) return true;
    const q = stockSearchQuery.toLowerCase().trim();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.brand?.toLowerCase().includes(q) ||
      item.model?.toLowerCase().includes(q) ||
      item.serialNumber?.toLowerCase().includes(q) ||
      item.assetTag?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.specs?.cpu?.toLowerCase().includes(q) ||
      item.specs?.ram?.toLowerCase().includes(q) ||
      item.specs?.storage?.toLowerCase().includes(q)
    );
  });

  // Pre-fill user details if selecting existing user
  const handleSelectPredefinedUser = (userName: string) => {
    setFormBeneficiaryName(userName);
    const foundUser = users.find(u => u.name === userName);
    if (foundUser) {
      setFormBeneficiaryEmail(foundUser.email);
      setFormBeneficiaryDept(foundUser.department);
      setFormBeneficiaryJob(foundUser.jobTitle);
    }
  };

  const syncPrimaryEquipmentFields = (currentIds: string[]) => {
    if (currentIds.length === 0) return;
    const firstItem = stockItems.find(i => i.id === currentIds[0]);
    if (firstItem) {
      setFormEquipmentType(firstItem.category || firstItem.name || "Ordinateur / PC");
      if (firstItem.brand) setFormDeviceBrand(firstItem.brand);
      if (firstItem.model) setFormDeviceModel(firstItem.model);
      if (firstItem.serialNumber) setFormDeviceImei(firstItem.serialNumber);
      if (firstItem.specs) {
        if (firstItem.specs.cpu) setFormEquipmentCpu(firstItem.specs.cpu);
        if (firstItem.specs.ram) setFormEquipmentRam(firstItem.specs.ram.replace(/[^0-9]/g, "") || "8");
        if (firstItem.specs.storage) setFormEquipmentStorage(firstItem.specs.storage.replace(/[^0-9]/g, "") || "256");
      }
    }
  };

  const toggleStockItemSelection = (itemId: string) => {
    if (selectedItemIds.includes(itemId)) {
      const next = selectedItemIds.filter(id => id !== itemId);
      setSelectedItemIds(next);
      syncPrimaryEquipmentFields(next);
    } else {
      const next = [...selectedItemIds, itemId];
      setSelectedItemIds(next);
      syncPrimaryEquipmentFields(next);
      // Default accessories for this item
      if (!itemAccessoriesMap[itemId]) {
        setItemAccessoriesMap(prev => ({
          ...prev,
          [itemId]: ["Chargeur secteur d'origine", "Câble d'alimentation"]
        }));
      }
      if (!itemConditionMap[itemId]) {
        setItemConditionMap(prev => ({
          ...prev,
          [itemId]: "Neuf / Excellent état"
        }));
      }
    }
  };

  const removeStockItem = (itemId: string) => {
    const next = selectedItemIds.filter(id => id !== itemId);
    setSelectedItemIds(next);
    syncPrimaryEquipmentFields(next);
  };

  const setItemCondition = (itemId: string, cond: "Neuf / Excellent état" | "Très bon état" | "Bon état") => {
    setItemConditionMap(prev => ({
      ...prev,
      [itemId]: cond
    }));
  };

  const toggleAccessory = (itemId: string, accessory: string) => {
    const current = itemAccessoriesMap[itemId] || [];
    if (current.includes(accessory)) {
      setItemAccessoriesMap(prev => ({
        ...prev,
        [itemId]: current.filter(a => a !== accessory)
      }));
    } else {
      setItemAccessoriesMap(prev => ({
        ...prev,
        [itemId]: [...current, accessory]
      }));
    }
  };

  // Submit New Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBeneficiaryName) {
      alert("Veuillez renseigner le nom complet du collaborateur.");
      return;
    }

    if (assignmentTemplateType === "STANDARD_DSI_EQUIPMENT" && selectedItemIds.length === 0) {
      alert("Veuillez sélectionner au moins un équipement en stock à affecter.");
      return;
    }

    setLoadingAction(true);
    try {
      const itemsPayload = selectedItemIds.map(id => ({
        stockItemId: id,
        condition: itemConditionMap[id] || "Neuf / Excellent état",
        accessories: itemAccessoriesMap[id] || ["Chargeur secteur", "Câble d'alimentation"]
      }));

      const isSim = formResourceType === "Carte SIM" || formResourceType === "Carte SIM + SmartPhone";
      const isPhone = formResourceType === "SmartPhone" || formResourceType === "Carte SIM + SmartPhone";

      const payloadBody: any = {
        templateType: assignmentTemplateType,
        formCode: assignmentTemplateType === "DISTRA_SIM_SMARTPHONE" ? "IT-02" : "IT-01",
        beneficiaryName: formBeneficiaryName,
        beneficiaryEmail: formBeneficiaryEmail,
        beneficiaryPhone: formBeneficiaryPhone || formSimPhoneNumber,
        beneficiaryCin: formBeneficiaryCin,
        beneficiaryJobTitle: formBeneficiaryJob || "Operateur",
        beneficiaryDepartment: formBeneficiaryDept || "Technique",
        beneficiarySite: formBeneficiarySite || "Berrechid",
        assignedDate: formAssignedDate,
        authorizedBy: formAuthorizedBy,
        dsiTitle: formDsiTitle,
        items: itemsPayload,
        notes: formNotes
      };

      if (assignmentTemplateType === "DISTRA_SIM_SMARTPHONE") {
        payloadBody.resourceType = formResourceType;
        payloadBody.hasSimCard = isSim;
        payloadBody.simOperator = formSimOperator;
        payloadBody.simPhoneNumber = formSimPhoneNumber || formBeneficiaryPhone;
        payloadBody.simPuk = formSimPuk;
        payloadBody.simPin = formSimPin;
        payloadBody.hasSmartphone = isPhone;
        payloadBody.deviceBrand = formDeviceBrand;
        payloadBody.deviceImei = formDeviceImei;
        payloadBody.deviceModel = formDeviceModel;
        payloadBody.deviceConfiguration = formDeviceConfiguration;
        payloadBody.operationType = formOperationType;
        payloadBody.restitutionPreviousDevice = formRestitutionPreviousDevice;
        payloadBody.restitutedDeviceCondition = formRestitatedDeviceCondition;
        payloadBody.incidentRemarks = formIncidentRemarks;
      } else {
        payloadBody.equipmentType = formEquipmentType;
        payloadBody.equipmentCpu = formEquipmentCpu;
        payloadBody.equipmentRam = formEquipmentRam;
        payloadBody.equipmentStorage = formEquipmentStorage;
        payloadBody.equipmentAcquisitionDate = formEquipmentAcquisitionDate;
        payloadBody.hasKeyboard = formHasKeyboard;
        payloadBody.hasMouse = formHasMouse;
        payloadBody.hasUsbAdapter = formHasUsbAdapter;
        payloadBody.operationType = formOperationType;
        payloadBody.incidentRemarks = formIncidentRemarks || formNotes;
      }

      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody)
      });

      if (res.ok) {
        const payload = await res.json();
        setShowCreateModal(false);
        // Reset form
        setFormBeneficiaryName("");
        setFormBeneficiaryEmail("");
        setFormBeneficiaryPhone("");
        setFormBeneficiaryCin("");
        setFormBeneficiaryJob("");
        setFormSimPhoneNumber("");
        setFormSimPuk("");
        setFormSimPin("");
        setFormDeviceImei("");
        setSelectedItemIds([]);
        onRefresh();
        // Immediately show the printable slip for the created assignment!
        if (payload.data) {
          setSelectedAssignmentForPrint(payload.data);
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Erreur lors de la création de l'affectation.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion au serveur.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Open Return Modal
  const handleOpenReturnModal = (assignment: MaterialAssignment) => {
    setSelectedAssignmentForReturn(assignment);
    setReturnDate(new Date().toISOString().split("T")[0]);
    setReturnCause("Départ collaborateur (Fin de contrat / Démission)");
    setEquipmentCondition("Bon état d'usage");
    // Pre-fill all accessories that were given
    const allAssignedAccessories = assignment.items.flatMap(i => i.accessories || []);
    const uniqueAccessories = Array.from(new Set(allAssignedAccessories));
    setAccessoriesReturned(uniqueAccessories);
    setDataWiped(true);
    setBitlockerUnlocked(true);
    setTechnicalDiagnosis("Matériel restitué à la DSI. Contrôle technique conforme, réinitialisation prête.");
    setActionTaken("Remise en stock disponible");
    setReturnNotes("");
  };

  // Submit Return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentForReturn) return;

    setLoadingAction(true);
    try {
      const allOriginalAccessories = selectedAssignmentForReturn.items.flatMap(i => i.accessories || []);
      const missing = allOriginalAccessories.filter(a => !accessoriesReturned.includes(a));

      const res = await fetch(`/api/assignments/${selectedAssignmentForReturn.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnDate,
          cause: returnCause,
          customCause: customReturnCause,
          equipmentCondition,
          accessoriesReturned,
          missingAccessories: missing,
          dataWiped,
          bitlockerUnlocked,
          technicalDiagnosis,
          actionTaken,
          inspectedBy,
          notes: returnNotes
        })
      });

      if (res.ok) {
        const payload = await res.json();
        setSelectedAssignmentForReturn(null);
        onRefresh();
        // Show printable return slip
        if (payload.data?.assignment) {
          setSelectedAssignmentForReturnPrint(payload.data.assignment);
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Erreur lors de l'enregistrement de la restitution.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Filtered assignments
  const filteredAssignments = assignments.filter(a => {
    const matchesSearch =
      a.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.beneficiaryDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.beneficiaryCin && a.beneficiaryCin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      a.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    if (activeSubTab === "active") return matchesSearch && a.status === "Active";
    if (activeSubTab === "returned") return matchesSearch && a.status === "Restitué";
    return matchesSearch;
  });

  const activeCount = assignments.filter(a => a.status === "Active").length;
  const returnedCount = assignments.filter(a => a.status === "Restitué").length;
  const totalItemsAllocated = assignments
    .filter(a => a.status === "Active")
    .reduce((acc, a) => acc + a.items.length, 0);

  return (
    <div className="space-y-6">
      
      {/* 1. TOP HEADER & OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Affectations Actives</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{activeCount}</h3>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
              <CheckCircle2 size={12} /> Collaborateurs dotés
            </span>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Matériels en Circulation</span>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{totalItemsAllocated}</h3>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5">PC, Écrans & Périphériques</span>
          </div>
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
            <Laptop size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Restitutions & Retours</span>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{returnedCount}</h3>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5">Décharges clôturées DSI</span>
          </div>
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
            <RotateCcw size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stock Disponible</span>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">{availableStock.length}</h3>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5">Équipements prêts à doter</span>
          </div>
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* 2. CONTROL BAR & ACTIONS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Rechercher par nom, CIN, N° série, référence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>

        {/* Sub-tabs Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveSubTab("all")}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                activeSubTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Toutes ({assignments.length})
            </button>
            <button
              onClick={() => setActiveSubTab("active")}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                activeSubTab === "active" ? "bg-white text-indigo-600 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              En cours ({activeCount})
            </button>
            <button
              onClick={() => setActiveSubTab("returned")}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                activeSubTab === "returned" ? "bg-white text-slate-800 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Restituées ({returnedCount})
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
          >
            <Plus size={14} /> Nouvelle Fiche d'Affectation
          </button>
        </div>
      </div>

      {/* 3. ASSIGNMENTS LIST TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Réf. Fiche</th>
                <th className="py-3 px-4">Bénéficiaire & CIN</th>
                <th className="py-3 px-4">Département & Fonction</th>
                <th className="py-3 px-4">Matériels Affectés</th>
                <th className="py-3 px-4">Date Affectation</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <FileCheck2 size={32} className="mx-auto mb-2 text-slate-300" />
                    Aucune fiche d'affectation ne correspond à vos critères.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => {
                  const isActive = assignment.status === "Active";

                  return (
                    <tr key={assignment.id} className="hover:bg-slate-50/70 transition">
                      
                      {/* Reference */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        <div className="flex items-center gap-1.5">
                          <span>{assignment.reference}</span>
                          {assignment.templateType === "DISTRA_SIM_SMARTPHONE" || assignment.resourceType ? (
                            <span className="text-[10px] font-sans font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                              IT-02
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Beneficiary */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          {assignment.beneficiaryName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {assignment.beneficiaryCin ? `CIN/Mat: ${assignment.beneficiaryCin}` : assignment.beneficiaryEmail || assignment.beneficiaryPhone}
                        </div>
                      </td>

                      {/* Dept & Job */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{assignment.beneficiaryDepartment}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span>{assignment.beneficiaryJobTitle}</span>
                          {assignment.beneficiarySite && (
                            <span className="text-[10px] text-slate-400 font-medium">• {assignment.beneficiarySite}</span>
                          )}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4">
                        {assignment.templateType === "DISTRA_SIM_SMARTPHONE" || assignment.resourceType ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Layers size={11} className="text-emerald-600" />
                              <span>{assignment.resourceType || "Carte SIM + SmartPhone"}</span>
                            </div>
                            {assignment.simPhoneNumber && (
                              <div className="flex items-center gap-1.5 text-slate-700 text-[11px]">
                                <Radio size={11} className="text-blue-600 shrink-0" />
                                <span className="font-semibold text-slate-900">{assignment.simOperator || "SIM"}:</span>
                                <span className="font-mono text-slate-600">{assignment.simPhoneNumber}</span>
                              </div>
                            )}
                            {assignment.deviceBrand && (
                              <div className="flex items-center gap-1.5 text-slate-700 text-[11px]">
                                <Smartphone size={11} className="text-indigo-600 shrink-0" />
                                <span className="font-semibold text-slate-900">{assignment.deviceBrand} {assignment.deviceModel}</span>
                                {assignment.deviceImei && (
                                  <span className="text-[10px] bg-slate-100 border border-slate-200 px-1 rounded font-mono text-slate-600">
                                    {assignment.deviceImei}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {assignment.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-slate-700">
                                <Laptop size={12} className="text-indigo-500 shrink-0" />
                                <span className="font-medium truncate max-w-[200px]">{item.name}</span>
                                <span className="text-[10px] bg-slate-100 border border-slate-200 px-1 rounded-sm text-slate-600 font-mono">
                                  {item.serialNumber}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Assigned Date */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {new Date(assignment.assignedDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            En Dotation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <CheckCircle2 size={11} className="text-slate-500" />
                            Restitué
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isActive ? (
                            <>
                              {/* Single consultation & print / PDF export button */}
                              <button
                                onClick={() => setSelectedAssignmentForPrint(assignment)}
                                title="Consulter la Fiche d'Affectation, Imprimer ou Télécharger en PDF"
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-indigo-200 cursor-pointer shadow-2xs"
                              >
                                <FileCheck2 size={13} className="text-indigo-600" />
                                <span>Fiche d'Affectation (PDF)</span>
                              </button>

                              {/* Return action button */}
                              <button
                                onClick={() => handleOpenReturnModal(assignment)}
                                title="Enregistrer la Restitution / Retour du Matériel"
                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-amber-200 cursor-pointer shadow-2xs"
                              >
                                <RotateCcw size={13} className="text-amber-600" />
                                <span>Restituer</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Single consultation & print / PDF discharge button */}
                              <button
                                onClick={() => setSelectedAssignmentForReturnPrint(assignment)}
                                title="Consulter le Procès-Verbal de Décharge, Imprimer ou Télécharger en PDF"
                                className="bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-amber-200 cursor-pointer shadow-2xs"
                              >
                                <Printer size={13} className="text-amber-700" />
                                <span>Décharge de Restitution (PDF)</span>
                              </button>

                              {/* Secondary view of initial assignment sheet */}
                              <button
                                onClick={() => setSelectedAssignmentForPrint(assignment)}
                                title="Consulter la Fiche d'Affectation Initiale"
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition border border-slate-300 cursor-pointer"
                              >
                                <Eye size={12} />
                                <span className="text-[11px]">Fiche Initiale</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1 : CRÉATION D'UNE NOUVELLE AFFECTATION DE MATÉRIEL                 */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <FileCheck2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Nouvelle Fiche d'Affectation & Prise en Charge</h3>
                  <p className="text-xs text-slate-500">Choisissez le modèle de décharge et renseignez les informations officielles</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Selector */}
            <div className="bg-slate-100 p-1.5 rounded-xl grid grid-cols-2 gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAssignmentTemplateType("DISTRA_SIM_SMARTPHONE")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                  assignmentTemplateType === "DISTRA_SIM_SMARTPHONE"
                    ? "bg-white text-indigo-900 shadow-xs border border-indigo-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Smartphone size={15} className={assignmentTemplateType === "DISTRA_SIM_SMARTPHONE" ? "text-indigo-600" : "text-slate-400"} />
                <span>Décharge Carte SIM & Smartphone (Formulaire IT-02 - Distra)</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignmentTemplateType("STANDARD_DSI_EQUIPMENT")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                  assignmentTemplateType === "STANDARD_DSI_EQUIPMENT"
                    ? "bg-white text-indigo-900 shadow-xs border border-indigo-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Laptop size={15} className={assignmentTemplateType === "STANDARD_DSI_EQUIPMENT" ? "text-indigo-600" : "text-slate-400"} />
                <span>Affectation Matériel IT Standard (DSI)</span>
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              
              {/* Section 1 : Bénéficiaire */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={13} className="text-indigo-600" /> Informations du Bénéficiaire
                  </span>
                  
                  {/* Select from existing users shortcut */}
                  {users.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span>Remplir depuis :</span>
                      <select
                        onChange={(e) => handleSelectPredefinedUser(e.target.value)}
                        className="text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1"
                        defaultValue=""
                      >
                        <option value="" disabled>Sélectionner un collaborateur...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.name}>{u.name} ({u.department})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom & Prénom *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Sarah Bennani"
                      value={formBeneficiaryName}
                      onChange={(e) => setFormBeneficiaryName(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">N° CIN / Matricule</label>
                    <input
                      type="text"
                      placeholder="Ex: BE892341"
                      value={formBeneficiaryCin}
                      onChange={(e) => setFormBeneficiaryCin(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Fonction / Poste *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Responsable Commercial / Tech"
                      value={formBeneficiaryJob}
                      onChange={(e) => setFormBeneficiaryJob(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Département *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: BU - Comm / DSI / Finance"
                      value={formBeneficiaryDept}
                      onChange={(e) => setFormBeneficiaryDept(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Site / Localisation *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Berrechid / Casablanca / Tanger"
                      value={formBeneficiarySite}
                      onChange={(e) => setFormBeneficiarySite(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Date d'Affectation *</label>
                    <input
                      type="date"
                      required
                      value={formAssignedDate}
                      onChange={(e) => setFormAssignedDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Distra Specific Section */}
              {assignmentTemplateType === "DISTRA_SIM_SMARTPHONE" && (
                <div className="space-y-4">
                  {/* Ressource assignée */}
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-3">
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={13} className="text-emerald-700" /> Ressource Assignée (Formulaire IT-02)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      {(["Carte SIM", "SmartPhone", "PC / Laptop", "Autre matériel IT", "Carte SIM + SmartPhone"] as AssignedResourceType[]).map((rType) => (
                        <button
                          key={rType}
                          type="button"
                          onClick={() => setFormResourceType(rType)}
                          className={`py-2 px-2.5 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer text-[11px] ${
                            formResourceType === rType
                              ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {formResourceType === rType ? <CheckSquare size={13} /> : <Square size={13} />}
                          <span>{rType}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SIM Card Details */}
                  {(formResourceType === "Carte SIM" || formResourceType === "Carte SIM + SmartPhone") && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Radio size={13} className="text-indigo-600" /> Informations Carte SIM
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Opérateur Télécom</label>
                          <select
                            value={formSimOperator}
                            onChange={(e) => setFormSimOperator(e.target.value as TelecomOperator)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold"
                          >
                            <option value="IAM">IAM (Maroc Telecom)</option>
                            <option value="INWI">INWI</option>
                            <option value="ORANGE">ORANGE</option>
                            <option value="AUTRE">AUTRE</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">N° de Téléphone</label>
                          <input
                            type="tel"
                            placeholder="06 XX XX XX XX"
                            value={formSimPhoneNumber}
                            onChange={(e) => setFormSimPhoneNumber(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Code PUK</label>
                          <input
                            type="text"
                            placeholder="Ex: 87462910"
                            value={formSimPuk}
                            onChange={(e) => setFormSimPuk(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Code PIN</label>
                          <input
                            type="text"
                            placeholder="Ex: 0000"
                            value={formSimPin}
                            onChange={(e) => setFormSimPin(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hardware / Smartphone / PC Details */}
                  {formResourceType !== "Carte SIM" && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Smartphone size={13} className="text-indigo-600" /> Informations Matériel (Appareil / PC)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Marque</label>
                          <input
                            type="text"
                            placeholder="Ex: HP, Dell, Samsung, Lenovo"
                            value={formDeviceBrand}
                            onChange={(e) => setFormDeviceBrand(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            {formResourceType === "SmartPhone" ? "IMEI" : (formResourceType === "PC / Laptop" ? "N° Série / Service Tag" : "N° Série / IMEI")}
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: 356789104523120 ou 5CD..."
                            value={formDeviceImei}
                            onChange={(e) => setFormDeviceImei(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono font-bold text-indigo-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Modèle</label>
                          <input
                            type="text"
                            placeholder="Ex: EliteBook 840 G8, Galaxy A54"
                            value={formDeviceModel}
                            onChange={(e) => setFormDeviceModel(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Configuration</label>
                          <input
                            type="text"
                            placeholder="Ex: i7 16GB 512GB SSD"
                            value={formDeviceConfiguration}
                            onChange={(e) => setFormDeviceConfiguration(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Operation Type, Restitution & Incidents */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Type d'opération</label>
                      <div className="flex gap-2">
                        {(["AFFECTATION", "RÉAFFECTATION"] as OperationType[]).map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => setFormOperationType(op)}
                            className={`flex-1 py-1.5 px-2 rounded-lg border font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1 ${
                              formOperationType === op
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-300"
                            }`}
                          >
                            {formOperationType === op ? <CheckSquare size={11} /> : <Square size={11} />}
                            <span>{op}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Restitution ancien appareil ?</label>
                      <div className="flex gap-2">
                        {(["OUI", "NON"] as ("OUI" | "NON")[]).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setFormRestitutionPreviousDevice(val);
                              if (val === "NON") {
                                setFormRestitatedDeviceCondition("Non applicable");
                              }
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-lg border font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1 ${
                              formRestitutionPreviousDevice === val
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-300"
                            }`}
                          >
                            {formRestitutionPreviousDevice === val ? <CheckSquare size={11} /> : <Square size={11} />}
                            <span>{val}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">État de l'appareil restitué</label>
                      <select
                        value={formRestitutionPreviousDevice === "NON" ? "Non applicable" : formRestitatedDeviceCondition}
                        disabled={formRestitutionPreviousDevice === "NON"}
                        onChange={(e) => setFormRestitatedDeviceCondition(e.target.value as RestitutedDeviceCondition)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="Non applicable">Non applicable</option>
                        <option value="Bon état">Bon état</option>
                        <option value="Cassé mais opérationnel">Cassé mais opérationnel</option>
                        <option value="Endommagé">Endommagé</option>
                      </select>
                    </div>
                  </div>

                  {/* Incident Remarks */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Remarques / Motif particulier (Optionnel)</label>
                    <input
                      type="text"
                      value={formIncidentRemarks}
                      onChange={(e) => setFormIncidentRemarks(e.target.value)}
                      placeholder="Optionnel - Ex: Remplacement suite panne, nouvelle embauche..."
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Standard IT Equipment Selection (If Standard mode is chosen) */}
              {assignmentTemplateType === "STANDARD_DSI_EQUIPMENT" && (
                <div className="space-y-4">
                  {/* Stock IT Real-time Search & Multi-selection Component */}
                  <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 space-y-3.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                      <div>
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <Search size={14} className="text-indigo-600" />
                          Sélection du matériel depuis le Stock IT
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Recherchez par nom, numéro de série, code asset, modèle ou caractéristiques pour affecter des équipements.
                        </p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                        <PackageCheck size={13} />
                        {selectedItemIds.length} matériel(s) sélectionné(s)
                      </span>
                    </div>

                    {/* Search Input & Category Pills */}
                    <div className="space-y-2.5">
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={stockSearchQuery}
                          onChange={(e) => setStockSearchQuery(e.target.value)}
                          placeholder="Rechercher un équipement disponible (ex: HP EliteBook, Dell Latitude, STK-001, SN-..., i7, 16GB)..."
                          className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium placeholder:text-slate-400"
                        />
                        {stockSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setStockSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Category Pills Filter */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {[
                          "Tous",
                          "Laptops & Portables",
                          "Postes Fixes & Écrans",
                          "Périphériques & Accessoires",
                          "Serveurs & Stockage",
                          "Réseau & Sécurité"
                        ].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setStockCategoryFilter(cat)}
                            className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer text-xs flex items-center gap-1 ${
                              stockCategoryFilter === cat
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Autocomplete / Available Stock Results */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                        <span>Équipements disponibles ({filteredAvailableStock.length})</span>
                        {stockSearchQuery && <span>Filtre actif : « {stockSearchQuery} »</span>}
                      </div>

                      {availableStock.length === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                          <span>Aucun matériel n'est actuellement disponible dans le stock IT.</span>
                        </div>
                      ) : filteredAvailableStock.length === 0 ? (
                        <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                          Aucun équipement disponible ne correspond à votre recherche « <strong>{stockSearchQuery}</strong> ».
                        </div>
                      ) : (
                        <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-white/90 shadow-inner">
                          {filteredAvailableStock.map((item) => {
                            const isSelected = selectedItemIds.includes(item.id);
                            return (
                              <div
                                key={item.id}
                                onClick={() => toggleStockItemSelection(item.id)}
                                className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                  isSelected
                                    ? "bg-indigo-50/90 border-indigo-400 shadow-xs ring-1 ring-indigo-400"
                                    : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80"
                                }`}
                              >
                                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                  <div className={`w-5 h-5 mt-0.5 sm:mt-0 rounded flex items-center justify-center border shrink-0 transition ${
                                    isSelected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300 text-transparent"
                                  }`}>
                                    <Check size={12} className="stroke-[3]" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-medium border border-slate-200">
                                        {item.category}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                      <span>SN : <strong className="font-mono text-slate-800">{item.serialNumber || "—"}</strong></span>
                                      <span>•</span>
                                      <span>Asset : <strong className="font-mono text-indigo-700">{item.assetTag || item.id}</strong></span>
                                      {item.specs?.cpu && (
                                        <>
                                          <span>•</span>
                                          <span className="text-slate-600 font-medium">CPU : {item.specs.cpu}</span>
                                        </>
                                      )}
                                      {item.specs?.ram && (
                                        <>
                                          <span>•</span>
                                          <span className="text-slate-600 font-medium">RAM : {item.specs.ram}</span>
                                        </>
                                      )}
                                      {item.specs?.storage && (
                                        <>
                                          <span>•</span>
                                          <span className="text-slate-600 font-medium">SSD : {item.specs.storage}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Dispo: {item.availableQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStockItemSelection(item.id);
                                    }}
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                                      isSelected
                                        ? "bg-indigo-600 text-white"
                                        : "bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200"
                                    }`}
                                  >
                                    {isSelected ? (
                                      <>
                                        <Check size={12} />
                                        <span>Ajouté</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus size={12} />
                                        <span>Ajouter</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Items Detail Container */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={14} className="text-indigo-600" />
                        Matériels IT Sélectionnés pour la Décharge ({selectedItemIds.length}) *
                      </span>
                      {selectedItemIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedItemIds([])}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Tout désélectionner
                        </button>
                      )}
                    </div>

                    {selectedItemIds.length === 0 ? (
                      <div className="p-4 bg-indigo-50/60 border border-dashed border-indigo-200 rounded-xl text-center space-y-1.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                          <Laptop size={16} />
                        </div>
                        <p className="text-xs font-bold text-slate-800">Aucun matériel sélectionné</p>
                        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                          Veuillez rechercher et cliquer sur un ou plusieurs équipements dans la liste du stock ci-dessus pour les inclure dans cette fiche de décharge.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedItemIds.map((itemId, index) => {
                          const item = stockItems.find(i => i.id === itemId);
                          if (!item) return null;
                          const currentCondition = itemConditionMap[itemId] || "Neuf / Excellent état";
                          const currentAccessories = itemAccessoriesMap[itemId] || ["Chargeur secteur d'origine", "Câble d'alimentation"];

                          return (
                            <div
                              key={itemId}
                              className="bg-white p-3.5 rounded-xl border border-slate-300 shadow-xs space-y-3 transition hover:border-indigo-200"
                            >
                              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                                      <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full border border-indigo-100">
                                        {item.category}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 font-mono">
                                      <span>N° Série : <strong className="text-slate-800">{item.serialNumber || "—"}</strong></span>
                                      <span>•</span>
                                      <span>Asset : <strong className="text-indigo-600">{item.assetTag || item.id}</strong></span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeStockItem(itemId)}
                                  className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                                  title="Retirer cet équipement"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>

                              {/* Technical Specs & Condition Form */}
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Processeur (CPU)</span>
                                  <span className="font-semibold text-slate-900 text-xs">
                                    {item.specs?.cpu || formEquipmentCpu || "Intel Core"}
                                  </span>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Mémoire RAM</span>
                                  <span className="font-semibold text-slate-900 text-xs">
                                    {item.specs?.ram || `${formEquipmentRam} GB`}
                                  </span>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Stockage (SSD/HDD)</span>
                                  <span className="font-semibold text-slate-900 text-xs">
                                    {item.specs?.storage || `${formEquipmentStorage} GB`}
                                  </span>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                    État du matériel
                                  </label>
                                  <select
                                    value={currentCondition}
                                    onChange={(e) => setItemCondition(itemId, e.target.value as any)}
                                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                  >
                                    <option value="Neuf / Excellent état">Neuf / Excellent état</option>
                                    <option value="Très bon état">Très bon état</option>
                                    <option value="Bon état">Bon état d'usage</option>
                                  </select>
                                </div>
                              </div>

                              {/* Accessories per item */}
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                  Accessoires & Éléments inclus pour ce matériel :
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    "Chargeur secteur d'origine",
                                    "Câble d'alimentation",
                                    "Sacoche de transport",
                                    "Souris sans fil",
                                    "Câble HDMI",
                                    "Clavier USB",
                                    "Adaptateur USB/RJ45",
                                    "Hub USB-C",
                                    "Cadenas de sécurité"
                                  ].map((acc) => {
                                    const isChecked = currentAccessories.includes(acc);
                                    return (
                                      <button
                                        key={acc}
                                        type="button"
                                        onClick={() => toggleAccessory(itemId, acc)}
                                        className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                                          isChecked
                                            ? "bg-indigo-50 text-indigo-800 border-indigo-300 font-bold"
                                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                        }`}
                                      >
                                        {isChecked ? <CheckSquare size={12} className="text-indigo-600" /> : <Square size={12} />}
                                        <span>{acc}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Operation Type, Acquisition Date, and General Complements */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-indigo-600" /> Options de la Fiche IT-01
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Date d'Acquisition Matériel</label>
                        <input
                          type="date"
                          value={formEquipmentAcquisitionDate}
                          onChange={(e) => setFormEquipmentAcquisitionDate(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Type d'opération</label>
                        <div className="flex gap-2">
                          {(["AFFECTATION", "RÉAFFECTATION"] as OperationType[]).map((op) => (
                            <button
                              key={op}
                              type="button"
                              onClick={() => setFormOperationType(op)}
                              className={`flex-1 py-2 px-2 rounded-lg border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                formOperationType === op
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              {formOperationType === op ? <CheckSquare size={13} /> : <Square size={13} />}
                              <span>{op}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Global Complements */}
                    <div className="space-y-2 pt-1 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Compléments Fournis (Case à cocher sur la fiche) :
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setFormHasKeyboard(!formHasKeyboard)}
                          className={`py-2 px-3 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            formHasKeyboard
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {formHasKeyboard ? <CheckSquare size={13} /> : <Square size={13} />}
                          <span>Clavier</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormHasMouse(!formHasMouse)}
                          className={`py-2 px-3 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            formHasMouse
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {formHasMouse ? <CheckSquare size={13} /> : <Square size={13} />}
                          <span>Souris</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormHasUsbAdapter(!formHasUsbAdapter)}
                          className={`py-2 px-3 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            formHasUsbAdapter
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {formHasUsbAdapter ? <CheckSquare size={13} /> : <Square size={13} />}
                          <span>Adaptateur USB/RJ45</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DSI & Validation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Émetteur / Responsable DSI</label>
                  <input
                    type="text"
                    required
                    value={formAuthorizedBy}
                    onChange={(e) => setFormAuthorizedBy(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Entité Émettrice</label>
                  <input
                    type="text"
                    required
                    value={formDsiTitle}
                    onChange={(e) => setFormDsiTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Notes Complémentaires</label>
                <input
                  type="text"
                  placeholder="Ex: Matériel configuré pour dotation entreprise."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loadingAction || (!formBeneficiaryName)}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <FileCheck2 size={14} />
                  Générer & Afficher la Fiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2 : ENREGISTREMENT D'UN RETOUR / RESTITUTION DE MATÉRIEL            */}
      {/* ========================================================================= */}
      {selectedAssignmentForReturn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Procédure de Restitution & Décharge de Matériel</h3>
                  <p className="text-xs text-slate-500">
                    Fiche {selectedAssignmentForReturn.reference} • Bénéficiaire : <strong>{selectedAssignmentForReturn.beneficiaryName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAssignmentForReturn(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              
              {/* Matériels concernés */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Équipements à Restituer :</span>
                <div className="space-y-1.5">
                  {selectedAssignmentForReturn.items.map((it, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Laptop size={14} className="text-indigo-600" />
                        <div>
                          <strong className="text-slate-900">{it.name}</strong>
                          <div className="text-[10px] text-slate-500 font-mono">SN: {it.serialNumber} • Asset: {it.assetTag}</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        Initial : {it.condition}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date & Cause de retour */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Date de Restitution Réelle *</label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Motif / Cause de Retour *</label>
                  <select
                    value={returnCause}
                    onChange={(e) => setReturnCause(e.target.value as ReturnCause)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
                  >
                    <option value="Départ collaborateur (Fin de contrat / Démission)">Départ collaborateur (Fin de contrat / Démission)</option>
                    <option value="Renouvellement matériel / Upgrade">Renouvellement matériel / Upgrade</option>
                    <option value="Matériel défectueux / En panne">Matériel défectueux / En panne</option>
                    <option value="Changement de poste / Mutation interne">Changement de poste / Mutation interne</option>
                    <option value="Fin de mission / Projet temporaire">Fin de mission / Projet temporaire</option>
                    <option value="Autre motif">Autre motif</option>
                  </select>
                </div>
              </div>

              {/* État du matériel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">État Physique & Fonctionnel Constaté *</label>
                  <select
                    value={equipmentCondition}
                    onChange={(e) => setEquipmentCondition(e.target.value as EquipmentReturnCondition)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold text-slate-800"
                  >
                    <option value="Parfait état / Comme neuf">Parfait état / Comme neuf</option>
                    <option value="Bon état d'usage">Bon état d'usage</option>
                    <option value="Rayures / Usure légère">Rayures / Usure légère</option>
                    <option value="Endommagé / Réparation requise">Endommagé / Réparation requise</option>
                    <option value="Hors service / Rebut">Hors service / Rebut</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Action Technique Décidée (DSI) *</label>
                  <select
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold text-indigo-700"
                  >
                    <option value="Remise en stock disponible">Remise en stock disponible (Prêt pour dotation)</option>
                    <option value="Envoi en maintenance / SAV">Envoi en maintenance / SAV Réparation</option>
                    <option value="Mise au rebut">Mise au rebut / Déclassement définitif</option>
                  </select>
                </div>
              </div>

              {/* Accessoires restitués */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Contrôle des Accessoires Remis :</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Chargeur secteur d'origine",
                    "Câble d'alimentation",
                    "Sacoche de transport",
                    "Souris sans fil",
                    "Adaptateur / Hub USB-C",
                    "Câble HDMI 4K",
                    "Cadenas de sécurité"
                  ].map((acc, i) => {
                    const isChecked = accessoriesReturned.includes(acc);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setAccessoriesReturned(prev => prev.filter(a => a !== acc));
                          } else {
                            setAccessoriesReturned(prev => [...prev, acc]);
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-md border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                          isChecked
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                            : "bg-white text-slate-400 border-slate-200 line-through"
                        }`}
                      >
                        {isChecked ? <CheckSquare size={12} className="text-emerald-600" /> : <Square size={12} />}
                        {acc}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Checklist Sécurité IT */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={13} className="text-indigo-600" /> Checklist Sécurité & Conformité Informatique
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border border-indigo-100">
                    <input
                      type="checkbox"
                      checked={dataWiped}
                      onChange={(e) => setDataWiped(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-slate-800 font-semibold">Données effacées / Reset Usine</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border border-indigo-100">
                    <input
                      type="checkbox"
                      checked={bitlockerUnlocked}
                      onChange={(e) => setBitlockerUnlocked(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-slate-800 font-semibold">Comptes & BitLocker déconnectés</span>
                  </label>
                </div>
              </div>

              {/* Diagnostic technique */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Diagnostic Technique & Remarques DSI</label>
                <textarea
                  rows={2}
                  value={technicalDiagnosis}
                  onChange={(e) => setTechnicalDiagnosis(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Inspected By */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Inspecté et Validé par</label>
                <input
                  type="text"
                  required
                  value={inspectedBy}
                  onChange={(e) => setInspectedBy(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentForReturn(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <RotateCcw size={14} />
                  Valider le Retour & Imprimer Décharge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3 : FICHE D'AFFECTATION IMPRIMABLE (SIGNATURE BÉNÉFICIAIRE & DSI)   */}
      {/* ========================================================================= */}
      {selectedAssignmentForPrint && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedAssignmentForPrint(null);
            }
          }}
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static"
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 print:shadow-none print:border-none print:m-0 print:p-4 print:max-w-none relative">
            
            {/* Sticky Action Bar (Hidden in Print) */}
            <div className="sticky -top-6 -mt-2 -mx-2 sm:-mx-4 px-4 py-3 bg-white/95 backdrop-blur-md rounded-xl border-b border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 z-20 print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Fiche Officielle d'Affectation & Prise en Charge
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportAssignmentToPDF(selectedAssignmentForPrint)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Download size={14} /> Exporter PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Printer size={14} /> Imprimer (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentForPrint(null)}
                  className="bg-slate-800 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <X size={15} /> Fermer
                </button>
              </div>
            </div>

            {/* PRINTABLE SHEET CONTENT */}
            <div id="printable-handover-slip" className="text-slate-900 font-sans">
              
              {/* IF DISTRA IT-02 FORM */}
              {selectedAssignmentForPrint.templateType === "DISTRA_SIM_SMARTPHONE" || selectedAssignmentForPrint.resourceType ? (
                <div className="space-y-3.5 text-slate-900 border-2 border-slate-300 p-4 sm:p-6 bg-white rounded-lg text-xs">
                  
                  {/* Top Header */}
                  <div className="grid grid-cols-12 border-2 border-slate-900 rounded overflow-hidden">
                    {/* Distra Brand */}
                    <div className="col-span-3 p-3 border-r-2 border-slate-900 flex items-center justify-center bg-white">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-[#7cb342] flex items-center justify-center text-white font-black text-xs">D</div>
                          <div className="w-5 h-5 -ml-2 rounded-full bg-[#558b2f] opacity-80"></div>
                          <div className="w-4 h-4 -ml-2 rounded-full bg-[#33691e] opacity-70"></div>
                        </div>
                        <span className="text-xl font-black tracking-tight text-slate-800 font-sans">Distra</span>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="col-span-6 p-3 border-r-2 border-slate-900 flex items-center justify-center text-center bg-white">
                      <h1 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-tight leading-tight">
                        DÉCHARGE D'AFFECTATION<br />DE MATÉRIEL IT
                      </h1>
                    </div>

                    {/* Reference & Form code */}
                    <div className="col-span-3 flex flex-col justify-between bg-white text-center">
                      <div className="p-2 border-b-2 border-slate-900 font-bold text-slate-700 text-[11px]">
                        Formulaire : {selectedAssignmentForPrint.formCode || "IT-02"}
                      </div>
                      <div className="p-2 font-black text-blue-700 text-[11px] font-mono">
                        N° AFFECTATION : {selectedAssignmentForPrint.reference?.replace("AFF-DSI-2026-", "")?.replace(/^0+/, "") || "1"}
                      </div>
                    </div>
                  </div>

                  {/* DSI Green Banner */}
                  <div className="bg-[#689f38] text-white py-1.5 px-3 text-center text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs">
                    DÉPARTEMENT SYSTÈMES D'INFORMATION
                  </div>

                  {/* 1 — BÉNÉFICIAIRE GRID */}
                  <div className="border border-slate-900 rounded overflow-hidden text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 border-b border-slate-300">
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Nom et Prénom :</div>
                      <div className="p-2 font-bold text-slate-900 border-r border-slate-300 sm:col-span-1">{selectedAssignmentForPrint.beneficiaryName}</div>
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Date d'affectation :</div>
                      <div className="p-2 font-semibold text-slate-900">{selectedAssignmentForPrint.assignedDate}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 border-b border-slate-300">
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Fonction :</div>
                      <div className="p-2 text-slate-900 border-r border-slate-300 sm:col-span-1">{selectedAssignmentForPrint.beneficiaryJobTitle || "—"}</div>
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Département :</div>
                      <div className="p-2 text-slate-900">{selectedAssignmentForPrint.beneficiaryDepartment || "—"}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4">
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Site :</div>
                      <div className="p-2 text-slate-900 border-r border-slate-300 sm:col-span-1">{selectedAssignmentForPrint.beneficiarySite || "Berrechid"}</div>
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Société :</div>
                      <div className="p-2 font-bold text-slate-900">Distra SA</div>
                    </div>
                  </div>

                  {/* 2 — TYPE D'AFFECTATION & 3 — RESSOURCE AFFECTÉE */}
                  <div className="border border-slate-900 rounded p-3 bg-white space-y-2.5">
                    {/* Row 1: Type d'affectation */}
                    <div className="flex flex-wrap items-center gap-6 pb-2 border-b border-slate-200">
                      <span className="font-bold text-slate-900 min-w-[130px]">Type d'affectation :</span>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 font-semibold cursor-pointer">
                          <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${
                            selectedAssignmentForPrint.operationType !== "RÉAFFECTATION" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                          }`}>
                            {selectedAssignmentForPrint.operationType !== "RÉAFFECTATION" ? "✓" : ""}
                          </span>
                          <span>Affectation</span>
                        </label>
                        <label className="flex items-center gap-2 font-semibold cursor-pointer">
                          <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${
                            selectedAssignmentForPrint.operationType === "RÉAFFECTATION" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                          }`}>
                            {selectedAssignmentForPrint.operationType === "RÉAFFECTATION" ? "✓" : ""}
                          </span>
                          <span>Réaffectation</span>
                        </label>
                      </div>
                    </div>

                    {/* Row 2: Ressource affectée */}
                    <div className="flex flex-wrap items-center gap-6">
                      <span className="font-bold text-slate-900 min-w-[130px]">Ressource affectée :</span>
                      <div className="flex flex-wrap items-center gap-5">
                        {(() => {
                          const rTypeStr = selectedAssignmentForPrint.resourceType || "";
                          const isSim = selectedAssignmentForPrint.hasSimCard || rTypeStr === "Carte SIM" || rTypeStr === "Carte SIM + SmartPhone" || rTypeStr.includes("SIM");
                          const isPhone = selectedAssignmentForPrint.hasSmartphone || rTypeStr === "SmartPhone" || rTypeStr === "Carte SIM + SmartPhone" || (selectedAssignmentForPrint.deviceBrand && !selectedAssignmentForPrint.equipmentType && !selectedAssignmentForPrint.deviceModel?.toLowerCase().includes("hp"));
                          const isPc = rTypeStr === "PC / Laptop" || (selectedAssignmentForPrint.equipmentType && (selectedAssignmentForPrint.equipmentType.toLowerCase().includes("pc") || selectedAssignmentForPrint.equipmentType.toLowerCase().includes("laptop") || selectedAssignmentForPrint.equipmentType.toLowerCase().includes("ordinateur"))) || (selectedAssignmentForPrint.deviceBrand?.toUpperCase() === "HP" || selectedAssignmentForPrint.items?.some(i => i.category?.includes("Laptop") || i.category?.includes("Postes Fixes")));
                          const isOther = rTypeStr === "Autre matériel IT" || (!isSim && !isPhone && !isPc && (selectedAssignmentForPrint.items?.length || selectedAssignmentForPrint.equipmentType));

                          return (
                            <>
                              <label className="flex items-center gap-2 font-semibold">
                                <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${isSim ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
                                  {isSim ? "✓" : ""}
                                </span>
                                <span>Carte SIM</span>
                              </label>
                              <label className="flex items-center gap-2 font-semibold">
                                <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${isPhone ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
                                  {isPhone ? "✓" : ""}
                                </span>
                                <span>Smartphone</span>
                              </label>
                              <label className="flex items-center gap-2 font-semibold">
                                <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${isPc ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
                                  {isPc ? "✓" : ""}
                                </span>
                                <span>PC / Laptop</span>
                              </label>
                              <label className="flex items-center gap-2 font-semibold">
                                <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${isOther ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
                                  {isOther ? "✓" : ""}
                                </span>
                                <span>Autre matériel IT</span>
                              </label>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* 4 — INFORMATIONS CARTE SIM */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <div className="bg-[#ecf5e9] text-[#285014] px-3 py-1 font-bold text-[11px] uppercase border-b border-slate-900">
                      INFORMATIONS CARTE SIM
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800">Opérateur :</span>
                        <div className="flex items-center gap-2.5">
                          {["IAM", "INWI", "ORANGE", "AUTRE"].map((op) => (
                            <label key={op} className="flex items-center gap-1 font-semibold text-[11px]">
                              <span className={`w-3 h-3 border border-slate-800 rounded-xs flex items-center justify-center text-[9px] font-bold ${
                                (selectedAssignmentForPrint.simOperator || "IAM") === op ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                              }`}>
                                {(selectedAssignmentForPrint.simOperator || "IAM") === op ? "✓" : ""}
                              </span>
                              <span>{op}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-[11px]">
                        <div>
                          <span className="text-slate-600 mr-1">N° Tél :</span>
                          <strong className="font-mono text-slate-900 font-bold">{selectedAssignmentForPrint.simPhoneNumber || selectedAssignmentForPrint.beneficiaryPhone || "—"}</strong>
                        </div>
                        <div>
                          <span className="text-slate-600 mr-1">PIN :</span>
                          <strong className="font-mono text-slate-900">{selectedAssignmentForPrint.simPin || "—"}</strong>
                        </div>
                        <div>
                          <span className="text-slate-600 mr-1">PUK :</span>
                          <strong className="font-mono text-slate-900">{selectedAssignmentForPrint.simPuk || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5 — INFORMATIONS DU MATÉRIEL */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <div className="bg-[#ecf5e9] text-[#285014] px-3 py-1 font-bold text-[11px] uppercase border-b border-slate-900">
                      INFORMATIONS MATÉRIEL
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#689f38] text-white font-bold">
                          <th className="p-2 border-r border-emerald-700 text-center">Type de matériel</th>
                          <th className="p-2 border-r border-emerald-700 text-center">Marque</th>
                          <th className="p-2 border-r border-emerald-700 text-center">Modèle</th>
                          <th className="p-2 border-r border-emerald-700 text-center">
                            {selectedAssignmentForPrint.resourceType === "SmartPhone" ? "IMEI" : (selectedAssignmentForPrint.resourceType === "PC / Laptop" ? "N° Série / Service Tag" : "N° Série / IMEI")}
                          </th>
                          <th className="p-2 text-center">Configuration</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white border-t border-slate-300 text-center">
                          <td className="p-2 border-r border-slate-300 font-medium">
                            {selectedAssignmentForPrint.equipmentType || (selectedAssignmentForPrint.resourceType === "PC / Laptop" ? "PC Portable" : (selectedAssignmentForPrint.resourceType === "SmartPhone" ? "Smartphone" : selectedAssignmentForPrint.items?.[0]?.name || "Matériel IT"))}
                          </td>
                          <td className="p-2 border-r border-slate-300 font-semibold">{selectedAssignmentForPrint.deviceBrand || selectedAssignmentForPrint.items?.[0]?.brand || "—"}</td>
                          <td className="p-2 border-r border-slate-300">{selectedAssignmentForPrint.deviceModel || selectedAssignmentForPrint.items?.[0]?.model || "—"}</td>
                          <td className="p-2 border-r border-slate-300 font-mono font-bold text-indigo-700">
                            {selectedAssignmentForPrint.deviceImei || selectedAssignmentForPrint.items?.[0]?.serialNumber || "—"}
                          </td>
                          <td className="p-2 text-slate-700">
                            {selectedAssignmentForPrint.deviceConfiguration || [
                              selectedAssignmentForPrint.equipmentCpu ? `CPU: ${selectedAssignmentForPrint.equipmentCpu}` : "",
                              selectedAssignmentForPrint.equipmentRam ? `RAM: ${selectedAssignmentForPrint.equipmentRam}GB` : "",
                              selectedAssignmentForPrint.equipmentStorage ? `SSD: ${selectedAssignmentForPrint.equipmentStorage}GB` : ""
                            ].filter(Boolean).join(" | ") || (selectedAssignmentForPrint.items?.[0]?.specs ? `${selectedAssignmentForPrint.items[0].specs.ram || ""} ${selectedAssignmentForPrint.items[0].specs.storage || ""}`.trim() : "") || "Standard"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 6 — RESTITUTION ANCIEN MATÉRIEL & REMARQUES */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <div className="bg-[#ecf5e9] text-[#285014] px-3 py-1 font-bold text-[11px] uppercase border-b border-slate-900">
                      RESTITUTION ANCIEN MATÉRIEL
                    </div>
                    <div className="p-3 space-y-2 bg-white text-xs">
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-slate-800">Restitution de l'ancien appareil :</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 font-semibold">
                            <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${
                              selectedAssignmentForPrint.restitutionPreviousDevice === "OUI" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                            }`}>
                              {selectedAssignmentForPrint.restitutionPreviousDevice === "OUI" ? "✓" : ""}
                            </span>
                            <span>OUI</span>
                          </label>
                          <label className="flex items-center gap-1.5 font-semibold">
                            <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${
                              selectedAssignmentForPrint.restitutionPreviousDevice !== "OUI" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                            }`}>
                              {selectedAssignmentForPrint.restitutionPreviousDevice !== "OUI" ? "✓" : ""}
                            </span>
                            <span>NON</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-bold text-slate-800">État de l'appareil restitué :</span>
                        <div className="flex flex-wrap items-center gap-3">
                          {["Endommagé", "Cassé mais opérationnel", "Bon état", "Non applicable"].map((cond) => {
                            const isCondMatch = (selectedAssignmentForPrint.restitutionPreviousDevice !== "OUI" && cond === "Non applicable") ||
                                                (selectedAssignmentForPrint.restitutionPreviousDevice === "OUI" && (selectedAssignmentForPrint.restitutedDeviceCondition || "Non applicable") === cond);
                            return (
                              <label key={cond} className="flex items-center gap-1 font-semibold text-[11px]">
                                <span className={`w-3 h-3 border border-slate-800 rounded-xs flex items-center justify-center text-[9px] font-bold ${
                                  isCondMatch ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                                }`}>
                                  {isCondMatch ? "✓" : ""}
                                </span>
                                <span>{cond}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <span className="font-bold text-slate-800">Remarques :</span>
                        <span className="text-slate-900 font-medium">
                          {selectedAssignmentForPrint.incidentRemarks && selectedAssignmentForPrint.incidentRemarks.trim() !== "INCIDENT / PANNE"
                            ? selectedAssignmentForPrint.incidentRemarks
                            : (selectedAssignmentForPrint.notes || "—")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 7 — ENGAGEMENT DU BÉNÉFICIAIRE */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <div className="bg-[#ecf5e9] text-[#285014] px-3 py-1 font-bold text-[11px] uppercase text-center border-b border-slate-900">
                      ENGAGEMENT DU BÉNÉFICIAIRE
                    </div>
                    <div className="p-3 space-y-2 text-[10px] text-slate-800 leading-relaxed bg-white">
                      <p>
                        1. Le bénéficiaire s'engage à rendre le matériel (SIM et/ou équipement) en bon état en cas de cessation de travail ou suite à une demande de Distra SA. En cas de non-restitution, la valeur sera déduite du solde de tout compte ou du salaire mensuel.
                      </p>
                      <p>
                        2. En cas de perte, casse, panne ou vol suite à une mauvaise manipulation ou négligence, le bénéficiaire prendra en charge les frais d'achat d'un appareil de même gamme. Le département SI se charge de la récupération de la ligne SIM.
                      </p>
                      <p>
                        3. L'opérateur prend en charge la réparation (ou le remplacement) des appareils sous garantie uniquement pour les anomalies d'usine. Ces réclamations doivent être faites dans les premières semaines suivant la réception.
                      </p>
                    </div>
                  </div>

                  {/* 8 — SIGNATURES */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="border border-slate-900 rounded overflow-hidden flex flex-col justify-between min-h-[105px] bg-white">
                      <div className="bg-slate-100 text-slate-900 px-2.5 py-1 font-bold text-[11px] border-b border-slate-900 text-center">
                        Signature du bénéficiaire
                      </div>
                      <div className="p-2 text-center text-[9px] text-slate-400 italic">
                        (Date et mention manuscrite "Lu et approuvé")
                      </div>
                      <div className="p-2 flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Date & signature :</span>
                        <span className="font-mono text-slate-300">__________________</span>
                      </div>
                    </div>

                    <div className="border border-slate-900 rounded overflow-hidden flex flex-col justify-between min-h-[105px] bg-white">
                      <div className="bg-slate-100 text-slate-900 px-2.5 py-1 font-bold text-[11px] border-b border-slate-900 text-center">
                        Visa Département Systèmes d'Information
                      </div>
                      <div className="p-2 text-center text-[9px] text-slate-400 italic">
                        (Date, visa et cachet DSI)
                      </div>
                      <div className="p-2 flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Visa & cachet :</span>
                        <span className="font-mono text-slate-300">__________________</span>
                      </div>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="border-t border-slate-900 pt-2 text-[10px] text-slate-600 text-center font-bold tracking-wider">
                    Département Systèmes D'Information &nbsp;|&nbsp; <span className="font-normal text-slate-500">DIS-IT-02 | Version 1.0</span>
                  </div>

                </div>
              ) : (
                /* DISTRA STANDARD IT EQUIPMENT FORM (DIS-IT-01) */
                <div className="space-y-4 text-slate-900 border-2 border-slate-300 p-4 sm:p-6 bg-white rounded-lg">
                  {/* Top Header */}
                  <div className="grid grid-cols-3 items-center border-b-2 border-[#7cb342] pb-3 gap-2">
                    {/* Distra Brand */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-[#7cb342] flex items-center justify-center text-white font-black text-xs">D</div>
                        <div className="w-5 h-5 -ml-2 rounded-full bg-[#558b2f] opacity-80"></div>
                        <div className="w-4 h-4 -ml-2 rounded-full bg-[#33691e] opacity-70"></div>
                      </div>
                      <span className="text-xl font-black tracking-tight text-slate-800 font-sans">Distra</span>
                    </div>

                    {/* Title */}
                    <div className="text-center border-2 border-[#7cb342] py-2 px-3 rounded bg-emerald-50/40">
                      <h1 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-tight leading-snug">
                        FORMULAIRE DE DÉCHARGE MATÉRIEL INFORMATIQUE
                      </h1>
                    </div>

                    {/* Reference & Form code */}
                    <div className="text-right text-xs">
                      <div className="font-bold text-slate-700">Formulaire IT-01</div>
                      <div className="font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded inline-block font-mono mt-0.5">
                        N° AFFECTATION : {selectedAssignmentForPrint.reference}
                      </div>
                    </div>
                  </div>

                  {/* DSI Green Banner */}
                  <div className="bg-[#7cb342] text-white py-1 px-3 text-center text-xs font-bold uppercase tracking-wider rounded-xs">
                    Département Systèmes D'Information
                  </div>

                  {/* Information Bénéficiaire */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                      INFORMATION BÉNÉFICIAIRE :
                    </div>
                    <div className="border border-slate-300 rounded overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#7cb342] text-white text-[11px]">
                            <th className="p-2 font-bold border-r border-emerald-600">Nom Complet</th>
                            <th className="p-2 font-bold border-r border-emerald-600">Fonction</th>
                            <th className="p-2 font-bold border-r border-emerald-600">Département</th>
                            <th className="p-2 font-bold">Emplacement</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white text-slate-900">
                            <td className="p-2 border-r border-slate-300 font-bold">{selectedAssignmentForPrint.beneficiaryName}</td>
                            <td className="p-2 border-r border-slate-300">{selectedAssignmentForPrint.beneficiaryJobTitle || "Operateur"}</td>
                            <td className="p-2 border-r border-slate-300 font-semibold">{selectedAssignmentForPrint.beneficiaryDepartment || "Technique"}</td>
                            <td className="p-2">{selectedAssignmentForPrint.beneficiarySite || "Berrechid"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Informations du bien */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                      INFORMATIONS DU BIEN :
                    </div>
                    <div className="border border-slate-300 rounded overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#7cb342] text-white text-[11px]">
                            <th className="p-2 font-bold border-r border-emerald-600">Type du bien</th>
                            <th className="p-2 font-bold border-r border-emerald-600">Numéro de série</th>
                            <th className="p-2 font-bold border-r border-emerald-600">Configuration</th>
                            <th className="p-2 font-bold">Date d'acquisition</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAssignmentForPrint.items.map((it, idx) => {
                            const configStr = [
                              selectedAssignmentForPrint.equipmentCpu ? `CPU: ${selectedAssignmentForPrint.equipmentCpu}` : (it.specs?.cpu ? `CPU: ${it.specs.cpu}` : ""),
                              selectedAssignmentForPrint.equipmentRam ? `RAM: ${selectedAssignmentForPrint.equipmentRam} GB` : (it.specs?.ram ? `RAM: ${it.specs.ram}` : ""),
                              selectedAssignmentForPrint.equipmentStorage ? `SSD: ${selectedAssignmentForPrint.equipmentStorage} GB` : (it.specs?.storage ? `SSD: ${it.specs.storage}` : "")
                            ].filter(Boolean).join(" | ") || (selectedAssignmentForPrint.deviceConfiguration || "Standard");

                            const acqDate = selectedAssignmentForPrint.equipmentAcquisitionDate 
                              ? new Date(selectedAssignmentForPrint.equipmentAcquisitionDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                              : "06/12/2021";

                            return (
                              <tr key={idx} className="bg-white text-slate-900 border-b border-slate-200">
                                <td className="p-2 border-r border-slate-300 font-semibold">{selectedAssignmentForPrint.equipmentType || it.category || it.name}</td>
                                <td className="p-2 border-r border-slate-300 font-mono font-bold text-[#33691e]">{it.serialNumber}</td>
                                <td className="p-2 border-r border-slate-300 font-medium">{configStr}</td>
                                <td className="p-2 font-mono">{acqDate}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Compléments & Type d'opération */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Compléments */}
                    <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1.5">
                      <span className="font-bold text-slate-800 uppercase text-[11px] block">Compléments :</span>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { label: "Clavier", checked: !!selectedAssignmentForPrint.hasKeyboard },
                          { label: "Souris", checked: !!selectedAssignmentForPrint.hasMouse },
                          { label: "Adaptateur USB / RJ45", checked: !!selectedAssignmentForPrint.hasUsbAdapter }
                        ].map((c) => (
                          <div key={c.label} className="flex items-center gap-1.5 font-bold text-slate-800">
                            <span className={`w-4 h-4 rounded-xs border flex items-center justify-center ${
                              c.checked ? "bg-[#7cb342] text-white border-[#558b2f]" : "bg-white border-slate-400"
                            }`}>
                              {c.checked ? "✓" : ""}
                            </span>
                            <span>{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Type d'opération */}
                    <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1.5">
                      <span className="font-bold text-slate-800 uppercase text-[11px] block">Type d'opération :</span>
                      <div className="flex items-center gap-4">
                        {["AFFECTATION", "RÉAFFECTATION"].map((op) => {
                          const isOp = (selectedAssignmentForPrint.operationType || "AFFECTATION") === op;
                          return (
                            <div key={op} className="flex items-center gap-1.5 font-bold text-slate-800">
                              <span className={`w-4 h-4 rounded-xs border flex items-center justify-center ${
                                isOp ? "bg-[#7cb342] text-white border-[#558b2f]" : "bg-white border-slate-400"
                              }`}>
                                {isOp ? "✓" : ""}
                              </span>
                              <span>{op}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Engagement du bénéficiaire */}
                  <div className="border border-slate-300 rounded overflow-hidden text-xs">
                    <div className="bg-[#7cb342] text-white px-2.5 py-1 font-bold text-[11px] uppercase">
                      Engagement du bénéficiaire
                    </div>
                    <div className="p-3 space-y-1 text-[10px] text-slate-800 leading-relaxed bg-white">
                      <p>
                        1. Par la présente, je soussigné(e) M/Mme <strong>{selectedAssignmentForPrint.beneficiaryName}</strong>, atteste avoir reçu le matériel informatique ci-dessus mentionné en parfait état de marche.
                      </p>
                      <p>
                        2. Je m'engage à en prendre soin, à l'utiliser exclusivement à des fins professionnelles conformément aux directives de la Direction des Systèmes d'Information (DSI).
                      </p>
                      <p>
                        3. En cas de perte, vol ou dégradation par négligence, j'en informerai immédiatement la DSI et reconnais ma responsabilité selon le règlement intérieur de l'entreprise.
                      </p>
                      <p>
                        4. Tout le matériel ainsi que ses accessoires devront être restitués à la DSI lors de mon départ ou sur simple demande.
                      </p>
                    </div>
                  </div>

                  {/* Remarques */}
                  <div className="border border-slate-300 rounded p-2 text-xs flex items-center gap-2 bg-white">
                    <span className="font-bold text-slate-700 shrink-0">Remarques :</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {selectedAssignmentForPrint.incidentRemarks || selectedAssignmentForPrint.notes || "INFORMATION / SUIVI"}
                    </span>
                  </div>

                  {/* Dual Signatures */}
                  <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                    <div className="border border-slate-300 rounded overflow-hidden flex flex-col justify-between min-h-[110px] bg-white">
                      <div className="bg-[#7cb342] text-white px-2.5 py-1 font-bold text-[11px]">
                        Signature du bénéficiaire
                      </div>
                      <div className="p-2.5 flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Date et signature :</span>
                        <span className="font-mono text-slate-300">__________________</span>
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded overflow-hidden flex flex-col justify-between min-h-[110px] bg-white">
                      <div className="bg-[#7cb342] text-white px-2.5 py-1 font-bold text-[11px]">
                        Visa Département Systèmes d'Information
                      </div>
                      <div className="p-2.5 flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Date, visa et cachet :</span>
                        <span className="font-mono text-slate-300">__________________</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Distra */}
                  <div className="border-t border-slate-300 pt-2 text-[9px] text-slate-500 text-center font-semibold tracking-wider uppercase">
                    Département Systèmes D'Information | DIS-IT-01 | Version 1.0
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <span className="text-xs text-slate-500 font-medium">
                Document certifié conforme DSI • Vous pouvez l'exporter en PDF ou l'imprimer sur papier A4.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportAssignmentToPDF(selectedAssignmentForPrint)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download size={14} /> Exporter PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Printer size={14} /> Imprimer (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentForPrint(null)}
                  className="bg-slate-800 hover:bg-red-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <X size={15} /> Fermer la Fiche
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4 : FICHE DE DÉCHARGE & RESTITUTION IMPRIMABLE (SIGNATURE DSI & BÉNÉFICIAIRE) */}
      {/* ========================================================================= */}
      {selectedAssignmentForReturnPrint && selectedAssignmentForReturnPrint.returnRecord && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedAssignmentForReturnPrint(null);
            }
          }}
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static"
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 print:shadow-none print:border-none print:m-0 print:p-4 print:max-w-none relative">
            
            {/* Sticky Action Bar */}
            <div className="sticky -top-6 -mt-2 -mx-2 sm:-mx-4 px-4 py-3 bg-white/95 backdrop-blur-md rounded-xl border-b border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 z-20 print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-amber-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Décharge Officielle de Restitution
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportReturnToPDF(selectedAssignmentForReturnPrint)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Download size={14} /> Exporter PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Printer size={14} /> Imprimer Décharge (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentForReturnPrint(null)}
                  className="bg-slate-800 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <X size={15} /> Fermer
                </button>
              </div>
            </div>

            {/* PRINTABLE RETURN SHEET */}
            <div id="printable-return-slip" className="space-y-6 text-slate-900 font-sans">
              
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">
                    DIRECTION DES SYSTÈMES D'INFORMATION (DSI)
                  </h1>
                  <p className="text-xs font-semibold text-amber-800 uppercase">
                    Procès-Verbal de Restitution & Décharge de Matériel Informatique
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-black text-amber-900 bg-amber-50 px-3 py-1 rounded border border-amber-300">
                    DÉCHARGE N° {selectedAssignmentForReturnPrint.returnRecord.id}
                  </span>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium">
                    Casablanca, le {new Date(selectedAssignmentForReturnPrint.returnRecord.returnDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                
                {/* Beneficiary Return details */}
                <div className="border border-slate-300 rounded-lg p-3.5 space-y-1.5 bg-slate-50/50">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1 text-[11px]">
                    1. Bénéficiaire Restituant
                  </h4>
                  <div><strong>Nom & Prénom :</strong> {selectedAssignmentForReturnPrint.beneficiaryName}</div>
                  <div><strong>N° CIN / Matricule :</strong> {selectedAssignmentForReturnPrint.beneficiaryCin || "Non renseigné"}</div>
                  <div><strong>Département :</strong> {selectedAssignmentForReturnPrint.beneficiaryDepartment}</div>
                  <div><strong>Fonction :</strong> {selectedAssignmentForReturnPrint.beneficiaryJobTitle || "Collaborateur"}</div>
                  <div><strong>Réf. Affectation Initiale :</strong> {selectedAssignmentForReturnPrint.reference}</div>
                </div>

                {/* Return Inspection */}
                <div className="border border-slate-300 rounded-lg p-3.5 space-y-1.5 bg-slate-50/50">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1 text-[11px]">
                    2. Constat & Motif de Restitution
                  </h4>
                  <div><strong>Motif du Retour :</strong> <span className="font-bold text-slate-900">{selectedAssignmentForReturnPrint.returnRecord.cause}</span></div>
                  <div><strong>État Constaté :</strong> <span className="font-bold text-slate-900">{selectedAssignmentForReturnPrint.returnRecord.equipmentCondition}</span></div>
                  <div><strong>Action DSI :</strong> <span className="font-bold text-indigo-700">{selectedAssignmentForReturnPrint.returnRecord.actionTaken}</span></div>
                  <div><strong>Inspecté par :</strong> {selectedAssignmentForReturnPrint.returnRecord.inspectedBy}</div>
                </div>
              </div>

              {/* Table of Returned Gear */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  3. Matériels Restitués & Contrôle des Composants
                </h4>
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                      <th className="border border-slate-300 p-2 text-left">Désignation</th>
                      <th className="border border-slate-300 p-2 text-left">N° Série (SN)</th>
                      <th className="border border-slate-300 p-2 text-left">Asset Tag</th>
                      <th className="border border-slate-300 p-2 text-left">Accessoires Reçus</th>
                      <th className="border border-slate-300 p-2 text-left">Accessoires Manquants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAssignmentForReturnPrint.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-2 font-bold text-slate-900">{it.name}</td>
                        <td className="border border-slate-300 p-2 font-mono font-semibold">{it.serialNumber}</td>
                        <td className="border border-slate-300 p-2 font-mono text-indigo-700 font-bold">{it.assetTag}</td>
                        <td className="border border-slate-300 p-2 text-[11px] text-emerald-700 font-medium">
                          {selectedAssignmentForReturnPrint.returnRecord?.accessoriesReturned.join(", ") || "Tous reçus"}
                        </td>
                        <td className="border border-slate-300 p-2 text-[11px] text-rose-700 font-medium">
                          {selectedAssignmentForReturnPrint.returnRecord?.missingAccessories && selectedAssignmentForReturnPrint.returnRecord.missingAccessories.length > 0
                            ? selectedAssignmentForReturnPrint.returnRecord.missingAccessories.join(", ")
                            : "Aucun (Complet)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Technical Observations */}
              <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 space-y-1 text-xs">
                <span className="font-bold text-slate-900 uppercase text-[11px] block">4. Diagnostic Technique & Quitus de Sécurité DSI :</span>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {selectedAssignmentForReturnPrint.returnRecord.technicalDiagnosis}
                </p>
                <div className="flex items-center gap-4 text-[10px] text-slate-600 font-semibold pt-1">
                  <span>• Nettoyage des Données : {selectedAssignmentForReturnPrint.returnRecord.dataWiped ? "Effectué (OK)" : "En attente"}</span>
                  <span>• Déconnexion BitLocker : {selectedAssignmentForReturnPrint.returnRecord.bitlockerUnlocked ? "Effectuée (OK)" : "En attente"}</span>
                </div>
              </div>

              {/* Quitus & Décharge text */}
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-[10px] text-slate-700 leading-relaxed">
                Par la présente, la Direction des Systèmes d'Information (DSI) atteste avoir réceptionné les matériels et accessoires décrits ci-dessus, et délivre au collaborateur <strong>{selectedAssignmentForReturnPrint.beneficiaryName}</strong> un quitus complet de décharge de prise en charge matérielle sous réserve des constats contradictoires ci-énoncés.
              </div>

              {/* SIGNATURES */}
              <div className="pt-4 grid grid-cols-2 gap-8 text-xs">
                
                {/* Beneficiary */}
                <div className="border border-slate-400 rounded-xl p-4 flex flex-col justify-between min-h-[140px] bg-white">
                  <div>
                    <span className="font-bold text-slate-900 uppercase block text-[11px]">
                      Le Collaborateur (Restituant)
                    </span>
                    <div className="font-semibold text-slate-800 mt-2">
                      {selectedAssignmentForReturnPrint.beneficiaryName}
                    </div>
                  </div>
                  <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-400 flex justify-between items-end">
                    <span>Date & Signature :</span>
                    <span className="font-mono text-slate-300">________________________</span>
                  </div>
                </div>

                {/* DSI */}
                <div className="border border-slate-400 rounded-xl p-4 flex flex-col justify-between min-h-[140px] bg-white">
                  <div>
                    <span className="font-bold text-slate-900 uppercase block text-[11px]">
                      Pour la DSI (Inspecteur Réception)
                    </span>
                    <div className="font-semibold text-slate-800 mt-2">
                      {selectedAssignmentForReturnPrint.returnRecord.inspectedBy}
                    </div>
                  </div>
                  <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-400 flex justify-between items-end">
                    <span>Cachet & Signature DSI :</span>
                    <span className="font-mono text-slate-300">________________________</span>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 pt-3 text-[9px] text-slate-400 text-center uppercase tracking-widest font-mono">
                Procès-Verbal Officiel de Restitution DSI • Page 1/1
              </div>

            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <span className="text-xs text-slate-500 font-medium">
                Décharge certifiée par la DSI • Exportation PDF pour archivage légal ou impression papier.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportReturnToPDF(selectedAssignmentForReturnPrint)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download size={14} /> Exporter PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Printer size={14} /> Imprimer Décharge (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentForReturnPrint(null)}
                  className="bg-slate-800 hover:bg-red-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <X size={15} /> Fermer la Décharge
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
