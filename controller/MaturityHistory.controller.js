sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/ViewSettingsDialog",
	"sap/m/ViewSettingsFilterItem",
	"sap/m/ViewSettingsItem",
    "sap/ui/core/format/DateFormat"
], function(BaseController, JSONModel, Filter, FilterOperator, Sorter, MessageBox, MessageToast, ViewSettingsDialog, ViewSettingsFilterItem, ViewSettingsItem, DateFormat) {
	"use strict";

	return BaseController.extend("com.infocus.zfifixeddepositZFI_FIXED_DEPOSIT.controller.MaturityHistory", {

		onInit: function() {
			this._filters = { search: "", status: "" };
			BaseController.prototype.onInit.apply(this, arguments);
			this._loadMaturityHistory();
		},

		_refresh: function() {
			BaseController.prototype._refresh.apply(this, arguments);
			this._applyFilters();
		},

		onSearch: function(oEvent) {
			this._filters.search = (oEvent.getParameter("newValue") || oEvent.getParameter("query") || "").trim();
			this._applyFilters();
		},

		onRefresh: function(){
			this._loadMaturityHistory();
		},

		onExport: function() {
			var oTable = this.byId("maturityHistoryTable");
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
				{ label: "Company Code", property: "coCode", type: "string" },
				{ label: "FD Number", property: "fdAccno", type: "string" },
				{ label: "Bank", property: "bankName", type: "string" },
				{ label: "Principal", property: "principalAmtText", type: "string" },
				{ label: "Rate", property: "interestRateText", type: "string" },
				{ label: "Interest Amount", property: "interestAmtText", type: "string" },
				{ label: "TDS Amount", property: "tdsAmt", type: "string" },
				{ label: "TDS Applicable", property: "tdsApplicable", type: "string" },
				{ label: "Maturity Doc", property: "tdsDocNo", type: "string" },
				{ label: "Accounting Doc", property: "fdDocNo", type: "string" },
				{ label: "Posting Date", property: "postingDateText", type: "string" },
				{ label: "Status", property: "statusText", type: "string" }
			];

			var oSettings = {
				workbook: { columns: aColumns, context: { title: "Maturity History" } },
				dataSource: aRows,
				fileName: "Maturity_History.xlsx",
				worker: false
			};

			sap.ui.require(["sap/ui/export/Spreadsheet"], function(Spreadsheet) {
				var oSheet = new Spreadsheet(oSettings);
				oSheet.build().finally(function() {
					oSheet.destroy();
				});
			});
		},

		onSort: function() {
			if (!this._oSortDialog) {
				this._oSortDialog = new ViewSettingsDialog({
					title: "Sort History",
					confirm: this._handleSortConfirm.bind(this),
					sortItems: [
						new ViewSettingsItem({ text: "FD Number", key: "fdAccno" }),
						new ViewSettingsItem({ text: "Principal Amount", key: "principalAmt" }),
						new ViewSettingsItem({ text: "Accounting Doc", key: "fdDocNo" })
					]
				});
				this.getView().addDependent(this._oSortDialog);
			}
			this._oSortDialog.open();
		},

		onFilter: function() {
			if (this._oFilterDialog) {
				this._oFilterDialog.destroy();
			}

			this._oFilterDialog = new ViewSettingsDialog({
				title: "Filter History",
				confirm: this._handleFilterConfirm.bind(this),
				filterItems: [
					new ViewSettingsFilterItem({
						text: "Status",
						key: "status",
						items: [
							new ViewSettingsItem({ text: "Success", key: "status:Success" }),
							new ViewSettingsItem({ text: "Failed", key: "status:Failed" })
						]
					})
				]
			});
			this.getView().addDependent(this._oFilterDialog);
			this._oFilterDialog.open();
		},

		_handleSortConfirm: function(oEvent) {
			var oSortItem = oEvent.getParameter("sortItem");
			var oBinding = this.byId("maturityHistoryTable").getBinding("items");
			if (oBinding && oSortItem) {
				oBinding.sort(new Sorter(oSortItem.getKey(), oEvent.getParameter("sortDescending")));
			}
		},

		_handleFilterConfirm: function(oEvent) {
			var aItems = oEvent.getParameter("filterItems") || [];
			this._filters.status = "";

			aItems.forEach(function(oItem) {
				var aParts = String(oItem.getKey()).split(":");
				if (aParts[0] === "status") { this._filters.status = aParts[1] || ""; }
			}.bind(this));

			this._applyFilters();
		},

		_applyFilters: function() {
			var oTable = this.byId("maturityHistoryTable");
			var oBinding = oTable && oTable.getBinding("items");
			if (!oBinding) {
				return;
			}

			var aFilters = [];
			var sSearch = this._filters.search;

			if (sSearch) {
				aFilters.push(new Filter({
					filters: [
						new Filter("fdAccno", FilterOperator.Contains, sSearch),
						new Filter("bankName", FilterOperator.Contains, sSearch),
						new Filter("coCode", FilterOperator.Contains, sSearch),
						new Filter("fdDocNo", FilterOperator.Contains, sSearch)
					],
					and: false
				}));
			}

			if (this._filters.status) {
				aFilters.push(new Filter("statusText", FilterOperator.EQ, this._filters.status));
			}

			oBinding.filter(aFilters);
		},

		_loadMaturityHistory: function() {
			var oServiceModel = this.getOwnerComponent().getModel();

			if (!oServiceModel || !oServiceModel.read) {
				return;
			}

			this.getView().setBusy(true);

			oServiceModel.read("/MaturityDataDisplaySet", {
				success: function(oData) {
					this.getView().setBusy(false);

					var aResults = oData && oData.results ? oData.results : [];

					var oDateFormat = DateFormat.getInstance({ pattern: "dd MMM yyyy" });

					var aMapped = aResults.map(function(oEntity) {
						var fTdsAmt = parseFloat(oEntity.TDS_AMT) || 0;
                        // For display, use FdDetailsSet logic to derive interest or use zero if not present.
                        var fPrincipal = parseFloat(oEntity.PrincipalAmt) || 0;
                        var fRate = parseFloat(oEntity.InterestRate) || 0;
                        var iTenor = parseInt(oEntity.TenorMonths) || 0;
                        var fInterest = fPrincipal * (fRate / 100) * (iTenor / 12);

                        // Maturity Type calculation
                        var sMaturityType = "Unknown";
                        var sMaturityTypeState = "None";
                        var fActualInterest = fInterest; // Default to expected

                        // Find the correct processing date (maturity date)
                        var vProcessingDate = oEntity.MATURITY_DATE || oEntity.MaturityDate || oEntity.CREATE_DATE;

                        if (oEntity.StartDate && vProcessingDate) {
                            var oStartDateObj = this._parseODataDate(oEntity.StartDate);
                            var oCreateDateObj = this._parseODataDate(vProcessingDate);
                            
                            if (oStartDateObj && oCreateDateObj) {
                                var oScheduledDate = new Date(oStartDateObj.getTime());
                                oScheduledDate.setMonth(oScheduledDate.getMonth() + iTenor);
                                
                                // Normalize to midnight for accurate comparison
                                oScheduledDate.setHours(0,0,0,0);
                                oCreateDateObj.setHours(0,0,0,0);
                                
                                if (oCreateDateObj.getTime() < oScheduledDate.getTime()) {
                                    sMaturityType = "Premature";
                                    sMaturityTypeState = "Warning";
                                    oStartDateObj.setHours(0,0,0,0);
                                    var iDiffTime = oCreateDateObj.getTime() - oStartDateObj.getTime();
                                    var iInterestDays = Math.floor(iDiffTime / (1000 * 3600 * 24)) + 1;
                                    if (iInterestDays < 0) iInterestDays = 0;
                                    fActualInterest = (fPrincipal * fRate * iInterestDays) / 36500;
                                } else {
                                    if (oCreateDateObj.getTime() > oScheduledDate.getTime()) {
                                        sMaturityType = "Over Matured";
                                        sMaturityTypeState = "Error";
                                    } else {
                                        sMaturityType = "Matured";
                                        sMaturityTypeState = "Success";
                                    }
                                    // For Matured and Over Matured, calculate interest up to Scheduled Date using exact days (inclusive)
                                    oStartDateObj.setHours(0,0,0,0);
                                    var iDiffTime = oScheduledDate.getTime() - oStartDateObj.getTime();
                                    var iInterestDays = Math.floor(iDiffTime / (1000 * 3600 * 24)) + 1;
                                    if (iInterestDays < 0) iInterestDays = 0;
                                    fActualInterest = (fPrincipal * fRate * iInterestDays) / 36500;
                                }
                            }
                        }

						return {
							coCode: oEntity.CoCode || "",
							fdAccno: oEntity.FdAccno || "",
							bankName: oEntity.BankName || "",
							principalAmt: fPrincipal,
							principalAmtText: this._fmtAmount(oEntity.PrincipalAmt),
							interestRateText: this._fmtRate(oEntity.InterestRate),
                            expectedInterestAmtText: fInterest.toFixed(3),
                            actualInterestAmtText: fActualInterest.toFixed(3),
							tdsAmt: fTdsAmt.toFixed(2),
							tdsApplicable: fTdsAmt > 0 ? "Yes" : "No",
							tdsState: fTdsAmt > 0 ? "Warning" : "Success",
							tdsDocNo: oEntity.TDS_DOC_NO || "",
							fdDocNo: oEntity.FdDocNo || "",
							postingDateText: vProcessingDate ? oDateFormat.format(this._parseODataDate(vProcessingDate)) : "",
							statusText: (oEntity.FdDocNo || oEntity.TDS_DOC_NO) ? "Success" : "Failed",
							statusState: (oEntity.FdDocNo || oEntity.TDS_DOC_NO) ? "Success" : "Error",
                            maturityType: sMaturityType,
                            maturityTypeState: sMaturityTypeState
						};
					}.bind(this));

					this.getView().getModel().setProperty("/maturityHistory", aMapped);
					this._applyFilters();

				}.bind(this),
				error: function() {
					this.getView().setBusy(false);
					MessageBox.error("Failed to load Maturity History.");
				}.bind(this)
			});
		}

	});
});
