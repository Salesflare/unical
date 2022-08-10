'use strict';
const EventEmitter = require('events');

const _ = require('lodash');
const Async = require('async');
const Batchelor = require('batchelor');
const Boom = require('@hapi/boom');

const Google = require('googleapis').google;
const GoogleCal = Google.calendar('v3');
const OAuth2 = Google.auth.OAuth2;

class GoogleCalConnector extends EventEmitter {
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

        this.name = 'GoogleCal';

    }

    /* EVENTS */

    /**
     *
     * @param {Object} auth - Authentication object
     * @param {String} auth.access_token - Access token
     * @param {String} auth.refresh_token - Refresh token
     *
     * @param {Object} params
     * @param {Number} params.maxResults - Maximum amount of events in response, max = 100
     * @param {String} params.pageToken - Token used to retrieve a certain page in the list
     * @param {String} params.calendarId - ID of the specified calendar
     * @param {String} params.timeMin - Start time of the events in response
     * @param {String} params.orderBy - The order of the events in the response
     * @param {Boolean} params.singleEvents - Only give single events or not
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
        const paramsArray = [];
        const googleCalParams = {
            auth,
            ...params
        };

        if (params.maxResults || params.maxResults === 0) {
            googleCalParams.maxResults = params.maxResults > 100 ? 100 : params.maxResults; // TODO: Waarom 100?
        } else {
            googleCalParams.maxResults = 100;
        }

        return this._prepareApiCall(googleCalParams, (params, oldAccessToken)=>{
            GoogleCal.events.list(params, (err, listResponse)=>{
                if(err) return callback(null, err);

                if (!listResponse.data.items || listResponse.data.items === 0) {
                    return callback(null, []);
                }

                const listEvents = listResponse.data.items.map(d => this._transformEvent(d))

                const eventList = {
                    events: listEvents,
                    next_page_token: listResponse.data.nextPageToken
                }

                return callback(null, options.raw ? listResponse.data.items : eventList);
            });
        });
    }

    /**
     *
     * @param {Object} auth - Authentication object
     * @param {String} auth.access_token - Access token
     * @param {String} auth.refresh_token - Refresh token
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

                return callback(null, options.rax ? res.data : this._transformEvent(res.data));
            });
        });
    }

    /**
     *  Gets first available event
     * 
     * @param {Object} auth - Authentication object
     * @param {String} auth.access_token - Access token
     * @param {String} auth.refresh_token - Refresh token
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
     * @param {Object} auth - Authentication object
     * @param {String} auth.access_token - Access token
     * @param {String} auth.refresh_token - Refresh token
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
     * @param {Object} auth - Authentication object
     * @param {String} auth.access_token - Access token
     * @param {String} auth.refresh_token - Refresh token
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
     * @param {Object} auth - Authentication object
     * @param {String} auth.access_token - Access token
     * @param {String} auth.refresh_token - Refresh token
     *
     * @param {Object} params
     * @param {Number} params.maxResults - Maximum amount of events in response, max = 100
     * @param {String} params.pageToken - Token used to retrieve a certain page in the list
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
        const paramsArray = [];
        const googleCalParams = {
            auth,
            ...params
        };

        if (params.maxResults || params.maxResults === 0) {
            googleCalParams.maxResults = params.maxResults > 100 ? 100 : params.maxResults; // TODO: Waarom 100?
        } else {
            googleCalParams.maxResults = 100;
        }

        return this._prepareApiCall(googleCalParams, (params, oldAccessToken)=>{
            GoogleCal.calendarList.list(params, (err, listResponse)=>{
                if(err) return callback(null, err);

                if (!listResponse.data || listResponse.data.items === 0) {
                    return callback(null, []);
                }

                const listCalendar = {
                    calendars: listResponse.data.items.map(d => this._transformCalendar(d)),
                    next_sync_token: listResponse.data.nextSyncToken,
                    next_page_token: listCalendar.data.nextPageToken
                }

                return callback(null, options.raw ? listResponse.data.items : listCalendar);
            });
        });
    }

    /**
     *
     * @param {Object} auth - Authentication object
     * @param {String} auth.access_token - Access token
     * @param {String} auth.refresh_token - Refresh token
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
        const paramsArray = [];
        const googleCalParams = {
            auth,
            ...params
        };

        return this._prepareApiCall(googleCalParams, (params, oldAccessToken)=>{
            GoogleCal.calendars.get(params, (err, res)=>{
                if(err) return callback(null, err);

                return callback(null, options.raw ? res.data : this._transformCalendar(res.data));
            });
        });
    }

    refreshAuthCredentials(auth, callback) {

        if (auth.access_token && (!auth.expiration_date || new Date(auth.expiration_date) > new Date())) {
            return callback(null, auth);
        }

        const oauth2Client = new OAuth2(this.clientId, this.clientSecret);

        oauth2Client.setCredentials({
            refresh_token: auth.refresh_token
        });

        return oauth2Client.refreshAccessToken((err, token) => { // TODO: deprecated

            if (err) {
                return callback(null, err);
            }

            this.emit('newAccessToken', token);

            return callback(null, token);
        });
    }

     /**
     *
     * @param {Object} auth - Authentication object
     * @param {String} auth.access_token - Access token
     * @param {String} auth.refresh_token - Refresh token
     *
     * @param {function (err, results)} callback
     *
     */
    _prepareApiCall(params, callback) {
        if (!(params.auth instanceof OAuth2)) {
            const oauth2Client = new OAuth2(
                this.clientId,
                this.clientSecret
            );

            oauth2Client.setCredentials({
                access_token: params.auth.access_token,
                refresh_token: params.auth.refresh_token
            });

            params.auth = oauth2Client;
        }

        const oldAccessToken = params.auth.credentials.access_token;

        callback(params, oldAccessToken);

        if (params.auth.credentials.access_token !== oldAccessToken) {
            this.emit('newAccessToken', { ...params.auth.credentials });
        }
    }


     /**
     * Transforms a raw Google Calendar API event response to a unified event resource
     *
     * @param {Object} data - Event in the format returned by the Google Calendar API
     *
     * @returns {EventResource} - Unified event resource
     */
    _transformEvent(data){        
        const event = {
            tag: data.etag,        
            id: data.id,
            status: data.status,
            htmlLink: data.htmlLink,
            created: data.created,
            updated: data.updated,
            summary: data.summary,
            location: data.location,
            creator : {
                email: data.creator.email,
                self: data.creator.self
            },
            organizer: {
                email: data.organizer.email,
                self: data.organizer.self
            },
            start: {
                dateTime: data.start.dateTime,
                timeZone: data.start.timeZone
            },
            end: {
                dateTime: data.end.dateTime,
                timeZone: data.end.timeZone
            },
            iCalUID: data.iCalUID
        }

        return event
    }

    /**
     * Transforms a raw Google Calendar API calendar response to a unified calendar resource
     *
     * @param {Object} data - Calendar in the format returned by the Google Calendar API
     *
     * @returns {CalendarResource} - Unified calendar resource
     */
    _transformCalendar(data){
        const calendar = {
            tag: data.etag,
            id: data.id,
            summary: data.summary,
            description: data.description ? data.description : '',
            timeZone: data.timeZone,
            colorId: data.colorId
        }

        return calendar
    }
}

module.exports = GoogleCalConnector;
