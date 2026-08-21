export interface POItem {
  desc: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  title: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  category: string;
  department: string;
  requester: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Fulfilled" | "Declined" | "Cancelled";
  createdDate: string;
  deliveryDate: string;
  items: POItem[];
  auditScore: number;
  notes: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  email: string;
  category: string;
  qualityScore: number;
  onTimeDelivery: number;
  activeContracts: number;
  totalSpend: number;
  riskLevel: "Low" | "Medium" | "High";
  status: "Preferred" | "Approved" | "On Probation";
}

export interface Budget {
  name: string;
  allocated: number;
  spent: number;
}

export interface Bid {
  id: string;
  vendorName: string;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number;
  warrantyYears: number;
  complianceLevel: string;
  riskFlags: string[];
  notes: string;
}

export interface RFQComparisonCase {
  id: string;
  title: string;
  department: string;
  targetBudget: number;
  itemsRequired: string;
  bids: Bid[];
}

export interface AICopilotResult {
  recommendedVendor: string;
  recommendationReasoning: string;
  supplierComparison: {
    vendorName: string;
    pros: string;
    cons: string;
  }[];
  riskAssessment: {
    riskTitle: string;
    severity: "Low" | "Medium" | "High";
    riskExplanation: string;
  }[];
  negotiationPlaybook: string[];
}

export type UserRole = "ADMIN" | "PROCUREMENT_MANAGER" | "BUYER" | "AUDITOR";

export interface UserPermissions {
  canCreatePO: boolean;
  canApprovePO: boolean;
  canManageVendors: boolean;
  canEvaluateBids: boolean;
  canGenerateContracts: boolean;
  canManageUsers: boolean;
  canViewBudgets: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  jobTitle: string;
  role: UserRole;
  status: "Actif" | "Inactif" | "Suspendu";
  spendingLimitMAD: number; // 0 means no limit or strictly no approval right
  permissions: UserPermissions;
  avatarUrl?: string;
  createdAt: string;
  lastLogin?: string;
}

export type StockCategory = 
  | "Laptops & Portables"
  | "Postes Fixes & Écrans"
  | "Serveurs & Stockage"
  | "Réseau & Sécurité"
  | "Périphériques & Accessoires"
  | "Consommables & Pièces"
  | "Licences & Logiciels";

export type StockStatus = 
  | "En Stock"
  | "Affecté"
  | "En Commande"
  | "En Maintenance"
  | "Rebut / Fin de vie";

export interface StockAssignment {
  userId?: string;
  userName: string;
  department: string;
  assignedDate: string;
}

export interface ITStockItem {
  id: string;
  assetTag: string;
  name: string;
  category: StockCategory;
  brand: string;
  model: string;
  serialNumber: string;
  specs?: {
    cpu?: string;
    ram?: string;
    storage?: string;
    os?: string;
  };
  quantity: number;
  availableQty: number;
  allocatedQty: number;
  minThreshold: number;
  unitPriceMAD: number;
  totalValueMAD: number;
  location: string;
  status: StockStatus;
  purchaseOrderId?: string;
  purchaseOrderTitle?: string;
  vendorName?: string;
  purchaseDate?: string;
  assignedTo?: StockAssignment;
  warrantyExpiry?: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  itemName: string;
  type: "Entrée Achat" | "Sortie Affectation" | "Retour Stock" | "Ajustement Inventaire" | "Mise au Rebut";
  quantity: number;
  performedBy: string;
  recipient?: string;
  department?: string;
  date: string;
  purchaseOrderId?: string;
  notes?: string;
}

export interface AssignedItemDetail {
  stockItemId: string;
  assetTag: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  category: StockCategory;
  specs?: {
    cpu?: string;
    ram?: string;
    storage?: string;
    os?: string;
  };
  condition: "Neuf / Excellent état" | "Très bon état" | "Bon état";
  accessories: string[];
}

export type ReturnCause =
  | "Départ collaborateur (Fin de contrat / Démission)"
  | "Renouvellement matériel / Upgrade"
  | "Matériel défectueux / En panne"
  | "Changement de poste / Mutation interne"
  | "Fin de mission / Projet temporaire"
  | "Autre motif";

export type EquipmentReturnCondition =
  | "Parfait état / Comme neuf"
  | "Bon état d'usage"
  | "Rayures / Usure légère"
  | "Endommagé / Réparation requise"
  | "Hors service / Rebut";

export interface MaterialReturnRecord {
  id: string;
  assignmentId: string;
  returnDate: string;
  cause: ReturnCause;
  customCause?: string;
  equipmentCondition: EquipmentReturnCondition;
  accessoriesReturned: string[];
  missingAccessories: string[];
  dataWiped: boolean;
  bitlockerUnlocked: boolean;
  technicalDiagnosis?: string;
  actionTaken: "Remise en stock disponible" | "Envoi en maintenance / SAV" | "Mise au rebut";
  inspectedBy: string;
  notes?: string;
}

export type TelecomOperator = "IAM" | "INWI" | "ORANGE" | "AUTRE";
export type AssignedResourceType = "Carte SIM" | "SmartPhone" | "PC / Laptop" | "Autre matériel IT" | "Carte SIM + SmartPhone" | "Matériel Informatique IT";
export type AssignmentOperationType = "AFFECTATION" | "RÉAFFECTATION";
export type OperationType = AssignmentOperationType;
export type RestitutedDeviceCondition = "Endommagé" | "Cassé mais opérationnel" | "Bon état" | "Non applicable";

export interface MaterialAssignment {
  id: string;
  reference: string;
  templateType?: "DISTRA_IT_EQUIPMENT" | "DISTRA_SIM_SMARTPHONE" | "STANDARD_DSI_EQUIPMENT";
  formCode?: string; // e.g. "IT-01", "IT-02"
  beneficiaryName: string;
  beneficiaryEmail: string;
  beneficiaryPhone: string;
  beneficiaryCin: string;
  beneficiaryJobTitle: string;
  beneficiaryDepartment: string;
  beneficiarySite?: string; // e.g. "Berrechid", "Casablanca Siège", etc.
  assignedDate: string;
  status: "Active" | "Restitué" | "Restitution Partielle";
  authorizedBy: string;
  dsiTitle: string;
  
  // Specific Distra PC / IT Equipment Form fields (Matching image.png)
  equipmentType?: string; // e.g. "Ordinateur / PC"
  equipmentCpu?: string; // e.g. "Intel i7"
  equipmentRam?: string; // e.g. "8" (GB)
  equipmentStorage?: string; // e.g. "256" (GB SSD)
  equipmentAcquisitionDate?: string; // e.g. "06/12/2021"
  hasKeyboard?: boolean; // Clavier
  hasMouse?: boolean; // Souris
  hasUsbAdapter?: boolean; // Adaptateur USB/RJ45

  // Specific Distra SIM & Smartphone Form fields
  resourceType?: AssignedResourceType;
  hasSimCard?: boolean;
  simOperator?: TelecomOperator;
  simPhoneNumber?: string;
  simPuk?: string;
  simPin?: string;
  
  hasSmartphone?: boolean;
  deviceBrand?: string;
  deviceImei?: string;
  deviceModel?: string;
  deviceConfiguration?: string;
  
  operationType?: AssignmentOperationType;
  restitutionPreviousDevice?: "OUI" | "NON";
  restitutedDeviceCondition?: RestitutedDeviceCondition;
  incidentRemarks?: string;

  items: AssignedItemDetail[];
  termsAccepted: boolean;
  notes?: string;
  returnRecord?: MaterialReturnRecord;
}

