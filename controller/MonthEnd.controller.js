sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/BusyDialog",
	"sap/m/ViewSettingsDialog",
	"sap/m/ViewSettingsFilterItem",
	"sap/m/ViewSettingsItem"
], function(BaseController, JSONModel, Filter, FilterOperator, Sorter, MessageBox, MessageToast, BusyDialog, ViewSettingsDialog, ViewSettingsFilterItem, ViewSettingsItem) {
	"use strict";

	return BaseController.extend("com.infocus.zfifixeddepositZFI_FIXED_DEPOSIT.controller.MonthEnd", {

		onInit: function() {
			this._monthEndFilters = { search: "", companyCode: "", status: "", bank: "" };
			this.getView().setModel(new JSONModel(this._defaultMonthEndState()), "monthEnd");
			BaseController.prototype.onInit.apply(this, arguments);
			this._loadMonthEndHistory();
		},

		_refresh: function() {
			BaseController.prototype._refresh.apply(this, arguments);
			this._applyMonthEndFilters();
		},

		onAccountingMonthChange: function() {
			this._syncAccountingMonthText();
		},

		onMonthEndCompanyCodeValueHelp: function() {
			this._openValueHelp({
				title: "Company Code",
				entitySet: "/CocodeF4Set",
				titleProperty: "BUKRS",
				descriptionProperty: "BUTXT",
				targetPath: "/companyCode",
				modelName: "monthEnd"
			});
		},

		onFilterChanged: function(oEvent) {
			this._monthEndFilters.companyCode = (oEvent.getParameter("value") || "").trim();
			this._applyMonthEndFilters();
		},

		onMonthEndSearch: function(oEvent) {
			this._monthEndFilters.search = (oEvent.getParameter("newValue") || oEvent.getParameter("query") || "").trim();
			this.getView().getModel("monthEnd").setProperty("/search", this._monthEndFilters.search);
			this._applyMonthEndFilters();
		},

		onRefreshMonthEnd: function(){
			this._loadMonthEndHistory();
		},

		onExportMonthEnd: function() {
			var oTable = this.byId("monthEndHistoryTable");
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
				{ label: "Start Date", property: "startDate", type: "date" },
				{ label: "Month End For", property: "monthEndForText", type: "string" },
				{ label: "Accounting Doc", property: "fdDocNo", type: "string" },
				{ label: "Reverse Doc", property: "fdRevNo", type: "string" },
				{ label: "Status", property: "statusText", type: "string" }
			];

			var oSettings = {
				workbook: { columns: aColumns, context: { title: "Month End History" } },
				dataSource: aRows,
				fileName: "Month_End_History.xlsx",
				worker: false
			};

			sap.ui.require(["sap/ui/export/Spreadsheet"], function(Spreadsheet) {
				var oSheet = new Spreadsheet(oSettings);
				oSheet.build().finally(function() {
					oSheet.destroy();
				});
			});
		},

		onMonthEndSort: function() {
			if (!this._oMonthEndSortDialog) {
				this._oMonthEndSortDialog = new ViewSettingsDialog({
					title: "Sort History",
					confirm: this._handleMonthEndSortConfirm.bind(this),
					sortItems: [
						new ViewSettingsItem({ text: "FD Number", key: "fdAccno" }),
						new ViewSettingsItem({ text: "Principal Amount", key: "principalAmt" }),
						new ViewSettingsItem({ text: "Accounting Doc", key: "fdDocNo" }),
						new ViewSettingsItem({ text: "Reverse Doc", key: "fdRevNo" })
					]
				});
				this.getView().addDependent(this._oMonthEndSortDialog);
			}
			this._oMonthEndSortDialog.open();
		},

		onMonthEndFilter: function() {
			if (this._oMonthEndFilterDialog) {
				this._oMonthEndFilterDialog.destroy();
			}

			this._oMonthEndFilterDialog = new ViewSettingsDialog({
				title: "Filter History",
				confirm: this._handleMonthEndFilterConfirm.bind(this),
				filterItems: this._buildMonthEndFilterItems()
			});
			this.getView().addDependent(this._oMonthEndFilterDialog);
			this._oMonthEndFilterDialog.open();
		},

		_handleMonthEndSortConfirm: function(oEvent) {
			var oSortItem = oEvent.getParameter("sortItem");
			var oBinding = this.byId("monthEndHistoryTable").getBinding("items");
			if (oBinding && oSortItem) {
				oBinding.sort(new Sorter(oSortItem.getKey(), oEvent.getParameter("sortDescending")));
			}
		},

		_handleMonthEndFilterConfirm: function(oEvent) {
			var aItems = oEvent.getParameter("filterItems") || [];
			this._monthEndFilters.status = "";
			this._monthEndFilters.bank = "";
			this._monthEndFilters.companyCode = this.getView().getModel("monthEnd").getProperty("/companyCode") || "";

			aItems.forEach(function(oItem) {
				var aParts = String(oItem.getKey()).split(":");
				if (aParts[0] === "status") { this._monthEndFilters.status = aParts[1] || ""; }
				if (aParts[0] === "bank") { this._monthEndFilters.bank = aParts.slice(1).join(":"); }
				if (aParts[0] === "coCode") { this._monthEndFilters.companyCode = aParts[1] || ""; }
			}.bind(this));

			this.getView().getModel("monthEnd").setProperty("/companyCode", this._monthEndFilters.companyCode);
			this._applyMonthEndFilters();
		},

		_applyMonthEndFilters: function() {
			var oTable = this.byId("monthEndHistoryTable");
			var oBinding = oTable && oTable.getBinding("items");
			if (!oBinding) {
				return;
			}

			var aFilters = [];
			var sSearch = this._monthEndFilters.search;
			var sCompanyCode = (this.getView().getModel("monthEnd").getProperty("/companyCode") || this._monthEndFilters.companyCode || "").trim();

			if (sSearch) {
				aFilters.push(new Filter({
					filters: [
						new Filter("fdAccno", FilterOperator.Contains, sSearch),
						new Filter("bankName", FilterOperator.Contains, sSearch),
						new Filter("coCode", FilterOperator.Contains, sSearch)
					],
					and: false
				}));
			}

			if (sCompanyCode) {
				aFilters.push(new Filter("coCode", FilterOperator.EQ, sCompanyCode));
			}

			if (this._monthEndFilters.status) {
				aFilters.push(new Filter("statusText", FilterOperator.EQ, this._monthEndFilters.status));
			}

			if (this._monthEndFilters.bank) {
				aFilters.push(new Filter("bankName", FilterOperator.EQ, this._monthEndFilters.bank));
			}

			oBinding.filter(aFilters);
		},

		_buildMonthEndFilterItems: function() {
			return [
				new ViewSettingsFilterItem({
					text: "Status",
					key: "status",
					items: [
						new ViewSettingsItem({ text: "Success", key: "status:Success" }),
						new ViewSettingsItem({ text: "Failed", key: "status:Failed" })
					]
				})
			];
		},

		_loadMonthEndHistory: function() {
	var oServiceModel = this.getOwnerComponent().getModel();

	if (!oServiceModel || !oServiceModel.read) {
		return;
	}

	this.getView().setBusy(true);

	oServiceModel.read("/MonthEndDataSet", {

		success: function(oData) {

			this.getView().setBusy(false);

			var aResults = oData && oData.results ? oData.results : [];

			var aMapped = aResults.map(function(oEntity) {

    return {
        coCode: oEntity.CoCode,
        fdAccno: oEntity.FdAccno,
        bankName: oEntity.BankName,
        principalAmt: parseFloat(oEntity.PrincipalAmt) || 0,
        principalAmtText: this._fmtAmount(oEntity.PrincipalAmt),
        interestRateText: this._fmtRate(oEntity.InterestRate),
        interestAmt: parseFloat(oEntity.INTEREST_AMT) || 0,
        interestAmtText: this._fmtAmount(oEntity.INTEREST_AMT),
        startDate: oEntity.StartDate,
        fdDocNo: oEntity.FdDocNo,
        fdRevNo: oEntity.FD_REV_NO,
        postingDateText: oEntity.CREATE_DATE ?
            this._fmtDate(this._parseODataDate(oEntity.CREATE_DATE)) : "",
        // Month-end always closes the calendar month it is run in, so the
        // month it was "performed for" is the month of the posting date.
        monthEndForText: oEntity.CREATE_DATE ?
            this._fmtMonthYear(this._parseODataDate(oEntity.CREATE_DATE)) : "",
        processedBy: "Auto",
        statusText: oEntity.LV_IND === "X" ? "Success" : "Failed",
        statusState: oEntity.LV_IND === "X" ? "Success" : "Error"
    };

}.bind(this));

			this.getView().getModel().setProperty("/monthEndHistory", aMapped);
			this._applyMonthEndFilters();

		}.bind(this),

		error: function() {

			this.getView().setBusy(false);
			MessageBox.error("Failed to load Month End History.");

		}.bind(this)

	});
},

		_defaultMonthEndState: function() {
			var oToday = new Date();
			var sMonth = (oToday.getMonth() + 1 < 10 ? "0" : "") + (oToday.getMonth() + 1) + "/" + oToday.getFullYear();
			return {
				companyCode: "",
				accountingMonth: sMonth,
				accountingMonthText: sMonth,
				search: ""
			};
		},

		_syncAccountingMonthText: function() {
			var oModel = this.getView().getModel("monthEnd");
			oModel.setProperty("/accountingMonthText", oModel.getProperty("/accountingMonth") || "--");
		}
	});
});