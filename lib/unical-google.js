'use strict';

const EventEmitter = require('events');

const Google = require('googleapis').google;

const GoogleCal = Google.calendar('v3');
const OAuth2 = Google.auth.OAuth2;

const DateFns = require('date-fns');

const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {import('./index').EventResource} EventResource
 * @typedef {import('./index').Attendee} Attendee
 * @typedef {import('./index').Person} Person
 * @typedef {import('./index').EventPermissions} EventPermissions
 * @typedef {import('./index').CalendarResource} CalendarResource
 * @typedef {import('./index').CalendarListResource} CalendarListResource
 * @typedef {import('./index').EventListResource} EventListResource
 * @typedef {import('./index').EventWatchResult} EventWatchResult
 */

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
     * Creates an instance of GoogleConnector.
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
     * Retrieves a list of events from a calendar.
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
     * @returns {Promise<EventListResource | Object[]>} Returns a unified event list resource or the raw response of the API
     */
    async listEvents(auth, params, options = {}) {

        const result = await this._prepareApiCall({ credentials: auth, oauth: null });

        const googleCalParams = {
            ...result.credentials,
            calendarId: params.calendarId,
            timeZone: params.timeZone,
            updatedMin: params.lastModified,
            timeMin: this._parseFromDateFromOriginalParams(params.from),
            timeMax: this._parseToDateFromOriginalParams(params.to),
            pageToken: params.pageToken,
            singleEvents: true,
            orderBy: 'startTime'
        };

        const listResponse = await GoogleCal.events.list(googleCalParams);

        if (!listResponse.data?.items || listResponse.data.items.length === 0) {
            return [];
        }

        const listEvent = {
            events: listResponse.data.items.map((d) => this._transformEvent(d, { id: params.calendarId }, { next_page_token: listResponse.data.nextPageToken })),
            next_page_token: listResponse.data.nextPageToken
        };

        return options.raw ? listResponse.data.items : listEvent;
    }

    /**
     * Retrieves a single event from a calendar.
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
     * @returns {Promise<EventResource | Object>} Returns a unified event resource or the raw response of the API
     */
    async getEvent(auth, params, options = {}) {

        const googleCalParams = {
            auth,
            ...params
        };
        await this._prepareApiCall(googleCalParams);

        const res = await GoogleCal.events.get(googleCalParams);

        return options.raw ? res.data : this._transformEvent(res.data, { id: googleCalParams.calendarId });
    }

    /**
     * Retrieves the first upcoming event from a calendar.
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.calendarId - ID of the specified calendar
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     *
     * @returns {Promise<EventResource | Object>} Returns a unified event resource or the raw response of the API
     */
    async getNextEvent(auth, params, options = {}) {

        const googleCalParams = {
            auth,
            ...params
        };
        await this._prepareApiCall(googleCalParams);

        const res = await GoogleCal.events.get(googleCalParams);

        return options.raw ? res.data : this._transformEvent(res.data);
    }

    /**
     * Creates a channel that watches for changes to a calendar and sends notifications to a callback URL.
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.calendarId - ID of the specified calendar
     * @param {String} params.callbackUrl - The location push notifications should be delivered at
     *
     * @param {Object} options
     * @param {String} options.callbackSecret - Secret to deliver along with push notifications
     *
     * @returns {Promise<EventWatchResult>} Returns the result of the calendar watch request
     */
    async watchEvents(auth, params, options = {}) {

        if (!options.callbackSecret) {
            throw new Error('Options object is missing properties. The option \'callbackSecret\' is mandatory for google notification channels.');
        }

        const result = await this._prepareApiCall({ credentials: auth, oauth: null });

        const googleCalParams = {
            ...result.credentials,
            calendarId: params.calendarId,
            requestBody: {
                id: uuidv4(),
                token: options.callbackSecret,
                type: 'web_hook',
                address: params.callbackUrl
            }
        };

        const notificationResponse = await GoogleCal.events.watch(googleCalParams);

        const uniformChannelId = `${notificationResponse.data.id}///${notificationResponse.data.resourceId}`;

        return { channelId: uniformChannelId };
    }

    /**
     * Stops a watch channel and no longer receives updates.
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.channelId - ID of the specified calendar
     *
     * @param {Object} options
     * @param {String} options.callbackSecret - Secret to deliver along with push notifications
     *
     * @returns {Promise<EventWatchResult>} Returns the result of the stop watch request
     */
    async stopWatchEvents(auth, params, options = {}) {

        const result = await this._prepareApiCall({ credentials: auth, oauth: null });

        const parsedData = params.channelId.split('///');

        if (parsedData.length !== 2) {
            throw new Error(`Channel ID is in an invalid format; '${params.channelId}'.`);
        }

        const googleCalParams = {
            ...result.credentials,
            requestBody: {
                id: parsedData[0],
                resourceId: parsedData[1],
                token: options.callbackSecret
            }
        };

        await GoogleCal.channels.stop(googleCalParams);

        return { channelId: params.channelId };
    }

    /* CALENDARS */

    /**
     * Lists all calendars available to the user.
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {Number} params.maxResults - Maximum amount of events in response, max = 100
     * @param {String} [params.pageToken] - Token used to retrieve a certain page in the list
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     *
     * @returns {Promise<CalendarListResource | Object>} Returns a unified calendar list resource or the raw response of the API
     */
    async listCalendars(auth, params, options = {}) {

        const result = await this._prepareApiCall({ credentials: auth, oauth: null });

        const googleCalParams = {
            minAccessRole: 'owner',
            ...result.credentials,
            ...params
        };

        const listResponse = await GoogleCal.calendarList.list(googleCalParams);

        if (!listResponse.data?.items || listResponse.data.items.length === 0) {
            return [];
        }

        const listCalendar = {
            calendars: listResponse.data.items.map((d) => this._transformCalendar(d, { next_page_token: listResponse.data.nextPageToken })),
            next_sync_token: listResponse.data.nextSyncToken,
            next_page_token: listResponse.data.nextPageToken
        };

        return options.raw ? listResponse.data.items : listCalendar;
    }

    /**
     * Retrieves a single calendar information.
     *
     * @param {Auth} auth - Authentication object
     *
     * @param {Object} params
     * @param {String} params.calendarId - ID of the specified calendar
     *
     * @param {Object} options
     * @param {Boolean} options.raw - If true the response will not be transformed to the unified object
     *
     * @returns {Promise<CalendarResource | Object>} Returns a unified calendar resource or the raw response of the API
     */
    async getCalendar(auth, params, options = {}) {

        const googleCalParams = {
            auth,
            ...params
        };
        await this._prepareApiCall(googleCalParams);

        const res = await GoogleCal.calendars.get(googleCalParams);

        return options.raw ? res.data : this._transformCalendar(res.data);
    }

    /**
     * Prepares the API call by refreshing the authentication credentials if needed.
     *
     * @param {Object} params
     * @param {Auth} params.credentials - Credentials
     * @param {OAuth2} params.oauth - OAuth client
     *
     * @returns {Promise<{ credentials: Auth, oauth: OAuth2 }>} - Refreshed credentials and OAuth client object
     */
    async _prepareApiCall(params) {

        const refreshedAuth = await this.refreshAuthCredentials(params.credentials, {}, {});

        if (!(params.oauth instanceof OAuth2)) {
            const oauth2Client = new OAuth2(
                this.clientId,
                this.clientSecret
            );

            oauth2Client.setCredentials({
                access_token: refreshedAuth.access_token,
                refresh_token: refreshedAuth.refresh_token
            });

            params.oauth = oauth2Client;
        }

        return params;
    }

    /*
     * Authentication & authorisation methods
     */

    /**
     * Refreshes the authentication credentials if necessary.
     *
     * @param {Auth} auth - Authentication object
     *
     * @returns {Promise<Auth>} - The refreshed authentication credentials
     */
    async refreshAuthCredentials(auth) {

        if (!(auth.access_token && auth.refresh_token && auth.expiration_date)) {
            throw new Error('Authentication object is missing properties. Refer to the docs for more info.');
        }

        await this._refreshTokenIfNeeded(auth);

        return auth;
    }

    /**
     * Revokes the authentication credentials.
     *
     * @param {Auth} auth - Authentication object
     *
     * @returns {Promise<void>} - A promise that resolves once the credentials are revoked
     */
    async revokeAuthCredentials(auth) {

        if (!(auth.access_token && auth.refresh_token && auth.expiration_date)) {
            throw new Error('Authentication object is missing properties. Refer to the docs for more info.');
        }

        const oauth2Client = new OAuth2(this.clientId, this.clientSecret);
        oauth2Client.setCredentials({
            access_token: auth.access_token,
            refresh_token: auth.refresh_token
        });

        await oauth2Client.revokeToken(oauth2Client.credentials.refresh_token);
    }

    /**
     * Refreshes the token if it is about to expire.
     *
     * @param {Auth} auth - Authentication object
     *
     * @returns {Promise<void>} - A promise that resolves once the token is refreshed
     */
    async _refreshTokenIfNeeded(auth) {

        if (DateFns.differenceInDays(new Date(auth.expiration_date), new Date()) <= 1) {
            return;
        }

        const oauth2Client = new OAuth2(this.clientId, this.clientSecret);
        oauth2Client.setCredentials({
            access_token: auth.access_token,
            refresh_token: auth.refresh_token
        });

        const tokens = await oauth2Client.refreshAccessToken();

        if (auth.access_token !== tokens.credentials.access_token) {
            auth.access_token = tokens.credentials.access_token;
            auth.refresh_token = tokens.credentials.refresh_token;
            auth.expiration_date = DateFns.fromUnixTime(tokens.credentials.expiry_date);

            this._tokensUpdated(auth);
        }
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
     * @param {GoogleCal.Schema$Event} googleEvent - Event in the format returned by the Google Calendar API
     * @param {GoogleCal.Schema$Calendar} googleCalendar - Calendar in the format returned by the Google Calendar API
     * @param {Object} [params] - A set of optional parameters
     * @param {Object} params.next_page_token - Token pointing to next page.
     *
     * @returns {EventResource} - Unified event resource
     */
    _transformEvent(googleEvent, googleCalendar, params = {}) {

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
            participation_status: 'needs_action',
            attendees: googleEvent.attendees?.map((attendee) => {

                return {
                    email: attendee.email,
                    display_name: attendee.displayName || '',
                    status: attendee.responseStatus
                };
            }) || [],
            organizer: {
                email: googleEvent.organizer?.email,
                display_name: googleEvent.organizer?.displayName || ''
            },
            transparency: googleEvent.transparency || null,
            status: googleEvent.status,
            categories: [],
            recurring: false,
            private: this._parseVisibilityToPrivate(googleEvent.visibility),
            options: {
                delete: true,
                update: true,
                change_participation_status: true
            },
            next_page_token: params.next_page_token
        };
    }

    /**
     * Transforms a raw Google Calendar API calendar response to a unified calendar resource
     *
     * @param {GoogleCal.Schema$Calendar} googleCalendar - Calendar in the format returned by the Google Calendar API
     * @param {Object} [params] - A set of optional parameters
     * @param {Object} params.next_page_token - Token pointing to next page.
     *
     * @returns {CalendarResource} - Unified calendar resource
     */
    _transformCalendar(googleCalendar, params = {}) {

        return {
            id: googleCalendar.id,
            name: googleCalendar.summary,
            provider_name: 'google',
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

        switch (accessRole) {
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

        switch (visibility) {
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
     * @param {GoogleCal.Schema$ConferenceData} conferenceData - Calendar in the format returned by the Google Calendar API
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


    /**
     * Parse a valid date 'from'-date.
     * This can be between 0 days and 42 days in the past.
     *
     * @param {Date} fromDate
     *
     * @returns {Date} - Valid 'from'-date
     */
    _parseFromDateFromOriginalParams(fromDate) {

        if (!fromDate) {
            return DateFns.startOfDay(DateFns.subDays(Date.now(), 42));
        }

        return DateFns.max([DateFns.startOfDay(DateFns.subDays(Date.now(), 42)), fromDate]);
    }

    /**
     * Parse a valid date 'to'-date.
     * This can be between 0 days and 201 days in the future.
     *
     * @param {Date} toDate
     *
     * @returns {Date} - Valid 'to'-date
     */
    _parseToDateFromOriginalParams(toDate) {

        if (!toDate) {
            return DateFns.endOfDay(DateFns.addDays(Date.now(), 201));
        }

        return DateFns.min([DateFns.endOfDay(DateFns.addDays(Date.now(), 201)), toDate]);
    }
}

module.exports = GoogleConnector;
