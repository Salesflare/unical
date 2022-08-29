'use strict'

/**
 * Event resource, represents an event and its metadata
 * This object structure should be returned by all custom connectors for events
 *
 * @global
 * @typedef {Object} EventResource
 * @property {String} id - ID of a given event
 * @property {String} calendar_id - ID of calendar event belongs to.
 * @property {String} meeting_url - URL reference to a meeting.
 * @property {String} summary - Summary
 * @property {String} description - Description
 * @property {Date} start - Start datetime-stamp
 * @property {Date} end - End datetime-stamp
 * @property {Boolean} deleted - Deleted status indicator
 * @property {Date} created - Timestamp indicating time of creation
 * @property {Date} updated - Timestamp indicating time of last update
 * @property {String} location - TODO: Location in spec but *NOT* in actual API response from Cronofy
 * @property {String} participation_status - Status of participation
 * @property {Attendee[]} attendees - List of attendees
 * @property {Person} organizer - Organizer of this event
 * @property {String} transparency - Transparency
 * @property {String} status - Status of event
 * @property {[]} categories - Unused as of now
 * @property {Boolean} recurring - Indicates whether event is recurring
 * @property {Boolean} private - Indicates whether event is private
 * @property {EventPermissions} permissions - Permissions user has on event
 * @property {String} next_page_token - Token referring to next page
 *
 * @property {String} tag - Tag of a given event (deprecated)
 * @property {String} id - ID of a given event (deprecated)
 * @property {String} status - Status of the event (deprecated)
 * @property {String} htmlLink - Public URL of the event (deprecated)
 * @property {DateTime} created - Date and time of event creation (deprecated)
 * @property {DateTime} updated - Date and time of event update (deprecated)
 * @property {String} summary - Summary or title of event (deprecated)
 * @property {String} location - Location of event (deprecated)
 * @property {String} creator.email - Email of the event creator (deprecated)
 * @property {Boolean} creator.self - Indicates if user is the creator (deprecated)
 * @property {String} organizer.email - Email of the event organizer (deprecated)
 * @property {Boolean} organizer.self - Indicates if user is the organizer (deprecated)
 * @property {DateTime} start.dateTime - Date and time of event start (deprecated)
 * @property {String} start.timeZone - Timezone of event (deprecated)
 * @property {DateTime} end.dateTime - Date and time of event stop (deprecated)
 * @property {String} end.timeZone - Timezone of event (deprecated)
 * @property {String} iCalUID - iCal UID (deprecated)
 */

/**
 *
 * @global
 * @typedef {Object} EventPermissions
 * @property {Boolean} delete - Indicates whether user can delete event
 * @property {Boolean} update - Indicates whether user can update event
 * @property {Boolean} change_participation_status - Indicates whether user can change participation status
 */

/**
 *
 * @global
 * @typedef {Object} Person
 * @property {String} email - Email address
 * @property {String} display_name - Name
 */

/**
 *
 * @global
 * @typedef {Object} Attendee
 * @property {String} email - Email address
 * @property {String} display_name - Name
 * @property {String} status - Status for event
 */

/**
 *
 * @global
 * @typedef {Object} EventListResource
 * @property {EventResource[]} events - List of event resources
 * @property {string} next_page_token - Token for the next page of events
 */

/**
  * Calendar resource, represents an calendar and its metadata
  * This object structure should be returned by all custom connectors for events
  *
  * @global
  * @typedef {Object} CalendarResource
  * @property {String} id - ID of this calendar.
  * @property {String} name - Name of this calendar.
  * @property {String} provider_name - Name of the provider
  * @property {String} profile_id - Profile ID
  * @property {String} profile_name - Profile name
  * @property {Boolean} readonly - Readonly status indicator
  * @property {Boolean} deleted - Deleted status indicator
  * @property {Boolean} primary - Primary status indicator
  * @property {String} next_page_token - Token to retrieve next page.
  * @property {String} tag - Tag of a given event (deprecated)
  * @property {String} summary - Summary or title of calendar (deprecated)
  * @property {String} description - Description of calendar (optional) (deprecated)
  * @property {String} timeZone - Timezone of an calendar (deprecated)
  * @property {String} colorId - Color of an calendar (optional) (deprecated)
  */

/**
 *
 * @global
 * @typedef {Object} CalendarListResource
 * @property {CalendarResource[]} calendars - List of calendar resources
 * @property {String} next_page_token - Token for the next page of calendars
 */

const connectors = Symbol('connectors');

class Unical {

    constructor() {

        this[connectors] = new Map();

        this.calendars = {
            /* Get a list of calendars */
            list: (connectorName, auth, params, options, callback) => {
                return this.callMethod(connectorName, 'listCalendars', auth, params, options, callback);
            },
        };

        this.events = {
            /* Get a list of events */
            list: (connectorName, auth, params, options, callback) => {
                return this.callMethod(connectorName, 'listEvents', auth, params, options, callback);
            },
        }

        this.auth = {
            refreshCredentialsIfExpired: (connectorName, auth, callback) => {

                return this.callMethod(connectorName, 'refreshAuthCredentials', auth, callback);
            },
            revokeCredentials: (connectorName, auth, callback) => {

                return this.callMethod(connectorName, 'revokeAuthCredentials', auth, callback);
            }
        };
    }

    /*
        Method that will add a new connector to the list of available connectors
    */
    use(connector) {

        if (!connector) {
            throw new Error('Connector cannot be undefined');
        }

        if (!connector.name) {
            throw new Error('Connector must have a name');
        }

        this[connectors].set(connector.name.toLowerCase(), connector);
    }

    /*
        Get a list of all available connectors
    */
    listConnectors() {

        return [...this[connectors].keys()];
    }


    /*
        Call the correct method from the correct connector with the specified connectorName
    */

    /**
     * @param {String} connectorName The name of the connector to use.
     *
     * @param {String} methodName The name of the method to use.
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
     * @returns {any} Returns a unified event list resource when options.raw is false or the raw response of the API when truthy
     */
    callMethod(connectorName, methodName, auth, params, options, callback) {

        if (!connectorName) {
            throw new Error('You should specify a connector name!');
        }

        const name = connectorName.toLowerCase();

        if (!this[connectors].has(name)) {
            throw new Error(`Unknown connector: ${connectorName}`);
        }

        const connector = this[connectors].get(name);

        if (!(methodName in connector)) {
            throw new Error(`This connector does not implement ${methodName}()`);
        }

        return connector[methodName](auth, params, options, callback);
    }
}

Unical.CronofyConnector = require('./unical-cronofy.js');
Unical.GoogleConnector = require('./unical-google.js');

module.exports = Unical;
