import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini Client to prevent server startup crashes if key is initially absent
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "") {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("Gemini AI Client initialized successfully.");
    } else {
      console.warn("GEMINI_API_KEY is not defined. Falling back to rule-based procurement advisory.");
    }
  }
  return aiClient;
}

// In-Memory Database State
const state = {
  vendors: [
    {
      id: "v-1",
      name: "Apex Tech & Logistique Maroc",
      contact: "Sarah Benali",
      email: "contact@apextech.ma",
      category: "Équipements Informatiques",
      qualityScore: 94,
      onTimeDelivery: 96,
      activeContracts: 2,
      totalSpend: 78500,
      riskLevel: "Low",
      status: "Preferred",
    },
    {
      id: "v-2",
      name: "BlueSky Fournitures & Bureau",
      contact: "Youssef El Amrani",
      email: "commandes@bluesky.ma",
      category: "Fournitures de Bureau",
      qualityScore: 88,
      onTimeDelivery: 91,
      activeContracts: 1,
      totalSpend: 14200,
      riskLevel: "Low",
      status: "Approved",
    },
    {
      id: "v-3",
      name: "Vanguard Cybersécurité Maroc",
      contact: "Driss Tazi",
      email: "projets@vanguardcyber.ma",
      category: "Cybersécurité & Réseaux",
      qualityScore: 98,
      onTimeDelivery: 99,
      activeContracts: 3,
      totalSpend: 185000,
      riskLevel: "Low",
      status: "Preferred",
    },
    {
      id: "v-4",
      name: "Vertex Conseil & Solutions",
      contact: "Kenza Mansouri",
      email: "contrats@vertexconseil.ma",
      category: "Services & Conseil",
      qualityScore: 82,
      onTimeDelivery: 85,
      activeContracts: 1,
      totalSpend: 45000,
      riskLevel: "Medium",
      status: "Approved",
    },
    {
      id: "v-5",
      name: "Summit Transport & Logistique",
      contact: "Mehdi Alami",
      email: "operations@summitlog.ma",
      category: "Transport & Logistique",
      qualityScore: 71,
      onTimeDelivery: 74,
      activeContracts: 0,
      totalSpend: 18900,
      riskLevel: "High",
      status: "On Probation",
    }
  ],
  purchaseOrders: [
    {
      id: "DA-2026-001",
      title: "Mise à niveau Antivirus Entreprise & Pare-feu Cloud",
      vendorId: "v-3",
      vendorName: "Vanguard Cybersécurité Maroc",
      amount: 45000,
      category: "Cybersécurité & Réseaux",
      department: "Technologies de l'Information",
      requester: "Zakaria Radouane (DSI)",
      status: "Approved",
      createdDate: "2026-05-15",
      deliveryDate: "2026-06-25",
      items: [
        { desc: "Licences postes clients Pare-feu Endpoint (Qté 1500)", qty: 1500, unitPrice: 20, total: 30000 },
        { desc: "Passerelle Cloud Zero-Trust (Annuelle)", qty: 1, unitPrice: 15000, total: 15000 }
      ],
      auditScore: 95,
      notes: "Tarif négocié avec remise cadre entreprise appliquée."
    },
    {
      id: "DA-2026-002",
      title: "Mobilier Ergonomique & Équipements de Travail",
      vendorId: "v-2",
      vendorName: "BlueSky Fournitures & Bureau",
      amount: 12500,
      category: "Fournitures de Bureau",
      department: "Ressources Humaines & Moyens Généraux",
      requester: "Maya Lin (Dir. RH)",
      status: "Pending Approval",
      createdDate: "2026-06-02",
      deliveryDate: "2026-07-10",
      items: [
        { desc: "Bureaux assis-debout ergonomiques - Modèle Pro", qty: 15, unitPrice: 500, total: 7500 },
        { desc: "Chaises de bureau ergonomiques avec soutien lombaire", qty: 25, unitPrice: 200, total: 5000 }
      ],
      auditScore: 85,
      notes: "En attente de signature d'approbation budgétaire finale."
    },
    {
      id: "DA-2026-003",
      title: "Renouvellement Parc Ordinateurs Portables (Équipe Commerciale)",
      vendorId: "v-1",
      vendorName: "Apex Tech & Logistique Maroc",
      amount: 28200,
      category: "Équipements Informatiques",
      department: "Ventes & Marketing",
      requester: "Karim Berrada (Dir. Commercial)",
      status: "Pending Approval",
      createdDate: "2026-06-08",
      deliveryDate: "2026-06-30",
      items: [
        { desc: "Ultraportable Pro 14\" (Intel Ultra 7 / 32Go / 1To SSD)", qty: 20, unitPrice: 1350, total: 27000 },
        { desc: "Hubs stations d'accueil Multi-ports USB-C", qty: 20, unitPrice: 60, total: 1200 }
      ],
      auditScore: 92,
      notes: "Option de livraison express confirmée sans surcoût transporteur."
    },
    {
      id: "DA-2026-004",
      title: "Audit & Optimisation Architecture Cloud Multi-Région",
      vendorId: "v-4",
      vendorName: "Vertex Conseil & Solutions",
      amount: 45000,
      category: "Services & Conseil",
      department: "Technologies de l'Information",
      requester: "Zakaria Radouane (DSI)",
      status: "Fulfilled",
      createdDate: "2026-04-10",
      deliveryDate: "2026-05-20",
      items: [
        { desc: "Prestation d'audit et optimisation Cloud entreprise", qty: 1, unitPrice: 45000, total: 45000 }
      ],
      auditScore: 78,
      notes: "Mission réalisée avec succès. Rapport de conformité validé."
    },
    {
      id: "DA-2026-005",
      title: "Maintenance & Révision Flotte Véhicules T3",
      vendorId: "v-5",
      vendorName: "Summit Transport & Logistique",
      amount: 8900,
      category: "Transport & Logistique",
      department: "Chaîne Logistique & Approvisionnements",
      requester: "Mehdi Alami (Responsable Flotte)",
      status: "Draft",
      createdDate: "2026-06-10",
      deliveryDate: "2026-07-20",
      items: [
        { desc: "Contrôle technique et révision pièces d'usure", qty: 1, unitPrice: 8900, total: 8900 }
      ],
      auditScore: 60,
      notes: "Dossier en phase de brouillon pour réévaluation des garanties contractuelles."
    }
  ],
  budgets: [
    { name: "Technologies de l'Information", allocated: 250000, spent: 90000 },
    { name: "Ressources Humaines & Moyens Généraux", allocated: 60000, spent: 12500 },
    { name: "Ventes & Marketing", allocated: 100000, spent: 28200 },
    { name: "Chaîne Logistique & Approvisionnements", allocated: 120000, spent: 8900 }
  ],
  rfqComparisonPools: [
    {
      id: "rfq-1",
      title: "Mise à niveau Baies de Stockage & Serveurs Haute Disponibilité",
      department: "Technologies de l'Information",
      targetBudget: 60000,
      itemsRequired: "3x Nœuds SAN redondants et baies de stockage haute performance",
      bids: [
        {
          id: "bid-1-1",
          vendorName: "Apex Tech & Logistique Maroc",
          unitPrice: 17500,
          totalPrice: 52500,
          leadTimeDays: 14,
          warrantyYears: 3,
          complianceLevel: "95%",
          riskFlags: [],
          notes: "Calendrier de livraison standard. SLA extensible sur 3 ans."
        },
        {
          id: "bid-1-2",
          vendorName: "Vanguard Cybersécurité Maroc",
          unitPrice: 19800,
          totalPrice: 59400,
          leadTimeDays: 7,
          warrantyYears: 5,
          complianceLevel: "100%",
          riskFlags: [],
          notes: "Composants chiffrés certifiés. Support technique prioritaire sous 24h."
        },
        {
          id: "bid-1-3",
          vendorName: "Summit Transport & Logistique",
          unitPrice: 12000,
          totalPrice: 36000,
          leadTimeDays: 45,
          warrantyYears: 1,
          complianceLevel: "70%",
          riskFlags: ["Délai de livraison excessif", "Garantie limitée à 1 an", "Spécifications techniques partielles"],
          notes: "Approvisionnement international. Risque de retard douanier."
        }
      ]
    },
    {
      id: "rfq-2",
      title: "Rénovation Éclairage LED Éco-Énergétique & Domotique Siège",
      department: "Ressources Humaines & Moyens Généraux",
      targetBudget: 25000,
      itemsRequired: "Luminaires LED basse consommation & capteurs intelligents",
      bids: [
        {
          id: "bid-2-1",
          vendorName: "BlueSky Fournitures & Bureau",
          unitPrice: 22000,
          totalPrice: 22000,
          leadTimeDays: 10,
          warrantyYears: 2,
          complianceLevel: "90%",
          riskFlags: [],
          notes: "Matériel certifié basse consommation. Recyclage de l'ancien parc inclus."
        },
        {
          id: "bid-2-2",
          vendorName: "Summit Transport & Logistique",
          unitPrice: 17000,
          totalPrice: 17000,
          leadTimeDays: 30,
          warrantyYears: 1,
          complianceLevel: "75%",
          riskFlags: ["Sous-traitance de la main d'œuvre", "Garantie réduite"],
          notes: "Intervention réalisée par équipe sous-traitante."
        }
      ]
    }
  ],
  users: [
    {
      id: "usr-1",
      name: "Zakaria Radouane",
      email: "zakariaradouane61@gmail.com",
      phone: "+212 6 61 23 45 67",
      department: "Technologies de l'Information",
      jobTitle: "Directeur des Systèmes d'Information (DSI)",
      role: "ADMIN",
      status: "Actif",
      spendingLimitMAD: 1000000,
      permissions: {
        canCreatePO: true,
        canApprovePO: true,
        canManageVendors: true,
        canEvaluateBids: true,
        canGenerateContracts: true,
        canManageUsers: true,
        canViewBudgets: true
      },
      avatarUrl: "",
      createdAt: "2026-01-10",
      lastLogin: "2026-08-18 13:40"
    },
    {
      id: "usr-2",
      name: "Maya Lin",
      email: "maya.lin@entreprise.ma",
      phone: "+212 6 62 34 56 78",
      department: "Ressources Humaines & Moyens Généraux",
      jobTitle: "Directrice des Achats & Moyens Généraux",
      role: "PROCUREMENT_MANAGER",
      status: "Actif",
      spendingLimitMAD: 300000,
      permissions: {
        canCreatePO: true,
        canApprovePO: true,
        canManageVendors: true,
        canEvaluateBids: true,
        canGenerateContracts: true,
        canManageUsers: false,
        canViewBudgets: true
      },
      avatarUrl: "",
      createdAt: "2026-02-01",
      lastLogin: "2026-08-18 11:15"
    },
    {
      id: "usr-3",
      name: "Karim Berrada",
      email: "karim.berrada@entreprise.ma",
      phone: "+212 6 63 45 67 89",
      department: "Ventes & Marketing",
      jobTitle: "Acheteur Senior & Commercial",
      role: "BUYER",
      status: "Actif",
      spendingLimitMAD: 50000,
      permissions: {
        canCreatePO: true,
        canApprovePO: false,
        canManageVendors: false,
        canEvaluateBids: true,
        canGenerateContracts: false,
        canManageUsers: false,
        canViewBudgets: true
      },
      avatarUrl: "",
      createdAt: "2026-03-15",
      lastLogin: "2026-08-17 16:30"
    },
    {
      id: "usr-4",
      name: "Sarah Benali",
      email: "sarah.benali@entreprise.ma",
      phone: "+212 6 64 56 78 90",
      department: "Direction Générale & Finance",
      jobTitle: "Contrôleur Financier & Auditeur Interne",
      role: "AUDITOR",
      status: "Actif",
      spendingLimitMAD: 0,
      permissions: {
        canCreatePO: false,
        canApprovePO: false,
        canManageVendors: false,
        canEvaluateBids: false,
        canGenerateContracts: false,
        canManageUsers: false,
        canViewBudgets: true
      },
      avatarUrl: "",
      createdAt: "2026-03-20",
      lastLogin: "2026-08-18 09:05"
    },
    {
      id: "usr-5",
      name: "Mehdi Alami",
      email: "mehdi.alami@entreprise.ma",
      phone: "+212 6 65 67 89 01",
      department: "Chaîne Logistique & Approvisionnements",
      jobTitle: "Responsable Approvisionnements & Flotte",
      role: "BUYER",
      status: "Inactif",
      spendingLimitMAD: 30000,
      permissions: {
        canCreatePO: true,
        canApprovePO: false,
        canManageVendors: false,
        canEvaluateBids: false,
        canGenerateContracts: false,
        canManageUsers: false,
        canViewBudgets: true
      },
      avatarUrl: "",
      createdAt: "2026-04-10",
      lastLogin: "2026-07-25 14:20"
    }
  ],
  stockItems: [
    {
      id: "STK-001",
      assetTag: "IT-LAP-1001",
      name: "Dell Latitude 5540 i7 13th Gen (32GB / 1TB SSD)",
      category: "Laptops & Portables",
      brand: "Dell",
      model: "Latitude 5540",
      serialNumber: "5CD2389KL1",
      quantity: 15,
      availableQty: 9,
      allocatedQty: 6,
      minThreshold: 5,
      unitPriceMAD: 14500,
      totalValueMAD: 217500,
      location: "Magasin Central IT (Casablanca)",
      status: "En Stock",
      purchaseOrderId: "DA-2026-001",
      purchaseOrderTitle: "Renouvellement Postes de Travail & Écrans",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: "2026-05-15",
      warrantyExpiry: "2029-05-15",
      assignedTo: {
        userName: "Karim Berrada",
        department: "Ventes & Marketing",
        assignedDate: "2026-06-01"
      },
      notes: "Postes standards ingénieurs et managers."
    },
    {
      id: "STK-002",
      assetTag: "IT-LAP-1002",
      name: "Lenovo ThinkPad T14s Gen 4 (AMD Ryzen 7 PRO / 32GB)",
      category: "Laptops & Portables",
      brand: "Lenovo",
      model: "ThinkPad T14s",
      serialNumber: "PF389201A",
      quantity: 8,
      availableQty: 2,
      allocatedQty: 6,
      minThreshold: 3,
      unitPriceMAD: 13800,
      totalValueMAD: 110400,
      location: "Magasin Central IT (Casablanca)",
      status: "En Stock",
      purchaseOrderId: "DA-2026-001",
      purchaseOrderTitle: "Renouvellement Postes de Travail & Écrans",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: "2026-05-15",
      warrantyExpiry: "2029-05-15",
      assignedTo: {
        userName: "Sarah Bennani",
        department: "Ressources Humaines & Moyens Généraux",
        assignedDate: "2026-06-03"
      },
      notes: "Ultraportable haute autonomie."
    },
    {
      id: "STK-003",
      assetTag: "IT-MON-2001",
      name: "Écran Dell UltraSharp 27\" 4K USB-C Hub (U2723QE)",
      category: "Postes Fixes & Écrans",
      brand: "Dell",
      model: "UltraSharp U2723QE",
      serialNumber: "CN0K89201L",
      quantity: 25,
      availableQty: 12,
      allocatedQty: 13,
      minThreshold: 8,
      unitPriceMAD: 4800,
      totalValueMAD: 120000,
      location: "Stock IT Étage 3",
      status: "En Stock",
      purchaseOrderId: "DA-2026-001",
      purchaseOrderTitle: "Renouvellement Postes de Travail & Écrans",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: "2026-05-15",
      warrantyExpiry: "2029-05-15",
      notes: "Avec alimentation 90W USB-C PD et port Ethernet RJ45 intégré."
    },
    {
      id: "STK-004",
      assetTag: "IT-SRV-3001",
      name: "Serveur Dell PowerEdge R760 2U (2x Xeon Gold 6430 / 128GB)",
      category: "Serveurs & Stockage",
      brand: "Dell",
      model: "PowerEdge R760",
      serialNumber: "SRV-R760-9018",
      quantity: 3,
      availableQty: 1,
      allocatedQty: 2,
      minThreshold: 1,
      unitPriceMAD: 78000,
      totalValueMAD: 234000,
      location: "Salle Serveurs Datacenter (Baie B2)",
      status: "En Stock",
      purchaseOrderId: "DA-2026-004",
      purchaseOrderTitle: "Mise à niveau Serveurs & Datacenter",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: "2026-04-20",
      warrantyExpiry: "2031-04-20",
      notes: "Cluster virtualisation VMware / Proxmox."
    },
    {
      id: "STK-005",
      assetTag: "IT-NET-4001",
      name: "Switch Cisco Catalyst 9300 48 Ports PoE+ (C9300-48P)",
      category: "Réseau & Sécurité",
      brand: "Cisco",
      model: "Catalyst 9300",
      serialNumber: "FCW2248L01K",
      quantity: 4,
      availableQty: 1,
      allocatedQty: 3,
      minThreshold: 2,
      unitPriceMAD: 24500,
      totalValueMAD: 98000,
      location: "Local Technique Réseau",
      status: "En Stock",
      purchaseOrderId: "DA-2026-002",
      purchaseOrderTitle: "Équipements Réseau & Câblage",
      vendorName: "Vanguard Cybersécurité Maroc",
      purchaseDate: "2026-05-02",
      warrantyExpiry: "2029-05-02",
      notes: "Commutateur de cœur de réseau PoE+ pour bornes WiFi 6."
    },
    {
      id: "STK-006",
      assetTag: "IT-ACC-5001",
      name: "Docking Station USB-C Multi-Display 100W",
      category: "Périphériques & Accessoires",
      brand: "HP",
      model: "USB-C G5 Dock",
      serialNumber: "5CD109283",
      quantity: 30,
      availableQty: 14,
      allocatedQty: 16,
      minThreshold: 10,
      unitPriceMAD: 1200,
      totalValueMAD: 36000,
      location: "Magasin Central IT (Casablanca)",
      status: "En Stock",
      purchaseOrderId: "DA-2026-003",
      purchaseOrderTitle: "Équipements Informatiques Ventes",
      vendorName: "Apex Tech & Logistique Maroc",
      purchaseDate: "2026-06-08",
      warrantyExpiry: "2028-06-08",
      notes: "Stations d'accueil universelles double affichage HDMI/DP."
    },
    {
      id: "STK-007",
      assetTag: "IT-CON-6001",
      name: "Cartouche Toner Noir HP LaserJet Enterprise (W9004MC)",
      category: "Consommables & Pièces",
      brand: "HP",
      model: "W9004MC",
      serialNumber: "LOT-HP-202604",
      quantity: 4,
      availableQty: 4,
      allocatedQty: 0,
      minThreshold: 6, // Below threshold -> critical stock alert
      unitPriceMAD: 850,
      totalValueMAD: 3400,
      location: "Réserve Consommables",
      status: "En Stock",
      purchaseOrderId: "DA-2026-001",
      purchaseOrderTitle: "Fournitures et consommables",
      vendorName: "BlueSky Fournitures & Bureau",
      purchaseDate: "2026-05-20",
      notes: "Stock critique : seuil minimal de 6 unités requis."
    }
  ],
  stockMovements: [
    {
      id: "MVT-001",
      stockItemId: "STK-001",
      itemName: "Dell Latitude 5540 i7 13th Gen",
      type: "Entrée Achat",
      quantity: 15,
      performedBy: "Zakaria Radouane (DSI)",
      date: "2026-05-15",
      purchaseOrderId: "DA-2026-001",
      notes: "Réception de commande fournisseur Apex Tech."
    },
    {
      id: "MVT-002",
      stockItemId: "STK-001",
      itemName: "Dell Latitude 5540 i7 13th Gen",
      type: "Sortie Affectation",
      quantity: 1,
      performedBy: "Zakaria Radouane (DSI)",
      recipient: "Karim Berrada",
      department: "Ventes & Marketing",
      date: "2026-06-01",
      notes: "Dotation matériel nouveau collaborateur."
    },
    {
      id: "MVT-003",
      stockItemId: "STK-002",
      itemName: "Lenovo ThinkPad T14s Gen 4",
      type: "Sortie Affectation",
      quantity: 1,
      performedBy: "Maya Lin",
      recipient: "Sarah Bennani",
      department: "Ressources Humaines & Moyens Généraux",
      date: "2026-06-03",
      notes: "Mise à disposition PC portable RH."
    },
    {
      id: "MVT-004",
      stockItemId: "STK-007",
      itemName: "Cartouche Toner Noir HP LaserJet Enterprise",
      type: "Entrée Achat",
      quantity: 4,
      performedBy: "Zakaria Radouane",
      date: "2026-05-20",
      purchaseOrderId: "DA-2026-001",
      notes: "Réception partielle commande consommables."
    }
  ],
  assignments: [
    {
      id: "AFF-2026-001",
      reference: "AFF-DSI-2026-001",
      templateType: "DISTRA_SIM_SMARTPHONE",
      formCode: "IT-02",
      beneficiaryName: "Abdelhak Elfissi",
      beneficiaryEmail: "a.elfissi@distra.ma",
      beneficiaryPhone: "+212 6 61 88 12 34",
      beneficiaryCin: "BH554210",
      beneficiaryJobTitle: "Responsable Commercial",
      beneficiaryDepartment: "BU - Comm",
      beneficiarySite: "Berrechid",
      assignedDate: "2026-08-15",
      status: "Active",
      authorizedBy: "Directeur Systèmes d'Information",
      dsiTitle: "Département Systèmes D'Information",
      resourceType: "Carte SIM + SmartPhone",
      hasSimCard: true,
      simOperator: "IAM",
      simPhoneNumber: "06 61 88 12 34",
      simPuk: "89230147",
      simPin: "1234",
      hasSmartphone: true,
      deviceBrand: "HP",
      deviceImei: "358920198273615",
      deviceModel: "15-AY002NK",
      deviceConfiguration: "4 GB | 500 GB",
      operationType: "AFFECTATION",
      restitutionPreviousDevice: "NON",
      restitutedDeviceCondition: "Non applicable",
      incidentRemarks: "INCIDENT / PANNE",
      items: [
        {
          stockItemId: "STK-006",
          assetTag: "IT-TEL-001",
          name: "HP Smart Device 15-AY002NK (4GB/500GB) + SIM IAM",
          brand: "HP",
          model: "15-AY002NK",
          serialNumber: "358920198273615",
          category: "Périphériques & Accessoires",
          condition: "Neuf / Excellent état",
          accessories: ["Chargeur secteur", "Câble USB", "Kit Piéton"]
        }
      ],
      termsAccepted: true,
      notes: "Affectation conforme charte Distra SA. Matériel remis en main propre."
    },
    {
      id: "AFF-2026-002",
      reference: "AFF-DSI-2026-002",
      templateType: "STANDARD_DSI_EQUIPMENT",
      beneficiaryName: "Sarah Bennani",
      beneficiaryEmail: "s.bennani@entreprise.ma",
      beneficiaryPhone: "+212 6 61 23 45 67",
      beneficiaryCin: "BE892341",
      beneficiaryJobTitle: "Responsable Recrutement & RH",
      beneficiaryDepartment: "Ressources Humaines & Moyens Généraux",
      beneficiarySite: "Casablanca Siège",
      assignedDate: "2026-06-03",
      status: "Active",
      authorizedBy: "Zakaria Radouane",
      dsiTitle: "Directeur des Systèmes d'Information (DSI)",
      items: [
        {
          stockItemId: "STK-002",
          assetTag: "IT-2026-002",
          name: "Dell Latitude 5540 Core i7 / 16GB / 512GB SSD",
          brand: "Dell",
          model: "Latitude 5540",
          serialNumber: "SN-DL5540-88910",
          category: "Laptops & Portables",
          condition: "Neuf / Excellent état",
          accessories: ["Sacoche Dell Pro 15.6\"", "Bloc d'alimentation 65W USB-C", "Souris sans fil Dell MS116"]
        },
        {
          stockItemId: "STK-004",
          assetTag: "IT-2026-004",
          name: "Écran Professionnel Dell UltraSharp 27\" 4K U2723QE",
          brand: "Dell",
          model: "UltraSharp U2723QE",
          serialNumber: "SN-DELL27-99120",
          category: "Postes Fixes & Écrans",
          condition: "Neuf / Excellent état",
          accessories: ["Câble HDMI 2.0 1.8m", "Câble USB-C vidéo 4K", "Cordon d'alimentation"]
        }
      ],
      termsAccepted: true,
      notes: "Pack télétravail & bureautique complet remis en main propre."
    },
    {
      id: "AFF-2026-003",
      reference: "AFF-DSI-2026-003",
      templateType: "STANDARD_DSI_EQUIPMENT",
      beneficiaryName: "Omar Tazi",
      beneficiaryEmail: "o.tazi@entreprise.ma",
      beneficiaryPhone: "+212 6 62 88 99 00",
      beneficiaryCin: "BK445566",
      beneficiaryJobTitle: "Analyste Financier Senior",
      beneficiaryDepartment: "Finance & Contrôle de Gestion",
      beneficiarySite: "Casablanca Siège",
      assignedDate: "2026-05-15",
      status: "Restitué",
      authorizedBy: "Zakaria Radouane",
      dsiTitle: "Directeur des Systèmes d'Information (DSI)",
      items: [
        {
          stockItemId: "STK-001",
          assetTag: "IT-2026-001",
          name: "Lenovo ThinkPad T14s Gen 4 - Core i7 32GB RAM",
          brand: "Lenovo",
          model: "ThinkPad T14s Gen 4",
          serialNumber: "SN-TP-99281-A",
          category: "Laptops & Portables",
          condition: "Très bon état",
          accessories: ["Chargeur 65W USB-C", "Sacoche Lenovo ThinkPad"]
        }
      ],
      termsAccepted: true,
      notes: "Dotation initiale lors de la prise de fonction.",
      returnRecord: {
        id: "RET-2026-001",
        assignmentId: "AFF-2026-003",
        returnDate: "2026-06-05",
        cause: "Renouvellement matériel / Upgrade",
        equipmentCondition: "Bon état d'usage",
        accessoriesReturned: ["Chargeur 65W USB-C", "Sacoche Lenovo ThinkPad"],
        missingAccessories: [],
        dataWiped: true,
        bitlockerUnlocked: true,
        technicalDiagnosis: "PC testé et fonctionnel. Clavier et écran en bon état. Données réinitialisées aux paramètres d'usine.",
        actionTaken: "Remise en stock disponible",
        inspectedBy: "Zakaria Radouane (DSI)",
        notes: "Restitution effectuée suite à passage sur station de calcul mobile."
      }
    }
  ]
};

// --- DATA READ APIs ---
app.get("/api/data", (req, res) => {
  res.json({
    status: "ok",
    data: state,
  });
});

// --- PURCHASE ORDER CREATION ---
app.post("/api/pos", (req, res) => {
  const { title, vendorId, amount, department, requester, items, notes } = req.body;
  
  if (!title || !vendorId || !amount || !department || !requester) {
    return res.status(400).json({ error: "Missing required fields for PO creation." });
  }

  const vendor = state.vendors.find(v => v.id === vendorId);
  if (!vendor) {
    return res.status(404).json({ error: "Selected supplier not found." });
  }

  // Calculate high risk check
  let auditScore = 100;
  if (vendor.riskLevel === "High") auditScore -= 30;
  if (vendor.riskLevel === "Medium") auditScore -= 15;
  if (amount > 50000) auditScore -= 10;
  if (vendor.qualityScore < 85) auditScore -= 10;

  const newPO = {
    id: `PO-2026-00${state.purchaseOrders.length + 1}`,
    title,
    vendorId,
    vendorName: vendor.name,
    amount: parseFloat(amount),
    category: vendor.category,
    department,
    requester,
    status: "Pending Approval",
    createdDate: new Date().toISOString().split("T")[0],
    deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // +30 days
    items: items || [],
    auditScore,
    notes: notes || ""
  };

  // Add spend to budget
  const budgetObj = state.budgets.find(b => b.name === department);
  if (budgetObj) {
    budgetObj.spent += parseFloat(amount);
  } else {
    state.budgets.push({ name: department, allocated: 100000, spent: parseFloat(amount) });
  }

  // Add spend to vendor total spend
  vendor.totalSpend += parseFloat(amount);

  state.purchaseOrders.unshift(newPO);
  res.status(201).json({ message: "Purchase Order created.", data: newPO });
});

// --- OVERRIDE PO STATUS ---
app.post("/api/pos/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Approved, Fulfilled, Declined, Cancelled

  const po = state.purchaseOrders.find(p => p.id === id);
  if (!po) {
    return res.status(404).json({ error: "Purchase Order not found." });
  }

  const oldStatus = po.status;
  po.status = status;

  // Adjust budgets if rejected or cancelled
  if ((status === "Declined" || status === "Cancelled") && oldStatus !== "Declined" && oldStatus !== "Cancelled") {
    const budgetObj = state.budgets.find(b => b.name === po.department);
    if (budgetObj) {
      budgetObj.spent = Math.max(0, budgetObj.spent - po.amount);
    }
    const vendor = state.vendors.find(v => v.id === po.vendorId);
    if (vendor) {
      vendor.totalSpend = Math.max(0, vendor.totalSpend - po.amount);
    }
  } else if (oldStatus === "Declined" || oldStatus === "Cancelled") {
    // Re-active approval status
    if (status === "Approved" || status === "Pending Approval") {
      const budgetObj = state.budgets.find(b => b.name === po.department);
      if (budgetObj) {
        budgetObj.spent += po.amount;
      }
      const vendor = state.vendors.find(v => v.id === po.vendorId);
      if (vendor) {
        vendor.totalSpend += po.amount;
      }
    }
  }

  res.json({ message: "PO status updated successfully.", data: po });
});

// --- ADD VENDOR SUPPLIER ---
app.post("/api/vendors", (req, res) => {
  const { name, contact, email, category, qualityScore, onTimeDelivery, riskLevel } = req.body;

  if (!name || !contact || !email || !category) {
    return res.status(400).json({ error: "Missing required vendor fields." });
  }

  const newVendor = {
    id: `v-${state.vendors.length + 1}`,
    name,
    contact,
    email,
    category,
    qualityScore: parseInt(qualityScore) || 90,
    onTimeDelivery: parseInt(onTimeDelivery) || 92,
    activeContracts: 0,
    totalSpend: 0,
    riskLevel: riskLevel || "Low",
    status: "Approved"
  };

  state.vendors.unshift(newVendor);
  res.status(201).json({ message: "Vendor vendor listed.", data: newVendor });
});

// --- UPDATE VENDOR RATING / RISK ---
app.post("/api/vendors/:id/rating", (req, res) => {
  const { id } = req.params;
  const { qualityScore, onTimeDelivery, riskLevel } = req.body;

  const vendor = state.vendors.find(v => v.id === id);
  if (!vendor) {
    return res.status(404).json({ error: "Supplier not found." });
  }

  if (qualityScore !== undefined) vendor.qualityScore = parseInt(qualityScore);
  if (onTimeDelivery !== undefined) vendor.onTimeDelivery = parseInt(onTimeDelivery);
  if (riskLevel !== undefined) {
    vendor.riskLevel = riskLevel;
    if (riskLevel === "High") {
      vendor.status = "On Probation";
    } else if (vendor.status === "On Probation") {
      vendor.status = "Approved";
    }
  }

  res.json({ message: "Vendor attributes updated.", data: vendor });
});

// --- CREATE NEW COMPARATIVE BID LISTING ---
app.post("/api/rfq", (req, res) => {
  const { title, department, targetBudget, itemsRequired, bids } = req.body;
  if (!title || !itemsRequired || !bids) {
    return res.status(400).json({ error: "Missing required parameters for Request for Quote (RFQ) comparison." });
  }

  const newRFQ = {
    id: `rfq-${state.rfqComparisonPools.length + 1}`,
    title,
    department: department || "Supply Chain",
    targetBudget: parseFloat(targetBudget) || 20000,
    itemsRequired,
    bids: bids.map((b: any, index: number) => ({
      id: `bid-${state.rfqComparisonPools.length + 1}-${index + 1}`,
      vendorName: b.vendorName,
      unitPrice: parseFloat(b.unitPrice) || 0,
      totalPrice: (parseFloat(b.unitPrice) || 0) * (b.qty || 1),
      leadTimeDays: parseInt(b.leadTimeDays) || 14,
      warrantyYears: parseInt(b.warrantyYears) || 2,
      complianceLevel: b.complianceLevel || "90%",
      riskFlags: b.riskFlags || [],
      notes: b.notes || ""
    }))
  };

  state.rfqComparisonPools.unshift(newRFQ);
  res.status(201).json({ message: "RFQ comparative simulation added.", data: newRFQ });
});

// --- USER MANAGEMENT & PERMISSIONS APIS ---
app.get("/api/users", (req, res) => {
  res.json({ status: "ok", data: state.users });
});

app.post("/api/users", (req, res) => {
  const { name, email, phone, department, jobTitle, role, status, spendingLimitMAD, permissions } = req.body;

  if (!name || !email || !department || !role) {
    return res.status(400).json({ error: "Nom, email, département et rôle sont obligatoires." });
  }

  // Check email uniqueness
  const existing = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "Un utilisateur avec cette adresse email existe déjà." });
  }

  // Default permissions based on role if not provided
  const defaultPermissions = {
    ADMIN: {
      canCreatePO: true,
      canApprovePO: true,
      canManageVendors: true,
      canEvaluateBids: true,
      canGenerateContracts: true,
      canManageUsers: true,
      canViewBudgets: true
    },
    PROCUREMENT_MANAGER: {
      canCreatePO: true,
      canApprovePO: true,
      canManageVendors: true,
      canEvaluateBids: true,
      canGenerateContracts: true,
      canManageUsers: false,
      canViewBudgets: true
    },
    BUYER: {
      canCreatePO: true,
      canApprovePO: false,
      canManageVendors: false,
      canEvaluateBids: true,
      canGenerateContracts: false,
      canManageUsers: false,
      canViewBudgets: true
    },
    AUDITOR: {
      canCreatePO: false,
      canApprovePO: false,
      canManageVendors: false,
      canEvaluateBids: false,
      canGenerateContracts: false,
      canManageUsers: false,
      canViewBudgets: true
    }
  };

  const finalPermissions = permissions || defaultPermissions[role as keyof typeof defaultPermissions] || defaultPermissions.BUYER;

  const newUser = {
    id: `usr-${state.users.length + 1}`,
    name,
    email,
    phone: phone || "",
    department,
    jobTitle: jobTitle || "Collaborateur Achats",
    role: role || "BUYER",
    status: status || "Actif",
    spendingLimitMAD: spendingLimitMAD !== undefined ? Number(spendingLimitMAD) : (role === "ADMIN" ? 1000000 : role === "PROCUREMENT_MANAGER" ? 300000 : 50000),
    permissions: finalPermissions,
    avatarUrl: "",
    createdAt: new Date().toISOString().split("T")[0],
    lastLogin: "Non connecté"
  };

  state.users.unshift(newUser);
  res.status(201).json({ message: "Utilisateur créé avec succès.", data: newUser });
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const user = state.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  const { name, email, phone, department, jobTitle, role, status, spendingLimitMAD, permissions } = req.body;

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (department !== undefined) user.department = department;
  if (jobTitle !== undefined) user.jobTitle = jobTitle;
  if (role !== undefined) user.role = role;
  if (status !== undefined) user.status = status;
  if (spendingLimitMAD !== undefined) user.spendingLimitMAD = Number(spendingLimitMAD);
  if (permissions !== undefined) user.permissions = { ...user.permissions, ...permissions };

  res.json({ message: "Utilisateur mis à jour avec succès.", data: user });
});

app.post("/api/users/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // "Actif" | "Inactif" | "Suspendu"

  const user = state.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  // Prevent deactivating the last ADMIN
  if (user.role === "ADMIN" && status !== "Actif") {
    const activeAdmins = state.users.filter(u => u.role === "ADMIN" && u.status === "Actif");
    if (activeAdmins.length <= 1) {
      return res.status(400).json({ error: "Impossible de désactiver le seul administrateur actif du système." });
    }
  }

  user.status = status;
  res.json({ message: `Statut utilisateur modifié en ${status}.`, data: user });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const index = state.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  const user = state.users[index];
  if (user.role === "ADMIN") {
    const activeAdmins = state.users.filter(u => u.role === "ADMIN");
    if (activeAdmins.length <= 1) {
      return res.status(400).json({ error: "Impossible de supprimer le seul compte administrateur." });
    }
  }

  state.users.splice(index, 1);
  res.json({ message: "Utilisateur supprimé avec succès." });
});

// --- IT STOCK & ASSET MANAGEMENT APIs ---

// 1. Get all IT stock items and movement logs
app.get("/api/stock", (req, res) => {
  res.json({
    status: "ok",
    data: {
      items: state.stockItems,
      movements: state.stockMovements
    }
  });
});

// 1.1 Search IT stock items
app.get("/api/stock/search", (req, res) => {
  const q = ((req.query.q as string) || "").toLowerCase().trim();
  const category = (req.query.category as string) || "";
  const availableOnly = req.query.availableOnly === "true" || req.query.availableOnly === "1";

  let filtered = state.stockItems;

  if (availableOnly) {
    filtered = filtered.filter(item => (item.availableQty || 0) > 0);
  }

  if (category && category !== "Tous") {
    filtered = filtered.filter(item => item.category === category);
  }

  if (q) {
    filtered = filtered.filter((item: any) => 
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
  }

  res.json({
    status: "ok",
    data: filtered
  });
});

// 2. Create new IT Stock Item manually
app.post("/api/stock", (req, res) => {
  const {
    name,
    category,
    brand,
    model,
    serialNumber,
    quantity,
    minThreshold,
    unitPriceMAD,
    location,
    status,
    purchaseOrderId,
    purchaseOrderTitle,
    vendorName,
    notes,
    performedBy
  } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: "Le nom et la catégorie de l'article sont obligatoires." });
  }

  const qty = parseInt(quantity) || 1;
  const unitPrice = parseFloat(unitPriceMAD) || 0;
  const newId = `STK-00${state.stockItems.length + 1}`;
  const assetTag = `IT-AST-${1000 + state.stockItems.length + 1}`;

  const newItem = {
    id: newId,
    assetTag,
    name,
    category: category || "Laptops & Portables",
    brand: brand || "Générique",
    model: model || "",
    serialNumber: serialNumber || `SN-${Date.now().toString().slice(-6)}`,
    quantity: qty,
    availableQty: qty,
    allocatedQty: 0,
    minThreshold: parseInt(minThreshold) || 2,
    unitPriceMAD: unitPrice,
    totalValueMAD: qty * unitPrice,
    location: location || "Magasin Central IT (Casablanca)",
    status: status || "En Stock",
    purchaseOrderId: purchaseOrderId || undefined,
    purchaseOrderTitle: purchaseOrderTitle || undefined,
    vendorName: vendorName || undefined,
    purchaseDate: new Date().toISOString().split("T")[0],
    notes: notes || ""
  };

  state.stockItems.unshift(newItem);

  // Record initial movement
  const newMovement = {
    id: `MVT-00${state.stockMovements.length + 1}`,
    stockItemId: newId,
    itemName: name,
    type: "Entrée Achat",
    quantity: qty,
    performedBy: performedBy || "Administrateur Système",
    date: new Date().toISOString().split("T")[0],
    purchaseOrderId: purchaseOrderId || undefined,
    notes: "Création et entrée initiale en stock."
  };
  state.stockMovements.unshift(newMovement);

  res.status(201).json({ message: "Article ajouté au stock IT avec succès.", data: newItem });
});

// 3. Update stock item
app.put("/api/stock/:id", (req, res) => {
  const { id } = req.params;
  const item = state.stockItems.find(s => s.id === id);
  if (!item) {
    return res.status(404).json({ error: "Article de stock introuvable." });
  }

  const {
    name,
    category,
    brand,
    model,
    serialNumber,
    quantity,
    minThreshold,
    unitPriceMAD,
    location,
    status,
    notes,
    warrantyExpiry
  } = req.body;

  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (brand !== undefined) item.brand = brand;
  if (model !== undefined) item.model = model;
  if (serialNumber !== undefined) item.serialNumber = serialNumber;
  if (location !== undefined) item.location = location;
  if (status !== undefined) item.status = status;
  if (notes !== undefined) item.notes = notes;
  if (warrantyExpiry !== undefined) item.warrantyExpiry = warrantyExpiry;
  if (minThreshold !== undefined) item.minThreshold = parseInt(minThreshold);

  if (quantity !== undefined) {
    const newQty = parseInt(quantity) || 0;
    const diff = newQty - item.quantity;
    item.quantity = newQty;
    item.availableQty = Math.max(0, item.availableQty + diff);
  }

  if (unitPriceMAD !== undefined) {
    item.unitPriceMAD = parseFloat(unitPriceMAD) || 0;
  }
  item.totalValueMAD = item.quantity * item.unitPriceMAD;

  res.json({ message: "Article de stock mis à jour.", data: item });
});

// 4. Record Stock Movement (Affectation / Sortie / Retour / Ajustement / Rebut)
app.post("/api/stock/:id/movement", (req, res) => {
  const { id } = req.params;
  const item = state.stockItems.find(s => s.id === id);
  if (!item) {
    return res.status(404).json({ error: "Article de stock introuvable." });
  }

  const { type, quantity, performedBy, recipient, department, notes } = req.body;
  const qty = parseInt(quantity) || 1;

  if (type === "Sortie Affectation") {
    if (item.availableQty < qty) {
      return res.status(400).json({ error: `Quantité disponible insuffisante (${item.availableQty} en stock disponible).` });
    }
    item.availableQty -= qty;
    item.allocatedQty += qty;
    if (recipient) {
      item.assignedTo = {
        userName: recipient,
        department: department || "Général",
        assignedDate: new Date().toISOString().split("T")[0]
      };
      if (item.availableQty === 0) {
        item.status = "Affecté";
      }
    }
  } else if (type === "Retour Stock") {
    const returnQty = Math.min(qty, item.allocatedQty);
    item.allocatedQty = Math.max(0, item.allocatedQty - returnQty);
    item.availableQty += returnQty;
    if (item.allocatedQty === 0) {
      item.assignedTo = undefined;
    }
    item.status = "En Stock";
  } else if (type === "Entrée Achat") {
    item.quantity += qty;
    item.availableQty += qty;
    item.totalValueMAD = item.quantity * item.unitPriceMAD;
  } else if (type === "Mise au Rebut") {
    item.quantity = Math.max(0, item.quantity - qty);
    item.availableQty = Math.max(0, item.availableQty - qty);
    item.totalValueMAD = item.quantity * item.unitPriceMAD;
    if (item.quantity === 0) {
      item.status = "Rebut / Fin de vie";
    }
  } else if (type === "Ajustement Inventaire") {
    item.quantity = qty;
    item.availableQty = Math.max(0, qty - item.allocatedQty);
    item.totalValueMAD = item.quantity * item.unitPriceMAD;
  }

  const newMvt = {
    id: `MVT-00${state.stockMovements.length + 1}`,
    stockItemId: id,
    itemName: item.name,
    type,
    quantity: qty,
    performedBy: performedBy || "Responsable Stock IT",
    recipient,
    department,
    date: new Date().toISOString().split("T")[0],
    notes: notes || ""
  };

  state.stockMovements.unshift(newMvt);
  res.json({ message: `Mouvement de stock "${type}" enregistré.`, data: { item, movement: newMvt } });
});

// 5. One-click Import & Reception from Purchase Order (DA) into IT Stock
app.post("/api/stock/import-po", (req, res) => {
  const { purchaseOrderId, performedBy, location } = req.body;
  const po = state.purchaseOrders.find(p => p.id === purchaseOrderId);
  if (!po) {
    return res.status(404).json({ error: "Demande d'achat introuvable." });
  }

  const createdItems: any[] = [];
  const poItems = po.items && po.items.length > 0 ? po.items : [{ desc: po.title, qty: 1, unitPrice: po.amount, total: po.amount }];

  poItems.forEach((poItem: any, idx: number) => {
    const qty = parseInt(poItem.qty) || 1;
    const unitPrice = parseFloat(poItem.unitPrice) || 0;
    const newId = `STK-00${state.stockItems.length + 1}`;
    const assetTag = `IT-AST-${1000 + state.stockItems.length + 1}`;

    // Deduce category from description
    let category: any = "Périphériques & Accessoires";
    const lowerDesc = poItem.desc.toLowerCase();
    if (lowerDesc.includes("portable") || lowerDesc.includes("laptop") || lowerDesc.includes("thinkpad") || lowerDesc.includes("macbook")) {
      category = "Laptops & Portables";
    } else if (lowerDesc.includes("écran") || lowerDesc.includes("moniteur") || lowerDesc.includes("poste") || lowerDesc.includes("station")) {
      category = "Postes Fixes & Écrans";
    } else if (lowerDesc.includes("serveur") || lowerDesc.includes("stockage") || lowerDesc.includes("san") || lowerDesc.includes("nas")) {
      category = "Serveurs & Stockage";
    } else if (lowerDesc.includes("switch") || lowerDesc.includes("routeur") || lowerDesc.includes("câblage") || lowerDesc.includes("réseau") || lowerDesc.includes("firewall")) {
      category = "Réseau & Sécurité";
    } else if (lowerDesc.includes("toner") || lowerDesc.includes("cartouche") || lowerDesc.includes("papier") || lowerDesc.includes("fourniture")) {
      category = "Consommables & Pièces";
    } else if (lowerDesc.includes("licence") || lowerDesc.includes("logiciel") || lowerDesc.includes("saas") || lowerDesc.includes("cloud")) {
      category = "Licences & Logiciels";
    }

    const newItem = {
      id: newId,
      assetTag,
      name: poItem.desc,
      category,
      brand: po.vendorName?.split(" ")[0] || "Fournisseur",
      model: "Standard Entreprise",
      serialNumber: `SN-${Date.now().toString().slice(-5)}${idx}`,
      quantity: qty,
      availableQty: qty,
      allocatedQty: 0,
      minThreshold: Math.max(1, Math.round(qty * 0.2)),
      unitPriceMAD: unitPrice,
      totalValueMAD: qty * unitPrice,
      location: location || "Magasin Central IT (Casablanca)",
      status: "En Stock",
      purchaseOrderId: po.id,
      purchaseOrderTitle: po.title,
      vendorName: po.vendorName,
      purchaseDate: po.deliveryDate || new Date().toISOString().split("T")[0],
      warrantyExpiry: new Date(Date.now() + 365 * 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: `Intégré depuis le Bon de Commande ${po.id}. Fournisseur : ${po.vendorName}.`
    };

    state.stockItems.unshift(newItem);
    createdItems.push(newItem);

    // Add movement
    state.stockMovements.unshift({
      id: `MVT-00${state.stockMovements.length + 1}`,
      stockItemId: newId,
      itemName: poItem.desc,
      type: "Entrée Achat",
      quantity: qty,
      performedBy: performedBy || "Service Réception Achats",
      date: new Date().toISOString().split("T")[0],
      purchaseOrderId: po.id,
      notes: `Réception conforme depuis la DA ${po.id}.`
    });
  });

  // Mark PO as fulfilled
  po.status = "Fulfilled";

  res.status(201).json({
    message: `${createdItems.length} article(s) intégré(s) avec succès dans le stock IT depuis ${po.id}.`,
    data: createdItems
  });
});

// 6. Delete stock item
app.delete("/api/stock/:id", (req, res) => {
  const { id } = req.params;
  const index = state.stockItems.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Article introuvable." });
  }

  state.stockItems.splice(index, 1);
  res.json({ message: "Article supprimé du stock IT." });
});

// --- IT EQUIPMENT ASSIGNMENT & RETURN APIS ---

// 1. Get all assignments
app.get("/api/assignments", (req, res) => {
  res.json({
    status: "ok",
    data: (state as any).assignments || []
  });
});

// 2. Create a new equipment assignment
app.post("/api/assignments", (req, res) => {
  const {
    templateType,
    formCode,
    beneficiaryName,
    beneficiaryEmail,
    beneficiaryPhone,
    beneficiaryCin,
    beneficiaryJobTitle,
    beneficiaryDepartment,
    beneficiarySite,
    assignedDate,
    authorizedBy,
    dsiTitle,
    resourceType,
    hasSimCard,
    simOperator,
    simPhoneNumber,
    simPuk,
    simPin,
    hasSmartphone,
    deviceBrand,
    deviceImei,
    deviceModel,
    deviceConfiguration,
    operationType,
    restitutionPreviousDevice,
    restitutedDeviceCondition,
    incidentRemarks,
    items,
    notes
  } = req.body;

  if (!beneficiaryName || !beneficiaryDepartment) {
    return res.status(400).json({ error: "Veuillez renseigner le nom du bénéficiaire et son département." });
  }

  const newId = `AFF-2026-00${((state as any).assignments?.length || 0) + 1}`;
  const refNum = `AFF-DSI-2026-${String(((state as any).assignments?.length || 0) + 1).padStart(3, "0")}`;

  // Process items & update stock
  const assignedItemsList: any[] = [];

  if (Array.isArray(items) && items.length > 0) {
    // 1. Hard validation: check availability of all items prior to modifying state
    for (const itemInput of items) {
      if (itemInput.stockItemId && itemInput.stockItemId !== "STK-DIRECT") {
        const stockItem = state.stockItems.find(s => s.id === itemInput.stockItemId);
        if (!stockItem) {
          return res.status(400).json({ error: `Article en stock introuvable : ${itemInput.stockItemId}` });
        }
        if ((stockItem.availableQty || 0) <= 0) {
          return res.status(400).json({ 
            error: `Le matériel « ${stockItem.name} » (${stockItem.serialNumber || stockItem.assetTag}) n'est plus disponible en stock (Quantité disponible : 0).` 
          });
        }
      }
    }

    // 2. Perform atomic assignment updates
    items.forEach((itemInput: any) => {
      const stockItem = state.stockItems.find(s => s.id === itemInput.stockItemId);
      if (stockItem) {
        if (stockItem.availableQty > 0) {
          stockItem.availableQty -= 1;
        }
        stockItem.allocatedQty = (stockItem.allocatedQty || 0) + 1;
        stockItem.status = stockItem.availableQty === 0 ? "Affecté" : "En Stock";
        stockItem.assignedTo = {
          userName: beneficiaryName,
          department: beneficiaryDepartment,
          assignedDate: assignedDate || new Date().toISOString().split("T")[0]
        };

        assignedItemsList.push({
          stockItemId: stockItem.id,
          assetTag: stockItem.assetTag || itemInput.assetTag || `IT-${stockItem.id}`,
          name: stockItem.name,
          brand: stockItem.brand,
          model: stockItem.model,
          serialNumber: stockItem.serialNumber || itemInput.serialNumber || "SN-STANDARD",
          category: stockItem.category,
          specs: (stockItem as any).specs || itemInput.specs,
          condition: itemInput.condition || "Neuf / Excellent état",
          accessories: itemInput.accessories || ["Chargeur secteur", "Câble d'alimentation"]
        });

        // Log movement
        state.stockMovements.unshift({
          id: `MVT-00${state.stockMovements.length + 1}`,
          stockItemId: stockItem.id,
          itemName: stockItem.name,
          type: "Sortie Affectation",
          quantity: 1,
          performedBy: authorizedBy || "Zakaria Radouane (DSI)",
          recipient: beneficiaryName,
          department: beneficiaryDepartment,
          date: assignedDate || new Date().toISOString().split("T")[0],
          notes: `Affectation matérielle (${refNum}) - ${beneficiaryJobTitle || "Collaborateur"}`
        });
      }
    });
  } else if (hasSmartphone || resourceType?.includes("SmartPhone")) {
    // If entered directly via SIM/Phone form without picking a stock item
    assignedItemsList.push({
      stockItemId: "STK-DIRECT",
      assetTag: `IT-TEL-${Date.now().toString().slice(-4)}`,
      name: `${deviceBrand || "Smartphone"} ${deviceModel || ""}`,
      brand: deviceBrand || "Générique",
      model: deviceModel || "",
      serialNumber: deviceImei || `SN-${Date.now().toString().slice(-6)}`,
      category: "Périphériques & Accessoires",
      condition: "Neuf / Excellent état",
      accessories: ["Chargeur secteur", "Câble USB"]
    });
  }

  const newAssignment = {
    id: newId,
    reference: refNum,
    templateType: templateType || (resourceType?.includes("SIM") || resourceType?.includes("SmartPhone") ? "DISTRA_SIM_SMARTPHONE" : "STANDARD_DSI_EQUIPMENT"),
    formCode: formCode || "IT-02",
    beneficiaryName,
    beneficiaryEmail: beneficiaryEmail || "",
    beneficiaryPhone: beneficiaryPhone || simPhoneNumber || "",
    beneficiaryCin: beneficiaryCin || "",
    beneficiaryJobTitle: beneficiaryJobTitle || "Collaborateur",
    beneficiaryDepartment,
    beneficiarySite: beneficiarySite || "Berrechid",
    assignedDate: assignedDate || new Date().toISOString().split("T")[0],
    status: "Active",
    authorizedBy: authorizedBy || "Directeur Systèmes d'Information",
    dsiTitle: dsiTitle || "Département Systèmes D'Information",
    
    // Distra SIM & Smartphone specific fields
    resourceType: resourceType || "Carte SIM + SmartPhone",
    hasSimCard: hasSimCard === true || resourceType?.includes("SIM"),
    simOperator: simOperator || "IAM",
    simPhoneNumber: simPhoneNumber || beneficiaryPhone || "",
    simPuk: simPuk || "",
    simPin: simPin || "",
    hasSmartphone: hasSmartphone === true || resourceType?.includes("SmartPhone"),
    deviceBrand: deviceBrand || (assignedItemsList[0]?.brand || "HP"),
    deviceImei: deviceImei || (assignedItemsList[0]?.serialNumber || ""),
    deviceModel: deviceModel || (assignedItemsList[0]?.model || "15-AY002NK"),
    deviceConfiguration: deviceConfiguration || "4 GB | 500 GB",
    operationType: operationType || "AFFECTATION",
    restitutionPreviousDevice: restitutionPreviousDevice || "NON",
    restitutedDeviceCondition: restitutedDeviceCondition || "Non applicable",
    incidentRemarks: incidentRemarks || "INCIDENT / PANNE",

    items: assignedItemsList,
    termsAccepted: true,
    notes: notes || "Fiche de décharge SIM & Smartphone conforme."
  };

  if (!(state as any).assignments) {
    (state as any).assignments = [];
  }
  (state as any).assignments.unshift(newAssignment);

  res.status(201).json({
    message: `Fiche d'affectation ${refNum} générée avec succès pour ${beneficiaryName}.`,
    data: newAssignment
  });
});

// 3. Process equipment return / restitution
app.post("/api/assignments/:id/return", (req, res) => {
  const { id } = req.params;
  const {
    returnDate,
    cause,
    customCause,
    equipmentCondition,
    accessoriesReturned,
    missingAccessories,
    dataWiped,
    bitlockerUnlocked,
    technicalDiagnosis,
    actionTaken,
    inspectedBy,
    notes
  } = req.body;

  const assignment = ((state as any).assignments || []).find((a: any) => a.id === id);
  if (!assignment) {
    return res.status(404).json({ error: "Fiche d'affectation introuvable." });
  }

  const returnRecord = {
    id: `RET-2026-00${Math.floor(Math.random() * 900) + 100}`,
    assignmentId: assignment.id,
    returnDate: returnDate || new Date().toISOString().split("T")[0],
    cause: cause || "Départ collaborateur (Fin de contrat / Démission)",
    customCause: customCause || "",
    equipmentCondition: equipmentCondition || "Bon état d'usage",
    accessoriesReturned: accessoriesReturned || [],
    missingAccessories: missingAccessories || [],
    dataWiped: dataWiped === true,
    bitlockerUnlocked: bitlockerUnlocked === true,
    technicalDiagnosis: technicalDiagnosis || "Matériel inspecté et vérifié conforme.",
    actionTaken: actionTaken || "Remise en stock disponible",
    inspectedBy: inspectedBy || "Zakaria Radouane (DSI)",
    notes: notes || ""
  };

  assignment.status = "Restitué";
  assignment.returnRecord = returnRecord;

  // Restore or update stock items
  assignment.items.forEach((assignedItem: any) => {
    const stockItem = state.stockItems.find(s => s.id === assignedItem.stockItemId);
    if (stockItem) {
      if (stockItem.allocatedQty > 0) {
        stockItem.allocatedQty -= 1;
      }
      delete stockItem.assignedTo;

      if (actionTaken === "Remise en stock disponible") {
        stockItem.availableQty += 1;
        stockItem.status = "En Stock";
      } else if (actionTaken === "Envoi en maintenance / SAV") {
        stockItem.status = "En Maintenance";
      } else if (actionTaken === "Mise au rebut") {
        stockItem.status = "Rebut / Fin de vie";
        if (stockItem.quantity > 0) stockItem.quantity -= 1;
      }

      // Log movement
      state.stockMovements.unshift({
        id: `MVT-00${state.stockMovements.length + 1}`,
        stockItemId: stockItem.id,
        itemName: stockItem.name,
        type: actionTaken === "Mise au rebut" ? "Mise au Rebut" : "Retour Stock",
        quantity: 1,
        performedBy: inspectedBy || "Zakaria Radouane (DSI)",
        recipient: "Magasin Central IT",
        department: assignment.beneficiaryDepartment,
        date: returnDate || new Date().toISOString().split("T")[0],
        notes: `Restitution (${cause}) - État: ${equipmentCondition}. ${actionTaken}.`
      });
    }
  });

  res.json({
    message: `Restitution de matériel enregistrée avec succès pour l'affectation ${assignment.reference}.`,
    data: {
      assignment,
      returnRecord
    }
  });
});

// 4. Delete assignment
app.delete("/api/assignments/:id", (req, res) => {
  const { id } = req.params;
  const index = ((state as any).assignments || []).findIndex((a: any) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Affectation introuvable." });
  }

  (state as any).assignments.splice(index, 1);
  res.json({ message: "Fiche d'affectation supprimée." });
});

// --- AI INTELLIGENT CO-PILOT ENDPOINT (GEMINI API) ---
app.post("/api/ai/analyze-bids", async (req, res) => {
  const { title, department, targetBudget, itemsRequired, bids } = req.body;

  if (!title || !bids || bids.length === 0) {
    return res.status(400).json({ error: "Please provide a project title and active bids to scan." });
  }

  const ai = getAI();
  const procurementCaseString = `
    Titre du Projet / Appel d'Offres: ${title}
    Département Bénéficiaire: ${department}
    Budget Cible Alloué: ${targetBudget} MAD (Dirhams marocains)
    Livrables & Spécifications Requises: ${itemsRequired}

    Offres Concurrentes Reçues:
    ${JSON.stringify(bids, null, 2)}
  `;

  if (ai) {
    try {
      // Configured as per gemini-api skill rules using standard Gemini 3.5 Flash Model
      const prompt = `
        Tu es un auditeur expert en achats industriels, marchés publics et stratégie de négociation commerciale au Maroc.
        Analyse les offres de prix des fournisseurs pour ce projet :
        ${procurementCaseString}

        Réponds OBLIGATOIREMENT en français avec toutes les valeurs monétaires formulées en Dirhams marocains (MAD).
        Fournis ton analyse strictement sous le format JSON suivant (valide, avec guillemets doubles) :
        {
          "recommendedVendor": "NOM DU FOURNISSEUR RECOMMANDÉ",
          "recommendationReasoning": "Explication claire et synthétique évaluant le rapport qualité/prix en MAD, les délais de livraison, la garantie et la conformité globale.",
          "supplierComparison": [
            {
              "vendorName": "NOM DU FOURNISSEUR",
              "pros": "Points forts de l'offre...",
              "cons": "Points faibles ou réserves (ex: délai long, garantie standard, prix élevé en MAD)..."
            }
          ],
          "riskAssessment": [
            {
              "riskTitle": "Titre du risque (ex: Risque de rupture logistique, Dépassement budgétaire)",
              "severity": "High" | "Medium" | "Low",
              "riskExplanation": "Description concise du risque opérationnel ou financier."
            }
          ],
          "negotiationPlaybook": [
            "2 à 3 points d'action et arguments concrets de négociation pour optimiser le coût en MAD, réduire le délai ou étendre la garantie SLA."
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "Tu es un expert auditeur des achats et juriste contrats marchés. Rédige toujours en français irréprochable avec des recommandations concrètes et des montants en Dirhams marocains (MAD).",
        }
      });

      const auditResponseText = response.text || "{}";
      const cleanJson = JSON.parse(auditResponseText);
      return res.json({ provider: "Gemini 3.5 Flash Client", ...cleanJson });
    } catch (err: any) {
      console.error("Gemini Audit Exception:", err);
      const ruleBasedResult = buildRuleBasedFallback(title, targetBudget, bids);
      return res.json({
        provider: "Moteur Heuristique d'Achats Local (Secours Haute Disponibilité)",
        isFallbackDueToDemand: true,
        ...ruleBasedResult
      });
    }
  } else {
    // If Gemini client key is missing or not supplied yet, execute intelligent rule-based fallback instantly!
    console.log("No live key found. Resolving with dynamic rule-based procurement solver.");
    const ruleBasedResult = buildRuleBasedFallback(title, targetBudget, bids);
    return res.json({ provider: "Moteur d'Analyse Heuristique Local", ...ruleBasedResult });
  }
});

// --- AI DRAFT CONTRACT TERMS / COMMERCIAL CLAUSES ---
app.post("/api/ai/draft-terms", async (req, res) => {
  const { vendorName, category, termScope, speedUrgency } = req.body;

  if (!vendorName || !category) {
    return res.status(400).json({ error: "Informations du fournisseur manquantes pour la génération des clauses contractuelles." });
  }

  const ai = getAI();
  if (ai) {
    try {
      const prompt = `
        Rédige un Avenant Contractuel d'Achats & Accord de Niveau de Service (SLA) professionnel entre notre entreprise et le prestataire "${vendorName}".
        Catégorie d'Approvisionnement: ${category}
        Périmètre Spécifique Demandé: ${termScope || "Indicateurs de performance, pénalités de retard, force majeure, confidentialité et droit d'audit"}
        Niveau d'Urgence du Projet: ${speedUrgency || "Standard"}

        Produis un document contractuel formel, complet et juridiquement rigoureux en langue française, avec les pénalités et montants exprimés en Dirhams marocains (MAD). Utilise une structure Markdown soignée avec titres et articles numérotés.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Tu es un juriste d'entreprise senior spécialisé en droit des contrats commerciaux, logistique, marchés de fournitures et gestion des risques au Maroc. Rédige toujours en français avec rigueur et précision.",
        }
      });

      return res.json({ provider: "Gemini 3.5 Flash Client", document: response.text });
    } catch (err: any) {
      console.error("Gemini Contract Exception (Falling back to High Demand Template):", err);
      const fallbackDocument = `
### AVENANT CONTRACTUEL : ACCORD DE NIVEAU DE SERVICE (SLA) & CONFORMITÉ
**FOURNISSEUR :** ${vendorName || "Prestataire Sous-traitant"}
**CATÉGORIE :** ${category || "Fournitures & Services Généraux"}
**DATE D'EFFET :** ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}

#### ARTICLE 1 : ENGAGEMENTS DE DISPONIBILITÉ & NIVEAU DE SERVICE (SLA)
Le Fournisseur s'engage formellement à garantir un taux de respect des délais de livraison (OTD) d'au moins **95%** sur l'ensemble des commandes émises. Tout retard imputable au Fournisseur supérieur à cinq (5) jours ouvrés ouvrira droit pour l'Acheteur à une pénalité forfaitaire de **1,5% par jour de retard**, déductible directement sur la facture mensuelle correspondante (exprimée en Dirhams marocains - MAD).

#### ARTICLE 2 : DROIT D'AUDIT COMMERCIAL ET CONTRÔLE TARIFAIRE
L'Acheteur se réserve le droit d'effectuer ou de faire effectuer par un cabinet d'audit indépendant tout contrôle sur les éléments de facturation, les bons de livraison et les fiches techniques des composants livrés, à raison de deux audits annuels maximum. Tout écart ou surfacturation fera l'objet d'un avoir immédiat majoré des intérêts légaux en vigueur.

#### ARTICLE 3 : GARANTIE MATÉRIELLE & CONFORMITÉ RÉGLEMENTAIRE
Tous les équipements et prestations fournis au titre du présent marché bénéficient d'une garantie pièces et main d'œuvre intégrale d'une durée minimale de **24 Mois** à compter de la signature du procès-verbal de réception conforme. Le Fournisseur garantit le respect strict des normes de sécurité et de confidentialité applicables.
      `;
      return res.json({ provider: "Moteur Local de Contrats Standards", document: fallbackDocument });
    }
  } else {
    // Elegant fallback document in French
    const genericDocument = `
### AVENANT CONTRACTUEL : ACCORD DE NIVEAU DE SERVICE (SLA) & CONFORMITÉ
**FOURNISSEUR :** ${vendorName}
**CATÉGORIE :** ${category}
**DATE D'EFFET :** ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}

#### ARTICLE 1 : ENGAGEMENTS DE DISPONIBILITÉ & NIVEAU DE SERVICE (SLA)
Le Fournisseur s'engage formellement à garantir un taux de respect des délais de livraison (OTD) d'au moins **92%** sur l'ensemble des bons de commande. Tout retard logistique supérieur à cinq (5) jours ouvrés donnera lieu à une pénalité de retard de **1,5% par jour**, imputable sur les règlements en Dirhams marocains (MAD).

#### ARTICLE 2 : CONTRÔLE QUALITÉ & DROIT D'AUDIT
L'Acheteur dispose d'un droit de regard et d'audit sur les processus de fabrication et les bordereaux de prix unitaires convenus.

#### ARTICLE 3 : GARANTIE PIÈCES & MAIN D'ŒUVRE
Les fournitures livrées sont couvertes par une garantie constructeur étendue de **24 Mois** avec engagement d'intervention sur site sous 48 heures ouvrées.
    `;
    return res.json({ provider: "Moteur Local de Contrats Standards", document: genericDocument });
  }
});


// Helper Rule-Based Procurement Evaluator in French and MAD
function buildRuleBasedFallback(title: string, targetBudget: number, bids: any[]) {
  let bestBid = bids[0];
  let lowestCost = Infinity;

  const comparison = bids.map(b => {
    const exceedsBudget = b.totalPrice > targetBudget;
    const isLowest = b.totalPrice < lowestCost;
    if (isLowest) {
      lowestCost = b.totalPrice;
      bestBid = b;
    }

    const prs = [];
    const cns = [];

    if (b.totalPrice <= targetBudget) prs.push("Offre conforme au plafond budgétaire alloué");
    else cns.push(`Dépassement du budget prévisionnel alloué (${targetBudget.toLocaleString()} MAD)`);

    if (b.leadTimeDays <= 10) prs.push(`Délai d'exécution rapide (${b.leadTimeDays} jours)`);
    else cns.push(`Délai de livraison allongé (${b.leadTimeDays} jours), risque d'impact sur le planning`);

    if (b.warrantyYears >= 3) prs.push(`Excellente couverture de garantie (${b.warrantyYears} ans)`);
    else prs.push(`Garantie standard de ${b.warrantyYears} an(s)`);

    const compliancePct = parseInt(b.complianceLevel) || 85;
    if (compliancePct >= 95) prs.push("Excellente conformité au cahier des charges technique");
    else cns.push("Certaines spécifications secondaires restent à valider");

    return {
      vendorName: b.vendorName,
      pros: prs.join(". ") || "Spécifications conformes aux normes requises.",
      cons: cns.join(". ") || "Aucune anomalie majeure identifiée."
    };
  });

  const risks = [];
  bids.forEach(b => {
    if (b.leadTimeDays > 25) {
      risks.push({
        riskTitle: `Risque de retard logistique avec ${b.vendorName}`,
        severity: "High",
        riskExplanation: `${b.vendorName} annonce un délai d'acheminement de ${b.leadTimeDays} jours, ce qui peut impacter la mise en service.`
      });
    }
    const cmp = parseInt(b.complianceLevel) || 85;
    if (cmp < 80) {
      risks.push({
        riskTitle: `Écart de conformité technique (${b.vendorName})`,
        severity: "Medium",
        riskExplanation: `${b.vendorName} affiche un taux de conformité de ${b.complianceLevel}. Une revue des fiches techniques est requise.`,
      });
    }
  });

  if (risks.length === 0) {
    risks.push({
      riskTitle: "Risques Opérationnels Standards",
      severity: "Low",
      riskExplanation: "Les offres examinées présentent un niveau de maîtrise logistique et technique satisfaisant."
    });
  }

  return {
    recommendedVendor: bestBid?.vendorName || "Offre la plus compétitive",
    recommendationReasoning: `${bestBid?.vendorName} propose la meilleure offre économique avec un montant de ${bestBid ? Number(bestBid.totalPrice).toLocaleString() : 0} MAD et des garanties conformes au cahier des charges.`,
    supplierComparison: comparison,
    riskAssessment: risks,
    negotiationPlaybook: [
      `Négocier avec ${bestBid?.vendorName || "le fournisseur"} un engagement ferme sur les délais de livraison.`,
      "Demander une remise commerciale de volume de 5% à 8% sur le montant total en MAD.",
      "Solliciter une extension de garantie d'au moins 12 mois sans surcoût."
    ]
  };
}


// --- INTEGRATING VITE DEV SERVER OR STANDALONE PROD ASSETS ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Dev Mode Setup
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Middlewares loaded for Vite development build.");
  } else {
    // Production Assets Serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving compiled production client assets.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Procurement Dashboard Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
