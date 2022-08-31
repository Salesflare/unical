'use strict';
const EventEmitter = require('events');

const Google = require('googleapis').google;
const GoogleCal = Google.calendar('v3');
const OAuth2 = Google.auth.OAuth2;

const DateFns = require('date-fns');

class GoogleConnector extends EventEmitter {
    /**
     * @typedef {Object} Auth - Authentication object
     * @property {String} access_token
     * @property {String} refresh_token
     * @property {Date} expiration_date
     * @property {*} [id] - will be passed back when emitting `newAccessToken`
     */

    /**
     * @typedef {Object} ConnectorConfig - Configuration object
     * @property {String} clientId
     * @property {String} clientSecret
     */

    /**
     * @constructor
     *
     * @param {ConnectorConfig} config - Configuration object
     */
    constructor(config) {
        super();

        if (!config || !config.clientId || !config.clientSecret) {
            throw new Error('Invalid configuration. Please refer to the documentation to get the required fields.');
        }

        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;

        this.name = 'google';

    }

    /* EVENTS */

    /**
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.calendarId - ID of the calendar to retrieve events on
     * @param {String} params.timeZone - Timezone identifier
     * @param {Date} params.lastModified - Timestamp of last modification
     * @param {Date} params.from - Date from which to include
     * @param {Date} params.to - Date to which to include
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

        return this._prepareApiCall({ credentials: auth, oauth: null }, (err, result) => {

            const googleCalParams = {
                ...result.credentials,
                calendarId: params.calendarId,
                timeZone: params.timeZone,
                updatedMin: params.lastModified,
                timeMin: params.from,
                timeMax: params.to,
                pageToken: params.pageToken,
                singleEvents: true
            };

            GoogleCal.events.list(googleCalParams, (err, listResponse) => {
                if(err) return callback(null, err);

                if (!listResponse.data?.items || listResponse.data.items === 0) {
                    return callback(null, []);
                }

                const listEvent = {
                    events: listResponse.data.items.map(d => this._transformEvent(d, { id: params.calendarId },{ next_page_token: listResponse.data.nextPageToken })),
                    next_page_token: listResponse.data.nextPageToken
                }

                return callback(null, options.raw ? listResponse.data.items : listEvent);
            });
        });
    }

    /**
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.eventId - ID of the specified event
     * @param {String} params.calendarId - ID of the specified calendar
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     *
     * @param {function (err, results)} callback
     *
     * @returns {EventResource | Object} Returns a unified event resource when options.raw is false or the raw response of the API when truthy
     */
    getEvent(auth, params, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options = options || {};
        const paramsArray = [];
        const googleCalParams = {
            auth,
            ...params
        };

        return this._prepareApiCall(googleCalParams, (params, oldAccessToken)=>{
            GoogleCal.events.get(params, (err, res)=>{
                if(err) return callback(null, err);

                if (!res.data) {
                    return callback(null, null);
                }

                return callback(null, options.rax ? res.data : this._transformEvent(res.data, { id: googleCalParams.calendarId }));
            });
        });
    }

    /**
     *  Gets first available event
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.calendarId - ID of the specified calendar
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     *
     * @param {function (err, results)} callback
     *
     * @returns {EventResource | Object} Returns a unified event resource when options.raw is false or the raw response of the API when truthy
     */
    getNextEvent(auth, params, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options = options || {};
        const paramsArray = [];
        const googleCalParams = {
            auth,
            ...params
        };

        return this._prepareApiCall(googleCalParams, (params, oldAccessToken)=>{
            GoogleCal.events.get(params, (err, res)=>{
                if(err) return callback(null, err);

                if (!res.data) {
                    return callback(null, null);
                }

                return callback(null, options.raw ? res.data : this._transformEvent(res.data));
            });
        });
    }

    /**
     *  Watch a calendar to get updates about events changes
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.calendarId - ID of the specified calendar
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     * @param {String} options.id - A UUID or similar unique string that identifies this channel.
     * @param {String} options.address - The address where notifications are delivered for this channel.
     * @param {String} options.token - An arbitrary string delivered to the target address with each notification delivered over this channel. Optional.
     *
     * @param {function (err, results)} callback
     *
     * @returns {EventResource | Object} Returns a unified event resource when options.raw is false or the raw response of the API when truthy
     */
    watchEvents(auth, params, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options = options || {};
        const paramsArray = [];
        const googleCalParams = {
            auth,
            ...params,
            requestBody: {
                id: options.id,
                token: options.token,
                type: "web_hook",
                address: options.address
            }
        };

        return this._prepareApiCall(googleCalParams, (params, oldAccessToken)=>{
            GoogleCal.events.watch(params, (err, res)=>{
                if(err) return callback(null, err);
                /**
                 * TODO: process data
                 *
                 * {
                    "kind": "api#channel",
                    "id": "01234567-89ab-cdef-0123456789ab"", // ID you specified for this channel.
                    "resourceId": "o3hgv1538sdjfh", // ID of the watched resource.
                    "resourceUri": "https://www.googleapis.com/calendar/v3/calendars/my_calendar@gmail.com/events", // Version-specific ID of the watched resource.
                    "token": "target=myApp-myCalendarChannelDest", // Present only if one was provided.
                    "expiration": 1426325213000, // Actual expiration time as Unix timestamp (in ms), if applicable.
                    }
                 *
                 */
                return callback(null, res.data);
            });
        });
    }

    /**
     *  Stop watching a calendar
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.id - ID of the specified calendar
     * @param {String} params.resourceId - ID of the watched resource
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     *
     * @param {function (err, results)} callback
     *
     * @returns {EventResource | Object} Returns a unified event resource when options.raw is false or the raw response of the API when truthy
     */
    stopWatch(auth, params, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options = options || {};
        const paramsArray = [];
        const googleCalParams = {
            auth,
            requestBody: {
                id: params.id,
                resourceId: params.resourceId
            }
        };

        return this._prepareApiCall(googleCalParams, (params, oldAccessToken)=>{
            GoogleCal.channels.stop(params, (err, res)=>{
                if(err) return callback(null, err);
                return callback(null, res);
            });
        });
    }

    /* CALENDARS */

    /**
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {Number} params.maxResults - Maximum amount of events in response, max = 100
     * @param {String} params?.pageToken - Token used to retrieve a certain page in the list
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     *
     * @param {function (err, results)} callback
     *
     * @returns {CalendarListResource | Object} Returns a unified calendar list resource when options.raw is false or the raw response of the API when truthy
     */
    listCalendars(auth, params, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        options = options || {};

        return this._prepareApiCall({ credentials: auth, oauth: null }, (err, result) => {

            const googleCalParams = {
                ...result.credentials,
                ...params
            };

            GoogleCal.calendarList.list(googleCalParams, (err, listResponse) => {
                if(err) return callback(null, err);

                if (!listResponse.data?.items || listResponse.data.items === 0) {
                    return callback(null, []);
                }

                const listCalendar = {
                    calendars: listResponse.data.items.map(d => this._transformCalendar(d, { next_page_token: listResponse.data.nextPageToken })),
                    next_sync_token: listResponse.data.nextSyncToken,
                    next_page_token: listResponse.data.nextPageToken
                }

                return callback(null, options.raw ? listResponse.data.items : listCalendar);
            });
        });
    }

    /**
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.calendarId - ID of the specified calendar
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     *
     * @param {function (err, results)} callback
     *
     * @returns {CalendarResource | Object} Returns a unified calendar resource when options.raw is false or the raw response of the API when truthy
     */
    getCalendar(auth, params, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options = options || {};

        const googleCalParams = {
            auth,
            ...params
        };

        return this._prepareApiCall(googleCalParams, (params, oldAccessToken)=>{
            GoogleCal.calendars.get(params, (err, res) => {
                if(err) return callback(null, err);

                return callback(null, options.raw ? res.data : this._transformCalendar(res.data));
            });
        });
    }

    /**
     *
     * @param {Object} params
     * @param {Auth} params.credentials - Credentials
     * @param {OAuth2Client} params.oauth - OAuth client
     *
     * @param {function (err: any, results: { credentials: Auth, oauth: OAuth2Client })} callback
     *
     */
    _prepareApiCall(params, callback) {
        try {
            this.refreshAuthCredentials(params.credentials, {}, {}, (err, result) => {
                if (err) {
                    callback(err, null);
                }

                if (!(params.oauth instanceof OAuth2)) {
                    const oauth2Client = new OAuth2(
                        this.clientId,
                        this.clientSecret
                    );

                    oauth2Client.setCredentials({
                        access_token: result.access_token,
                        refresh_token: result.refresh_token
                    });

                    params.oauth = oauth2Client;
                }

                callback(null, params)
            });
        }
        catch (exc) {
            callback(exc, null);
        }
    }


    /*
     * Authentication & authorisation methods
     */

    /**
     * @param {Auth} auth Authentication object
     * @param {Object} params
     * @param {Object} options
     *
     * @param {(function(Error):void) | (function(null, Auth):void)} callback
     *
     */
    refreshAuthCredentials(auth, params, options, callback) {
        if (!(auth.access_token && auth.refresh_token && auth.expiration_date)) {
            throw new Error('Authentication object is missing properties. Refer to the docs for more info.');
        }

        this._refreshTokenIfNeeded(auth, (err, resAuth) => {

            if (err) {
                return callback(err, null);
            }

            auth = resAuth;
            return callback(null, auth);
        });
    }

    /**
     * @param {Auth} auth Authentication object
     * @param {Object} params
     * @param {Object} options
     *
     *
     * @param {function (error: any, result: any)} callback
     */
    revokeAuthCredentials(auth, params, options, callback) {
        if (!(auth.access_token && auth.refresh_token && auth.expiration_date)) {
            throw new Error('Authentication object is missing properties. Refer to the docs for more info.');
        }

        const oauth2Client = new OAuth2(this.clientId, this.clientSecret);

        oauth2Client.setCredentials({
            access_token: auth.access_token,
            refresh_token: auth.refresh_token
        });

        /* Revoking a refresh token should revoke the associated access token.
         * Also, if this access token happens to have expired, and an attempt is made to revoke it, this can cause (unnecessary) errors.
         */
        oauth2Client.revokeToken(oauth2Client.credentials.refresh_token, (err, result) => {
            if (err) {
                callback(err, null);
            }

            callback(null, result);
        });


    }


    /**
     * Checks if the access token is still valid and gets a new one if needed.
     *
     * @param {Auth} auth
     *
     * @param {(function(Error):void) | (function(null, Auth):void)} callback
     *
     * @returns {void} - If the access token was expired, a new one is returned. If it was still valid, original auth object is returned.
     */
    _refreshTokenIfNeeded(auth, callback) {

        if (!(auth.access_token && auth.refresh_token && auth.expiration_date)) {
            throw new Error('Authentication object is missing properties. Refer to the docs for more info.');
        }

        if (DateFns.differenceInDays(new Date(auth.expiration_date), new Date()) <= 1) {
            return callback(null, auth);
        }

        const oauth2Client = new OAuth2(this.clientId, this.clientSecret);

        oauth2Client.setCredentials({
            access_token: auth.access_token,
            refresh_token: auth.refresh_token
        });

        // Be careful: expiry_date is the Unix epoch time, not a regular date.
        oauth2Client.refreshAccessToken((err, result) => {

            if (err) {
                return callback(err, null);
            }

            if (auth.access_token !== result.access_token) {

                auth.access_token = result.access_token;
                auth.refresh_token = result.refresh_token;
                auth.expiration_date = DateFns.fromUnixTime(result.expiry_date);

                this._tokensUpdated(auth);
            }

            callback(null, auth);
        });
    }

    /**
     * Makes sure authentication information gets updated when the access token has been renewed
     *
     * @param {Auth} newAuthObject - The new authentication information
     *
     * @returns {void}
     */
    _tokensUpdated(newAuthObject) {

        const authToUpdate = {
            access_token: newAuthObject.access_token,
            refresh_token: newAuthObject.refresh_token,
            expiration_date: newAuthObject.expiration_date.toISOString(),
            id: newAuthObject.id
        };

        this.emit('newAccessToken', authToUpdate);
    }

    /*
     * Transformation utilities
     */
    /**
     * Transforms a raw Google Calendar API event response to a unified event resource
     *
     * @param {Schema$Event} googleEvent - Event in the format returned by the Google Calendar API
     * @param {Schema$Calendar} googleCalendar - Calendar in the format returned by the Google Calendar API
     * @param {Object} params? - A set of optional parameters
     * @param {Object} params.next_page_token - Token pointing to next page.
     *
     * @returns {EventResource} - Unified event resource
     */
    _transformEvent(googleEvent, googleCalendar, params= {}) {

        return {
            id: googleEvent.id,
            calendar_id: googleCalendar.id,
            meeting_url: this._parseConferenceUrlFromConferenceData(googleEvent.conferenceData),
            summary: googleEvent.summary,
            description: googleEvent.description,
            start: googleEvent.start?.dateTime ? googleEvent.start?.dateTime : googleEvent.start?.date,
            end: googleEvent.start?.dateTime ? googleEvent.start?.dateTime : googleEvent.start?.date,
            deleted: googleEvent.status === 'cancelled',
            created: googleEvent.created,
            updated: googleEvent.updated,
            location: googleEvent.location,
            participation_status: "needs_action",
            attendees: googleEvent.attendees?.map((attendee) => {
                return {
                    email: attendee.email,
                    display_name: attendee.displayName || '',
                    status: attendee.responseStatus,
                }
            }) || [],
            organizer: {
                email: googleEvent.organizer?.email,
                display_name: googleEvent.organizer?.displayName || '',
            },
            transparency: googleEvent.transparency || null,
            status: googleEvent.status,
            categories: [],
            recurring: false,
            private: this._parseVisibilityToPrivate(googleEvent.visibility),
            options: {
                delete: true,
                update: true,
                change_participation_status: true,
            },
            next_page_token: null,
        };
    }

    /**
     * Transforms a raw Google Calendar API calendar response to a unified calendar resource
     *
     * @param {Schema$Calendar} googleCalendar - Calendar in the format returned by the Google Calendar API
     * @param {Object} params? - A set of optional parameters
     * @param {Object} params.next_page_token - Token pointing to next page.
     *
     * @returns {CalendarResource} - Unified calendar resource
     */
    _transformCalendar(googleCalendar, params= {}) {

        return {
            id: googleCalendar.id,
            name: googleCalendar.summary,
            provider_name: "google",
            profile_id: null,
            profile_name: null,
            readonly: this._parseAccessRoleToReadOnly(googleCalendar.accessRole),
            deleted: !!googleCalendar.deleted,
            primary: !!googleCalendar.primary,
            next_page_token: params?.next_page_token
        };
    }

    /**
     * Parse the access role for read-write rights.
     *
     * @param {String} accessRole - Calendar in the format returned by the Google Calendar API
     *
     * @returns {Boolean} - Unified calendar resource
     */
    _parseAccessRoleToReadOnly(accessRole) {

        switch(accessRole) {
            case 'freeBusyReader':
                return true;
            case 'reader':
                return true;
            case 'writer':
                return false;
            case 'owner':
                return false;
            default:
                return true;
        }
    }

    /**
     * Parse whether event is private or not.
     *
     * @param {String} visibility - Calendar in the format returned by the Google Calendar API
     *
     * @returns {Boolean} - Is private
     */
    _parseVisibilityToPrivate(visibility) {

        switch(visibility) {
            case 'private':
                return true;
            case 'confidential':
                return true;
            case 'default':
                return false;
            case 'public':
                return false;
            default:
                return true;
        }
    }

    /**
     * Parse the access role for read-write rights.
     *
     * @param {Schema$ConferenceData} conferenceData - Calendar in the format returned by the Google Calendar API
     *
     * @returns {Boolean} - Unified calendar resource
     */
    _parseConferenceUrlFromConferenceData(conferenceData) {

        conferenceData?.entryPoints?.forEach((entryPoint) => {
            if (entryPoint.entryPointType === 'video') {
                return entryPoint.uri;
            }
        });

        return null;
    }
}

module.exports = GoogleConnector;
