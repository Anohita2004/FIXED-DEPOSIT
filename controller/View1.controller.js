sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/SelectDialog",
	"sap/m/StandardListItem",
	"sap/ui/core/CustomData",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(Controller, JSONModel, MessageBox, MessageToast, SelectDialog, StandardListItem, CustomData, Filter, FilterOperator) {
	"use strict";

	return Controller.extend("com.infocus.zfifixeddepositZFI_FIXED_DEPOSIT.controller.View1", {
		onInit: function() {
			this._fds = [];
			this._entries = [];
			this._loadState = {
				status: "Loading FdDetailsSet...",
				state: "Warning"
			};

			this.getView().setModel(new JSONModel(this._buildAppData()));
			this.getView().setModel(new JSONModel(this._buildUiState("dashboard")), "ui");
			this.getView().setModel(new JSONModel({
				principal: "",
				rate: "",
				tenor: "",
				freq: "",
				maturityValueText: "",
				interestText: "",
				monthlyText: ""
			}), "calc");
			this.getView().setModel(new JSONModel(this._defaultNewFd()), "newFd");
			this.getView().setModel(new JSONModel(this._defaultLegacyFd()), "legacyFd");
			this._loadFdDetailsFromService();
		},

		onNavDashboard: function() { this._setPage("dashboard"); },
		onNavFds: function() { this._setPage("fds"); },
		onNavInterest: function() { this._setPage("interest"); },
		onNavMaturity: function() { this._setPage("maturity"); },
		onNavAccounting: function() { this._setPage("accounting"); },
		onNavNewfd: function() { this._setPage("newfd"); },
		onNavLegacyFd: function() { this._setPage("legacyfd"); },
		onNavSettings: function() { this._setPage("settings"); },

		onCompanyCodeValueHelp: function() {
			this._openValueHelp({
				title: "Company Code",
				entitySet: "/CocodeF4Set",
				titleProperty: "BUKRS",
				targetPath: "/coCode"
			});
		},

		onBankNameValueHelp: function() {
			this._openValueHelp({
				title: "Bank Name",
				entitySet: "/BankNameF4Set",
				titleProperty: "BANKA",
				descriptionProperty: "BANKL",
				targetPath: "/bank"
			});
		},

		onGlPrincipalValueHelp: function() {
			this._openValueHelp({
				title: "FD Principal GL",
				entitySet: "/GLAccountF4Set",
				titleProperty: "saknr",
				descriptionProperty: "Txt50",
				targetPath: "/glP"
			});
		},

		onGlReceivableValueHelp: function() {
			this._openValueHelp({
				title: "Interest Receivable GL",
				entitySet: "/GLInterestF4Set",
				titleProperty: "saknr",
				descriptionProperty: "TXT50",
				targetPath: "/glI"
			});
		},

		onGlIncomeValueHelp: function() {
			this._openValueHelp({
				title: "Interest Income GL",
				entitySet: "/GLIncomeF4Set",
				titleProperty: "saknr",
				descriptionProperty: "TXT50",
				targetPath: "/glInc"
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
				targetPath: "/coCode",
				modelName: "legacyFd"
			});
		},

		onLegacyBankNameValueHelp: function() {
			this._openValueHelp({
				title: "Bank Name",
				entitySet: "/BankNameF4Set",
				titleProperty: "BANKA",
				descriptionProperty: "BANKL",
				targetPath: "/bank",
				modelName: "legacyFd"
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
				entitySet: "/GLAccountF4Set",
				titleProperty: "saknr",
				descriptionProperty: "Txt50",
				targetPath: "/glP",
				modelName: "legacyFd"
			});
		},

		onLegacyGlReceivableValueHelp: function() {
			this._openValueHelp({
				title: "Interest Receivable GL",
				entitySet: "/GLInterestF4Set",
				titleProperty: "saknr",
				descriptionProperty: "TXT50",
				targetPath: "/glI",
				modelName: "legacyFd"
			});
		},

		onLegacyGlIncomeValueHelp: function() {
			this._openValueHelp({
				title: "Interest Income GL",
				entitySet: "/GLIncomeF4Set",
				titleProperty: "saknr",
				descriptionProperty: "TXT50",
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

		onCalculateInterest: function() {
			var oCalcModel = this.getView().getModel("calc");
			var oCalc = oCalcModel.getData();
			var iPrincipal = Number(oCalc.principal) || 0;
			var fRate = (Number(oCalc.rate) || 0) / 100;
			var iFreq = Number(oCalc.freq);
			var iTenor = Number(oCalc.tenor);
			if (!iPrincipal || !fRate || !iFreq || !iTenor) {
				oCalcModel.setProperty("/maturityValueText", "");
				oCalcModel.setProperty("/interestText", "");
				oCalcModel.setProperty("/monthlyText", "");
				return;
			}
			var fYears = iTenor / 12;
			var fMaturity = iPrincipal * Math.pow(1 + fRate / iFreq, iFreq * fYears);
			var fInterest = fMaturity - iPrincipal;

			oCalcModel.setProperty("/maturityValueText", this._fmt(fMaturity));
			oCalcModel.setProperty("/interestText", this._fmt(fInterest));
			oCalcModel.setProperty("/monthlyText", this._fmt(fInterest / iTenor));
		},

		onCreateFD: function() {
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

			if (!oServiceModel || !oServiceModel.create) {
				oNewFdModel.setProperty("/message", "OData model is not available.");
				return;
			}

			var aMissing = [];
			if (!sCoCode) aMissing.push("Company Code");
			if (!sId) aMissing.push("FD Number");
			if (!sBank) aMissing.push("Bank Name");
			if (!sPrincipal || Number(sPrincipal) <= 0) aMissing.push("Valid Principal Amount");
			if (!sRate || Number(sRate) <= 0) aMissing.push("Valid Interest Rate");
			if (!oData.start) aMissing.push("Start Date");
			if (!sTenor || Number(sTenor) <= 0) aMissing.push("Valid Tenor (Months)");
			if (!oData.freq) aMissing.push("Compounding Frequency");
			if (!sOpeningFd) aMissing.push("Purpose of Opening");
			if (!oData.glP) aMissing.push("Principal GL");
			if (!oData.glI) aMissing.push("Interest Receivable GL");
			if (!oData.glInc) aMissing.push("Interest Income GL");
			if (!sProfitCenter) aMissing.push("Profit Center");

			if (aMissing.length > 0) {
				var sErrorMsg = "Please fill in the following required fields:\n\n• " + aMissing.join("\n• ");
				oNewFdModel.setProperty("/message", "Validation failed.");
				sap.m.MessageBox.error(sErrorMsg, { title: "Missing Information" });
				return;
			}

			var oPayload = {
				CoCode: sCoCode,
				FdAccno: sId,
				BankName: sBank,
				PrincipalAmt: sPrincipal,
				InterestRate: sRate,
				StartDate: this._toODataDateTime(oData.start),
				TenorMonths: sTenor,
				CompoundFreq: this._compoundFreqText(oData.freq),
				OPENING_FD: sOpeningFd,
				GlPrincipal: (oData.glP || "").trim(),
				GlReceivable: (oData.glI || "").trim(),
				GlIncome: (oData.glInc || "").trim(),
				ProfitCenter: sProfitCenter
			};

			oNewFdModel.setProperty("/message", "Creating FD...");
			oServiceModel.create("/FdDetailsSet", oPayload, {
				success: function() {
					MessageToast.show("FD Created Successfully");
					oNewFdModel.setData(this._defaultNewFd("FD " + sId + " created successfully."));
					this._setPage("dashboard");
					this._loadFdDetailsFromService();
				}.bind(this),
				error: function(oError) {
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

			if (!oServiceModel || !oServiceModel.read) {
				oLegacyModel.setProperty("/message", "OData model is not available.");
				return;
			}

			var aMissing = [];
			if (!sCoCode) aMissing.push("Company Code");
			if (!sId) aMissing.push("FD Number");
			if (!sBank) aMissing.push("Bank Name");
			if (!sPrincipal || Number(sPrincipal) <= 0) aMissing.push("Valid Principal Amount");
			if (!sRate || Number(sRate) <= 0) aMissing.push("Valid Interest Rate");
			if (!oData.start) aMissing.push("Start Date");
			if (!sTenor || Number(sTenor) <= 0) aMissing.push("Valid Tenor (Months)");
			if (!oData.freq) aMissing.push("Compounding Frequency");
			if (!sOpeningFd) aMissing.push("Purpose of Opening");
			if (!oData.glP) aMissing.push("Principal GL");
			if (!oData.glI) aMissing.push("Interest Receivable GL");
			if (!oData.glInc) aMissing.push("Interest Income GL");
			if (!sProfitCenter) aMissing.push("Profit Center");
			if (!oData.fdDocNo) aMissing.push("Accounting Document Number");

			if (aMissing.length > 0) {
				var sErrorMsg = "Please fill in the following required fields:\n\n• " + aMissing.join("\n• ");
				oLegacyModel.setProperty("/message", "Validation failed.");
				sap.m.MessageBox.error(sErrorMsg, { title: "Missing Information" });
				return;
			}

			oLegacyModel.setProperty("/message", "Posting accounting document...");
			oLegacyModel.setProperty("/fdDocNo", "");

			oServiceModel.read("/AccountingDocSet", {
				filters: [
					new Filter("CoCode", FilterOperator.EQ, sCoCode),
					new Filter("FdAccno", FilterOperator.EQ, sId),
					new Filter("BankName", FilterOperator.EQ, sBank),
					new Filter("PrincipalAmt", FilterOperator.EQ, sPrincipal),
					new Filter("InterestRate", FilterOperator.EQ, sRate),
					new Filter("StartDate", FilterOperator.EQ, this._toODataDateTime(oData.start)),
					new Filter("TenorMonths", FilterOperator.EQ, sTenor),
					new Filter("CompoundFreq", FilterOperator.EQ, this._compoundFreqText(oData.freq)),
					new Filter("OpeningFd", FilterOperator.EQ, sOpeningFd),
					new Filter("GlPrincipal", FilterOperator.EQ, (oData.glP || "").trim()),
					new Filter("GlReceivable", FilterOperator.EQ, (oData.glI || "").trim()),
					new Filter("GlIncome", FilterOperator.EQ, (oData.glInc || "").trim()),
					new Filter("ProfitCenter", FilterOperator.EQ, sProfitCenter)
				],
				success: function(oResponse) {
					var aResults = oResponse && oResponse.results ? oResponse.results : [];
					var oResult = aResults[0] || {};
					var sDocNo = oResult.FdDocNo || oResult.FD_DOC_NO || "";
					var sMessage = sDocNo ? "Accounting document posted: " + sDocNo : "Accounting document posting completed.";
					oLegacyModel.setProperty("/fdDocNo", sDocNo);
					oLegacyModel.setProperty("/message", sMessage);
					MessageToast.show(sMessage);
				}.bind(this),
				error: function(oError) {
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

		onRunMonthEnd: function() {
			var oTable = this.byId("dashboardFdsTable");
			if (!oTable) return;
			var aContexts = oTable.getSelectedContexts();
			if (!aContexts.length) {
				MessageBox.warning("Please select at least one FD to run month-end.");
				return;
			}

			var oServiceModel = this.getOwnerComponent().getModel();
			var aPromises = [];

			this._setLoadState("Running month-end for " + aContexts.length + " FDs...", "Warning");

			aContexts.forEach(function(oContext) {
				var oFd = oContext.getObject();
				aPromises.push(new Promise(function(resolve, reject) {
					oServiceModel.read("/AccountingDocSet", {
						filters: [
							new Filter("CoCode", FilterOperator.EQ, oFd.coCode),
							new Filter("FdAccno", FilterOperator.EQ, oFd.id),
							new Filter("BankName", FilterOperator.EQ, oFd.bank),
							new Filter("PrincipalAmt", FilterOperator.EQ, oFd.principal.toString()),
							new Filter("InterestRate", FilterOperator.EQ, oFd.rate.toString()),
							new Filter("StartDate", FilterOperator.EQ, new Date(oFd.start + "T00:00:00")),
							new Filter("TenorMonths", FilterOperator.EQ, oFd.tenor.toString()),
							new Filter("CompoundFreq", FilterOperator.EQ, this._compoundFreqText(oFd.freq)),
							new Filter("OpeningFd", FilterOperator.EQ, oFd.openingFd),
							new Filter("GlPrincipal", FilterOperator.EQ, (oFd.glP || "").trim()),
							new Filter("GlReceivable", FilterOperator.EQ, (oFd.glI || "").trim()),
							new Filter("GlIncome", FilterOperator.EQ, (oFd.glInc || "").trim()),
							new Filter("ProfitCenter", FilterOperator.EQ, (oFd.profitCenter || "").trim()),
							new Filter("LV_IND", FilterOperator.EQ, "X")
						],
						success: function(oData) {
							var aResults = oData && oData.results ? oData.results : [];
							if (aResults.length > 0) {
								var oResult = aResults[0];
								oFd.fdDocNo = oResult.FdDocNo || oResult.FD_DOC_NO;
								oFd.fdRevNo = oResult.FD_REV_NO || oResult.FdRevNo;
								oFd.lvInd = "X";
							}
							resolve(oData);
						},
						error: function(oError) {
							reject(oError);
						}
					});
				}.bind(this)));
			}.bind(this));

			Promise.all(aPromises).then(function() {
				this._setLoadState("Month-end completed successfully.", "Success", true);
				oTable.removeSelections(true);
				this._refresh();
			}.bind(this)).catch(function(oError) {
				var sMessage = this._extractODataError(oError);
				this._setLoadState("Error during month-end: " + sMessage, "Error", true);
				MessageBox.error("Month-end failed: " + sMessage);
			}.bind(this));
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
			this.getView().getModel("ui").setData(this._buildUiState(sPage));
		},

		_refresh: function() {
			this.getView().getModel().setData(this._buildAppData());
		},

		_loadFdDetailsFromService: function() {
			var oServiceModel = this.getOwnerComponent().getModel();
			if (!oServiceModel || !oServiceModel.read) {
				this._setLoadState("OData model is not available. No local defaults are shown.", "Error");
				return;
			}

			oServiceModel.read("/FdDetailsSet", {
				success: function(oData) {
					var aResults = oData && oData.results ? oData.results : [];
					if (!aResults.length) {
						this._setLoadState("FdDetailsSet returned 0 records.", "None");
						return;
					}
					this._fds = aResults.map(this._mapFdDetailsEntity.bind(this));
					this._entries = [];
					this._setLoadState("Loaded " + aResults.length + " records from FdDetailsSet.", "Success", true);
					this._refresh();
				}.bind(this),
				error: function() {
					this._setLoadState("Could not load FdDetailsSet. No local defaults are shown.", "Error");
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

		_openValueHelp: function(oConfig) {
			var oServiceModel = this.getOwnerComponent().getModel();
			if (!oServiceModel || !oServiceModel.read) {
				MessageBox.error("OData model is not available.");
				return;
			}

			oServiceModel.read(oConfig.entitySet, {
				success: function(oData) {
					var aResults = oData && oData.results ? oData.results : [];
					var oDialog = new SelectDialog({
						title: oConfig.title,
						items: aResults.map(function(oItem) {
							return new StandardListItem({
								title: oItem[oConfig.titleProperty] || "",
								description: oConfig.descriptionProperty ? oItem[oConfig.descriptionProperty] || "" : "",
								customData: [new CustomData({
									key: "value",
									value: oItem[oConfig.titleProperty] || ""
								})]
							});
						}),
						confirm: function(oEvent) {
							var oSelectedItem = oEvent.getParameter("selectedItem");
							if (oSelectedItem) {
								this.getView().getModel(oConfig.modelName || "newFd").setProperty(oConfig.targetPath, oSelectedItem.data("value"));
							}
						}.bind(this)
					});
					this.getView().addDependent(oDialog);
					oDialog.open();
				}.bind(this),
				error: function(oError) {
					MessageBox.error(this._extractODataError(oError));
				}.bind(this)
			});
		},

		_mapFdDetailsEntity: function(oEntity) {
			var iTenor = this._parseTenor(oEntity.TenorMonths);
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
				glI: oEntity.GlReceivable,
				glInc: oEntity.GlIncome,
				profitCenter: oEntity.ProfitCenter,
				fdDocNo: oEntity.FD_DOC_NO,
				fdRevNo: oEntity.FD_REV_NO,
				lvInd: oEntity.LV_IND
			};
			oFd.status = this._maturityDate(oFd) < new Date() ? "matured" : "active";
			return oFd;
		},

		_buildUiState: function(sPage) {
			var mTitles = {
				dashboard: "Dashboard",
				fds: "Fixed Deposits",
				interest: "Interest Accrual",
				maturity: "Maturity Alerts",
				accounting: "Accounting Entries",
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

			return {
				title: mTitles[sPage] || "Dashboard",
				visible: oVisible,
				nav: oNav,
				fdFilter: this.getView() && this.getView().getModel("ui") ? this.getView().getModel("ui").getProperty("/fdFilter") || "all" : "all",
				acctFilter: this.getView() && this.getView().getModel("ui") ? this.getView().getModel("ui").getProperty("/acctFilter") || "all" : "all"
			};
		},

		_buildAppData: function() {
			var aFds = this._fds.map(this._decorateFd.bind(this));
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
					autoRenewCount: aActive.filter(function(oFd) { return oFd.autoRenew; }).length + " FDs"
				}
			};
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

		_decorateFd: function(oFd) {
			var oCopy = {};
			Object.keys(oFd).forEach(function(sKey) {
				oCopy[sKey] = oFd[sKey];
			});
			var fMaturity = this._maturityValue(oFd);
			oCopy.principalText = this._fmt(oFd.principal);
			oCopy.rateText = oFd.rate + "%";
			oCopy.tenorText = oFd.tenor + "M";
			oCopy.startText = this._fmtDate(oFd.start);
			oCopy.maturityText = this._fmtDate(this._maturityDate(oFd));
			oCopy.maturityValueText = this._fmt(fMaturity);
			this._applyDaywiseAccrual(oCopy);
			oCopy.statusText = oFd.status.charAt(0).toUpperCase() + oFd.status.slice(1);
			oCopy.statusState = oFd.status === "active" ? "Success" : oFd.status === "matured" ? "None" : "Warning";
			oCopy.autoRenewText = oFd.autoRenew ? "Auto" : "-";
			oCopy.autoRenewIcon = oFd.autoRenew ? "sap-icon://synchronize" : "";
			oCopy.autoRenewState = oFd.autoRenew ? "Information" : "None";
			oCopy.fdDocNoText = oFd.fdDocNo || "-";
			oCopy.fdRevNoText = oFd.fdRevNo || "-";
			oCopy.monthEndPerformed = oFd.lvInd === "X" ? "Yes" : "No";
			oCopy.actionLabel = oFd.status === "active" ? "Mature / Renew" : "Processed";
			oCopy.actionIcon = oFd.status === "active" ? "sap-icon://accept" : "";
			oCopy.actionEnabled = oFd.status === "active";
			return oCopy;
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

		_defaultNewFd: function(sMessage) {
			return {
				coCode: "",
				bank: "",
				id: "",
				principal: "",
				rate: "",
				start: "",
				tenor: "",
				freq: "",
				openingFd: "",
				autoRenew: false,
				rollInterest: false,
				glP: "",
				glI: "",
				glInc: "",
				profitCenter: "",
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
				tenor: "",
				freq: "",
				openingFd: "",
				glP: "",
				glI: "",
				glInc: "",
				profitCenter: "",
				fdDocNo: "",
				message: sMessage || ""
			};
		},

		_compoundFreqText: function(vFreq) {
			var mText = {
				"12": "Monthly",
				"4": "Quarterly",
				"2": "Half-yearly",
				"1": "Yearly"
			};
			return mText[String(vFreq)] || String(vFreq || "");
		},

		_toODataDateTime: function(sDate) {
			if (!sDate) {
				return null;
			}
			if (sDate instanceof Date) {
				return new Date(Date.UTC(
					sDate.getFullYear(),
					sDate.getMonth(),
					sDate.getDate()
				));
			}
			var aParts = String(sDate).split("-");
			// Use Date.UTC() so the epoch's UTC calendar day equals the
			// intended date. The backend floors incoming DateTime values
			// to the UTC day, so local midnight (e.g. IST) lands on the
			// previous UTC day and the wrong date gets stored.
			return new Date(Date.UTC(
				Number(aParts[0]),
				Number(aParts[1]) - 1,
				Number(aParts[2])
			));
		},

		_extractODataError: function(oError) {
			var sResponse = oError && oError.responseText;
			var oBody;
			if (!sResponse) {
				return "FD creation failed.";
			}
			try {
				oBody = JSON.parse(sResponse);
				return oBody.error && oBody.error.message && oBody.error.message.value ? oBody.error.message.value : sResponse;
			} catch (oException) {
				return sResponse;
			}
		},

		_getObjectFromEvent: function(oEvent) {
			return oEvent.getSource().getBindingContext().getObject();
		},

		_maturityDate: function(oFd) {
			var oDate = new Date(oFd.start + "T00:00:00");
			oDate.setMonth(oDate.getMonth() + Number(oFd.tenor));
			return oDate;
		},

		_maturityValue: function(oFd) {
			var fRate = Number(oFd.rate) / 100;
			var iFreq = Number(oFd.freq) || 1;
			var fYears = Number(oFd.tenor) / 12;
			return Number(oFd.principal) * Math.pow(1 + fRate / iFreq, iFreq * fYears);
		},

		_applyDaywiseAccrual: function(oFd) {
			var oToday = this._startOfDay(new Date());
			var oMonthStart = new Date(oToday.getFullYear(), oToday.getMonth(), 1);
			var oStartDate = this._startOfDay(new Date(oFd.start + "T00:00:00"));
			var oMaturityDate = this._startOfDay(this._maturityDate(oFd));
			var oAccrualStart = oStartDate > oMonthStart ? oStartDate : oMonthStart;
			var oAccrualEnd = oMaturityDate < oToday ? oMaturityDate : oToday;
			var iDays = oAccrualEnd >= oAccrualStart ? this._daysBetween(oAccrualStart, oAccrualEnd) + 1 : 0;
			var fDailyAccrual = Number(oFd.principal) * (Number(oFd.rate) || 0) / 100 / 365;
			var fCurrentMonthAccrual = fDailyAccrual * iDays;

			oFd.accruedDays = iDays;
			oFd.accruedDaysText = iDays + (iDays === 1 ? " day" : " days");
			oFd.dailyAccrual = fDailyAccrual;
			oFd.dailyAccrualText = this._fmt(fDailyAccrual);
			oFd.currentMonthAccrual = fCurrentMonthAccrual;
			oFd.currentMonthAccrualText = this._fmt(fCurrentMonthAccrual);
			oFd.accrualPeriodText = iDays ? this._fmtDate(oAccrualStart) + " - " + this._fmtDate(oAccrualEnd) : "No accrual this month";
		},

		_startOfDay: function(oDate) {
			return new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
		},

		_daysBetween: function(oStartDate, oEndDate) {
			return Math.floor((oEndDate.getTime() - oStartDate.getTime()) / 86400000);
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
			var sValue = String(vValue || "").toLowerCase();
			var iValue = parseInt(sValue, 10);
			if (iValue > 0) {
				return iValue;
			}
			if (sValue.indexOf("quarter") > -1) {
				return 4;
			}
			if (sValue.indexOf("half") > -1 || sValue.indexOf("semi") > -1) {
				return 2;
			}
			if (sValue.indexOf("year") > -1 || sValue.indexOf("annual") > -1) {
				return 1;
			}
			return 0;
		},

		_parseODataDate: function(vDate) {
			var aMatch;
			if (vDate instanceof Date) {
				return vDate;
			}
			if (typeof vDate === "string") {
				aMatch = /\/Date\((\d+)\)\//.exec(vDate);
				if (aMatch) {
					return new Date(Number(aMatch[1]));
				}
				return new Date(vDate);
			}
			return new Date();
		},

		_fmt: function(nValue) {
			return "INR " + Math.round(Number(nValue) || 0).toLocaleString("en-IN");
		},

		_countMaturingThisMonth: function(aFds) {
			var oNow = new Date();
			return aFds.filter(function(oFd) {
				var oDate = this._maturityDate(oFd);
				return oDate.getFullYear() === oNow.getFullYear() && oDate.getMonth() === oNow.getMonth();
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

		_dateToIso: function(oDate) {
			var iMonth = oDate.getMonth() + 1;
			var iDay = oDate.getDate();
			return oDate.getFullYear() + "-" + (iMonth < 10 ? "0" : "") + iMonth + "-" + (iDay < 10 ? "0" : "") + iDay;
		}
	});
});