sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/SelectDialog",
	"sap/m/StandardListItem",
	"sap/ui/core/CustomData",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/ui/core/BusyIndicator",
	"sap/m/ActionSheet",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/CheckBox",
	"sap/m/VBox",
	"sap/ui/export/Spreadsheet",
	"../util/Frequency",
	"../util/ODataErrorHandler",
	"../service/FdDetailsService"
], function(Controller, JSONModel, MessageBox, MessageToast, SelectDialog, StandardListItem, CustomData, Filter, FilterOperator, Sorter, BusyIndicator, ActionSheet, Dialog, Button, CheckBox, VBox, Spreadsheet, Frequency, ODataErrorHandler, FdDetailsService) {
	"use strict";

	return Controller.extend("com.infocus.zfifixeddepositZFI_FIXED_DEPOSIT.controller.BaseController", {

		// UI5 lifecycle hook. This guarantees initializeApplication() actually
		// runs. If a child controller defines its own onInit, it MUST call
		// BaseController.prototype.onInit.apply(this, arguments) (or simply
		// this.initializeApplication()) itself, otherwise this one is skipped.
		onInit: function() {
			
			this.initializeApplication();
		},

		initializeApplication: function() {
		
			this._fds = [];
			this._entries = [];
			this._f4Cache = {};
			this._f4Dialogs = {};
			this._loadState = {
				status: "Loading FdDetailsSet...",
				state: "Warning"
			};

			// Active-FDs table toolbar state: free-text search, quick-filter
			// chip, status checkboxes from the filter dialog, and an optional
			// KPI click-through filter. _applyTableFilters() combines all of
			// these into a single client-side filter on the table binding.
			this._tableFilters = {
				search: "",
				quick: "all",
				statusChecks: [],
				kpi: null
			};

			this.getView().setModel(new JSONModel(this._buildAppData()));
			this.getView().setModel(new JSONModel(this._buildUiState("dashboard")), "ui");
			this.getView().setModel(new JSONModel({
				principal: "",
				rate: "",
				tenor: "",
				freq: "12",
				maturityValueText: "",
				interestText: "",
				monthlyText: ""
			}), "calc");
			this.getView().setModel(new JSONModel(this._defaultNewFd()), "newFd");
			this.getView().setModel(new JSONModel(this._defaultLegacyFd()), "legacyFd");
			this._setCurrentFiscalYear();
			this._loadFdDetailsFromService();
			this._attachKpiCardHandlers();
		},

		onNavDashboard: function() { this._setPage("dashboard"); },
		onNavFds: function() { this._setPage("fds"); },
		onNavInterest: function() { this._setPage("interest"); },
		onNavMaturity: function() { this._setPage("maturity"); },
		onNavMaturityAlerts: function() { this._setPage("maturityAlerts"); },
		onNavAccounting: function() { this._setPage("accounting"); },
		onNavMonthEnd: function() { this._setPage("monthEnd"); },
		onNavNewfd: function() { this._setPage("newfd"); },
		onNavLegacyFd: function() { this._setPage("legacyfd"); },
		onNavSettings: function() { this._setPage("settings"); },

		onCompanyCodeValueHelp: function() {
			this._openValueHelp({
				title: "Company Code",
				entitySet: "/CocodeF4Set",
				titleProperty: "BUKRS",
				descriptionProperty: "BUTXT",
				targetPath: "/coCode"
			});
		},

		onBankNameValueHelp: function () {

			this._openValueHelp({
				title: "Bank Account",
				entitySet: "/BankNameF4Set",
				titleProperty: "BANKN",
				descriptionProperty: "TEXT1",

				// Store bank name instead of account number
				valueProperty: "TEXT1",

				targetPath: "/bank",

				additionalMappings: [
					{
						source: "HKONT",
						target: "/bankGL"
					}
				]
			});

		},

		onGlPrincipalValueHelp: function() {
			this._openValueHelp({
				title: "FD Principal GL",
				entitySet: "/GlPrincipalSet",
				titleProperty: "GlAcc",
				targetPath: "/glP"
			});
		},

		onBankGlValueHelp: function() {
			this._openValueHelp({
				title: "Bank GL",
				entitySet: "/BankGLF4Set",
				titleProperty: "BANKN",
				descriptionProperty: "Txt50",
				targetPath: "/bankGL"
			});
		},


		onGlReceivableValueHelp: function () {
			this._openValueHelp({
				title: "Interest Receivable GL",
				entitySet: "/GlReceivableSet",
				titleProperty: "GlRece",
				targetPath: "/glI"
			});
		},

		onGlIncomeValueHelp: function () {
			this._openValueHelp({
				title: "Interest Income GL",
				entitySet: "/GlInterestSet",
				titleProperty: "GlInte",
				targetPath: "/glInc"
			});
		},
		onDisplayJournalEntry: function (oEvent) {

    var oSource = oEvent.getSource();

    var oContext =
        oSource.getBindingContext("maturityDisplay") ||
        oSource.getBindingContext();

    if (!oContext) {
        MessageToast.show("Unable to determine selected record.");
        return;
    }

    var oData = oContext.getObject();

    // Determine which link was clicked
    var oBindingInfo = oSource.getBindingInfo("text");
    var sBoundPath = oBindingInfo &&
        oBindingInfo.parts &&
        oBindingInfo.parts[0] &&
        oBindingInfo.parts[0].path;

    var bReversal = sBoundPath === "fdRevNo" ||
        sBoundPath === "FD_REV_NO" ||
        sBoundPath === "fdRevNoText";

    var bTds = sBoundPath === "tdsDocNo" ||
        sBoundPath === "TDS_DOC_NO";

    var sDocNo;

    if (bReversal) {
        sDocNo = oData.fdRevNo || oData.FD_REV_NO;
    } else if (bTds) {
        sDocNo = oData.tdsDocNo || oData.TDS_DOC_NO;
    } else {
        sDocNo = oData.fdDocNo || oData.FD_DOC_NO;
    }

    if (!sDocNo) {
        MessageToast.show((bReversal ? "Reversal" : bTds ? "TDS" : "Accounting") + " Document not available.");
        return;
    }

    // Determine the relevant date for Fiscal Year calculation based on document type
    var oDate;
    
    if (bTds) {
        // Maturity/TDS document is posted at maturity
        var vMatDate = oData.maturity || oData.maturityDate;
        oDate = vMatDate ? this._parseODataDate(vMatDate) : new Date();
    } else if (bReversal) {
        // Reversal documents are posted during month-end or maturity
        oDate = new Date();
    } else {
        // FD opening document is posted on the start date
        var sStartDate = oData.start || oData.startDate;
        if (!sStartDate) {
            MessageToast.show("Start Date not available.");
            return;
        }
        oDate = this._parseODataDate(sStartDate);
    }

    if (!oDate || isNaN(oDate.getTime())) {
        oDate = new Date(); // Safe fallback
    }

    var iYear = oDate.getFullYear();
    var iMonth = oDate.getMonth() + 1;

    var sFiscalYear = (iMonth >= 4) ?
        String(iYear) :
        String(iYear - 1);

    sap.ushell.Container
        .getService("CrossApplicationNavigation")
        .toExternal({
            target: {
                semanticObject: "AccountingDocument",
                action: "displayDocument"
            },
            params: {
                CompanyCode: oData.coCode || oData.CoCode,
                AccountingDocument: sDocNo,
                FiscalYear: sFiscalYear
            }
        });

},
		onProfitCenterValueHelp: function() {
			this._openValueHelp({
				title: "Profit Center",
				entitySet: "/ProfitCenterF4Set",
				titleProperty: "Prctr",
				descriptionProperty: "ktext",
				targetPath: "/profitCenter"
			});
		},

		onOpeningFdValueHelp: function() {
			this._openValueHelp({
				title: "Purpose of Opening a FD",
				entitySet: "/PurposeF4Set",
				titleProperty: "Purpose",
				targetPath: "/openingFd"
			});
		},

		onLegacyCompanyCodeValueHelp: function() {
			this._openValueHelp({
				title: "Company Code",
				entitySet: "/CocodeF4Set",
				titleProperty: "BUKRS",
				descriptionProperty: "BUTXT",
				targetPath: "/coCode",
				modelName: "legacyFd"
			});
		},

		onLegacyBankNameValueHelp: function () {

			this._openValueHelp({
				title: "Bank Account",
				entitySet: "/BankNameF4Set",
				titleProperty: "BANKN",
				descriptionProperty: "TEXT1",

				valueProperty: "TEXT1",

				targetPath: "/bank",
				modelName: "legacyFd",

				additionalMappings: [
					{
						source: "HKONT",
						target: "/bankGL"
					}
				]
			});

		},

		onLegacyOpeningFdValueHelp: function() {
			this._openValueHelp({
				title: "Purpose of Opening a FD",
				entitySet: "/PurposeF4Set",
				titleProperty: "Purpose",
				targetPath: "/openingFd",
				modelName: "legacyFd"
			});
		},

		onLegacyGlPrincipalValueHelp: function() {
			this._openValueHelp({
				title: "FD Principal GL",
				entitySet: "/GlPrincipalSet",
				titleProperty: "GlAcc",
				targetPath: "/glP",
				modelName: "legacyFd"
			});
		},

		onLegacyBankGlValueHelp: function() {
			this._openValueHelp({
				title: "Bank GL",
				entitySet: "/BankGLF4Set",
				titleProperty: "saknr",
				descriptionProperty: "Txt50",
				targetPath: "/bankGL",
				modelName: "legacyFd"
			});
		},

		onLegacyGlReceivableValueHelp: function () {
			this._openValueHelp({
				title: "Interest Receivable GL",
				entitySet: "/GlReceivableSet",
				titleProperty: "GlRece",
				targetPath: "/glI",
				modelName: "legacyFd"
			});
		},

		onLegacyGlIncomeValueHelp: function () {
			this._openValueHelp({
				title: "Interest Income GL",
				entitySet: "/GlInterestSet",
				titleProperty: "GlInte",
				targetPath: "/glInc",
				modelName: "legacyFd"
			});
		},

		onLegacyProfitCenterValueHelp: function() {
			this._openValueHelp({
				title: "Profit Center",
				entitySet: "/ProfitCenterF4Set",
				titleProperty: "Prctr",
				descriptionProperty: "ktext",
				targetPath: "/profitCenter",
				modelName: "legacyFd"
			});
		},

		onFDFilter: function(oEvent) {
			this.getView().getModel("ui").setProperty("/fdFilter", oEvent.getParameter("key"));
			this._refresh();
		},

		onAcctFilter: function(oEvent) {
			this.getView().getModel("ui").setProperty("/acctFilter", oEvent.getParameter("key"));
			this._refresh();
		},

		// ---------- Active FDs table toolbar: search / quick filter / sort / filter dialog / export ----------

		onSearchFD: function(oEvent) {
			this._tableFilters.search = (oEvent.getParameter("newValue") || "").trim();
			this._applyTableFilters();
		},

		onQuickFilterFD: function(oEvent) {
			this._tableFilters.quick = oEvent.getParameter("key") || "all";
			this._tableFilters.kpi = null;
			this._applyTableFilters();
		},

		onSortFD: function(oEvent) {
			if (!this._oSortActionSheet) {

				var aOptions = [
					{ text: "Principal (High to Low)", path: "principal", descending: true },
					{ text: "Start Date (Newest first)", path: "start", descending: true },
					{ text: "Maturity (Soonest first)", path: "start", descending: false },
					{ text: "Creation Date (Newest first)", path: "creationDate", descending: true },
					{ text: "Bank (A-Z)", path: "bank", descending: false }
				];

				this._oSortActionSheet = new ActionSheet({
					title: "Sort by",
					buttons: aOptions.map(function(oOption) {
						return new Button({
							text: oOption.text,
							press: function() {
								var oBinding = this.byId("fdTable") && this.byId("fdTable").getBinding("items");
								if (oBinding) {
									oBinding.sort(new Sorter(oOption.path, oOption.descending));
								}
							}.bind(this)
						});
					}.bind(this))
				});

				this.getView().addDependent(this._oSortActionSheet);
			}

			this._oSortActionSheet.openBy(oEvent.getSource());
		},

		onFilterFD: function() {
			if (!this._oFilterDialog) {

				var oFilterModel = new JSONModel({
					active: this._tableFilters.statusChecks.indexOf("active") > -1,
					matured: this._tableFilters.statusChecks.indexOf("matured") > -1,
					renewed: this._tableFilters.statusChecks.indexOf("renewed") > -1,
					autoRenew: this._tableFilters.statusChecks.indexOf("autoRenew") > -1
				});

				this._oFilterDialog = new Dialog({
					title: "Filter Fixed Deposits",
					contentWidth: "20rem",
					content: [
						new VBox({
							items: [
								new CheckBox({ text: "Active", selected: "{filter>/active}" }),
								new CheckBox({ text: "Matured", selected: "{filter>/matured}" }),
								new CheckBox({ text: "Renewed", selected: "{filter>/renewed}" }),
								new CheckBox({ text: "Auto Renew", selected: "{filter>/autoRenew}" })
							]
						}).addStyleClass("sapUiSmallMargin")
					],
					beginButton: new Button({
						text: "Apply",
						type: "Emphasized",
						press: function() {
							var oData = oFilterModel.getData();
							this._tableFilters.statusChecks = Object.keys(oData).filter(function(sKey) {
								return oData[sKey];
							});
							this._applyTableFilters();
							this._oFilterDialog.close();
						}.bind(this)
					}),
					endButton: new Button({
						text: "Cancel",
						press: function() { this._oFilterDialog.close(); }.bind(this)
					})
				});

				this._oFilterDialog.setModel(oFilterModel, "filter");
				this.getView().addDependent(this._oFilterDialog);
			}

			this._oFilterDialog.open();
		},

		onExportFD: function() {
			var oTable = this.byId("fdTable");
			var oBinding = oTable && oTable.getBinding("items");

			if (!oBinding) {
				MessageToast.show("Nothing to export.");
				return;
			}

			var aContexts = oBinding.getContexts(0, oBinding.getLength());
			var aRows = aContexts.map(function(oContext) { return oContext.getObject(); });

			if (!aRows.length) {
				MessageToast.show("No rows match the current filter.");
				return;
			}

			var aColumns = [
				{ label: "FD Number", property: "id", type: "string" },
				{ label: "Bank", property: "bank", type: "string" },
				{ label: "Principal", property: "principalText", type: "string" },
				{ label: "Rate", property: "rateText", type: "string" },
				{ label: "Start", property: "startText", type: "string" },
				{ label: "Creation Date", property: "creationDateText", type: "string" },
				{ label: "Maturity", property: "maturityText", type: "string" },
				{ label: "Status", property: "statusText", type: "string" },
				{ label: "Accounting Doc", property: "fdDocNoText", type: "string" },
				{ label: "Auto-renew", property: "autoRenewText", type: "string" }
			];

			var oSheet = new Spreadsheet({
				workbook: { columns: aColumns, context: { title: "Active Fixed Deposits" } },
				dataSource: aRows,
				fileName: "Active_Fixed_Deposits.xlsx",
				worker: false
			});

			oSheet.build()
				.then(function() {
					MessageToast.show("Export complete.");
				})
				.catch(function() {
					MessageBox.error("Export failed.");
				})
				.finally(function() {
					oSheet.destroy();
				});
		},

		onCalculateInterest: function() {
			var oCalcModel = this.getView().getModel("calc");
			var oCalc = oCalcModel.getData();
			var iPrincipal = Number(oCalc.principal) || 0;
			var fRate = (Number(oCalc.rate) || 0) / 100;
			var sStart = oCalc.startDate;
			var sMaturity = oCalc.maturityDate;

			if (!iPrincipal || !fRate || !sStart || !sMaturity) {
				oCalcModel.setProperty("/maturityValueText", "");
				oCalcModel.setProperty("/interestText", "");
				return;
			}

			var oStartDate = new Date(sStart);
			var oMaturityDate = new Date(sMaturity);
			
			if (isNaN(oStartDate.getTime()) || isNaN(oMaturityDate.getTime())) {
				oCalcModel.setProperty("/maturityValueText", "");
				oCalcModel.setProperty("/interestText", "");
				return;
			}

			// Inclusive days counting
			oStartDate.setHours(0,0,0,0);
			oMaturityDate.setHours(0,0,0,0);
			var iDiffTime = oMaturityDate.getTime() - oStartDate.getTime();
			var iDays = Math.floor(iDiffTime / (1000 * 3600 * 24)) + 1;
			if (iDays < 0) iDays = 0;

			// Principal * Rate * Days / 365
			var fInterest = (iPrincipal * fRate * iDays) / 365;
			var fMaturity = iPrincipal + fInterest;

			oCalcModel.setProperty("/maturityValueText", this._fmt(fMaturity));
			oCalcModel.setProperty("/interestText", this._fmt(fInterest));
		},

		onCreateFD: function () {

			var oNewFdModel = this.getView().getModel("newFd");
			var oData = oNewFdModel.getData();
			var oServiceModel = this.getOwnerComponent().getModel();

			var sCoCode = (oData.coCode || "").trim();
			var sId = (oData.id || "").trim();
			var sBank = (oData.bank || "").trim();
			var sPrincipal = (oData.principal || "").trim();
			var sRate = (oData.rate || "").trim();
			var sTenor = (oData.tenor || "").trim();
			var sOpeningFd = (oData.openingFd || "").trim();
			var sProfitCenter = (oData.profitCenter || "").trim();
			var sBankGl = (oData.bankGL || "").trim();

			if (!oServiceModel || !oServiceModel.read) {
				oNewFdModel.setProperty("/message", "OData model is not available.");
				return;
			}

			console.log({
				coCode: !sCoCode,
				id: !sId,
				bank: !sBank,
				principal: !sPrincipal,
				rate: !sRate,
				start: !oData.start,
				tenor: !sTenor,
				freq: !oData.freq,
				openingFd: !sOpeningFd,
				glP: !oData.glP,
				bankGL: !sBankGl,
				glI: !oData.glI,
				glInc: !oData.glInc,
				profitCenter: !sProfitCenter
			});

			// Mandatory field validation
			if (
				!sCoCode ||
				!sId ||
				!sBank ||
				!sPrincipal ||
				!sRate ||
				!oData.start ||
				!sTenor ||
				!oData.freq ||
				!sOpeningFd ||
				!oData.glP ||
				!sBankGl ||
				!oData.glI ||
				!oData.glInc ||
				!sProfitCenter
			) {
				oNewFdModel.setProperty("/message", "Please fill all required fields.");
				MessageBox.error("Please fill all mandatory fields.");
				return;
			}

			// Financial year validation
			var oStartDate = new Date(oData.start + "T00:00:00");

			var oToday = new Date();
			var iYear = oToday.getFullYear();
			var iMonth = oToday.getMonth();

			var oFiscalStart, oFiscalEnd;

			if (iMonth >= 3) {
				oFiscalStart = new Date(iYear, 3, 1);
				oFiscalEnd = new Date(iYear + 1, 2, 31);
			} else {
				oFiscalStart = new Date(iYear - 1, 3, 1);
				oFiscalEnd = new Date(iYear, 2, 31);
			}

			if (oStartDate < oFiscalStart || oStartDate > oFiscalEnd) {
				MessageBox.error("Start Date must be within the current financial year.");
				return;
			}

			oNewFdModel.setProperty("/message", "Creating FD...");
			oNewFdModel.setProperty("/message", "Generating Accounting Document...");
			oNewFdModel.setProperty("/fdDocNo", "");

			FdDetailsService.generateAccountingDoc(oServiceModel, {

				filters: [
					new Filter("CoCode", FilterOperator.EQ, sCoCode),
					new Filter("FdAccno", FilterOperator.EQ, sId),
					new Filter("BankName", FilterOperator.EQ, sBank),
					new Filter("PrincipalAmt", FilterOperator.EQ, sPrincipal),
					new Filter("InterestRate", FilterOperator.EQ, sRate),
					new Filter("StartDate", FilterOperator.EQ, this._toODataDateTime(oData.start)),
					new Filter(
						"CREATE_DATE",
						FilterOperator.EQ,
						this._toODataDateTime(oData.createDate)
					),
					new Filter("TenorMonths", FilterOperator.EQ, sTenor),
					new Filter("CompoundFreq", FilterOperator.EQ, this._compoundFreqText(oData.freq)),
					new Filter("OpeningFd", FilterOperator.EQ, sOpeningFd),
					new Filter("GlPrincipal", FilterOperator.EQ, (oData.glP || "").trim()),
					new Filter("BankGl", FilterOperator.EQ, sBankGl),
					new Filter("GlReceivable", FilterOperator.EQ, (oData.glI || "").trim()),
					new Filter("GlIncome", FilterOperator.EQ, (oData.glInc || "").trim()),
					new Filter("ProfitCenter", FilterOperator.EQ, sProfitCenter)
				],

				success: function (oResponse) {

					var aResults = oResponse.results || [];

					if (!aResults.length) {
						MessageBox.error("No response received from backend.");
						return;
					}

					var oResult = aResults[0];
					var sDocNo = oResult.FdDocNo || "";
					var sMsg = oResult.Message || "FD Created Successfully";

					MessageToast.show(sMsg);

					this._resetModelProperties(
						oNewFdModel,
						this._defaultNewFd(sMsg)
					);

					// Set document number after resetting the model
					oNewFdModel.setProperty("/fdDocNo", sDocNo);

					// Refresh OData model
					var oModel = this.getOwnerComponent().getModel();
					oModel.refresh(true);

					// Reload dashboard data
					this._loadFdDetailsFromService();

				}.bind(this),

				error: function (oError) {

					var sMessage = this._extractODataError(oError);

					oNewFdModel.setProperty("/message", sMessage);

					MessageBox.error(sMessage);

				}.bind(this)

			});

		},

		onPostLegacyFD: function() {
			var oLegacyModel = this.getView().getModel("legacyFd");
			var oData = oLegacyModel.getData();
			var oServiceModel = this.getOwnerComponent().getModel();
			var sCoCode = (oData.coCode || "").trim();
			var sId = (oData.id || "").trim();
			var sBank = (oData.bank || "").trim();
			var sPrincipal = (oData.principal || "").trim();
			var sRate = (oData.rate || "").trim();
			var sTenor = (oData.tenor || "").trim();
			var sOpeningFd = (oData.openingFd || "").trim();
			var sProfitCenter = (oData.profitCenter || "").trim();

			if (!oServiceModel || !oServiceModel.create) {
				oLegacyModel.setProperty("/message", "OData model is not available.");
				return;
			}

			if (
				!sCoCode ||
				!sId ||
				!sBank ||
				!sPrincipal ||
				!sRate ||
				!oData.start ||
				!sTenor ||
				!oData.freq ||
				!sOpeningFd ||
				!oData.glP ||
				!oData.bankGL ||
				!oData.glI ||
				!oData.glInc ||
				!sProfitCenter
			) {
				oLegacyModel.setProperty("/message", "Please fill all required fields.");
				MessageBox.error("Please fill all mandatory fields.");
				return;
			}

			oLegacyModel.setProperty("/message", "Posting accounting document...");
			oLegacyModel.setProperty("/fdDocNo", "");

			var oPayload = {
				CoCode: sCoCode,
				FdAccno: sId,
				BankName: sBank,
				PrincipalAmt: sPrincipal,
				InterestRate: sRate,
				StartDate: this._toODataDateTime(oData.start),
				CREATE_DATE: this._toODataDateTime(oData.createDate),
				TenorMonths: sTenor,
				CompoundFreq: this._compoundFreqText(oData.freq),
				OPENING_FD: sOpeningFd,
				GlPrincipal: (oData.glP || "").trim(),
				BankGl: (oData.bankGL || "").trim(),
				GlReceivable: (oData.glI || "").trim(),
				GlIncome: (oData.glInc || "").trim(),
				ProfitCenter: sProfitCenter
			};

			oLegacyModel.setProperty("/message", "Posting Legacy FD...");

			FdDetailsService.createLegacyFd(oServiceModel, oPayload, {

				success: function (oResponse) {

					var sDocNo = oResponse && oResponse.FdDocNo ? oResponse.FdDocNo : "";

					MessageToast.show("Legacy FD Posted Successfully");

					this._resetModelProperties(
						oLegacyModel,
						this._defaultLegacyFd("Legacy FD Posted Successfully")
					);

					// set doc number after the reset, otherwise the default
					// model (which also clears fdDocNo) would wipe it out
					if (sDocNo) {
						oLegacyModel.setProperty("/fdDocNo", sDocNo);
					}

					this._loadFdDetailsFromService();

					this._refresh();

				}.bind(this),

				error: function (oError) {

					var sMessage = this._extractODataError(oError);

					oLegacyModel.setProperty("/message", sMessage);

					MessageBox.error(sMessage);

				}.bind(this)

			});
		},

		onOpenMaturity: function(oEvent) {
			var oFd = this._getObjectFromEvent(oEvent);
			this._showMaturityDialog(oFd);
		},

		onOpenAlertMaturity: function(oEvent) {
			var oAlert = this._getObjectFromEvent(oEvent);
			var oFd = this._fds.filter(function(oItem) {
				return oItem.id === oAlert.fdId;
			})[0];
			this._showMaturityDialog(oFd);
		},
		onRefreshFDTable: function () {

			this._loadFdDetailsFromService();
			MessageToast.show("Refreshing...");

		},
		onRunMonthEnd: function() {
			MessageBox.success("Month-end run complete.\n\nInterest accrual entries posted for active FDs.\nPrevious month reversals posted on the first day.\nMaturity alerts refreshed.\n\nTotal accrual posted: " + this.getView().getModel().getProperty("/metrics/accruedInterest"));
		},

		onSaveSettings: function() {
			MessageToast.show("Settings saved");
		},

		_showMaturityDialog: function(oFd) {
			if (!oFd) {
				return;
			}

			var fMaturity = this._maturityValue(oFd);
			var fInterest = fMaturity - oFd.principal;
			var sDetails = [
				oFd.bank + " | Maturity date: " + oFd.maturityText,
				"Principal: " + oFd.principalText,
				"Maturity value: " + this._fmt(fMaturity),
				"",
				"Accounting entries to post:",
				"Dr Bank A/c (" + oFd.glP + ") " + this._fmt(fMaturity),
				"Cr FD principal (" + oFd.glP + ") " + this._fmt(oFd.principal),
				"Cr Interest receivable (" + oFd.glI + ") " + this._fmt(fInterest)
			].join("\n");

			MessageBox.show(sDetails, {
				title: "Maturity processing - " + oFd.id,
				actions: ["Encash", "Renew principal", "Renew with interest", MessageBox.Action.CANCEL],
				onClose: function(sAction) {
					if (sAction === MessageBox.Action.CANCEL) {
						return;
					}
					this._processMaturity(oFd.id, sAction);
				}.bind(this)
			});
		},

		_processMaturity: function(sId, sAction) {
			var oFd = this._fds.filter(function(oItem) {
				return oItem.id === sId;
			})[0];
			if (!oFd) {
				return;
			}

			oFd.status = sAction === "Encash" ? "matured" : "renewed";
			this._entries.push({
				doc: "DOC-" + sId.split("-").pop(),
				date: this._dateToIso(new Date()),
				type: "Maturity",
				fd: sId,
				gl: oFd.glP,
				drcr: "Dr",
				amount: this._maturityValue(oFd),
				text: sAction + " processed"
			});
			this._refresh();
			MessageToast.show(sId + " " + (sAction === "Encash" ? "encashed" : "renewed") + " successfully");
		},

		_setPage: function(sPage) {
			var mRoutes = {
				dashboard: "dashboard",
				fds: "fixedDeposits",
				interest: "interestAccrual",
				maturity: "maturity",
				maturityAlerts: "maturityAlerts",
				accounting: "accountingEntries",
				monthEnd: "monthEnd",
				newfd: "newFD",
				legacyfd: "legacyFD",
				settings: "settings"
			};
			this._applyUiState(sPage);
			if (this.getOwnerComponent && this.getOwnerComponent().getRouter) {
				this.getOwnerComponent().getRouter().navTo(mRoutes[sPage] || "dashboard");
			}
		},

		_refresh: function () {

			var oModel = this.getView().getModel();
			var oData = this._buildAppData();

			console.log("===== DASHBOARD DATA =====");
			console.log("FD Count:", oData.fds.length);
			console.table(oData.fds);

			Object.keys(oData).forEach(function (sPath) {
				oModel.setProperty("/" + sPath, oData[sPath]);
			});

			// Table binding is filtered client-side (search/quick filter/dialog/KPI),
			// so re-apply that filter state whenever the underlying data is rebuilt -
			// otherwise a refresh would silently drop the active filter.
			this._applyTableFilters();

		},
		_loadFdDetailsFromService: function () {

			BusyIndicator.show(0);

			var oServiceModel = this.getOwnerComponent().getModel();

			if (!oServiceModel || !oServiceModel.read) {
				BusyIndicator.hide();
				this._setLoadState("OData model is not available.", "Error");
				return;
			}

			FdDetailsService.readFdDetails(oServiceModel, {

				success: function (oData) {

					BusyIndicator.hide();

					var aResults = oData.results || [];

					this._fds = aResults.map(this._mapFdDetailsEntity.bind(this));

					this._entries = [];

					this._setLoadState(
						"Loaded " + aResults.length + " records from FdDetailsSet.",
						"Success",
						false
					);

					this._refresh();

				}.bind(this),

				error: function () {

					BusyIndicator.hide();

					this._setLoadState(
						"Could not load FdDetailsSet.",
						"Error"
					);

				}.bind(this)

			});

		},

		_setLoadState: function(sMessage, sState, bToast) {
			this._loadState = {
				status: sMessage,
				state: sState
			};
			this._refresh();
			if (bToast) {
				MessageToast.show(sMessage);
			}
		},

		// ---------- Active FDs table filter engine ----------

		// Combines free-text search, the quick-filter chip, the filter
		// dialog's checkboxes, and a KPI click-through filter into one
		// client-side filter on the fdTable binding.
		_applyTableFilters: function() {
			var oTable = this.byId("fdTable");
			var oBinding = oTable && oTable.getBinding("items");

			if (!oBinding) {
				return;
			}

			var oState = this._tableFilters;
			var aFilters = [];

			if (oState.search) {
				aFilters.push(new Filter({
					filters: [
						new Filter("id", FilterOperator.Contains, oState.search),
						new Filter("bank", FilterOperator.Contains, oState.search),
						new Filter("fdDocNoText", FilterOperator.Contains, oState.search),
						new Filter("statusText", FilterOperator.Contains, oState.search)
					],
					and: false
				}));
			}

			if (oState.quick && oState.quick !== "all") {
				aFilters.push(this._statusOrAutoRenewFilter(oState.quick));
			}

			if (oState.statusChecks && oState.statusChecks.length) {
				aFilters.push(new Filter({
					filters: oState.statusChecks.map(this._statusOrAutoRenewFilter.bind(this)),
					and: false
				}));
			}

			if (oState.kpi) {
				aFilters.push(new Filter(oState.kpi, FilterOperator.EQ, true));
			}

			oBinding.filter(aFilters);
		},

		// "autoRenew" is a boolean flag on the FD, everything else
		// (active/matured/renewed) is a value of the "status" field.
		_statusOrAutoRenewFilter: function(sKey) {
			return sKey === "autoRenew" ?
				new Filter("autoRenew", FilterOperator.EQ, true) :
				new Filter("status", FilterOperator.EQ, sKey);
		},

		// ---------- KPI-tile click-through filtering ----------

		_attachKpiCardHandlers: function() {
			var mHandlers = {
				fdCorpusCard: this._filterByQuickKey.bind(this, "active"),
				fdAccruedCard: this._filterByQuickKey.bind(this, "active"),
				fdMaturingCard: this._filterByKpi.bind(this, "maturingThisMonth"),
				fdAutoRenewCard: this._filterByKpi.bind(this, "autoRenew"),
				fdMonthEndCard: this.onNavMonthEnd.bind(this)
			};

			Object.keys(mHandlers).forEach(function(sId) {
				var oCard = this.byId(sId);
				if (oCard) {
					oCard.attachBrowserEvent("click", mHandlers[sId]);
				}
			}.bind(this));
		},

		_filterByQuickKey: function(sKey) {
			this._tableFilters.kpi = null;
			this._tableFilters.quick = sKey;
			this._syncQuickFilterChip(sKey);
			this._applyTableFilters();
		},

		_filterByKpi: function(sProperty) {
			this._tableFilters.kpi = sProperty;
			this._tableFilters.quick = "all";
			this._syncQuickFilterChip("all");
			this._applyTableFilters();
		},

		_syncQuickFilterChip: function(sKey) {
			var oUiModel = this.getView().getModel("ui");
			if (oUiModel) {
				oUiModel.setProperty("/quickFilter", sKey);
			}
		},

		_openValueHelp: function (oConfig) {

			// Defensive guard: these are normally set up in
			// initializeApplication(), but if that hasn't run yet for any
			// reason (e.g. onInit not wired up, or a race on first click)
			// this stops "Cannot read properties of undefined" errors and
			// self-heals instead of crashing.
			this._f4Cache = this._f4Cache || {};
			this._f4Dialogs = this._f4Dialogs || {};

			var sKey = oConfig.entitySet;
			var sDescProp = oConfig.descriptionProperty || oConfig.titleProperty;

			var fnFilter = function (oEvent) {
				var sValue = oEvent.getParameter("value");
				var aFilters = [];
				if (sValue) {
					aFilters.push(new Filter({
						filters: [
							new Filter(oConfig.titleProperty, FilterOperator.Contains, sValue),
							new Filter(sDescProp, FilterOperator.Contains, sValue)
						],
						and: false
					}));
				}
				oEvent.getSource().getBinding("items").filter(aFilters);
			};

			// Dialog already exists → reset any stale search/filter, then reopen
			if (this._f4Dialogs[sKey]) {

				this._f4Dialogs[sKey]._config = oConfig;

				var oExistingBinding = this._f4Dialogs[sKey].getBinding("items");
				if (oExistingBinding) {
					oExistingBinding.filter([]);
				}
				if (this._f4Dialogs[sKey].setSearchValue) {
					this._f4Dialogs[sKey].setSearchValue("");
				}

				this._f4Dialogs[sKey].open();

				return;
			}

			var oServiceModel = this.getOwnerComponent().getModel();

			if (!oServiceModel || !oServiceModel.read) {
				MessageBox.error("OData model is not available.");
				return;
			}

			var fnCreateDialog = function (aResults) {

				var oDialog = new SelectDialog({

					title: oConfig.title,

					growing: true,
					growingThreshold: 50,

					search: fnFilter,
					liveChange: fnFilter,

					confirm: function (oEvent) {

						var oSelectedItem = oEvent.getParameter("selectedItem");

						if (!oSelectedItem) {
							return;
						}

						var oData = oSelectedItem.getBindingContext().getObject();

						var oModel = this.getView().getModel(
							oDialog._config.modelName || "newFd"
						);

						// Populate the main field
						oModel.setProperty(
							oDialog._config.targetPath,
							oData[oDialog._config.valueProperty || oDialog._config.titleProperty] || ""
						);

						// Populate additional fields if configured
						if (oDialog._config.additionalMappings) {

							oDialog._config.additionalMappings.forEach(function (oMap) {

								oModel.setProperty(
									oMap.target,
									oData[oMap.source] || ""
								);

							});

						}

					}.bind(this)

				});

				oDialog.setModel(new JSONModel({ items: aResults }));
				oDialog.bindAggregation("items", {
					path: "/items",
					template: new StandardListItem({
						title: "{" + oConfig.titleProperty + "}",
						description: oConfig.descriptionProperty ? "{" + oConfig.descriptionProperty + "}" : ""
					})
				});

				oDialog._config = oConfig;

				this.getView().addDependent(oDialog);

				this._f4Dialogs[sKey] = oDialog;

				oDialog.open();

			}.bind(this);

			// Already cached → don't call backend
			if (this._f4Cache[sKey]) {

				fnCreateDialog(this._f4Cache[sKey]);

				return;

			}

			// First time only
			BusyIndicator.show(0);

			oServiceModel.read(sKey, {

				success: function (oData) {

					BusyIndicator.hide();

					var aResults = oData.results || [];

					this._f4Cache[sKey] = aResults;

					fnCreateDialog(aResults);

				}.bind(this),

				error: function (oError) {

					sap.ui.core.BusyIndicator.hide();

					MessageBox.error(this._extractODataError(oError));

				}.bind(this)

			});

		},

		_mapFdDetailsEntity: function(oEntity) {

			console.log("FD Entity:", oEntity);
			console.log("Available Properties:", Object.keys(oEntity));
			console.log("CREATE_DATE:", oEntity.CREATE_DATE);
			console.log("CreateDate:", oEntity.CreateDate);

			var iTenor = this._parseTenor(oEntity.TenorMonths);

			var oCreateDate =
				oEntity.CREATE_DATE ||
				oEntity.CreateDate ||
				oEntity.create_date;

			var oFd = {
				id: oEntity.FdAccno,
				coCode: oEntity.CoCode,
				bank: oEntity.BankName,
				principal: this._parseNumber(oEntity.PrincipalAmt),
				rate: this._parseNumber(oEntity.InterestRate),
				start: this._dateToIso(this._parseODataDate(oEntity.StartDate)),
				tenor: iTenor,
				freq: this._parseCompoundFreq(oEntity.CompoundFreq),
				openingFd: oEntity.OPENING_FD,
				autoRenew: this._parseBoolean(oEntity.AutoRenew || oEntity.AUTO_RENEW),
				rollInterest: this._parseBoolean(oEntity.RollInterest || oEntity.ROLL_INTEREST),
				status: "active",
				glP: oEntity.GlPrincipal,
				bankGL: oEntity.BankGl,
				glI: oEntity.GlReceivable,
				glInc: oEntity.GlIncome,
				profitCenter: oEntity.ProfitCenter,
				fdDocNo: oEntity.FD_DOC_NO || oEntity.FdDocNo,
				fdRevNo: oEntity.FD_REV_NO || oEntity.FdRevNo,
				creationDate: oCreateDate ? this._dateToIso(this._parseODataDate(oCreateDate)) : ""
			};

			// _maturityDate() can legitimately return null (missing/unparseable
			// start date) - guard it here instead of assuming a Date comes back.
			var oMaturity = this._maturityDate(oFd);
			oFd.status = (oMaturity && oMaturity < new Date()) ? "matured" : "active";

			return oFd;
		},

		_applyUiState: function(sPage) {
			var oUiModel = this.getView().getModel("ui");
			var oState = this._buildUiState(sPage);
			Object.keys(oState).forEach(function(sPath) {
				oUiModel.setProperty("/" + sPath, oState[sPath]);
			});
		},

		_buildUiState: function(sPage) {
			var mTitles = {
				dashboard: "Dashboard",
				fds: "Fixed Deposits",
				interest: "Interest Accrual",
				maturity: "Maturity Alerts",
				accounting: "Accounting Entries",
				monthEnd: "Run Month End Activity",
				newfd: "New Fixed Deposit",
				legacyfd: "Legacy FD Posting",
				settings: "Settings"
			};
			var oVisible = {};
			var oNav = {};
			Object.keys(mTitles).forEach(function(sKey) {
				oVisible[sKey] = sKey === sPage;
				oNav[sKey] = sKey === sPage ? "Emphasized" : "Transparent";
			});

			var oExistingUiModel = this.getView() && this.getView().getModel("ui");

			return {
				title: mTitles[sPage] || "Dashboard",
				visible: oVisible,
				nav: oNav,
				fdFilter: oExistingUiModel ? oExistingUiModel.getProperty("/fdFilter") || "all" : "all",
				acctFilter: oExistingUiModel ? oExistingUiModel.getProperty("/acctFilter") || "all" : "all",
				quickFilter: oExistingUiModel ? oExistingUiModel.getProperty("/quickFilter") || "all" : "all",
				fiscalYearText: this._getCurrentFiscalYearText()
			};
		},

		// Our system follows fiscal year variant V3 (1 April - 31 March):
		// Jan/Feb/Mar fall in the fiscal year that started the previous
		// calendar April, everything else starts the fiscal year in the
		// current calendar April. Always derived from today's date, so the
		// topbar never needs a manual yearly update.
		_getCurrentFiscalYearText: function() {
			var oToday = new Date();
			var iYear = oToday.getFullYear();
			var iMonth = oToday.getMonth(); // 0 = January
			var iFiscalStartYear = iMonth >= 3 ? iYear : iYear - 1;
			var sEndYearSuffix = String((iFiscalStartYear + 1) % 100).padStart(2, "0");
			return "FY " + iFiscalStartYear + "-" + sEndYearSuffix;
		},

		_buildAppData: function() {
			// filter(Boolean) belts-and-braces the map: _decorateFd() already
			// catches and logs per-record failures and returns null for a bad
			// FD instead of throwing, so one malformed record can't take down
			// the whole dashboard/table.
			var aFds = this._fds.map(this._decorateFd.bind(this)).filter(Boolean);
			var aEntries = this._entries.map(this._decorateEntry.bind(this));
			var sFdFilter = this.getView() && this.getView().getModel("ui") ? this.getView().getModel("ui").getProperty("/fdFilter") || "all" : "all";
			var sAcctFilter = this.getView() && this.getView().getModel("ui") ? this.getView().getModel("ui").getProperty("/acctFilter") || "all" : "all";
			var aActive = aFds.filter(function(oFd) { return oFd.status === "active"; });
			var fCorpus = aActive.reduce(function(iSum, oFd) { return iSum + oFd.principal; }, 0);
			var fAccrued = aActive.reduce(function(iSum, oFd) { return iSum + oFd.currentMonthAccrual; }, 0);

			return {
				loadStatus: this._loadState.status,
				loadStatusState: this._loadState.state,
				fds: aFds,
				filteredFds: sFdFilter === "all" ? aFds : aFds.filter(function(oFd) { return oFd.status === sFdFilter; }),
				interestSchedule: aActive,
				alerts: this._buildAlerts(aFds),
				accountingEntries: aEntries,
				accrualEntries: aEntries.filter(function(oEntry) {
					return oEntry.type === "Accrual" || oEntry.type === "Reversal";
				}).slice(0, 8),
				filteredEntries: sAcctFilter === "all" ? aEntries : aEntries.filter(function(oEntry) {
					return oEntry.type.toLowerCase() === sAcctFilter;
				}),
				metrics: {
					totalCorpus: this._fmt(fCorpus),
					accruedInterest: this._fmt(fAccrued),
					activeCount: aActive.length + " active deposits",
					accruedInterestPeriod: "Day-wise current month",
					maturingThisMonth: this._countMaturingThisMonth(aFds) + " FDs",
					autoRenewCount: aActive.filter(function(oFd) { return oFd.autoRenew; }).length + " FDs",
					// Month-end always closes the current calendar month, so
					// this tells the user, before they even click "Run
					// month-end", which month's validation/posting will
					// actually happen if they run it right now.
					monthEndMonthText: this._fmtMonthYear(new Date())
				},
				bankAllocation: this._buildBankAllocation(aActive, fCorpus),
				rateComparison: this._buildRateComparison(aActive),
				upcomingEvents: this._buildUpcomingEvents(aFds)
			};
		},

		// Groups active FD principal by bank so the "Bank allocation" donut
		// and its legend always add up to the same Total FD Corpus shown in
		// the KPI card above. The long tail of one-off/legacy bank entries is
		// rolled into a single "other banks" slice so the chart stays
		// readable instead of fragmenting into a dozen slivers.
		_buildBankAllocation: function(aActive, fCorpus) {
			var oGroups = {};

			aActive.forEach(function(oFd) {
				var sBank = oFd.bank || "Unknown";
				oGroups[sBank] = (oGroups[sBank] || 0) + Number(oFd.principal || 0);
			});

			var aPalette = ["#2563EB", "#10B981", "#F97316", "#8B5CF6", "#0e7c86", "#c8952b", "#EC4899"];

			var aSorted = Object.keys(oGroups).map(function(sBank) {
				return { bank: sBank, amount: oGroups[sBank] };
			}).sort(function(a, b) { return b.amount - a.amount; });

			var iTopN = aPalette.length - 1;
			var aTop = aSorted.slice(0, iTopN);
			var aRest = aSorted.slice(iTopN);

			if (aRest.length) {
				var fOthersAmount = aRest.reduce(function(iSum, o) { return iSum + o.amount; }, 0);
				aTop.push({ bank: aRest.length + " other bank" + (aRest.length > 1 ? "s" : ""), amount: fOthersAmount });
			}

			return aTop.map(function(oGroup, iIndex) {
				var fPercent = fCorpus > 0 ? (oGroup.amount / fCorpus) * 100 : 0;
				return {
					bank: oGroup.bank,
					amount: oGroup.amount,
					amountText: this._fmtCompact(oGroup.amount),
					percent: fPercent,
					percentText: fPercent.toFixed(1) + "%",
					color: aPalette[iIndex % aPalette.length]
				};
			}.bind(this));
		},

		// One bar per bank, showing the best rate currently on offer there -
		// so the comparison stays meaningful even when the same bank holds
		// several FDs at different rates. Sorted best-rate-first.
		_buildRateComparison: function(aActive) {
			var oBestRate = {};

			aActive.forEach(function(oFd) {
				var sBank = oFd.bank || "Unknown";
				var fRate = Number(oFd.rate || 0);
				if (oBestRate[sBank] === undefined || fRate > oBestRate[sBank]) {
					oBestRate[sBank] = fRate;
				}
			});

			return Object.keys(oBestRate).map(function(sBank, iIndex) {
				var fRate = oBestRate[sBank];
				return {
					bank: sBank,
					rate: fRate,
					rateText: fRate.toFixed(2) + "%",
					color: iIndex === 0 ? "#c8952b" : "#0e7c86"
				};
			}).sort(function(a, b) { return b.rate - a.rate; }).slice(0, 5)
			  // Re-flag the winner after sorting, and re-tone the rest, so
			  // the highlighted bar is always the actual highest rate.
			  .map(function(oRow, iIndex) {
				oRow.color = iIndex === 0 ? "#c8952b" : "#0e7c86";
				return oRow;
			});
		},

		// Merges the two fixed month-end dates (accrual run / reversal run)
		// with the nearest upcoming FD maturities into one chronological
		// feed, so the card reads like "what happens next" rather than a
		// static checklist.
		_buildUpcomingEvents: function(aFds) {
			var oToday = this._startOfDay(new Date());
			var oMonthEnd = new Date(oToday.getFullYear(), oToday.getMonth() + 1, 0);
			var oReversalDay = new Date(oToday.getFullYear(), oToday.getMonth() + 1, 1);

			var aEvents = [
				{
					date: oMonthEnd,
					icon: "sap-icon://synchronize",
					colorClass: "fdEventTeal",
					title: "Month-end accrual run",
					subtitle: "All active FDs"
				},
				{
					date: oReversalDay,
					icon: "sap-icon://undo",
					colorClass: "fdEventInfo",
					title: "Reversal run",
					subtitle: "Reversal of " + this._fmtMonthYear(oToday) + " accrual"
				}
			];

			aFds.filter(function(oFd) {
				return oFd.status === "active";
			}).forEach(function(oFd) {
				var oMaturity = this._maturityDate(oFd);
				var oMaturityDay = this._startOfDay(oMaturity);

				if (oMaturityDay && oMaturityDay >= oToday) {
					aEvents.push({
						date: oMaturityDay,
						icon: "sap-icon://alert",
						colorClass: "fdEventDanger",
						title: oFd.id + " FD maturity",
						subtitle: oFd.bank + " \u2022 " + oFd.principalText
					});
				}
			}.bind(this));

			return aEvents
				.sort(function(a, b) { return a.date - b.date; })
				.slice(0, 6)
				.map(function(oEvent) {
					return {
						icon: oEvent.icon,
						colorClass: oEvent.colorClass,
						title: oEvent.title,
						subtitle: oEvent.subtitle,
						dateText: this._fmtDate(oEvent.date)
					};
				}.bind(this));
		},

		// Compact Indian-numbering currency ("₹2.62Cr" / "₹73.95L" / "₹1.1K")
		// for the allocation legend, where full rupee figures next to a donut
		// chart would just be visual noise.
		_fmtCompact: function(nValue) {
			var fValue = Number(nValue) || 0;
			var fAbs = Math.abs(fValue);

			if (fAbs >= 1e7) {
				return "\u20b9" + (fValue / 1e7).toFixed(2) + "Cr";
			}
			if (fAbs >= 1e5) {
				return "\u20b9" + (fValue / 1e5).toFixed(2) + "L";
			}
			if (fAbs >= 1e3) {
				return "\u20b9" + (fValue / 1e3).toFixed(1) + "K";
			}
			return "\u20b9" + Math.round(fValue).toLocaleString("en-IN");
		},

		_buildAlerts: function(aFds) {
			var aAlerts = aFds.filter(function(oFd) {
				return oFd.status === "active";
			}).slice(0, 3).map(function(oFd, iIndex) {
				var sIcon = iIndex === 0 ? "sap-icon://alert" : iIndex === 1 ? "sap-icon://bell" : "sap-icon://hint";
				var sAction = iIndex === 0 ? "Process now" : iIndex === 1 ? "Review" : "Plan";
				return {
					fdId: oFd.id,
					icon: sIcon,
					title: oFd.id + " matures on " + oFd.maturityText,
					subtitle: oFd.bank + " | " + oFd.principalText + " | Maturity value: " + oFd.maturityValueText,
					actionText: sAction
				};
			});

			return aAlerts.length ? aAlerts : [{
				fdId: "",
				icon: "sap-icon://sys-enter-2",
				title: "No urgent maturity alerts right now.",
				subtitle: "All active deposits are outside the alert window.",
				actionText: "Done"
			}];
		},

		_decorateFd: function (oFd) {

			try {

				console.log("Decorating FD :", oFd.id);

				var oCopy = Object.assign({}, oFd);

				var oMaturityDate = this._maturityDate(oFd);
				var fMaturity = this._maturityValue(oFd);

				oCopy.principalText = this._fmt(oFd.principal);
				oCopy.rateText = oFd.rate + "%";
				oCopy.tenorText = oFd.tenor + "M";

				oCopy.startText = oFd.start ? this._fmtDate(oFd.start) : "";
				oCopy.creationDateText = oFd.creationDate ? this._fmtDate(oFd.creationDate) : "";
				oCopy.maturityText = oMaturityDate ? this._fmtDate(oMaturityDate) : "";
				oCopy.maturityValueText = isNaN(fMaturity) ? "" : this._fmt(fMaturity);

				// FIX: these were never derived, so every view binding to
				// {fdDocNoText}, {fdRevNoText}, {statusText}, {statusState},
				// {autoRenewText}, {autoRenewIcon}, {autoRenewState} resolved
				// to undefined - including the search/export logic in
				// _applyTableFilters() and onExportFD(), which filter/export
				// on "fdDocNoText" directly.
				oCopy.fdDocNoText = oFd.fdDocNo ? oFd.fdDocNo : "Not Posted";
				oCopy.fdRevNoText = oFd.fdRevNo ? oFd.fdRevNo : "-";

				oCopy.statusText = oFd.status === "active" ? "Active" :
					oFd.status === "matured" ? "Matured" :
					oFd.status === "renewed" ? "Renewed" : oFd.status;
				oCopy.statusState = oFd.status === "active" ? "Success" :
					oFd.status === "matured" ? "Warning" : "None";

				oCopy.autoRenewText = oFd.autoRenew ? "Yes" : "No";
				oCopy.autoRenewIcon = oFd.autoRenew ? "sap-icon://accept" : "";
				oCopy.autoRenewState = oFd.autoRenew ? "Success" : "None";

				this._applyDaywiseAccrual(oCopy);

				return oCopy;

			} catch (e) {

				console.error("FD FAILED :", oFd.id);
				console.error(oFd);
				console.error(e);

				return null;
			}
		},
		_decorateEntry: function(oEntry) {
			var oCopy = {};
			Object.keys(oEntry).forEach(function(sKey) {
				oCopy[sKey] = oEntry[sKey];
			});
			oCopy.dateText = this._fmtDate(oEntry.date);
			oCopy.amountText = this._fmt(oEntry.amount);
			oCopy.drAmountText = oEntry.drcr === "Dr" ? this._fmt(oEntry.amount) : "-";
			oCopy.crAmountText = oEntry.drcr === "Cr" ? this._fmt(oEntry.amount) : "-";
			oCopy.entryState = oEntry.type === "Accrual" ? "Success" : oEntry.type === "Reversal" ? "Warning" : "None";
			oCopy.drcrState = oEntry.drcr === "Dr" ? "None" : "Success";
			return oCopy;
		},

		_resetModelProperties: function(oModel, oData) {
			Object.keys(oData).forEach(function(sPath) {
				oModel.setProperty("/" + sPath, oData[sPath]);
			});
		},
		_setCurrentFiscalYear: function () {

			var oDatePicker = this.byId("dpStartDate");

			if (!oDatePicker) {
				return;
			}

			var oToday = new Date();
			var iYear = oToday.getFullYear();
			var iMonth = oToday.getMonth(); // January = 0

			var oFiscalStart, oFiscalEnd;

			if (iMonth >= 3) { // April to December

				oFiscalStart = new Date(iYear, 3, 1);      // 1-Apr-current year
				oFiscalEnd   = new Date(iYear + 1, 2, 31); // 31-Mar-next year

			} else { // January to March

				oFiscalStart = new Date(iYear - 1, 3, 1);  // 1-Apr-last year
				oFiscalEnd   = new Date(iYear, 2, 31);     // 31-Mar-current year

			}

			oDatePicker.setMinDate(oFiscalStart);
			oDatePicker.setMaxDate(oFiscalEnd);

		},

		_defaultNewFd: function(sMessage) {
			return {
				coCode: "",
				bank: "",
				id: "",
				principal: "",
				rate: "",
				start: "",
				createDate: this._dateToIso(new Date()),
				tenor: "",
				freq: "12",
				openingFd: "",
				autoRenew: false,
				rollInterest: false,
				glP: "",
				bankGL: "",
				glI: "",
				glInc: "",
				profitCenter: "",
				fdDocNo: "",
				message: sMessage || ""
			};
		},

		_defaultLegacyFd: function(sMessage) {
			return {
				coCode: "",
				bank: "",
				id: "",
				principal: "",
				rate: "",
				start: "",
				createDate: this._dateToIso(new Date()),
				tenor: "",
				freq: "12",
				openingFd: "",
				glP: "",
				bankGL: "",
				glI: "",
				glInc: "",
				profitCenter: "",
				fdDocNo: "",
				message: sMessage || ""
			};
		},

		_compoundFreqText: function(vFreq) {
			return Frequency.toText(vFreq);
		},

		_toODataDateTime: function(sDate) {
			if (!sDate) {
				return null;
			}
			if (sDate instanceof Date) {
				// Normalize to a UTC-midnight instant carrying the same
				// calendar date as the Date's local components, so it
				// survives the backend's floor-to-UTC-day truncation.
				return new Date(Date.UTC(
					sDate.getFullYear(),
					sDate.getMonth(),
					sDate.getDate()
				));
			}
			var aParts = String(sDate).split("-");
			// IMPORTANT: use Date.UTC(), not local numeric components.
			// The backend/Gateway treats the incoming DateTime as UTC and
			// floors it to the UTC calendar day. Local midnight in IST
			// (UTC+5:30) is 18:30 the previous day in UTC, so the backend
			// was storing one day earlier. Building the instant directly
			// at UTC midnight keeps the UTC calendar day equal to the
			// date the user picked, regardless of the browser's timezone.
			return new Date(Date.UTC(
				Number(aParts[0]),
				Number(aParts[1]) - 1,
				Number(aParts[2])
			));
		},

		_extractODataError: function(oError) {
			return ODataErrorHandler.extract(oError, "FD creation failed.");
		},

		_getObjectFromEvent: function(oEvent) {
			return oEvent.getSource().getBindingContext().getObject();
		},

		_maturityDate: function (oFd) {

			if (!oFd || !oFd.start) {
				return null;
			}

			var oDate;

			if (oFd.start instanceof Date) {
				oDate = new Date(oFd.start.getTime());
			} else {
				oDate = new Date(oFd.start);
			}

			if (isNaN(oDate.getTime())) {
				return null;
			}

			oDate.setMonth(oDate.getMonth() + Number(oFd.tenor || 0));

			return oDate;
		},

		_maturityValue: function(oFd) {
			var fRate = Number(oFd.rate) / 100;
			var iFreq = Number(oFd.freq) || 1;
			var fYears = Number(oFd.tenor) / 12;
			return Number(oFd.principal) * Math.pow(1 + fRate / iFreq, iFreq * fYears);
		},

		_applyDaywiseAccrual: function (oFd) {

			console.log("========== APPLY DAYWISE ACCRUAL ==========");
			console.log("FD Number :", oFd.id);
			console.log("Start Date :", oFd.start);
			console.log("Tenor :", oFd.tenor);
			console.log("Principal :", oFd.principal);
			console.log("Interest Rate :", oFd.rate);

			var oToday = this._startOfDay(new Date());

			if (!oToday) {
				console.error("Unable to determine today's date.");
				return;
			}

			var oMonthStart = new Date(
				oToday.getFullYear(),
				oToday.getMonth(),
				1
			);

			var oStartDate = null;

			if (oFd.start) {
				oStartDate = this._startOfDay(new Date(oFd.start + "T00:00:00"));
			}

			var oMaturity = this._maturityDate(oFd);

			console.log("Calculated Maturity :", oMaturity);

			var oMaturityDate = this._startOfDay(oMaturity);

			console.log("Normalized Start Date :", oStartDate);
			console.log("Normalized Maturity Date :", oMaturityDate);

			if (!oStartDate || !oMaturityDate) {

				console.warn("Skipping accrual calculation for FD :", oFd.id);

				oFd.accruedDays = 0;
				oFd.accruedDaysText = "0 days";

				oFd.dailyAccrual = 0;
				oFd.dailyAccrualText = this._fmt(0);

				oFd.currentMonthAccrual = 0;
				oFd.currentMonthAccrualText = this._fmt(0);

				oFd.accrualPeriodText = "Not Available";

				return;
			}

			var oAccrualStart =
				oStartDate > oMonthStart
					? oStartDate
					: oMonthStart;

			var oAccrualEnd =
				oMaturityDate < oToday
					? oMaturityDate
					: oToday;

			var iDays =
				oAccrualEnd >= oAccrualStart
					? this._daysBetween(oAccrualStart, oAccrualEnd) + 1
					: 0;

			var fDailyAccrual =
				Number(oFd.principal || 0) *
				Number(oFd.rate || 0) /
				100 /
				365;

			var fCurrentMonthAccrual = fDailyAccrual * iDays;

			oFd.accruedDays = iDays;
			oFd.accruedDaysText = iDays + (iDays === 1 ? " day" : " days");

			oFd.dailyAccrual = fDailyAccrual;
			oFd.dailyAccrualText = this._fmt(fDailyAccrual);

			oFd.currentMonthAccrual = fCurrentMonthAccrual;
			oFd.currentMonthAccrualText = this._fmt(fCurrentMonthAccrual);

			oFd.accrualPeriodText = iDays
				? this._fmtDate(oAccrualStart) + " - " + this._fmtDate(oAccrualEnd)
				: "No accrual this month";

			console.log("Accrued Days :", iDays);
			console.log("Daily Accrual :", fDailyAccrual);
			console.log("Current Month Accrual :", fCurrentMonthAccrual);
			console.log("==========================================");
		},

		_startOfDay: function (oDate) {

			if (!oDate || !(oDate instanceof Date) || isNaN(oDate.getTime())) {
				return null;
			}

			return new Date(
				oDate.getFullYear(),
				oDate.getMonth(),
				oDate.getDate()
			);
		},

		_daysBetween: function(oStartDate, oEndDate) {
			return Math.floor((oEndDate.getTime() - oStartDate.getTime()) / 86400000);
		},

		_isSameMonth: function(oDateA, oDateB) {
			return oDateA.getFullYear() === oDateB.getFullYear() && oDateA.getMonth() === oDateB.getMonth();
		},

		_parseNumber: function(vValue) {
			if (vValue === null || vValue === undefined || vValue === "") {
				return 0;
			}
			return Number(String(vValue).replace(/,/g, "")) || 0;
		},

		_parseTenor: function(vValue) {
			var iTenor = parseInt(vValue, 10);
			return iTenor > 0 ? iTenor : 0;
		},

		_parseBoolean: function(vValue) {
			return vValue === true || vValue === "true" || vValue === "X" || vValue === "x" || vValue === "1" || vValue === 1;
		},

		_parseCompoundFreq: function(vValue) {
			return Frequency.parse(vValue);
		},

		// FIX: an empty/blank/unparseable StartDate used to fall through to
		// `new Date(vDate)`, producing an Invalid Date. That Invalid Date was
		// then truthy and passed silently into _dateToIso(), which turned it
		// into a garbage-but-truthy string like "NaN-NaN-NaN" for oFd.start.
		// That string later satisfied `!oFd.start` checks in _maturityDate(),
		// which then failed its own isNaN() guard and returned null - which
		// is what eventually crashed _countMaturingThisMonth() below.
	_parseODataDate: function (vDate) {

    var aMatch;

    if (vDate instanceof Date) {
        return vDate;
    }

    if (typeof vDate === "string" && vDate.trim()) {

        // Handles /Date(123456789)/
        aMatch = /\/Date\((\d+)\)\//.exec(vDate);

        if (aMatch) {
            return new Date(Number(aMatch[1]));
        }

        // Handles YYYYMMDD
        if (/^\d{8}$/.test(vDate)) {

            return new Date(
                parseInt(vDate.substring(0, 4), 10),
                parseInt(vDate.substring(4, 6), 10) - 1,
                parseInt(vDate.substring(6, 8), 10)
            );
        }

        var oParsed = new Date(vDate);

        if (!isNaN(oParsed.getTime())) {
            return oParsed;
        }
    }

    return new Date();
},

		_fmt: function(nValue) {
			return "INR " + Math.round(Number(nValue) || 0).toLocaleString("en-IN");
		},

		// FIX: _maturityDate() can return null for an FD with a missing or
		// unparseable start date. This used to call .getFullYear() on that
		// null unconditionally, throwing "Cannot read properties of null
		// (reading 'getFullYear')" and taking down the whole dashboard
		// metrics build. Records with no resolvable maturity date are now
		// simply excluded from the "maturing this month" count.
		_countMaturingThisMonth: function(aFds) {
			var oNow = new Date();
			return aFds.filter(function(oFd) {
				var oDate = this._maturityDate(oFd);
				return oDate && oDate.getFullYear() === oNow.getFullYear() && oDate.getMonth() === oNow.getMonth();
			}.bind(this)).length;
		},

		_fmtDate: function(vDate) {
			var oDate = vDate instanceof Date ? vDate : new Date(vDate + "T00:00:00");
			return oDate.toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "short",
				year: "numeric"
			});
		},

		// Used by the "Month End" KPI card and the Month End History
		// table's "Month End For" column - both only need the month/year,
		// not the day.
		_fmtMonthYear: function(vDate) {
			var oDate = vDate instanceof Date ? vDate : new Date(vDate + "T00:00:00");
			if (isNaN(oDate.getTime())) {
				return "";
			}
			return oDate.toLocaleDateString("en-IN", {
				month: "short",
				year: "numeric"
			});
		},

		// _fmt() rounds to a whole number (correct for currency amounts),
		// which is wrong for rates - "2.00" was collapsing to "2". This
		// keeps exactly 2 decimal places without touching the integer part.
		_fmtRate: function(vValue) {
			if (vValue === null || vValue === undefined || vValue === "") {
				return "";
			}
			var fValue = parseFloat(String(vValue).replace(/,/g, ""));
			if (isNaN(fValue)) {
				return "";
			}
			return fValue.toFixed(2) + "%";
		},

		// _fmt() rounds to a whole number via Math.round(), which drops
		// paise/cents entirely (e.g. "1200.45" -> "1,200"). This keeps
		// exactly 2 decimal places - for Principal/Interest Amount figures
		// where the decimal portion matters - while still adding thousands
		// separators for readability.
		_fmtAmount: function(vValue) {
			if (vValue === null || vValue === undefined || vValue === "") {
				return "";
			}
			var fValue = parseFloat(String(vValue).replace(/,/g, ""));
			if (isNaN(fValue)) {
				return "";
			}
			return fValue.toLocaleString("en-IN", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			});
		},

		_dateToIso: function (oDate) {

    if (!(oDate instanceof Date) || isNaN(oDate.getTime())) {
        return "";
    }

    var iMonth = oDate.getMonth() + 1;
    var iDay = oDate.getDate();

    return oDate.getFullYear() + "-" +
        (iMonth < 10 ? "0" : "") + iMonth + "-" +
        (iDay < 10 ? "0" : "") + iDay;
}
	});
});