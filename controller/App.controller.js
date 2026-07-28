sap.ui.define([
	"./BaseController"
], function(BaseController) {
	"use strict";

	return BaseController.extend("com.infocus.zfifixeddepositZFI_FIXED_DEPOSIT.controller.App", {
		onInit: function() {
			this.initializeApplication();
		},
		onToggleCalculator: function(oEvent) {
			var oButton = oEvent.getSource();
			var oPopover = this.getView().byId("calcPopover");
			if (oPopover.isOpen()) {
				oPopover.close();
			} else {
				oPopover.openBy(oButton);
			}
		},
		onToggleQuickActions: function(oEvent) {
			var oButton = oEvent.getSource();
			var oActionSheet = this.getView().byId("quickActionsMenu");
			if (oActionSheet.isOpen()) {
				oActionSheet.close();
			} else {
				oActionSheet.openBy(oButton);
			}
		},
		onToggleNotifications: function(oEvent) {
			var oButton = oEvent.getSource();
			var oPopover = this.getView().byId("notificationPopover");
			if (oPopover.isOpen()) {
				oPopover.close();
			} else {
				oPopover.openBy(oButton);
			}
		}
	});
});
