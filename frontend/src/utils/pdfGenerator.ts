import jsPDF from "jspdf";
import { MaterialAssignment } from "../types";
import { getDistraLogoDataUri } from "./distraLogo";

/**
 * Generate and download an exact replica of the Distra "FORMULAIRE DE DÉCHARGE MATÉRIEL INFORMATIQUE" (Image.png)
 */
export function exportDistraITEquipmentToPDF(assignment: MaterialAssignment) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = 12;

  // Helper for drawing checkboxes with optional checkmark
  const drawCheckbox = (x: number, yPos: number, checked: boolean, label: string) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(x, yPos, 3.8, 3.8);
    if (checked) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text("✔", x + 0.6, yPos + 3.0);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(label, x + 6, yPos + 3.0);
  };

  // --- 1. HEADER SECTION ---
  // Left: Distra Logo & Department sub-label
  try {
    const logoUri = getDistraLogoDataUri();
    if (logoUri) {
      doc.addImage(logoUri, "PNG", margin, y, 40, 15);
    }
  } catch (err) {
    // Fallback vector drawing
    doc.setTextColor(132, 189, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Distra", margin, y + 12);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.text("Département Systèmes d'Information", margin, y + 20);

  // Center/Right: Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  const titleText = "FORMULAIRE DE DÉCHARGE MATÉRIEL INFORMATIQUE";
  const titleX = margin + 48;
  const titleY = y + 8;
  doc.text(titleText, titleX, titleY);
  // Underline title
  const titleWidth = doc.getTextWidth(titleText);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(titleX, titleY + 1.2, titleX + titleWidth, titleY + 1.2);

  // Right: Number Box (Yellow background #fef9c3 with black border)
  const numBoxW = 46;
  const numBoxH = 10;
  const numBoxX = margin + contentWidth - numBoxW;
  const numBoxY = y + 3;

  doc.setFillColor(254, 249, 195); // Light yellow
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(numBoxX, numBoxY, numBoxW, numBoxH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const refDisplay = assignment.reference?.replace("AFF-DSI-2026-", "")?.replace(/^0+/, "") || assignment.reference || "2";
  doc.text(`N° AFFECTATION : ${refDisplay}`, numBoxX + numBoxW / 2, numBoxY + 6.5, { align: "center" });

  y += 26;

  // --- 2. INFORMATION BÉNÉFICIAIRE : ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("INFORMATION BÉNÉFICIAIRE :", margin, y);
  const infoWidth = doc.getTextWidth("INFORMATION BÉNÉFICIAIRE :");
  doc.line(margin, y + 1, margin + infoWidth, y + 1);

  y += 3.5;

  const benColW = contentWidth / 4; // 45.5mm each
  const thH = 6.5;
  const tdBH = 7.5;

  // Table Header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, thH);
  for (let i = 1; i < 4; i++) {
    doc.line(margin + benColW * i, y, margin + benColW * i, y + thH);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Nom Complet", margin + benColW / 2, y + 4.5, { align: "center" });
  doc.text("Fonction", margin + benColW * 1.5, y + 4.5, { align: "center" });
  doc.text("Département", margin + benColW * 2.5, y + 4.5, { align: "center" });
  doc.text("Emplacement", margin + benColW * 3.5, y + 4.5, { align: "center" });

  y += thH;

  // Table Data Row
  doc.rect(margin, y, contentWidth, tdBH);
  for (let i = 1; i < 4; i++) {
    doc.line(margin + benColW * i, y, margin + benColW * i, y + tdBH);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(assignment.beneficiaryName || "ABDELJALIL HISSAR", margin + benColW / 2, y + 5, { align: "center" });
  doc.text(assignment.beneficiaryJobTitle || "Operateur", margin + benColW * 1.5, y + 5, { align: "center" });
  doc.text(assignment.beneficiaryDepartment || "Technique", margin + benColW * 2.5, y + 5, { align: "center" });
  doc.text(assignment.beneficiarySite || "Berrechid", margin + benColW * 3.5, y + 5, { align: "center" });

  y += tdBH + 5;

  // --- 3. INFORMATIONS DU BIEN : ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("INFORMATIONS DU BIEN :", margin, y);
  const bienWidth = doc.getTextWidth("INFORMATIONS DU BIEN :");
  doc.line(margin, y + 1, margin + bienWidth, y + 1);

  y += 3.5;

  // Nested Table Layout
  const col1W = 38; // Type du bien
  const col2W = 42; // Numéro de série
  const configColW = 66; // Configuration (CPU 22, RAM 22, SSD 22)
  const col4W = contentWidth - col1W - col2W - configColW; // 36mm Date d'acquisition

  const headerRow1H = 6;
  const headerRow2H = 6;
  const fullHeaderH = headerRow1H + headerRow2H; // 12mm

  const itemsList = (assignment.items && assignment.items.length > 0)
    ? assignment.items
    : [{
        stockItemId: "STK-1",
        name: assignment.equipmentType || "Ordinateur / PC",
        category: "Ordinateurs Portables" as any,
        brand: assignment.deviceBrand || "HP",
        model: assignment.deviceModel || "15-AY002NK",
        serialNumber: assignment.deviceImei || "CZC50324W0",
        assetTag: "IT-AST-1001",
        condition: "Neuf / Excellent état" as any,
        accessories: [],
        specs: {
          cpu: assignment.equipmentCpu || "Intel i7",
          ram: assignment.equipmentRam || "8",
          storage: assignment.equipmentStorage || "256"
        }
      }];

  const singleItemRowH = 7.0;
  const totalDataH = itemsList.length * singleItemRowH;

  // Full table border for headers + all data rows
  doc.rect(margin, y, contentWidth, fullHeaderH + totalDataH);

  // Vertical lines spanning full header + all data rows
  doc.line(margin + col1W, y, margin + col1W, y + fullHeaderH + totalDataH);
  doc.line(margin + col1W + col2W, y, margin + col1W + col2W, y + fullHeaderH + totalDataH);
  doc.line(margin + col1W + col2W + configColW, y, margin + col1W + col2W + configColW, y + fullHeaderH + totalDataH);

  // Horizontal line separating header row 1 & row 2 in Configuration column
  doc.line(margin + col1W + col2W, y + headerRow1H, margin + col1W + col2W + configColW, y + headerRow1H);

  // Sub-column dividers under Configuration
  const cfgSubW = configColW / 3; // 22mm each
  doc.line(margin + col1W + col2W + cfgSubW, y + headerRow1H, margin + col1W + col2W + cfgSubW, y + fullHeaderH + totalDataH);
  doc.line(margin + col1W + col2W + cfgSubW * 2, y + headerRow1H, margin + col1W + col2W + cfgSubW * 2, y + fullHeaderH + totalDataH);

  // Horizontal line separating header from data rows
  doc.line(margin, y + fullHeaderH, margin + contentWidth, y + fullHeaderH);

  // Header Texts
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Type du bien", margin + col1W / 2, y + 7.5, { align: "center" });
  doc.text("Numéro de série", margin + col1W + col2W / 2, y + 7.5, { align: "center" });
  doc.text("Configuration", margin + col1W + col2W + configColW / 2, y + 4.2, { align: "center" });
  
  // Sub headers
  doc.setFontSize(8);
  doc.text("CPU", margin + col1W + col2W + cfgSubW / 2, y + headerRow1H + 4.2, { align: "center" });
  doc.text("RAM(GB)", margin + col1W + col2W + cfgSubW * 1.5, y + headerRow1H + 4.2, { align: "center" });
  doc.text("SSD(GB)", margin + col1W + col2W + cfgSubW * 2.5, y + headerRow1H + 4.2, { align: "center" });
  
  doc.setFontSize(8.5);
  doc.text("Date d'acquisition", margin + col1W + col2W + configColW + col4W / 2, y + 7.5, { align: "center" });

  // Data Rows
  itemsList.forEach((it, idx) => {
    const rowTop = y + fullHeaderH + idx * singleItemRowH;
    if (idx > 0) {
      doc.line(margin, rowTop, margin + contentWidth, rowTop);
    }

    const typeDisplay = it.category || it.name || assignment.equipmentType || "Ordinateur / PC";
    const snDisplay = it.serialNumber || assignment.deviceImei || "CZC50324W0";
    const cpuDisplay = it.specs?.cpu || assignment.equipmentCpu || "—";
    const ramDisplay = it.specs?.ram ? it.specs.ram.replace(/[^0-9]/g, "") : (assignment.equipmentRam || "—");
    const ssdDisplay = it.specs?.storage ? it.specs.storage.replace(/[^0-9]/g, "") : (assignment.equipmentStorage || "—");
    const acqDateDisplay = assignment.equipmentAcquisitionDate || assignment.assignedDate || "—";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const textY = rowTop + 4.8;
    const truncatedType = doc.splitTextToSize(typeDisplay, col1W - 4)[0] || typeDisplay;
    doc.text(truncatedType, margin + col1W / 2, textY, { align: "center" });
    doc.text(snDisplay, margin + col1W + col2W / 2, textY, { align: "center" });
    doc.text(cpuDisplay, margin + col1W + col2W + cfgSubW / 2, textY, { align: "center" });
    doc.text(ramDisplay, margin + col1W + col2W + cfgSubW * 1.5, textY, { align: "center" });
    doc.text(ssdDisplay, margin + col1W + col2W + cfgSubW * 2.5, textY, { align: "center" });
    doc.text(acqDateDisplay, margin + col1W + col2W + configColW + col4W / 2, textY, { align: "center" });
  });

  y += fullHeaderH + totalDataH + 4;

  // --- 4. COMPLÉMENTS : ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("COMPLÉMENTS :", margin, y);
  const compWidth = doc.getTextWidth("COMPLÉMENTS :");
  doc.line(margin, y + 1, margin + compWidth, y + 1);

  y += 3.5;

  const hasKey = assignment.hasKeyboard || assignment.items?.some(i => i.accessories?.some(a => a.toLowerCase().includes("clavier")));
  const hasMou = assignment.hasMouse || assignment.items?.some(i => i.accessories?.some(a => a.toLowerCase().includes("souris")));
  const hasUsb = assignment.hasUsbAdapter || assignment.items?.some(i => i.accessories?.some(a => a.toLowerCase().includes("usb") || a.toLowerCase().includes("rj45") || a.toLowerCase().includes("adaptateur")));

  drawCheckbox(margin + 6, y, !!hasKey, "Clavier");
  drawCheckbox(margin + 58, y, !!hasMou, "Souris");
  drawCheckbox(margin + 110, y, !!hasUsb, "Adaptateur USB/RJ45");

  y += 7.5;

  // --- 5. TYPE D'OPÉRATION : ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("TYPE D'OPÉRATION :", margin, y);
  const opWidth = doc.getTextWidth("TYPE D'OPÉRATION :");
  doc.line(margin, y + 1, margin + opWidth, y + 1);

  y += 3.5;

  const isReaff = assignment.operationType === "RÉAFFECTATION";
  drawCheckbox(margin + 6, y, !isReaff, "AFFECTATION");
  drawCheckbox(margin + 70, y, isReaff, "RÉAFFECTATION");

  y += 7.5;

  // --- 6. ENGAGEMENT DU BÉNÉFICIAIRE ---
  const engHdrH = 6.5;
  doc.setFillColor(220, 237, 200); // Light sage green #dcedc8
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, engHdrH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("ENGAGEMENT DU BÉNÉFICIAIRE", margin + contentWidth / 2, y + 4.6, { align: "center" });

  y += engHdrH;

  const engBoxH = 75;
  doc.rect(margin, y, contentWidth, engBoxH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.1);
  doc.setTextColor(0, 0, 0);

  const l1 = "En signant ce formulaire, le soussigné reconnaît l'entière responsabilité de tout l'équipement et de toutes les informations énumérées.";
  const l2 = "En utilisant le matériel informatique fourni par l'équipe IT de Distra :";
  const l3 = "1. Je reconnais être responsable de l'état physique et la sécurité physique du bien.";
  const l4 = "2. Je reconnais être responsable de la sécurité des données stockées sur le bien.";
  const l5 = "3. La durée de vie des ordinateurs de bureau et des ordinateurs portables est fixée à :";
  const l6 = "    • 3 ans pour les DESKTOPS (Ordinateurs Fixes)";
  const l7 = "    • 5 ans pour les LAPTOPS (Ordinateurs Portables)";
  const l8 = "4. Tout ordinateur qui n'a pas atteint l'âge fixé ne sera pas remplacé au cas de :";
  const l9 = "    • Casse / vole : c'est à la charge de l'utilisateur d'acheter un équipement de même Référence ou équivalent.";
  const l10 = "    • Dysfonctionnement réparable : le support SI prend en charge la réparation.";
  const l11 = "5. J'ai lu et compris les directives énumérées ci-dessous concernant les équipements informatiques perdus, volés ou endommagés qui me sont attribués :";
  const l12 = "    a. Les employées jugés négligents en ce qui concerne les appareils informatiques perdus ou volés sont tenus de payer la valeur comptable nette du District pour cet appareil.";
  const l13 = "    b. Les employées jugés négligents pour des appareils informatiques endommagés sont tenus de payer le coût réel de la réparation ou la valeur comptable nette du District, selon le montant le plus bas.";
  const l14 = "    c. En cas de cessation de travail, l'employé s'engage à rendre le matériel mentionné dessus en Bonne état, le cas échéant la valeur sera déduite de son solde de tout compte.";

  let ey = y + 3.8;
  const lineSpacing = 3.6;

  [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11].forEach((txt) => {
    doc.text(txt, margin + 2.5, ey);
    ey += lineSpacing;
  });

  // Multiline wrapping for sub-articles 5a, 5b, 5c
  const subLinesA = doc.splitTextToSize(l12, contentWidth - 6);
  doc.text(subLinesA, margin + 2.5, ey);
  ey += subLinesA.length * lineSpacing;

  const subLinesB = doc.splitTextToSize(l13, contentWidth - 6);
  doc.text(subLinesB, margin + 2.5, ey);
  ey += subLinesB.length * lineSpacing;

  const subLinesC = doc.splitTextToSize(l14, contentWidth - 6);
  doc.text(subLinesC, margin + 2.5, ey);

  y += engBoxH + 3.5;

  // --- 7. REMARQUES : INFORMATION / SUIVI ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("REMARQUES : INFORMATION / SUIVI", margin, y);
  const remWidth = doc.getTextWidth("REMARQUES : INFORMATION / SUIVI");
  doc.line(margin, y + 1, margin + remWidth, y + 1);

  y += 3;

  const remBoxH = 12;
  doc.rect(margin, y, contentWidth, remBoxH);
  if (assignment.notes || assignment.incidentRemarks) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const noteLines = doc.splitTextToSize(assignment.notes || assignment.incidentRemarks || "", contentWidth - 6);
    doc.text(noteLines, margin + 3, y + 4);
  }

  y += remBoxH + 3.5;

  // --- 8. SIGNATURES ---
  const sigW = contentWidth / 2; // 91mm each
  const sigH = 22;

  doc.rect(margin, y, sigW, sigH);
  doc.rect(margin + sigW, y, sigW, sigH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Signature du bénéficiaire", margin + sigW / 2, y + 4.5, { align: "center" });
  doc.text("Visa Département Systèmes d'Information", margin + sigW * 1.5, y + 4.5, { align: "center" });

  y += sigH + 4;

  // --- 9. FOOTER ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Département Systèmes d'Information", pageWidth / 2, y + 2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(80, 80, 80);
  doc.text("Formulaire de décharge matériel informatique | Version 1.0", pageWidth / 2, y + 5.5, { align: "center" });

  // Save PDF
  const filename = `Decharge_Materiel_IT_${assignment.beneficiaryName?.replace(/[^a-zA-Z0-9]/g, "_") || "Beneficiaire"}.pdf`;
  doc.save(filename);
}

/**
 * Generate and download an exact, professional PDF for the Distra "DÉCHARGE D'AFFECTATION DE MATÉRIEL IT" (Formulaire IT-02)
 */
export function exportDistraSimSmartphoneToPDF(assignment: MaterialAssignment) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  // --- Checkbox Vector Drawer Helper (Safe, No Unicode Encoding Issues) ---
  const drawCheckbox = (x: number, yPos: number, checked: boolean, label: string, labelBold: boolean = false) => {
    const boxSize = 3.2;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.3);
    doc.rect(x, yPos, boxSize, boxSize, "S");

    if (checked) {
      doc.setFillColor(34, 112, 40); // Forest green mark
      doc.rect(x + 0.6, yPos + 0.6, boxSize - 1.2, boxSize - 1.2, "F");
    }

    doc.setFont("helvetica", labelBold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text(label, x + boxSize + 2, yPos + 2.5);
  };

  // --- 1. HEADER SECTION ---
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);

  const headerHeight = 20;
  const logoColWidth = 48;
  const rightColWidth = 46;
  const centerColWidth = contentWidth - logoColWidth - rightColWidth;

  // Header 3 boxes
  doc.rect(margin, y, logoColWidth, headerHeight);
  doc.rect(margin + logoColWidth, y, centerColWidth, headerHeight);
  doc.rect(margin + logoColWidth + centerColWidth, y, rightColWidth, headerHeight);

  // Split right box in 2 rows
  doc.line(
    margin + logoColWidth + centerColWidth,
    y + headerHeight / 2,
    margin + contentWidth,
    y + headerHeight / 2
  );

  // Logo "Distra" on Left
  try {
    const logoUri = getDistraLogoDataUri();
    if (logoUri) {
      doc.addImage(logoUri, "PNG", margin + 3, y + 2, 42, 16);
    }
  } catch (err) {
    doc.setTextColor(132, 189, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Distra", margin + 6, y + 13);
  }

  // Center Title
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    "DÉCHARGE D'AFFECTATION\nDE MATÉRIEL IT",
    margin + logoColWidth + centerColWidth / 2,
    y + 8,
    { align: "center", lineHeightFactor: 1.25 }
  );

  // Top-Right: Form code
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text(
    `Formulaire : ${assignment.formCode || "IT-02"}`,
    margin + logoColWidth + centerColWidth + rightColWidth / 2,
    y + 6.5,
    { align: "center" }
  );

  // Bottom-Right: Number tag
  doc.setTextColor(29, 78, 216); // Royal Blue
  const refDisplay = assignment.reference?.replace("AFF-DSI-2026-", "")?.replace(/^0+/, "") || "1";
  doc.text(
    `N° AFFECTATION : ${refDisplay}`,
    margin + logoColWidth + centerColWidth + rightColWidth / 2,
    y + 16.5,
    { align: "center" }
  );

  y += headerHeight;

  // Subtitle header: Département Systèmes D'Information
  doc.setFillColor(104, 159, 56); // #689f38 green
  doc.rect(margin, y, contentWidth, 6.5, "FD");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("DÉPARTEMENT SYSTÈMES D'INFORMATION", margin + contentWidth / 2, y + 4.6, { align: "center" });

  y += 6.5;

  // --- 2. BENEFICIARY INFO GRID (1 — BÉNÉFICIAIRE) ---
  const rowHeight = 6.5;
  const col1W = 36;
  const col2W = 58;
  const col3W = 38;
  const col4W = contentWidth - col1W - col2W - col3W;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);

  // Row 1: Nom et Prénom & Date d'affectation
  doc.rect(margin, y, col1W, rowHeight);
  doc.rect(margin + col1W, y, col2W, rowHeight);
  doc.rect(margin + col1W + col2W, y, col3W, rowHeight);
  doc.rect(margin + col1W + col2W + col3W, y, col4W, rowHeight);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text("Nom et Prénom :", margin + 2.5, y + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(assignment.beneficiaryName || "Collaborateur", margin + col1W + 3, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text("Date d'affectation :", margin + col1W + col2W + 2.5, y + 4.5);
  doc.setTextColor(0, 0, 0);
  doc.text(assignment.assignedDate || "", margin + col1W + col2W + col3W + 3, y + 4.5);

  y += rowHeight;

  // Row 2: Fonction & Département
  doc.rect(margin, y, col1W, rowHeight);
  doc.rect(margin + col1W, y, col2W, rowHeight);
  doc.rect(margin + col1W + col2W, y, col3W, rowHeight);
  doc.rect(margin + col1W + col2W + col3W, y, col4W, rowHeight);

  doc.setTextColor(50, 50, 50);
  doc.text("Fonction :", margin + 2.5, y + 4.5);
  doc.setTextColor(0, 0, 0);
  doc.text(assignment.beneficiaryJobTitle || "—", margin + col1W + 3, y + 4.5);

  doc.setTextColor(50, 50, 50);
  doc.text("Département :", margin + col1W + col2W + 2.5, y + 4.5);
  doc.setTextColor(0, 0, 0);
  doc.text(assignment.beneficiaryDepartment || "—", margin + col1W + col2W + col3W + 3, y + 4.5);

  y += rowHeight;

  // Row 3: Site & Société
  doc.rect(margin, y, col1W, rowHeight);
  doc.rect(margin + col1W, y, col2W, rowHeight);
  doc.rect(margin + col1W + col2W, y, col3W, rowHeight);
  doc.rect(margin + col1W + col2W + col3W, y, col4W, rowHeight);

  doc.setTextColor(50, 50, 50);
  doc.text("Site :", margin + 2.5, y + 4.5);
  doc.setTextColor(0, 0, 0);
  doc.text(assignment.beneficiarySite || "Berrechid", margin + col1W + 3, y + 4.5);

  doc.setTextColor(50, 50, 50);
  doc.text("Société :", margin + col1W + col2W + 2.5, y + 4.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Distra SA", margin + col1W + col2W + col3W + 3, y + 4.5);

  y += rowHeight + 2.5;

  // --- 3. TYPE D'AFFECTATION & RESSOURCE AFFECTÉE ---
  const typeBoxHeight = 16;
  doc.rect(margin, y, contentWidth, typeBoxHeight);

  // Row 1: Type d'affectation
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Type d'affectation :", margin + 3, y + 4.6);

  const opType = assignment.operationType || "AFFECTATION";
  drawCheckbox(margin + 42, y + 2, opType === "AFFECTATION", "Affectation");
  drawCheckbox(margin + 88, y + 2, opType === "RÉAFFECTATION", "Réaffectation");

  doc.setDrawColor(220, 220, 220);
  doc.line(margin + 2, y + 8, margin + contentWidth - 2, y + 8);
  doc.setDrawColor(0, 0, 0);

  // Row 2: Ressource affectée
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Ressource affectée :", margin + 3, y + 12.6);

  // Determine resource checks dynamically
  const rTypeStr = assignment.resourceType || "";
  const isSim = assignment.hasSimCard || rTypeStr === "Carte SIM" || rTypeStr === "Carte SIM + SmartPhone" || rTypeStr.includes("SIM");
  const isPhone = assignment.hasSmartphone || rTypeStr === "SmartPhone" || rTypeStr === "Carte SIM + SmartPhone" || (assignment.deviceBrand && !assignment.equipmentType && !assignment.deviceModel?.toLowerCase().includes("hp"));
  const isPc = rTypeStr === "PC / Laptop" || (assignment.equipmentType && (assignment.equipmentType.toLowerCase().includes("pc") || assignment.equipmentType.toLowerCase().includes("laptop") || assignment.equipmentType.toLowerCase().includes("ordinateur"))) || (assignment.deviceBrand?.toUpperCase() === "HP" || assignment.items?.some(i => i.category?.includes("Laptop") || i.category?.includes("Postes Fixes")));
  const isOther = rTypeStr === "Autre matériel IT" || (!isSim && !isPhone && !isPc && (assignment.items?.length || assignment.equipmentType));

  drawCheckbox(margin + 42, y + 10, !!isSim, "Carte SIM");
  drawCheckbox(margin + 76, y + 10, !!isPhone, "Smartphone");
  drawCheckbox(margin + 112, y + 10, !!isPc, "PC / Laptop");
  drawCheckbox(margin + 148, y + 10, !!isOther, "Autre matériel IT");

  y += typeBoxHeight + 2.5;

  // --- 4. INFORMATIONS CARTE SIM ---
  doc.setFillColor(236, 245, 233); // Soft green tint
  doc.rect(margin, y, contentWidth, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 80, 20);
  doc.text("INFORMATIONS CARTE SIM", margin + 3, y + 3.6);

  y += 5;

  const simBoxHeight = 11;
  doc.rect(margin, y, contentWidth, simBoxHeight);

  // Operator
  const op = assignment.simOperator || "IAM";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("Opérateur :", margin + 3, y + 4.5);

  drawCheckbox(margin + 22, y + 2, op === "IAM", "IAM");
  drawCheckbox(margin + 38, y + 2, op === "INWI", "INWI");
  drawCheckbox(margin + 55, y + 2, op === "ORANGE", "ORANGE");
  drawCheckbox(margin + 76, y + 2, op === "AUTRE", "AUTRE");

  // Divider
  doc.setDrawColor(210, 210, 210);
  doc.line(margin + 98, y + 1, margin + 98, y + simBoxHeight - 1);
  doc.setDrawColor(0, 0, 0);

  // Phone / PIN / PUK on Right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text("N° Téléphone :", margin + 102, y + 4.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(assignment.simPhoneNumber || assignment.beneficiaryPhone || "—", margin + 125, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Code PIN :", margin + 102, y + 8.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(assignment.simPin || "—", margin + 120, y + 8.8);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Code PUK :", margin + 142, y + 8.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(assignment.simPuk || "—", margin + 160, y + 8.8);

  y += simBoxHeight + 2.5;

  // --- 5. INFORMATIONS DU MATÉRIEL (DYNAMIC ADAPTIVE TABLE) ---
  doc.setFillColor(236, 245, 233);
  doc.rect(margin, y, contentWidth, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 80, 20);
  doc.text("INFORMATIONS DU MATÉRIEL", margin + 3, y + 3.6);

  y += 5;

  // Table columns layout: Type (34) | Marque (28) | Modèle (34) | N° Série / IMEI (48) | Config (42)
  const matCol1 = 34;
  const matCol2 = 28;
  const matCol3 = 34;
  const matCol4 = 48;
  const matCol5 = contentWidth - matCol1 - matCol2 - matCol3 - matCol4;

  const thH = 5.5;
  doc.setFillColor(104, 159, 56);
  doc.rect(margin, y, contentWidth, thH, "FD");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.text("Type de matériel", margin + matCol1 / 2, y + 3.8, { align: "center" });
  doc.text("Marque", margin + matCol1 + matCol2 / 2, y + 3.8, { align: "center" });
  doc.text("Modèle", margin + matCol1 + matCol2 + matCol3 / 2, y + 3.8, { align: "center" });

  // Dynamic label for Serial / IMEI
  const serialHeaderLabel = isPhone ? "IMEI" : (isPc ? "N° Série / Service Tag" : "N° Série / IMEI");
  doc.text(serialHeaderLabel, margin + matCol1 + matCol2 + matCol3 + matCol4 / 2, y + 3.8, { align: "center" });
  doc.text("Configuration", margin + matCol1 + matCol2 + matCol3 + matCol4 + matCol5 / 2, y + 3.8, { align: "center" });

  y += thH;

  // Data row
  const tdH = 7.5;
  doc.rect(margin, y, contentWidth, tdH);
  doc.line(margin + matCol1, y, margin + matCol1, y + tdH);
  doc.line(margin + matCol1 + matCol2, y, margin + matCol1 + matCol2, y + tdH);
  doc.line(margin + matCol1 + matCol2 + matCol3, y, margin + matCol1 + matCol2 + matCol3, y + tdH);
  doc.line(margin + matCol1 + matCol2 + matCol3 + matCol4, y, margin + matCol1 + matCol2 + matCol3 + matCol4, y + tdH);

  const matType = assignment.equipmentType || (isPc ? "PC Portable" : (isPhone ? "Smartphone" : (assignment.items?.[0]?.name || "Matériel IT")));
  const matBrand = assignment.deviceBrand || assignment.items?.[0]?.brand || "—";
  const matModel = assignment.deviceModel || assignment.items?.[0]?.model || "—";
  const matSerial = assignment.deviceImei || assignment.items?.[0]?.serialNumber || "—";
  
  const matConfig = assignment.deviceConfiguration || [
    assignment.equipmentCpu ? `CPU: ${assignment.equipmentCpu}` : "",
    assignment.equipmentRam ? `RAM: ${assignment.equipmentRam}GB` : "",
    assignment.equipmentStorage ? `SSD: ${assignment.equipmentStorage}GB` : ""
  ].filter(Boolean).join(" | ") || (assignment.items?.[0]?.specs ? `${assignment.items[0].specs.ram || ""} ${assignment.items[0].specs.storage || ""}`.trim() : "") || "Standard";

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(matType, margin + matCol1 / 2, y + 4.8, { align: "center" });
  doc.text(matBrand, margin + matCol1 + matCol2 / 2, y + 4.8, { align: "center" });
  doc.text(matModel, margin + matCol1 + matCol2 + matCol3 / 2, y + 4.8, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(matSerial, margin + matCol1 + matCol2 + matCol3 + matCol4 / 2, y + 4.8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(matConfig, margin + matCol1 + matCol2 + matCol3 + matCol4 + matCol5 / 2, y + 4.8, { align: "center" });

  y += tdH + 2.5;

  // --- 6. RESTITUTION ANCIEN MATÉRIEL & REMARQUES ---
  doc.setFillColor(236, 245, 233);
  doc.rect(margin, y, contentWidth, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 80, 20);
  doc.text("RESTITUTION ANCIEN MATÉRIEL", margin + 3, y + 3.6);

  y += 5;

  const restBoxHeight = 18;
  doc.rect(margin, y, contentWidth, restBoxHeight);

  // Row 1: Restitution Oui / Non
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("Restitution de l'ancien appareil :", margin + 3, y + 4.6);

  const restOld = assignment.restitutionPreviousDevice || "NON";
  drawCheckbox(margin + 55, y + 2, restOld === "OUI", "OUI");
  drawCheckbox(margin + 75, y + 2, restOld === "NON", "NON");

  // Row 2: Condition
  doc.setFont("helvetica", "bold");
  doc.text("État de l'appareil restitué :", margin + 3, y + 9.8);

  const cond = restOld === "NON" ? "Non applicable" : (assignment.restitutedDeviceCondition || "Non applicable");
  drawCheckbox(margin + 44, y + 7.5, cond === "Endommagé", "Endommagé");
  drawCheckbox(margin + 72, y + 7.5, cond === "Cassé mais opérationnel", "Cassé mais opérationnel");
  drawCheckbox(margin + 120, y + 7.5, cond === "Bon état", "Bon état");
  drawCheckbox(margin + 144, y + 7.5, cond === "Non applicable", "Non applicable");

  // Row 3: Remarques (No hardcoded INCIDENT / PANNE!)
  doc.setFont("helvetica", "bold");
  doc.text("Remarques :", margin + 3, y + 15);
  doc.setFont("helvetica", "normal");
  const remarksVal = assignment.incidentRemarks || assignment.notes;
  if (remarksVal && remarksVal.trim() && remarksVal.trim() !== "INCIDENT / PANNE") {
    doc.text(remarksVal.trim(), margin + 23, y + 15);
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin + 23, y + 15.5, margin + contentWidth - 4, y + 15.5);
    doc.setDrawColor(0, 0, 0);
  }

  y += restBoxHeight + 2.5;

  // --- 7. ENGAGEMENT DU BÉNÉFICIAIRE ---
  doc.setFillColor(236, 245, 233);
  doc.rect(margin, y, contentWidth, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 80, 20);
  doc.text("ENGAGEMENT DU BÉNÉFICIAIRE", margin + contentWidth / 2, y + 3.6, { align: "center" });

  y += 5;

  const engBoxHeight = 28;
  doc.rect(margin, y, contentWidth, engBoxHeight);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(30, 30, 30);

  const p1 = "1. Le bénéficiaire s'engage à rendre le matériel (SIM et/ou équipement) en bon état en cas de cessation de travail ou suite à une demande de Distra SA. En cas de non-restitution, la valeur sera déduite du solde de tout compte ou du salaire mensuel.";
  const p2 = "2. En cas de perte, casse, panne ou vol suite à une mauvaise manipulation ou négligence, le bénéficiaire prendra en charge les frais d'achat d'un appareil de même gamme. Le département SI se charge de la récupération de la ligne SIM.";
  const p3 = "3. L'opérateur prend en charge la réparation (ou le remplacement) des appareils sous garantie uniquement pour les anomalies d'usine. Ces réclamations doivent être faites dans les premières semaines suivant la réception.";

  const textLines = doc.splitTextToSize(`${p1}\n\n${p2}\n\n${p3}`, contentWidth - 6);
  doc.text(textLines, margin + 3, y + 3.8);

  y += engBoxHeight + 3;

  // --- 8. SIGNATURES ---
  const sigColW = contentWidth / 2;
  const sigH = 30;

  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, y, sigColW, sigH);
  doc.rect(margin + sigColW, y, sigColW, sigH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Signature du bénéficiaire", margin + sigColW / 2, y + 4.5, { align: "center" });
  doc.text("Visa Département Systèmes d'Information", margin + sigColW * 1.5, y + 4.5, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.8);
  doc.setTextColor(110, 110, 110);
  doc.text('(Date et mention manuscrite "Lu et approuvé")', margin + sigColW / 2, y + 8, { align: "center" });
  doc.text('(Date, visa et cachet DSI)', margin + sigColW * 1.5, y + 8, { align: "center" });

  y += sigH + 3.5;

  // --- 9. FOOTER ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Département Systèmes d'Information", pageWidth / 2, y + 3, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text("DIS-IT-02 | Version 1.0", pageWidth / 2, y + 6.5, { align: "center" });

  // Save PDF file
  const fileName = `Decharge_Materiel_IT_${assignment.beneficiaryName?.replace(/[^a-zA-Z0-9]/g, "_") || "Beneficiaire"}_IT02.pdf`;
  doc.save(fileName);
}

/**
 * Generate and download an official PDF for Material Assignment (Fiche d'Affectation)
 */
export function exportAssignmentToPDF(assignment: MaterialAssignment) {
  // If this assignment is explicitly a Distra SIM/Smartphone form, generate the Distra SIM/Smartphone replica
  if (
    assignment.templateType === "DISTRA_SIM_SMARTPHONE" ||
    assignment.resourceType === "Carte SIM" ||
    assignment.resourceType === "SmartPhone" ||
    assignment.resourceType === "Carte SIM + SmartPhone" ||
    (assignment.hasSimCard && !assignment.equipmentType)
  ) {
    exportDistraSimSmartphoneToPDF(assignment);
    return;
  }

  // Otherwise, default to the official Distra IT Equipment Décharge (matching image.png)
  exportDistraITEquipmentToPDF(assignment);
}

/**
 * Generate and download an official PDF for Material Return (Décharge & Restitution)
 */
export function exportReturnToPDF(assignment: MaterialAssignment) {
  if (!assignment.returnRecord) return;
  const returnRec = assignment.returnRecord;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // --- HEADER SECTION WITH DISTRA LOGO ---
  try {
    const logoUri = getDistraLogoDataUri();
    if (logoUri) {
      doc.addImage(logoUri, "PNG", margin, y, 38, 14);
    }
  } catch (err) {
    // Fallback
    doc.setTextColor(132, 189, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Distra", margin, y + 10);
  }

  // Header Banner on right
  const bannerX = margin + 44;
  const bannerW = contentWidth - 44;
  doc.setFillColor(180, 83, 9); // Amber-700
  doc.roundedRect(bannerX, y, bannerW, 16, 1.5, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DSI — PROCÈS-VERBAL DE RESTITUTION & DÉCHARGE", bannerX + 4, y + 6.5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(254, 243, 199);
  doc.text(`Réf Décharge : ${returnRec.id}  •  Affectation initiale : ${assignment.reference}`, bannerX + 4, y + 12);

  y += 22;

  // Date and location
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const formattedDate = new Date(returnRec.returnDate).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  doc.text(`Casablanca, Maroc — Date de restitution effective : ${formattedDate}`, margin, y);

  y += 6;

  // --- SECTION 1 & 2: 2 CARDS (BENEFICIARY & CONSTAT DSI) ---
  const colWidth = (contentWidth - 6) / 2;

  // Beneficiary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colWidth, 42, 2, 2, "FD");

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, colWidth, 7, 2, 2, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("1. COLLABORATEUR RESTITUANT", margin + 4, y + 5);

  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  let by = y + 12;
  doc.text(`Nom & Prénom :`, margin + 4, by);
  doc.setFont("helvetica", "bold");
  doc.text(`${assignment.beneficiaryName}`, margin + 30, by);
  
  by += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`N° CIN / Matricule :`, margin + 4, by);
  doc.setFont("helvetica", "bold");
  doc.text(`${assignment.beneficiaryCin || "Non renseigné"}`, margin + 30, by);

  by += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Département :`, margin + 4, by);
  doc.setFont("helvetica", "bold");
  doc.text(`${assignment.beneficiaryDepartment}`, margin + 30, by);

  by += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Fonction :`, margin + 4, by);
  doc.text(`${assignment.beneficiaryJobTitle || "Collaborateur"}`, margin + 30, by);

  by += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Affectation Initiale :`, margin + 4, by);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text(assignment.reference, margin + 30, by);

  // Return Inspection Box
  const rightX = margin + colWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightX, y, colWidth, 42, 2, 2, "FD");

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(rightX, y, colWidth, 7, 2, 2, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("2. CONSTAT & DIAGNOSTIC DSI", rightX + 4, y + 5);

  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  let dy = y + 12;
  doc.text(`Motif de retour :`, rightX + 4, dy);
  doc.setFont("helvetica", "bold");
  doc.text(doc.splitTextToSize(returnRec.cause, colWidth - 32)[0] || returnRec.cause, rightX + 28, dy);

  dy += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`État physique :`, rightX + 4, dy);
  doc.setFont("helvetica", "bold");
  doc.text(returnRec.equipmentCondition, rightX + 28, dy);

  dy += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Décision DSI :`, rightX + 4, dy);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text(returnRec.actionTaken, rightX + 28, dy);

  dy += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(`Inspecté par :`, rightX + 4, dy);
  doc.text(returnRec.inspectedBy, rightX + 28, dy);

  dy += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Sécurité Données :`, rightX + 4, dy);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(returnRec.dataWiped ? "Reset Usine Effectué (OK)" : "En cours", rightX + 28, dy);

  y += 48;

  // --- SECTION 3: INVENTORY TABLE ---
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("3. MATÉRIELS RESTITUÉS & CONTRÔLE DES ACCESSOIRES", margin, y);

  y += 4;

  // Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("DÉSIGNATION", margin + 3, y + 5);
  doc.text("MARQUE & MODÈLE", margin + 65, y + 5);
  doc.text("N° DE SÉRIE (SN)", margin + 105, y + 5);
  doc.text("ASSET TAG", margin + 135, y + 5);
  doc.text("ACCESSOIRES REÇUS", margin + 155, y + 5);

  y += 7;

  assignment.items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, contentWidth, 12, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 12, margin + contentWidth, y + 12);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(item.name, 60)[0] || item.name, margin + 3, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`${item.brand} ${item.model}`, margin + 65, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(item.serialNumber, margin + 105, y + 6);

    doc.setTextColor(79, 70, 229);
    doc.text(item.assetTag, margin + 135, y + 6);

    doc.setTextColor(16, 185, 129);
    doc.setFontSize(7);
    const accStr = returnRec.accessoriesReturned?.join(", ") || "Tous reçus";
    doc.text(doc.splitTextToSize(accStr, 35)[0] || accStr, margin + 155, y + 6);

    y += 12;
  });

  y += 5;

  // --- SECTION 4: OBSERVATIONS & ATTESTATION ---
  doc.setFillColor(254, 243, 199); // Amber-50
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, "FD");

  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("4. DIAGNOSTIC TECHNIQUE DSI & QUITUS DE DÉCHARGE :", margin + 3, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(69, 26, 3);
  doc.text(`Observations : ${returnRec.technicalDiagnosis}`, margin + 3, y + 10);
  doc.text(
    `Par le présent acte, la DSI atteste avoir réceptionné les matériels ci-dessus et accorde au collaborateur ${assignment.beneficiaryName} une décharge pleine et entière de sa responsabilité matérielle.`,
    margin + 3,
    y + 16,
    { maxWidth: contentWidth - 6 }
  );

  y += 30;

  // --- SIGNATURES ---
  const sigBoxWidth = (contentWidth - 8) / 2;
  const sigBoxHeight = 36;

  // Beneficiary Signature
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(margin, y, sigBoxWidth, sigBoxHeight, 2, 2, "D");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("LE COLLABORATEUR (RESTITUANT)", margin + 4, y + 6);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('(Mention "Matériel remis et restitué conforme")', margin + 4, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(assignment.beneficiaryName, margin + 4, y + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Date & Signature : ___________________________", margin + 4, y + sigBoxHeight - 4);

  // DSI Signature
  const dsiSigX = margin + sigBoxWidth + 8;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(dsiSigX, y, sigBoxWidth, sigBoxHeight, 2, 2, "D");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("POUR LA DSI (RÉCEPTION TECHNIQUE)", dsiSigX + 4, y + 6);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("(Cachet et Visa de Quitus DSI)", dsiSigX + 4, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(returnRec.inspectedBy, dsiSigX + 4, y + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Cachet & Signature DSI : ______________________", dsiSigX + 4, y + sigBoxHeight - 4);

  // --- FOOTER ---
  y += sigBoxHeight + 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, margin + contentWidth, y);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Procès-Verbal de Décharge DSI • Généré le ${new Date().toLocaleDateString("fr-FR")} • Système Sourcing & IT Assets • Page 1/1`,
    pageWidth / 2,
    y + 4,
    { align: "center" }
  );

  // Save PDF
  const filename = `Decharge_Restitution_${returnRec.id}_${assignment.beneficiaryName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}

/**
 * Generate and download an official PDF for Purchase Order / Demande d'Achat (DA / PO)
 */

