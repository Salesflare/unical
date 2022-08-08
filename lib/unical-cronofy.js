'use strict'

const EventEmitter = require('events');

const Cronofy = require('cronofy');

const Oauth2 = require('simple-oauth2');

/**
 * @typedef {import('./index').EventResource} EventResource
 * @typedef {import('./index').Attendee} Attendee
 * @typedef {import('./index').Person} Person
 * @typedef {import('./index').EventPermissions} EventPermissions
 */

class CronofyConnector extends EventEmitter {
	/**
	 * @typedef {Object} Auth - Authentication object
	 * @property {String} access_token
	 * @property {String} refresh_token
	 * @property {Date} expiration_date
	 * @property {*} [id] - will be passed back when emitting `newAccessToken`
	 */

	/**
	 * @typedef {Object} Config - Configuration object
	 * @property {String} clientId
	 * @property {String} clientSecret
	 */

	/**
	 * @constructor
	 *
	 * @param {Config} config - Configuration object
	 */
	constructor(config) {
		super();

		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;

		const oauthCredentials = {
			client: {
				id: this.clientId,
				secret: this.clientSecret
			},
			auth: {
				tokenHost: 'https://api.cronofy.com/v1',
				authorizePath: 'oauth/authorize',
				tokenPath: 'oauth/token'
			}
		};

		this.oauth2 = Oauth2.create(oauthCredentials);

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

				if (!results.calendars || results.calendars.length === 0) {
					return callback(null, []);
				}

				const calendarList = {
					calendars: results.calendars.map(d => this._transformCalendar(d)),
					next_sync_token: null,
					next_page_token: null,
				}

				return callback(null, options.raw ? results.calendars : calendarList);
			});
		});
	}

	/* EVENTS */

	/**
	 *
	 * @param {Object} auth - Authentication object
	 * @param {String} auth.access_token - Access token
	 * @param {String} auth.refresh_token - Refresh token
	 *
	 * @param {Object} params
	 * @param {String} params.calendarId - ID of the calendar to retrieve events on
	 * @param {String} params.timeZone - Timezone identifier
	 * @param {Date} params.lastModified -
	 * @param {Date} params.from - ID of the specified calendar
	 * @param {Date} params.to - ID of the specified calendar
	 * @param {String} params.pageToken - Token for page referral
	 *
	 * @param {Object} options
	 * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
	 *
	 * @param {function (err, results)} callback
	 *
	 * @returns {EventListResource | Object[]} Returns a unified event list resource when options.raw is false or the raw response of the API when truthy
	 */
	listEvents(auth, params, options, callback) {

		if (typeof options === 'function') {
			callback = options;
			options = {};
		}

		options = options || {};

		const cronofyParams = {
			from: params.from,
			to: params.to,
			tzid: params.timeZone,
			next_page: params.pageToken,
		};

		return this._prepareApiCall(auth, (err, client) => {

			if (err) {
				return callback(err, null);
			}

			client.readEvents(cronofyParams, (err, result) => {
				if (err) {
					return callback(err, null);
				}

				if (!result.events || result.pages?.total === 0) {
					return callback(null, []);
				}

				const eventsList = result.events.map((event) => this._transformEvent({ next_page_token: result.pages.next_page, ...event }));

				return callback(null, eventsList);
			});
		});
	}

	/**
	 * Transforms a raw Cronofy Calendar API calendar response to a unified calendar resource
	 *
	 * @param {Object} data - Calendar in the format returned by the Cronofy Calendar API
	 * @param {String} data.provider_name
	 * @param {String} data.profile_id
	 * @param {String} data.profile_name
	 * @param {String} data.calendar_id
	 * @param {String} data.calendar_name
	 * @param {Boolean} data.calendar_readonly
	 * @param {Boolean} data.calendar_deleted
	 * @param {Boolean} data.calendar_primary
	 * @param {Boolean} data.calendar_integrated_conferencing_available
	 * @param {String} data.permission_level
	 *
	 * @returns {CalendarResource} - Unified calendar resource
	 */
	_transformCalendar(data){
		return {
			id: data.calendar_id,
			name: data.calendar_name,
			provider_name: data.provider_name,
			profile_id: data.profile_id,
			profile_name: data.profile_name,
			readonly: data.calendar_readonly,
			deleted: data.calendar_deleted,
			primary: data.calendar_primary,
			next_page_token: null,
		}
	}

	/**
	 * Transforms a raw Cronofy API event response to a unified event resource
	 *
	 * @param {Object} data - Event in the format returned by the Cronofy API
	 * @param {String} data.event_uid
	 * @param {String} data.calendar_id
	 * @param {String} data.meeting_url
	 * @param {String} data.summary
	 * @param {String} data.description
	 * @param {Date} data.start
	 * @param {Date} data.end
	 * @param {Boolean} data.deleted
	 * @param {Date} data.created
	 * @param {Date} data.updated
	 * @param {Object} data.location
	 * @param {String} data.location.description
	 * @param {String} data.participation_status
	 * @param {Attendee[]} data.attendees
	 * @param {Person} data.organizer
	 * @param {Attendee[]} data.attendees
	 * @param {String} data.transparency
	 * @param {String} data.status
	 * @param {String} data.status
	 * @param {Boolean} data.recurring
	 * @param {Boolean} data.event_private
	 * @param {Object} data.options
	 * @param {Boolean} data.options.delete
	 * @param {Boolean} data.options.update
	 * @param {Boolean} data.options.change_participation_status
	 * @param {String} data.next_page_token
	 *
	 * @returns {EventResource} - Unified calendar resource
	 */
	_transformEvent(data) {
		return {
			id: data.event_uid,
			calendar_id: data.calendar_id,
			meeting_url: data.meeting_url,
			summary: data.summary,
			description: data.description,
			start: data.start,
			end: data.end,
			deleted: data.deleted,
			created: data.created,
			updated: data.updated,
			location: data.location?.description,
			participation_status: data.participation_status,
			attendees: data.attendees.map((attendee) => {
				return {
					email: attendee.email,
					display_name: attendee.display_name,
					status: attendee.status,
				}
			}),
			organizer: {
				email: data.organizer.email,
				display_name: data.organizer.display_name,
			},
			transparency: data.transparency,
			status: data.status,
			categories: [],
			recurring: data.recurring,
			private: data.event_private,
			permissions: {
				delete: data.options.delete,
				update: data.options.update,
				change_participation_status: data.options.change_participation_status
			},
			next_page_token: data.next_page_token
		}
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

	refreshAuthCredentials(auth, callback) {

		this._refreshTokenIfNeeded(auth, (err, resAuth) => {

			if (err) {
				return callback(err, null);
			}

			auth = resAuth;
			return callback(null, auth);
		});
	}

	/**
	 * Checks if the access token is still valid and gets a new one if needed.
	 *
	 * @param {Auth} authObject
	 *
	 * @param {(function(Error):void) | (function(null, Auth):void)} callback
	 *
	 * @returns {void} - If the access token was expired, a new one is returned. If it was still valid, original auth object is returned.
	 */
	_refreshTokenIfNeeded(authObject, callback) {
		if (!(authObject.access_token && authObject.refresh_token && authObject.expiration_date)) {
			throw new Error('Authentication object is missing properties. Refer to the docs for more info.');
		}

		const token = this.oauth2.accessToken
			.create({
				refresh_token: authObject.refresh_token,
				access_token: authObject.access_token,
				expires_at: authObject.expiration_date
			});

		if (!token.expired()) {
			return callback(null, authObject);
		}

		token.refresh((err, resAuth) => {

			if (err) {
				if (err.context && err.context.error) {
					err.message = err.context.error;
				}

				err.statusCode = err.status;

				return callback(err, null);
			}

			authObject.access_token = resAuth.token.access_token;
			authObject.expiration_date = resAuth.token.expires_at;

			this._tokensUpdated({
				refresh_token: authObject.refresh_token,
				access_token: resAuth.token.access_token,
				expires_at: resAuth.token.expires_at,
				id: authObject.id
			});

			return callback(null, authObject);
		});

	}

	/**
	 * Makes sure authentication information gets updated when the access token has been renewed
	 *
	 * @param {Object} newAuthObject - The new authentication information
	 * @param {String} newAuthObject.access_token
	 * @param {String} newAuthObject.refresh_token
	 * @param {Date} newAuthObject.expires_at
	 * @param {any} [newAuthObject.id]
	 *
	 * @returns {void}
	 */
	_tokensUpdated(newAuthObject) {

		const authToUpdate = {
			access_token: newAuthObject.access_token,
			refresh_token: newAuthObject.refresh_token,
			expiration_date: newAuthObject.expires_at.toISOString(),
			id: newAuthObject.id
		};

		this.emit('newAccessToken', authToUpdate);
	}
}

module.exports = CronofyConnector;
