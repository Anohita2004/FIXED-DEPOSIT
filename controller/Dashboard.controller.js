sap.ui.define([
	"./BaseController",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/BusyDialog",
	"../util/DashboardChartHelper",
	"sap/ui/model/json/JSONModel",
	"sap/viz/ui5/controls/Popover",
	"sap/m/Dialog",
	"sap/m/DatePicker",
	"sap/m/VBox",
	"sap/m/Text",
	"sap/m/Button",
	"sap/m/Table",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/m/ObjectStatus"
], function(BaseController, MessageBox, Filter, FilterOperator, BusyDialog, DashboardChartHelper, JSONModel, Popover, Dialog, DatePicker, VBox, Text, Button, Table, Column, ColumnListItem, ObjectStatus) {
	"use strict";

	return BaseController.extend("com.infocus.zfifixeddepositZFI_FIXED_DEPOSIT.controller.Dashboard", {
		onInit: function() {
			BaseController.prototype.onInit.apply(this, arguments);
			this._setupCharts();
		},

		_setupCharts: function() {
			var aCharts = [
				{ id: "portfolioTrendChart", type: "line" },
				{ id: "bankAllocationChart", type: "donut" },
				{ id: "interestRateChart", type: "bar" },
				{ id: "interestTrendChart", type: "line" }
			];

			// Vibrant premium color palette for charts
			var aPalettes = [
				"#0072C6", "#26A65B", "#F89406", "#8E44AD", "#F22613", "#3A539B", "#FDE3A7", "#00B16A"
			];

			var that = this;
			aCharts.forEach(function(oChartInfo) {
				var oChart = that.byId(oChartInfo.id);
				if (!oChart) return;

				// Attach interactive Popover
				var oPopover = new Popover({});
				oPopover.connect(oChart.getVizUid());

				// Configure stunning VizProperties
				var oProperties = {
					title: { visible: false },
					interaction: { selectability: { mode: "multiple" } },
					plotArea: {
						colorPalette: aPalettes,
						dataLabel: {
							visible: true,
							hideWhenOverlap: true,
							style: {
								color: "#333333",
								fontWeight: "bold"
							}
						},
						animation: {
							dataLoading: true,
							dataUpdating: true
						}
					},
					categoryAxis: {
						title: { visible: false },
						axisLine: { visible: false }
					},
					valueAxis: {
						title: { visible: false },
						axisLine: { visible: false }
					},
					legend: {
						isScrollable: true,
						title: { visible: false }
					},
					legendGroup: {
						layout: {
							position: "bottom"
						}
					}
				};

				if (oChartInfo.type === "donut") {
					oProperties.plotArea.dataLabel.type = "value"; // show value instead of percentage by default
				} else if (oChartInfo.type === "line") {
					oProperties.plotArea.marker = { visible: true, shape: "circle", size: 6 };
					oProperties.plotArea.dataPointStyle = {
						"rules": [
							{
								"dataContext": {"*": "*"},
								"properties": {
									"line": { "width": 3 }
								}
							}
						]
					};
				}

				oChart.setVizProperties(oProperties);
			});
		},


		_buildAppData: function() {
			// Get base data from parent
			var oData = BaseController.prototype._buildAppData.apply(this, arguments);
			
			// Enrich with DashboardChartHelper
			var fds = oData.fds || [];
			oData.averageInterestRate = DashboardChartHelper.getAverageInterestRate(fds);
			oData.topBanks = DashboardChartHelper.getTopBanks(fds);
			oData.maturitiesByMonth = DashboardChartHelper.getMaturitiesByMonth(fds);
			oData.portfolioTrend = DashboardChartHelper.getPortfolioTrend(fds);
			oData.interestTrend = DashboardChartHelper.getInterestTrend(fds);

			return oData;
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

			// Month-end always closes the current calendar month - this is
			// shown in the block/confirm messages so the user always knows
			// which month they're validating/posting for, not just how
			// many FDs are selected.
			var sMonth = this._fmtMonthYear(new Date());

			// Split selection into three buckets:
			//  - already matured (blocked)
			//  - already processed for month-end this run (blocked - lvInd
			//    is only ever set once and never reset, so it marks an FD
			//    as already closed)
			//  - eligible
			// oFd.status/oFd.maturityText/oFd.lvInd are already computed
			// by _decorateFd()/_mapFdDetailsEntity(), so no recalculation
			// is needed here.
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

					// Helper to pad numeric GL accounts and Profit Centers to 10 chars for ABAP BAPI
					var padTo10 = function(sVal) {
						var sTrimmed = (sVal || "").trim();
						if (sTrimmed && /^\d+$/.test(sTrimmed) && sTrimmed.length < 10) {
							return "0000000000".substring(0, 10 - sTrimmed.length) + sTrimmed;
						}
						return sTrimmed;
					};

					// Backend BAPI_ACC_DOCUMENT_POST will fail if GL accounts or Profit Center are missing.
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

							// Preserve the original FD Accounting Document.
							// Only update Month End indicator.
							var oOriginalFd = this._fds.find(function (f) {
								return f.id === oFd.id;
							});

							if (oOriginalFd) {
								oOriginalFd.lvInd = "X";

								// Optional if you ever need them later
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

					}); // closes oServiceModel.read()

				}.bind(this)); // closes new Promise()

			}.bind(this)); // closes aSelectedFds.map()

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