'use strict'

const EventEmitter = require('events');

const Cronofy = require('cronofy');

const _ = require('lodash');

class CronofyConnector extends EventEmitter {
	/**
	 * @constructor
	 *
	 * @param {Object} config - Configuration object
	 * @param {String} config.clientId
	 * @param {String} config.clientSecret
	 */
	constructor(config) {
		super();

		if (!config || !config.clientId || !config.clientSecret) {
			throw new Error('Invalid configuration. Please refer to the documentation to get the required fields.');
		}

		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;

		this.name = 'Cronofy';

	}

	/* CALENDARS */

	/**
	 *
	 * @param {Object} auth - Authentication object
	 * @param {String} auth.access_token - Access token
	 * @param {String} auth.refresh_token - Refresh token
	 *
	 * @param {Object} params
	 * @param {Cronofy} params.client - Cronofy client
	 *
	 * @param {Object} options
	 * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
	 *
	 * @param {function (err, results)} callback
	 *
	 * @returns {CalendarListResource | Object} Returns a unified calendar list resource when options.raw is false or the raw response of the API when truthy
	 */
	listCalendars(auth, params, options, callback) {

		return this._prepareApiCall({...auth, ...params}, (err, client) => {
			if (err) {
				callback(err, null);
			}

			client.listCalendars((err, results) => {
				if (err) {
					return callback(err, null);
				}

				// TODO: Try to implement some form of adapter pattern to handle calendar adaptions as generic as possible.
				// Simply using lodash is also an option.
			});
		});
	}

	/**
	 *
	 *
	 * @param {Object} params
	 * @param {String} params.access_token - Access token
	 * @param {String} params.refresh_token - Refresh token
	 * @param {Cronofy} params.client - Cronofy client
	 *
	 *
	 * @param {function (error: any, client: Cronofy)} callback
	 *
	 */
	_prepareApiCall(params, callback) {
		try {
			if (!(params.client instanceof Cronofy)) {

				// TODO: Option 'data_center' omitted for now - specify later which datacenter to operate on.
				const cronofyClient = new Cronofy({
					access_token: params.access_token,
					refresh_token: params.refresh_token
				});

				params.client = cronofyClient;

				callback(null, cronofyClient);
			}
		}
		catch (exc) {
			callback(exc, null);
		}
	}
}

module.exports = CronofyConnector;
