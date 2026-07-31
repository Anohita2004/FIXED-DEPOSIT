sap.ui.define([
	"./BaseController",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/BusyDialog",
	"sap/ui/model/json/JSONModel",
	"sap/m/Dialog",
	"sap/m/DatePicker",
	"sap/m/VBox",
	"sap/m/Text",
	"sap/m/Button",
	"sap/m/Table",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/m/ObjectStatus"
], function(BaseController, MessageBox, Filter, FilterOperator, BusyDialog, JSONModel, Dialog, DatePicker, VBox, Text, Button, Table, Column, ColumnListItem, ObjectStatus) {
	"use strict";

	return BaseController.extend("com.infocus.zfifixeddepositZFI_FIXED_DEPOSIT.controller.FixedDeposits", {
		onInit: function() {
			BaseController.prototype.onInit.apply(this, arguments);
		},

		onRunMonthEnd: function() {
			var oTable = this.byId("fdTable");
			if (!oTable) return;

			var aContexts = oTable.getSelectedContexts();
			if (!aContexts || aContexts.length === 0) {
				MessageBox.error("Please select at least one Fixed Deposit.");
				return;
			}

			var aSelectedFds = aContexts.map(function(oContext) {
				return oContext.getObject();
			});

			var sMonth = this._fmtMonthYear(new Date());
			var aBlockedMessages = [];
			var aEligibleFds = [];

			aSelectedFds.forEach(function(oFd) {
				if (oFd.status === "matured") {
					aBlockedMessages.push(
						"FD " + oFd.id + " matured on " + oFd.maturityText + ". Month End Not Allowed"
					);
				} else if (oFd.lvInd === "X") {
					aBlockedMessages.push(
						"FD " + oFd.id + " Month End already performed for " + sMonth + ". Month End Not Allowed"
					);
				} else {
					aEligibleFds.push(oFd);
				}
			});

			if (aBlockedMessages.length) {
				MessageBox.error(aBlockedMessages.join("\n"));
			}

			if (!aEligibleFds.length) {
				return;
			}

			var oDatePicker = new DatePicker({
				valueFormat: "yyyy-MM-dd",
				displayFormat: "dd MMM yyyy",
				dateValue: new Date()
			});

			var oDialog = new Dialog({
				title: "Month End - " + sMonth,
				content: [
					new VBox({
						items: [
							new Text({ text: "Run Month End for " + aEligibleFds.length + " selected Fixed Deposit(s)?\n\nPlease select Posting Date:" }),
							oDatePicker
						]
					}).addStyleClass("sapUiSmallMargin")
				],
				beginButton: new Button({
					text: "Run",
					type: "Emphasized",
					press: function() {
						var oSelectedDate = oDatePicker.getDateValue();
						if (!oSelectedDate) {
							MessageBox.error("Please select a posting date.");
							return;
						}
						this._processMonthEnd(aEligibleFds, oTable, oSelectedDate);
						oDialog.close();
					}.bind(this)
				}),
				endButton: new Button({
					text: "Cancel",
					press: function() {
						oDialog.close();
					}
				}),
				afterClose: function() {
					oDialog.destroy();
				}
			});
			
			this.getView().addDependent(oDialog);
			oDialog.open();
		},

		_processMonthEnd: function(aSelectedFds, oTable, oPostingDate) {
			var oBusy = new BusyDialog({ text: "Running Month End..." });
			oBusy.open();

			var oServiceModel = this.getOwnerComponent().getModel();
			if (!oServiceModel || !oServiceModel.read) {
				oBusy.close();
				MessageBox.error("OData Service is unavailable.");
				return;
			}

			var aPromises = aSelectedFds.map(function(oFd) {
				return new Promise(function(resolve) {
					var padTo10 = function(sVal) {
						var sTrimmed = (sVal || "").trim();
						if (sTrimmed && /^\d+$/.test(sTrimmed) && sTrimmed.length < 10) {
							return "0000000000".substring(0, 10 - sTrimmed.length) + sTrimmed;
						}
						return sTrimmed;
					};

					if (!oFd.glP || !oFd.glI || !oFd.glInc || !oFd.profitCenter) {
						resolve({ status: "Error", id: oFd.id, message: "GL Accounts or Profit Center are missing." });
						return;
					}

					var oStartDate = oPostingDate ? this._toODataDateTime(oPostingDate) : (oFd.start ? this._toODataDateTime(oFd.start) : null);
					var oCreateDate = oFd.creationDate ? this._toODataDateTime(oFd.creationDate) : null;

					var bStartDateValid = oStartDate instanceof Date && !isNaN(oStartDate.getTime());
					var bCreateDateValid = oCreateDate instanceof Date && !isNaN(oCreateDate.getTime());

					var aFilters = [
						new Filter("CoCode", FilterOperator.EQ, oFd.coCode || ""),
						new Filter("FdAccno", FilterOperator.EQ, oFd.id || ""),
						new Filter("BankName", FilterOperator.EQ, oFd.bank || ""),
						new Filter("PrincipalAmt", FilterOperator.EQ, String(oFd.principal || "")),
						new Filter("InterestRate", FilterOperator.EQ, String(oFd.rate || ""))
					];

					if (bStartDateValid) {
						aFilters.push(new Filter("StartDate", FilterOperator.EQ, oStartDate));
					}

					if (bCreateDateValid) {
						aFilters.push(new Filter("CREATE_DATE", FilterOperator.EQ, oCreateDate));
					}

					aFilters.push(
						new Filter("TenorMonths", FilterOperator.EQ, String(oFd.tenor || "")),
						new Filter("CompoundFreq", FilterOperator.EQ, this._compoundFreqText(oFd.freq)),
						new Filter("OpeningFd", FilterOperator.EQ, oFd.openingFd || ""),
						new Filter("GlPrincipal", FilterOperator.EQ, padTo10(oFd.glP)),
						new Filter("BankGl", FilterOperator.EQ, padTo10(oFd.bankGL)),
						new Filter("GlReceivable", FilterOperator.EQ, padTo10(oFd.glI)),
						new Filter("GlIncome", FilterOperator.EQ, padTo10(oFd.glInc)),
						new Filter("ProfitCenter", FilterOperator.EQ, padTo10(oFd.profitCenter)),
						new Filter("LV_IND", FilterOperator.EQ, "X")
					);

					oServiceModel.read("/AccountingDocSet", {
						filters: aFilters,
						success: function (oResponse) {
							var oResult = (oResponse && oResponse.results && oResponse.results[0]) || {};
							var sDocNo = oResult.FdDocNo || oResult.FD_DOC_NO || "--";
							var sRevNo = oResult.FdRevNo || oResult.FD_REV_NO || "--";

							var oOriginalFd = this._fds.find(function (f) {
								return f.id === oFd.id;
							});

							if (oOriginalFd) {
								oOriginalFd.lvInd = "X";
								oOriginalFd.monthEndDocNo = sDocNo;
								oOriginalFd.monthEndRevNo = sRevNo;
							}

							oFd.lvInd = "X";
							oFd.monthEndDocNo = sDocNo;
							oFd.monthEndRevNo = sRevNo;

							resolve({
								status: "Success",
								id: oFd.id,
								docNo: sDocNo,
								revNo: sRevNo,
								message: "Month End posted successfully"
							});
						}.bind(this),
						error: function (oError) {
							var sBackendMessage = this._extractODataError(oError);

							if (sBackendMessage && sBackendMessage.toLowerCase().indexOf("already processed") !== -1) {
								sBackendMessage = "Month End already performed for this month.";
							}

							resolve({
								status: "Error",
								id: oFd.id,
								message: sBackendMessage || "Failed to process Month End."
							});
						}.bind(this)
					});
				}.bind(this));
			}.bind(this));

			Promise.all(aPromises).then(function (aResults) {
				oBusy.close();
				oTable.removeSelections(true);
				this.getView().getModel().setData(this._buildAppData());

				var oModel = new JSONModel(aResults);
				var oTableControl = new Table({
					columns: [
						new Column({ header: new Text({ text: "FD Number" }) }),
						new Column({ header: new Text({ text: "Status" }) }),
						new Column({ header: new Text({ text: "Message" }) })
					]
				});
				oTableControl.setModel(oModel);
				oTableControl.bindItems("/", new ColumnListItem({
					cells: [
						new Text({ text: "{id}" }),
						new ObjectStatus({
							text: "{status}",
							state: "{= ${status} === 'Success' ? 'Success' : 'Error' }"
						}),
						new Text({ text: "{message}" })
					]
				}));

				var oDialog = new Dialog({
					title: "Month End Batch Summary",
					contentWidth: "700px",
					content: [oTableControl],
					endButton: new Button({
						text: "Close",
						press: function () { oDialog.close(); oDialog.destroy(); }
					})
				});
				this.getView().addDependent(oDialog);
				oDialog.open();
			}.bind(this));
		}
	});
});
