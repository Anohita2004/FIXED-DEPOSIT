sap.ui.define([], function () {
    "use strict";

    return {

        readFdDetails: function (oModel, mParameters) {
            oModel.read("/FdDetailsSet", mParameters);
        },

        createLegacyFd: function (oModel, oPayload, mParameters) {
            oModel.create("/FdDetailsSet", oPayload, mParameters);
        },

        generateAccountingDoc: function (oModel, mParameters) {
            oModel.read("/AccountingDocSet", mParameters);
        }

    };
});