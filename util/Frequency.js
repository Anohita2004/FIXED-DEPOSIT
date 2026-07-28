sap.ui.define([], function() {
	"use strict";

	return {
		toText: function(vFreq) {
			var mText = {
				"12": "Monthly",
				"4": "Quarterly",
				"2": "Half-yearly",
				"1": "Yearly"
			};
			return mText[String(vFreq)] || String(vFreq || "");
		},

		parse: function(vValue) {
			var sValue = String(vValue || "").toLowerCase();
			var iValue = parseInt(sValue, 10);
			if (iValue > 0) { return iValue; }
			if (sValue.indexOf("quarter") > -1) { return 4; }
			if (sValue.indexOf("half") > -1 || sValue.indexOf("semi") > -1) { return 2; }
			if (sValue.indexOf("year") > -1 || sValue.indexOf("annual") > -1) { return 1; }
			return 0;
		}
	};
});
