sap.ui.define([], function() {
	"use strict";

	return {
		extract: function(oError, sFallback) {
			if (!oError) return sFallback || "An unknown error occurred.";

			var sResponse = oError.responseText;
			if (!sResponse) {
				return sFallback || "The server did not respond correctly.";
			}

			var sMessage = "";

			// 1. Try to parse headers for standard sap-message (often contains the real business error)
			if (oError.headers && oError.headers["sap-message"]) {
				try {
					var oSapMessage = JSON.parse(oError.headers["sap-message"]);
					if (oSapMessage && oSapMessage.message) {
						sMessage = oSapMessage.message;
					}
				} catch (e) {
					// Ignore parse errors on header
				}
			}

			// 2. If no sap-message, try the JSON body
			if (!sMessage) {
				try {
					var oBody = JSON.parse(sResponse);
					
					if (oBody && oBody.error) {
						// Look for inner business errors first
						if (oBody.error.innererror && oBody.error.innererror.errordetails && oBody.error.innererror.errordetails.length > 0) {
							// Find the first relevant message that isn't just an empty or generic exception
							for (var i = 0; i < oBody.error.innererror.errordetails.length; i++) {
								var sDetailMsg = oBody.error.innererror.errordetails[i].message;
								if (sDetailMsg && sDetailMsg.toLowerCase().indexOf("an exception was raised") === -1) {
									sMessage = sDetailMsg;
									break;
								}
							}
						}
						
						// Fallback to top-level message
						if (!sMessage && oBody.error.message && oBody.error.message.value) {
							sMessage = oBody.error.message.value;
						}
					}
				} catch (oException) {
					// If it's not JSON, it might be raw text or HTML
					sMessage = sResponse;
				}
			}

			// 3. Map cryptic SAP messages to User-Friendly text
			if (sMessage) {
				var sLower = sMessage.toLowerCase();
				if (sLower.indexOf("sy-subrc") !== -1 || sLower.indexOf("bapi") !== -1) {
					sMessage = "A system error occurred while processing the request. Please contact IT support.";
				} else if (sLower.indexOf("not exist in table ska1") !== -1 || sLower.indexOf("g/l account") !== -1) {
					sMessage = "One of the provided G/L Accounts is invalid or missing in the master data.";
				} else if (sLower.indexOf("period") !== -1 && sLower.indexOf("not open") !== -1) {
					sMessage = "The posting period for this month is closed. Please ask Finance to open the period.";
				} else if (sLower.indexOf("company code") !== -1 && sLower.indexOf("does not exist") !== -1) {
					sMessage = "The Company Code is invalid.";
				}
			}

			return sMessage || sFallback || "An unexpected error occurred during processing.";
		}
	};
});
