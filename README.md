#  SAP Fiori Fixed Deposit Management (ZFI_FIXED_DEPOSIT)

A comprehensive, beautifully designed SAP UI5 / Fiori application for end-to-end lifecycle management of corporate Fixed Deposits. 

This robust solution allows treasury and finance teams to efficiently track, manage, and process their fixed deposit portfolios, complete with automated interest accruals, maturity processing, and direct integration with backend SAP financial accounting (FI).

---

## ✨ Key Features

### 📊 Executive Dashboard
- **KPI Metrics:** Get instant visibility into the Total FD Corpus, Accrued Interest, Active Deposit count, and Upcoming Maturities.
- **Visual Analytics:** Interactive charts for Bank Allocation (Corpus distribution) and Interest Rate comparisons to ensure maximum yield.
- **Quick Actions:** One-click navigation to essential workflows like New FD creation, Month-End runs, and Maturity Processing.

### 💼 Fixed Deposit Lifecycle
- **FD Creation:** Streamlined forms to create new Fixed Deposits or migrate Legacy FDs, with F4 Value Helps for Company Codes, Banks, and GL accounts.
- **Active Portfolio:** Sort, filter, and search through all active FDs.
- **Dynamic Timeline:** Visual lifecycle timeline for each deposit detailing creation, day-wise interest accumulation, and scheduled maturity.

### 🗓️ Automated Month-End Operations
- **Batch Accruals:** Run bulk month-end interest accruals directly from the UI with custom posting dates.
- **Batch Summaries:** Real-time dialog displaying detailed success and failure logs for all processed deposits.
- **Month-End History:** A comprehensive log of all past month-end runs, complete with links to generated Accounting and Reversal documents.

### 🎯 Maturity & TDS Processing
- **Maturity Alerts:** Dedicated tracking for deposits nearing their scheduled maturity date.
- **Actionable Workflows:** Process maturity (with or without TDS applicability) and auto-renewals in a single click.

### 📒 Accounting Ledger
- **Journal Entries:** A centralized ledger tracking all Accrual, Reversal, and Maturity postings.
- **Direct Navigation:** Seamless cross-app navigation into the native SAP `AccountingDocument` viewer (via semantic object) for deep-dives into specific document numbers.

---

## 🛠️ Technical Stack
- **Frontend Framework:** SAP UI5 (sap.m, sap.f, sap.suite.ui.microchart)
- **Architecture:** Standard MVC (Model-View-Controller)
- **Data Protocol:** SAP OData V2
- **Styling:** Custom CSS (`css/style.css`) incorporating modern UI/UX paradigms like horizon cards, micro-animations, and responsive layouts.

---

## 📂 Project Structure

```text
ZFI_FIXED_DEPO/
├── controller/               # Contains all UI5 Controllers (BaseController, Dashboard, FixedDeposits, etc.)
├── view/                     # XML Views defining the UI structure
├── css/                      # Custom CSS stylesheets (style.css)
├── i18n/                     # Internationalization files
├── Component.js              # Application Component declaration
├── manifest.json             # Application Descriptor (Routing, Data Sources)
└── index.html                # Application entry point
```

---

## 🚀 Getting Started

### Prerequisites
- SAP system with Gateway configured and the corresponding backend OData service (`ZFI_FIXED_DEPOSIT_SRV`) activated.
- Node.js (for local testing via UI5 tooling).

### Running Locally
1. Clone the repository to your local machine.
2. Install UI5 tooling if you haven't already:
   ```bash
   npm install -g @ui5/cli
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   ui5 serve -o index.html
   ```

*(Note: Depending on your setup, you may need a local proxy configuration like `ui5-middleware-simpleproxy` in your `ui5.yaml` to route OData requests to your SAP backend without CORS issues).*

---

## 🎨 UI/UX Philosophy
This app deviates from standard, rigid ERP interfaces. It has been engineered with a "premium first" mindset:
- **Horizon Cards & Glassmorphism:** Elevated, layered UI elements that create depth.
- **Micro-interactions:** Subtle hover states, smooth transitions, and dynamic color changes to delight users.
- **Data Readability:** Use of monospaced fonts for financial figures, custom colored icons for statuses, and clean tabular layouts.

---

## 🤝 Contributing
For enhancements or bug fixes, please ensure all changes to the UI are reflected in both the respective XML view and standard CSS variables in `style.css` to maintain visual consistency.
