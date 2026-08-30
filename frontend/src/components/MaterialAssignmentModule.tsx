import { apiFetch } from "../api";
import React, { useState, useEffect } from "react";
import {
  MaterialAssignment,
  ITStockItem,
  AppUser,
  ReturnCause,
  EquipmentReturnCondition,
  TelecomOperator,
  AssignedResourceType,
  OperationType,
  RestitutedDeviceCondition,
  AssignedItemDetail,
  MaterialReturnRecord,
} from "../types";
import FicheImpressionAffectation from "./affectations/FicheImpressionAffectation";
import FicheImpressionRestitution from "./affectations/FicheImpressionRestitution";
import {
  FileCheck2,
  X,
  RotateCcw,
  CheckSquare,
  Square,
  SlidersHorizontal,
} from "lucide-react";
import {
  SummaryCards,
  SearchFilterBar,
  AssignmentsTable,
  BeneficiarySection,
  ResourceTypeSelector,
  SimDetailsSection,
  SmartphoneDetailsSection,
  OperationSection,
  StockSelector,
} from "./assignments";

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
  onSelectTab,
}: MaterialAssignmentModuleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<
    "all" | "active" | "returned"
  >("all");
  const [selectedAssignmentForPrint, setSelectedAssignmentForPrint] =
    useState<MaterialAssignment | null>(null);
  const [selectedAssignmentForReturn, setSelectedAssignmentForReturn] =
    useState<MaterialAssignment | null>(null);
  const [selectedAssignmentForReturnPrint, setSelectedAssignmentForReturnPrint] =
    useState<MaterialAssignment | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [cleIdempotenceAffectation, setCleIdempotenceAffectation] = useState(
    () => crypto.randomUUID()
  );
  const ouvrirCreation = () => {
    setCleIdempotenceAffectation(crypto.randomUUID());
    setShowCreateModal(true);
  };
  const [loadingAction, setLoadingAction] = useState(false);
  const [showConfirmSummary, setShowConfirmSummary] = useState(false);
  const [reassignAfterId, setReassignAfterId] = useState<string | null>(null);

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

  // Template type
  const [assignmentTemplateType, setAssignmentTemplateType] = useState<
    "DISTRA_SIM_SMARTPHONE" | "STANDARD_DSI_EQUIPMENT"
  >("DISTRA_SIM_SMARTPHONE");

  // Beneficiary form
  const [formBeneficiaryName, setFormBeneficiaryName] = useState("");
  const [formBeneficiaryEmail, setFormBeneficiaryEmail] = useState("");
  const [formBeneficiaryPhone, setFormBeneficiaryPhone] = useState("");
  const [formBeneficiaryCin, setFormBeneficiaryCin] = useState("");
  const [formBeneficiaryJob, setFormBeneficiaryJob] = useState("");
  const [formBeneficiaryDept, setFormBeneficiaryDept] = useState("BU - Comm");
  const [formBeneficiarySite, setFormBeneficiarySite] = useState("Berrechid");
  const [formAssignedDate, setFormAssignedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formAuthorizedBy, setFormAuthorizedBy] = useState(
    currentUser?.name || "Directeur Systèmes d'Information"
  );
  const [formDsiTitle, setFormDsiTitle] = useState(
    "Département Systèmes D'Information"
  );
  const [formNotes, setFormNotes] = useState("");

  // Distra SIM & Smartphone
  const [formResourceType, setFormResourceType] =
    useState<AssignedResourceType>("Carte SIM + SmartPhone");
  const [formSimOperator, setFormSimOperator] = useState<TelecomOperator>("IAM");
  const [formSimPhoneNumber, setFormSimPhoneNumber] = useState("");
  const [formSimPuk, setFormSimPuk] = useState("");
  const [formSimPin, setFormSimPin] = useState("");
  const [formDeviceBrand, setFormDeviceBrand] = useState("HP");
  const [formDeviceImei, setFormDeviceImei] = useState("");
  const [formDeviceModel, setFormDeviceModel] = useState("15-AY002NK");
  const [formDeviceConfiguration, setFormDeviceConfiguration] = useState(
    "4 GB | 500 GB"
  );
  const [formOperationType, setFormOperationType] =
    useState<OperationType>("AFFECTATION");
  const [formRestitutionPreviousDevice, setFormRestitutionPreviousDevice] =
    useState<"OUI" | "NON">("NON");
  const [formRestitatedDeviceCondition, setFormRestitatedDeviceCondition] =
    useState<RestitutedDeviceCondition>("Non applicable");
  const [formIncidentRemarks, setFormIncidentRemarks] =
    useState("INCIDENT / PANNE");

  // Distra IT Equipment
  const [formEquipmentType, setFormEquipmentType] = useState(
    "Ordinateur / PC"
  );
  const [formEquipmentCpu, setFormEquipmentCpu] = useState("Intel i7");
  const [formEquipmentRam, setFormEquipmentRam] = useState("8");
  const [formEquipmentStorage, setFormEquipmentStorage] = useState("256");
  const [formEquipmentAcquisitionDate, setFormEquipmentAcquisitionDate] =
    useState("2021-12-06");
  const [formHasKeyboard, setFormHasKeyboard] = useState(false);
  const [formHasMouse, setFormHasMouse] = useState(false);
  const [formHasUsbAdapter, setFormHasUsbAdapter] = useState(false);

  // Stock selection
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedStockItems, setSelectedStockItems] = useState<ITStockItem[]>([]);
  const [itemAccessoriesMap, setItemAccessoriesMap] = useState<
    Record<string, string[]>
  >({});
  const [itemConditionMap, setItemConditionMap] = useState<
    Record<string, AssignedItemDetail["condition"]>
  >({});

  // Return form
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [returnCause, setReturnCause] = useState<ReturnCause>(
    "Départ collaborateur (Fin de contrat / Démission)"
  );
  const [customReturnCause, setCustomReturnCause] = useState("");
  const [equipmentCondition, setEquipmentCondition] =
    useState<EquipmentReturnCondition>("Bon état");
  const [accessoriesReturned, setAccessoriesReturned] = useState<string[]>([]);
  const [dataWiped, setDataWiped] = useState(true);
  const [bitlockerUnlocked, setBitlockerUnlocked] = useState(true);
  const [technicalDiagnosis, setTechnicalDiagnosis] = useState(
    "Équipement inspecté par la DSI. Fonctionnement normal, aucun dommage critique."
  );
  const [actionTaken, setActionTaken] = useState<
    "Remise en stock disponible" | "Envoi en maintenance / SAV" | "Mise au rebut"
  >("Remise en stock disponible");
  const [inspectedBy, setInspectedBy] = useState(
    currentUser?.name || "Zakaria Radouane (DSI)"
  );
  const [returnNotes, setReturnNotes] = useState("");

  const handleSelectPredefinedUser = (userName: string) => {
    setFormBeneficiaryName(userName);
    const foundUser = users.find((u) => u.name === userName);
    if (foundUser) {
      setFormBeneficiaryEmail(foundUser.email);
      setFormBeneficiaryDept(foundUser.department);
      setFormBeneficiaryJob(foundUser.jobTitle);
    }
  };

  const toggleStockItemSelection = (item: ITStockItem) => {
    const itemId = item.id;
    if (selectedItemIds.includes(itemId)) {
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
      setSelectedStockItems((prev) => prev.filter((i) => i.id !== itemId));
    } else {
      setSelectedItemIds((prev) => [...prev, itemId]);
      setSelectedStockItems((prev) => [...prev, item]);
      if (!itemAccessoriesMap[itemId]) {
        setItemAccessoriesMap((prev) => ({
          ...prev,
          [itemId]: ["Chargeur secteur d'origine", "Câble d'alimentation"],
        }));
      }
      if (!itemConditionMap[itemId]) {
        setItemConditionMap((prev) => ({
          ...prev,
          [itemId]: "Neuf / Excellent état",
        }));
      }
    }
  };

  const removeStockItem = (itemId: string) => {
    setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
    setSelectedStockItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const setItemCondition = (
    itemId: string,
    cond: AssignedItemDetail["condition"]
  ) => {
    setItemConditionMap((prev) => ({ ...prev, [itemId]: cond }));
  };

  const toggleAccessory = (itemId: string, accessory: string) => {
    setItemAccessoriesMap((prev) => {
      const current = prev[itemId] || [];
      const next = current.includes(accessory)
        ? current.filter((a) => a !== accessory)
        : [...current, accessory];
      return { ...prev, [itemId]: next };
    });
  };

  // Submit new assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBeneficiaryName) {
      alert("Veuillez renseigner le nom complet du collaborateur.");
      return;
    }
    if (
      assignmentTemplateType === "STANDARD_DSI_EQUIPMENT" &&
      selectedItemIds.length === 0
    ) {
      alert("Veuillez sélectionner au moins un équipement en stock à affecter.");
      return;
    }
    setShowConfirmSummary(true);
  };

  const handleConfirmSubmitAssignment = async () => {
    setShowConfirmSummary(false);

    setLoadingAction(true);
    try {
      const itemsPayload = selectedItemIds.map((id) => ({
        stockItemId: id,
        condition: itemConditionMap[id] || "Neuf / Excellent état",
        accessories: itemAccessoriesMap[id] || [
          "Chargeur secteur",
          "Câble d'alimentation",
        ],
      }));

      const isSim =
        formResourceType === "Carte SIM" ||
        formResourceType === "Carte SIM + SmartPhone";
      const isPhone =
        formResourceType === "SmartPhone" ||
        formResourceType === "Carte SIM + SmartPhone";

      const payloadBody: Record<string, unknown> = {
        templateType: assignmentTemplateType,
        formCode:
          assignmentTemplateType === "DISTRA_SIM_SMARTPHONE" ? "IT-02" : "IT-01",
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
        notes: formNotes,
        ...(reassignAfterId ? { reaffecteApresId: reassignAfterId } : {}),
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

      const res = await apiFetch("/api/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cle-Idempotence": cleIdempotenceAffectation,
        },
        body: JSON.stringify(payloadBody),
      });

      if (res.ok) {
        const payload = await res.json();
        setShowCreateModal(false);
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
        setSelectedStockItems([]);
        setReassignAfterId(null);
        onRefresh();
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

  const handleOpenReturnModal = (assignment: MaterialAssignment) => {
    setSelectedAssignmentForReturn(assignment);
    setReturnDate(new Date().toISOString().split("T")[0]);
    setReturnCause("Départ collaborateur (Fin de contrat / Démission)");
    setEquipmentCondition("Bon état");
    const allAssignedAccessories = assignment.items.flatMap(
      (i) => i.accessories || []
    );
    const uniqueAccessories = Array.from(new Set(allAssignedAccessories));
    setAccessoriesReturned(uniqueAccessories);
    setDataWiped(true);
    setBitlockerUnlocked(true);
    setTechnicalDiagnosis(
      "Matériel restitué à la DSI. Contrôle technique conforme, réinitialisation prête."
    );
    setActionTaken("Remise en stock disponible");
    setReturnNotes("");
  };

  const handleReassign = (assignment: MaterialAssignment) => {
    setCleIdempotenceAffectation(crypto.randomUUID());
    setReassignAfterId(assignment.id);
    setShowCreateModal(true);
    setFormBeneficiaryName("");
    setFormBeneficiaryEmail("");
    setFormBeneficiaryPhone("");
    setFormBeneficiaryCin("");
    setFormBeneficiaryJob("");
    setFormBeneficiaryDept("");
    setFormBeneficiarySite("");
    setFormAssignedDate(new Date().toISOString().split("T")[0]!);
    setSelectedItemIds([]);
    setSelectedStockItems([]);
    setFormNotes(`Réaffectation post-restitution de ${assignment.reference}`);
    setFormOperationType("RÉAFFECTATION");
  };

  const handleOuvrirImpression = async (assignment: MaterialAssignment) => {
    setSelectedAssignmentForPrint(assignment);
    try {
      const r = await apiFetch(
        `/api/assignments/${assignment.id}/confidentiels`
      );
      if (r.ok) {
        const p = await r.json();
        setSelectedAssignmentForPrint({
          ...assignment,
          simPin: p.data.simPin || undefined,
          simPuk: p.data.simPuk || undefined,
        });
      }
    } catch {
      // Révélation indisponible
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentForReturn) return;

    setLoadingAction(true);
    try {
      const allOriginalAccessories =
        selectedAssignmentForReturn.items.flatMap((i) => i.accessories || []);
      const missing = allOriginalAccessories.filter(
        (a) => !accessoriesReturned.includes(a)
      );

      const res = await apiFetch(
        `/api/assignments/${selectedAssignmentForReturn.id}/return`,
        {
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
            notes: returnNotes,
          }),
        }
      );

      if (res.ok) {
        const payload = await res.json();
        setSelectedAssignmentForReturn(null);
        onRefresh();
        if (payload.data?.assignment) {
          setSelectedAssignmentForReturnPrint(payload.data.assignment);
        }
      } else {
        const errData = await res.json();
        alert(
          errData.error || "Erreur lors de l'enregistrement de la restitution."
        );
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion.");
    } finally {
      setLoadingAction(false);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    const matchesSearch =
      a.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.beneficiaryDepartment
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (a.beneficiaryCin &&
        a.beneficiaryCin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      a.items.some(
        (i) =>
          i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          i.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    if (activeSubTab === "active")
      return matchesSearch && a.status === "Active";
    if (activeSubTab === "returned")
      return matchesSearch && a.status === "Restitué";
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <SummaryCards assignments={assignments} stockItems={stockItems} />

      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeSubTab={activeSubTab}
        onSubTabChange={setActiveSubTab}
        assignments={assignments}
        onCreateClick={ouvrirCreation}
      />

      <AssignmentsTable
        assignments={filteredAssignments}
        onViewPdf={handleOuvrirImpression}
        onReturn={handleOpenReturnModal}
        onViewReturnPdf={setSelectedAssignmentForReturnPrint}
        onReassign={handleReassign}
      />

      {/* MODAL 1 : CRÉATION D'UNE NOUVELLE AFFECTATION */}
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
                  <h3 className="text-base font-bold text-slate-900">
                    Nouvelle Fiche d'Affectation & Prise en Charge
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choisissez le modèle de décharge et renseignez les informations
                    officielles
                  </p>
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
                <span>
                  Décharge Carte SIM & Smartphone (Formulaire IT-02 - Distra)
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setAssignmentTemplateType("STANDARD_DSI_EQUIPMENT")
                }
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                  assignmentTemplateType === "STANDARD_DSI_EQUIPMENT"
                    ? "bg-white text-indigo-900 shadow-xs border border-indigo-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Affectation Matériel IT Standard (DSI)</span>
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <BeneficiarySection
                formBeneficiaryName={formBeneficiaryName}
                onNameChange={setFormBeneficiaryName}
                formBeneficiaryCin={formBeneficiaryCin}
                onCinChange={setFormBeneficiaryCin}
                formBeneficiaryJob={formBeneficiaryJob}
                onJobChange={setFormBeneficiaryJob}
                formBeneficiaryDept={formBeneficiaryDept}
                onDeptChange={setFormBeneficiaryDept}
                formBeneficiarySite={formBeneficiarySite}
                onSiteChange={setFormBeneficiarySite}
                formAssignedDate={formAssignedDate}
                onDateChange={setFormAssignedDate}
                users={users}
                onSelectUser={handleSelectPredefinedUser}
              />

              {/* Distra Template Sections */}
              {assignmentTemplateType === "DISTRA_SIM_SMARTPHONE" && (
                <div className="space-y-4">
                  <ResourceTypeSelector
                    selected={formResourceType}
                    onSelect={setFormResourceType}
                  />
                  {(formResourceType === "Carte SIM" ||
                    formResourceType === "Carte SIM + SmartPhone") && (
                    <SimDetailsSection
                      simOperator={formSimOperator}
                      onOperatorChange={setFormSimOperator}
                      simPhoneNumber={formSimPhoneNumber}
                      onPhoneNumberChange={setFormSimPhoneNumber}
                      simPuk={formSimPuk}
                      onPukChange={setFormSimPuk}
                      simPin={formSimPin}
                      onPinChange={setFormSimPin}
                    />
                  )}
                  {formResourceType !== "Carte SIM" && (
                    <SmartphoneDetailsSection
                      resourceType={formResourceType}
                      deviceBrand={formDeviceBrand}
                      onBrandChange={setFormDeviceBrand}
                      deviceImei={formDeviceImei}
                      onImeiChange={setFormDeviceImei}
                      deviceModel={formDeviceModel}
                      onModelChange={setFormDeviceModel}
                      deviceConfiguration={formDeviceConfiguration}
                      onConfigurationChange={setFormDeviceConfiguration}
                    />
                  )}
                  <OperationSection
                    operationType={formOperationType}
                    onOperationTypeChange={setFormOperationType}
                    restitutionPreviousDevice={formRestitutionPreviousDevice}
                    onRestitutionPreviousDeviceChange={
                      setFormRestitutionPreviousDevice
                    }
                    restitutedDeviceCondition={formRestitatedDeviceCondition}
                    onRestitutedDeviceConditionChange={
                      setFormRestitatedDeviceCondition
                    }
                  />
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Remarques / Motif particulier (Optionnel)
                    </label>
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

              {/* Standard IT Equipment Template */}
              {assignmentTemplateType === "STANDARD_DSI_EQUIPMENT" && (
                <div className="space-y-4">
                  <StockSelector
                    selectedItems={selectedStockItems}
                    selectedItemIds={selectedItemIds}
                    onToggleItem={toggleStockItemSelection}
                    onRemoveItem={removeStockItem}
                    onClearAll={() => {
                      setSelectedItemIds([]);
                      setSelectedStockItems([]);
                    }}
                    itemConditionMap={itemConditionMap}
                    onSetCondition={setItemCondition}
                    itemAccessoriesMap={itemAccessoriesMap}
                    onToggleAccessory={toggleAccessory}
                  />

                  {/* Operation + complements */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal
                        size={13}
                        className="text-indigo-600"
                      />{" "}
                      Options de la Fiche IT-01
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Date d'Acquisition Matériel
                        </label>
                        <input
                          type="date"
                          value={formEquipmentAcquisitionDate}
                          onChange={(e) =>
                            setFormEquipmentAcquisitionDate(e.target.value)
                          }
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Type d'opération
                        </label>
                        <div className="flex gap-2">
                          {(["AFFECTATION", "RÉAFFECTATION"] as OperationType[]).map(
                            (op) => (
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
                                {formOperationType === op ? (
                                  <CheckSquare size={13} />
                                ) : (
                                  <Square size={13} />
                                )}
                                <span>{op}</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Compléments Fournis (Case à cocher sur la fiche) :
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          {
                            label: "Clavier",
                            value: formHasKeyboard,
                            setter: setFormHasKeyboard,
                          },
                          {
                            label: "Souris",
                            value: formHasMouse,
                            setter: setFormHasMouse,
                          },
                          {
                            label: "Adaptateur USB/RJ45",
                            value: formHasUsbAdapter,
                            setter: setFormHasUsbAdapter,
                          },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => item.setter(!item.value)}
                            className={`py-2 px-3 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                              item.value
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            {item.value ? (
                              <CheckSquare size={13} />
                            ) : (
                              <Square size={13} />
                            )}
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Notes Complémentaires
                </label>
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
                  disabled={loadingAction || !formBeneficiaryName}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <FileCheck2 size={14} />
                  {reassignAfterId ? "Réaffecter" : "Générer & Afficher la Fiche"}
                </button>
              </div>
            </form>

            {/* Confirmation summary overlay */}
            {showConfirmSummary && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-10 rounded-2xl flex flex-col p-6 overflow-y-auto">
                <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <FileCheck2 size={16} className="text-indigo-600" />
                  Récapitulatif avant soumission
                </h4>

                <div className="space-y-3 text-xs flex-1">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Bénéficiaire</span>
                    <p className="text-slate-900 font-semibold mt-0.5">{formBeneficiaryName || "—"}</p>
                    <p className="text-slate-500">{formBeneficiaryDept || "—"} · {formBeneficiarySite || "—"}</p>
                  </div>

                  {assignmentTemplateType === "DISTRA_SIM_SMARTPHONE" && (
                    <>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Type de ressource</span>
                        <p className="text-slate-900 font-semibold mt-0.5">{formResourceType || "—"}</p>
                      </div>
                      {formResourceType !== "Carte SIM" && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Smartphone</span>
                          <p className="text-slate-900 font-semibold mt-0.5">
                            {formDeviceBrand || "—"} {formDeviceModel || "—"}
                          </p>
                          {formDeviceImei && (
                            <p className="text-slate-500">IMEI: {formDeviceImei}</p>
                          )}
                        </div>
                      )}
                      {formResourceType !== "SmartPhone" && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Carte SIM</span>
                          <p className="text-slate-900 font-semibold mt-0.5">
                            {formSimOperator || "—"} · {formSimPhoneNumber || "—"}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {assignmentTemplateType === "STANDARD_DSI_EQUIPMENT" && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Équipements sélectionnés</span>
                      {selectedStockItems.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {selectedStockItems.map((item) => (
                            <li key={item.id} className="text-slate-700 font-medium">
                              {item.name} — {item.serialNumber || item.assetTag || item.id}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-400 italic">Aucun équipement sélectionné</p>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 grid grid-cols-2 gap-3">
                    <div>
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Opération</span>
                      <p className="text-slate-900 font-semibold mt-0.5">{formOperationType || "—"}</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Date</span>
                      <p className="text-slate-900 font-semibold mt-0.5">{formAssignedDate || "—"}</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Émetteur DSI</span>
                      <p className="text-slate-900 font-semibold mt-0.5">{formAuthorizedBy || "—"}</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Entité</span>
                      <p className="text-slate-900 font-semibold mt-0.5">{formDsiTitle || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowConfirmSummary(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSubmitAssignment}
                    disabled={loadingAction}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <FileCheck2 size={14} />
                    Confirmer l'affectation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2 : RESTITUTION */}
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
                  <h3 className="text-base font-bold text-slate-900">
                    Procédure de Restitution & Décharge de Matériel
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fiche {selectedAssignmentForReturn.reference} • Bénéficiaire :{" "}
                    <strong>{selectedAssignmentForReturn.beneficiaryName}</strong>
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
              {/* Items to return */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Équipements à Restituer :
                </span>
                <div className="space-y-1.5">
                  {selectedAssignmentForReturn.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileCheck2 size={14} className="text-indigo-600" />
                        <div>
                          <strong className="text-slate-900">{it.name}</strong>
                          <div className="text-[10px] text-slate-500 font-mono">
                            SN: {it.serialNumber} • Asset: {it.assetTag}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        Initial : {it.condition}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date & Cause */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Date de Restitution Réelle *
                  </label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Motif / Cause de Retour *
                  </label>
                  <select
                    value={returnCause}
                    onChange={(e) =>
                      setReturnCause(e.target.value as ReturnCause)
                    }
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
                  >
                    <option value="Départ collaborateur (Fin de contrat / Démission)">
                      Départ collaborateur (Fin de contrat / Démission)
                    </option>
                    <option value="Renouvellement matériel / Upgrade">
                      Renouvellement matériel / Upgrade
                    </option>
                    <option value="Matériel défectueux / En panne">
                      Matériel défectueux / En panne
                    </option>
                    <option value="Changement de poste / Mutation interne">
                      Changement de poste / Mutation interne
                    </option>
                    <option value="Fin de mission / Projet temporaire">
                      Fin de mission / Projet temporaire
                    </option>
                    <option value="Autre motif">Autre motif</option>
                  </select>
                </div>
              </div>

              {/* Equipment condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    État Physique & Fonctionnel Constaté *
                  </label>
                  <select
                    value={equipmentCondition}
                    onChange={(e) =>
                      setEquipmentCondition(
                        e.target.value as EquipmentReturnCondition
                      )
                    }
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold text-slate-800"
                  >
                    <option value="Bon état">Bon état</option>
                    <option value="Endommagé">Endommagé</option>
                    <option value="Maintenance requise">Maintenance requise</option>
                    <option value="Hors service">Hors service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Action Technique Décidée (DSI) *
                  </label>
                  <select
                    value={actionTaken}
                    onChange={(e) =>
                      setActionTaken(
                        e.target.value as MaterialReturnRecord["actionTaken"]
                      )
                    }
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold text-indigo-700"
                  >
                    <option value="Remise en stock disponible">
                      Remise en stock disponible (Prêt pour dotation)
                    </option>
                    <option value="Envoi en maintenance / SAV">
                      Envoi en maintenance / SAV Réparation
                    </option>
                    <option value="Mise au rebut">
                      Mise au rebut / Déclassement définitif
                    </option>
                  </select>
                </div>
              </div>

              {/* Accessories */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Contrôle des Accessoires Remis :
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Chargeur secteur d'origine",
                    "Câble d'alimentation",
                    "Sacoche de transport",
                    "Souris sans fil",
                    "Adaptateur / Hub USB-C",
                    "Câble HDMI 4K",
                    "Cadenas de sécurité",
                  ].map((acc, i) => {
                    const isChecked = accessoriesReturned.includes(acc);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setAccessoriesReturned((prev) =>
                              prev.filter((a) => a !== acc)
                            );
                          } else {
                            setAccessoriesReturned((prev) => [...prev, acc]);
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-md border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                          isChecked
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                            : "bg-white text-slate-400 border-slate-200 line-through"
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare size={12} className="text-emerald-600" />
                        ) : (
                          <Square size={12} />
                        )}
                        {acc}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security checklist */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
                  <CheckSquare size={13} className="text-indigo-600" />{" "}
                  Checklist Sécurité & Conformité Informatique
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border border-indigo-100">
                    <input
                      type="checkbox"
                      checked={dataWiped}
                      onChange={(e) => setDataWiped(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-slate-800 font-semibold">
                      Données effacées / Reset Usine
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border border-indigo-100">
                    <input
                      type="checkbox"
                      checked={bitlockerUnlocked}
                      onChange={(e) => setBitlockerUnlocked(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-slate-800 font-semibold">
                      Comptes & BitLocker déconnectés
                    </span>
                  </label>
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Diagnostic Technique & Remarques DSI
                </label>
                <textarea
                  rows={2}
                  value={technicalDiagnosis}
                  onChange={(e) => setTechnicalDiagnosis(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Inspected by */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Inspecté et Validé par
                </label>
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

      {/* MODAL 3 : fiche d'affectation imprimable */}
      {selectedAssignmentForPrint && (
        <FicheImpressionAffectation
          assignment={selectedAssignmentForPrint}
          onFermer={() => setSelectedAssignmentForPrint(null)}
        />
      )}

      {/* MODAL 4 : décharge & restitution imprimable */}
      {selectedAssignmentForReturnPrint &&
        selectedAssignmentForReturnPrint.returnRecord && (
          <FicheImpressionRestitution
            assignment={selectedAssignmentForReturnPrint}
            onFermer={() => setSelectedAssignmentForReturnPrint(null)}
          />
        )}
    </div>
  );
}
