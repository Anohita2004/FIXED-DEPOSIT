sap.ui.define([], function () {
	"use strict";

	return {
		/**
		 * Calculate average interest rate of all active FDs.
		 */
		getAverageInterestRate: function (aFds) {
			if (!aFds || aFds.length === 0) return "0.00%";
			var aActive = aFds.filter(function(fd) { return fd.status === "active"; });
			if (aActive.length === 0) return "0.00%";

			var totalRate = 0;
			aActive.forEach(function (fd) {
				totalRate += parseFloat(fd.rate || 0);
			});
			var avg = totalRate / aActive.length;
			return avg.toFixed(2) + "%";
		},

		/**
		 * Build Top Performing Banks Ranking
		 */
		getTopBanks: function (aFds) {
			if (!aFds) return [];
			var aActive = aFds.filter(function(fd) { return fd.status === "active"; });
			var bankRates = {};
			aActive.forEach(function (fd) {
				var bank = fd.bank || "Unknown";
				var rate = parseFloat(fd.rate || 0);
				if (!bankRates[bank] || rate > bankRates[bank]) {
					bankRates[bank] = rate;
				}
			});

			var sortedBanks = Object.keys(bankRates).map(function (bank) {
				return { bank: bank, rate: bankRates[bank], rateText: bankRates[bank].toFixed(2) + "%" };
			}).sort(function (a, b) {
				return b.rate - a.rate;
			});

			return sortedBanks.slice(0, 5);
		},

		/**
		 * Build Upcoming Maturities by Month (Count)
		 */
		getMaturitiesByMonth: function (aFds) {
			if (!aFds) return [];
			var aActive = aFds.filter(function(fd) { return fd.status === "active"; });
			var monthData = {};
			var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			
			var today = new Date();
			for(var i=0; i<6; i++) {
				var d = new Date(today.getFullYear(), today.getMonth() + i, 1);
				monthData[monthNames[d.getMonth()] + " " + d.getFullYear()] = { count: 0, amount: 0 };
			}

			aActive.forEach(function (fd) {
				if (fd.maturity) {
					var date = fd.maturity instanceof Date ? fd.maturity : new Date(fd.maturity);
					if (!isNaN(date.getTime())) {
						var key = monthNames[date.getMonth()] + " " + date.getFullYear();
						if (monthData[key] !== undefined) {
							monthData[key].count++;
							monthData[key].amount += parseFloat(fd.principal || 0);
						}
					}
				}
			});

			return Object.keys(monthData).map(function(key) {
				return { month: key, count: monthData[key].count, amount: monthData[key].amount };
			});
		},

		/**
		 * Build Portfolio Trend (Sum of Principal Active in recent months)
		 */
		getPortfolioTrend: function (aFds) {
			if (!aFds) return [];
			var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			var trend = [];
			var today = new Date();
			
			// Let's generate a trend for the last 6 months
			for(var i=5; i>=0; i--) {
				var d = new Date(today.getFullYear(), today.getMonth() - i, 1);
				var monthKey = monthNames[d.getMonth()] + " " + d.getFullYear();
				
				// Calculate principal active in that month
				var monthPrincipal = 0;
				aFds.forEach(function(fd) {
					var start = fd.start instanceof Date ? fd.start : new Date(fd.start);
					var maturity = fd.maturity instanceof Date ? fd.maturity : new Date(fd.maturity);
					if (!isNaN(start.getTime()) && start <= new Date(d.getFullYear(), d.getMonth() + 1, 0)) {
						if (isNaN(maturity.getTime()) || maturity >= d) {
							monthPrincipal += parseFloat(fd.principal || 0);
						}
					}
				});
				
				trend.push({ month: monthKey, amount: monthPrincipal });
			}
			return trend;
		},

		/**
		 * Build Monthly Interest Accrual Trend
		 */
		getInterestTrend: function (aFds) {
			if (!aFds) return [];
			var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			var trend = [];
			var today = new Date();
			
			// Let's generate an interest trend for the last 6 months
			for(var i=5; i>=0; i--) {
				var d = new Date(today.getFullYear(), today.getMonth() - i, 1);
				var monthKey = monthNames[d.getMonth()] + " " + d.getFullYear();
				
				var monthInterest = 0;
				aFds.forEach(function(fd) {
					var start = fd.start instanceof Date ? fd.start : new Date(fd.start);
					var maturity = fd.maturity instanceof Date ? fd.maturity : new Date(fd.maturity);
					if (!isNaN(start.getTime()) && start <= new Date(d.getFullYear(), d.getMonth() + 1, 0)) {
						if (isNaN(maturity.getTime()) || maturity >= d) {
							// Roughly estimate monthly interest: Principal * Rate / 12
							var p = parseFloat(fd.principal || 0);
							var r = parseFloat(fd.rate || 0) / 100;
							monthInterest += (p * r) / 12;
						}
					}
				});
				
				trend.push({ month: monthKey, interest: Math.round(monthInterest) });
			}
			return trend;
		}
	};
});
