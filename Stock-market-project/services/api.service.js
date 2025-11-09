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

		// Global Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
		use: [],

		routes: [
			{
				path: "/api",

				whitelist: [
					"**"
				],

				// Route-level Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
				use: [],

				// Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
				mergeParams: true,

				// Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
				authentication: false,

				// Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
				authorization: false,

				// The auto-alias feature allows you to declare your route alias directly in your services.
				// The gateway will dynamically build the full routes from service schema.
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
					"GET /accounts/users/balance": "core-logic.getBalance",   // <-- added
					"GET portfolio": "core-logic.getPortfolio", //singal path enfoced on GET?
					"GET getTransactionHistory": "core-logic.getTransactionHistory", // --NEW func to return transaction history
					"GET getOrderHistory": "core-logic.getOrderHistory", // --NEW func to return order history

					// ========== Orders ==========
					"POST /orders/place": "core-logic.placeOrder",
					"DELETE /orders/cancel": "core-logic.cancelOrder",

					// NOT DONE ========== Admin Market Endpoints ==========
					"GET /market/market-open": "core-logic.isMarketOpen",
					"GET /market/schedule": "core-logic.getMarketSchedule",
					"PUT /market/schedule": "core-logic.updateMarketSchedule",
					"GET /market/holidays": "core-logic.getAllHolidays",
					"POST /market/holidays": "core-logic.addHoliday",
					"DELETE /market/holidays/:holiday_date": "core-logic.deleteHoliday",
					"DELETE /market/holidays": "core-logic.deleteAllHolidays",
				},

				/**
				 * Before call hook. You can check the request.
				 * @param {Context} ctx
				 * @param {Object} route
				 * @param {IncomingRequest} req
				 * @param {ServerResponse} res
				 * @param {Object} data
				 *
				onBeforeCall(ctx, route, req, res) {
					// Set request headers to context meta
					ctx.meta.userAgent = req.headers["user-agent"];
				}, */

				/**
				 * After call hook. You can modify the data.
				 * @param {Context} ctx
				 * @param {Object} route
				 * @param {IncomingRequest} req
				 * @param {ServerResponse} res
				 * @param {Object} data
				onAfterCall(ctx, route, req, res, data) {
					// Async function which return with Promise
					return doSomething(ctx, res, data);
				}, */

				// Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
				callOptions: {},

				bodyParsers: {
					json: {
						strict: false,
					},
					urlencoded: {
						extended: true,
					}
				},

				// Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
				mappingPolicy: "all", // Available values: "all", "restrict"

				// Enable/disable logging
				logging: true
			}
		],

		// Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
		log4XXResponses: false,
		// Logging the request parameters. Set to any log level to enable it. E.g. "info"
		logRequestParams: null,
		// Logging the response data. Set to any log level to enable it. E.g. "info"
		logResponseData: null,


		// Serve assets from "public" folder. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Serve-static-files
		assets: {
			folder: "./public",

			// Options to `server-static` module
			// options: {
			// 	index: false
			// }
		}
	},

	methods: {

		/**
		 * Authenticate the request. It check the `Authorization` token value in the request header.
		 * Check the token value & resolve the user by the token.
		 * The resolved user will be available in `ctx.meta.user`
		 *
		 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authenticate(ctx, route, req) {
		const auth = req.headers["authorization"];
		if (auth && auth.startsWith("Bearer")) {
			const token = auth.slice(7);
			try {
			const payload = jwt.verify(token, JWT_SECRET);
			// Return an object to be set on ctx.meta.user
			return { id: payload.id, email: payload.email, role: payload.role };
			} catch (err) {
			// Invalid / expired token
			throw new ApiGateway.Errors.UnAuthorizedError(ApiGateway.Errors.ERR_INVALID_TOKEN);
			}
		}
		// No token present -> anonymous access (or throw if you want strict)
		return null;
		},


		/**
		 * Authorize the request. Check that the authenticated user has right to access the resource.
		 *
		 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authorize(ctx, route, req) {
			// Get the authenticated user.
			const user = ctx.meta.user;

			// It check the `auth` property in action schema.
			if (req.$action.auth == "required" && !user) {
				throw new ApiGateway.Errors.UnAuthorizedError("NO_RIGHTS");
			}
		}

	}
};
