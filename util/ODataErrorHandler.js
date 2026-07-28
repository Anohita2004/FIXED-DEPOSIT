sap.ui.define([], function() {
	"use strict";

	return {
		extract: function(oError, sFallback) {
			var sResponse = oError && oError.responseText;
			var oBody;
			if (!sResponse) {
				return sFallback || "FD creation failed.";
			}
			try {
				oBody = JSON.parse(sResponse);
				return oBody.error && oBody.error.message && oBody.error.message.value ? oBody.error.message.value : sResponse;
			} catch (oException) {
				return sResponse;
			}
		}
	};
});
