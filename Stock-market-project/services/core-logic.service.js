"use strict";
const { Pool } = require('pg'); //PostGres Library

/**
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema Moleculer's Service Schema
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "core-logic",

	settings: {

	},

	dependencies: [],

	// these are the functions that will be fired when an URL is hit
	actions: {


		hello: {
			async handler() {
				return "Hello Moleculer";
			}
		},

		welcome: {
			params: {
				name: "string"
			},
			async handler(ctx) {
				return `Welcome, ${ctx.params.name}`;
			}
		}
	},

	events: {

	},

	//LOGIC GOES HERE all private functions will be called by public API calls
	methods: {

		
	},

	created() {

	},

	async started() {
	
	},

	async stopped() {

	}
};
