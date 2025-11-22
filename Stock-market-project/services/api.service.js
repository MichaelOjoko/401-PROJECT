"use strict"; 

const ApiGateway = require("moleculer-web");
const jwt = require("jsonwebtoken");
const JWT_SECRET = "dev_secret_change_me";

/**
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema Moleculer's Service Schema
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 * @typedef {import('http').IncomingMessage} IncomingRequest Incoming HTTP Request
 * @typedef {import('http').ServerResponse} ServerResponse HTTP Server Response
 * @typedef {import('moleculer-web').ApiSettingsSchema} ApiSettingsSchema API Setting Schema
 */

module.exports = {
	name: "api",
	mixins: [ApiGateway],

	/** @type {ApiSettingsSchema} More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html */
	settings: {
		// Exposed port
		port: 3000,

		// Exposed IP
		ip: "0.0.0.0",

		// Global Express middlewares
		use: [],

		routes: [
			{
				path: "/api",

				whitelist: [
					"**"
				],

				use: [],

				mergeParams: true,

				// ✅ Enable JWT parsing globally.
				// Only actions marked auth:"required" will be blocked if no token.
				authentication: true,
				authorization: true,

				autoAliases: true,

				aliases: {
					// ========== User Authentication ==========
					"POST /users/register": "core-logic.registerUser",
					"POST /users/login": "core-logic.loginUser",

					// ========== Stock Management ==========
					"POST /stocks": "core-logic.createStock",
					
					// ========== Market (Read-only for stock lists) ==========
					"GET /market/assets": "core-logic.listAssets",
					"GET /market/assets/:ticker": "core-logic.getAsset",

					// ========== Accounts (Cash Management) ==========
					"POST /accounts/users/deposit": "core-logic.depositCash",
					"POST /accounts/users/withdraw": "core-logic.withdrawCash",
					"GET /accounts/users/balance": "core-logic.getBalance",
					"GET portfolio": "core-logic.getPortfolio",
					"GET getTransactionHistory": "core-logic.getTransactionHistory",
					"GET getOrderHistory": "core-logic.getOrderHistory",

					// ========== Orders ==========
					"POST /orders/place": "core-logic.placeOrder",
					"DELETE /orders/cancel": "core-logic.cancelOrder",

					// ========== Admin Market Endpoints ==========
					"GET /market/market-open": "core-logic.isMarketOpen",
					"GET /market/schedule": "core-logic.getMarketSchedule",
					"PUT /market/schedule": "core-logic.updateMarketSchedule",
					"GET /market/holidays": "core-logic.getAllHolidays",
					"POST /market/holidays": "core-logic.addHoliday",
					"DELETE /market/holidays/:holiday_date": "core-logic.deleteHoliday",
					"DELETE /market/holidays": "core-logic.deleteAllHolidays",
				},

				callOptions: {},

				bodyParsers: {
					json: { strict: false },
					urlencoded: { extended: true }
				},

				mappingPolicy: "all",
				logging: true
			}
		],

		log4XXResponses: false,
		logRequestParams: null,
		logResponseData: null,

		assets: {
			folder: "./public",
		}
	},

	methods: {

		/**
		 * Authenticate the request.
		 */
		async authenticate(ctx, route, req) {
			const auth = req.headers["authorization"];
			if (auth && auth.startsWith("Bearer")) {
				const token = auth.slice(7);
				try {
					const payload = jwt.verify(token, JWT_SECRET);
					return { id: payload.id, email: payload.email, role: payload.role };
				} catch (err) {
					throw new ApiGateway.Errors.UnAuthorizedError(ApiGateway.Errors.ERR_INVALID_TOKEN);
				}
			}
			return null;
		},

		/**
		 * Authorize only actions that explicitly require it.
		 */
		async authorize(ctx, route, req) {
			const user = ctx.meta.user;
			if (req.$action.auth == "required" && !user) {
				throw new ApiGateway.Errors.UnAuthorizedError("NO_RIGHTS");
			}
		}
	}
};
