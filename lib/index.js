'use strict'

/**
 * Event resource, represents an event and its metadata
 * This object structure should be returned by all custom connectors for events
 *
 * @global
 * @typedef {Object} EventResource
 * @property {String} tag - Tag of a given event
 * @property {String} id - ID of a given event
 * @property {String} status - Status of the event
 * @property {String} htmlLink - Public URL of the event
 * @property {DateTime} created - Date and time of event creation
 * @property {DateTime} updated - Date and time of event update
 * @property {String} summary - Summary or title of event
 * @property {String} location - Location of event
 * @property {String} creator.email - Email of the event creator
 * @property {Boolean} creator.self - Indicates if user is the creator
 * @property {String} organizer.email - Email of the event organizer
 * @property {Boolean} organizer.self - Indicates if user is the organizer
 * @property {DateTime} start.dateTime - Date and time of event start
 * @property {String} start.timeZone - Timezone of event
 * @property {DateTime} end.dateTime - Date and time of event stop
 * @property {String} end.timeZone - Timezone of event
 * @property {String} iCalUID - iCal UID
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
  * @property {String} readonly - Readonly status indicator
  * @property {String} deleted - Deleted status indicator
  * @property {String} primary - Primary status indicator
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
 * @property {CalendarResource[]} calendars - List of event resources
 * @property {string} next_sync_token - Token for syncing calendars
 * @property {string} next_page_token - Token for the next page of calendars
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

            /* Get a calendar with params.calendarId as ID of the calendar */
            get: (connectorName, auth, params, options, callback) => {
                return this.callMethod(connectorName, 'getCalendar', auth, params, options, callback);
            }
        };

        this.events = {
            /* Get a list of events */
            list: (connectorName, auth, params, options, callback) => {
                return this.callMethod(connectorName, 'listEvents', auth, params, options, callback);
            },

            /* Get a list with params.eventId as ID of the event */
            get: (connectorName, auth, params, options, callback) => {
                return this.callMethod(connectorName, 'getEvent', auth, params, options, callback);
            },

            /* Get the next available event of calendar with params.calendarId as ID of the calendar*/
            next: (connectorName, auth, params, options, callback) => {
                return this.callMethod(connectorName, 'getNextEvent', auth, params, options, callback);
            },

            /* Get event updates of the calendar with  params.calendarId as ID of the calendar */
            watchEvents: (connectorName, auth, params, options, callback) => {
                return this.callMethod(connectorName, 'watchEvents', auth, params, options, callback);
            },

            /* Stop getting event updates */
            stopWatch: (connectorName, auth, params, options, callback) => {
                return this.callMethod(connectorName, 'stopWatch', auth, params, options, callback);
            }
        }

        //TODO: check if this is necessary
        this.auth = {
            refreshCredentialsIfExpired: (connectorName, auth, callback) => {
                return this.callMethod(connectorName, 'refreshAuthCredentials', auth, callback);
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

Unical.GoogleCalConnector = require('./unical-google.js');
Unical.CronofyConnector = require('./unical-cronofy.js');

module.exports = Unical;
