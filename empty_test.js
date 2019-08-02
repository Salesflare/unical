const GoogleCalConnector = require('./unical-google.js')

/**
 * Make a file named api_creds.js
 * Copy and Paste this file
 * Add your keys
 *
 * In console do:
 *      npm i
 *      node api_creds.js
 *
 * Get your refreshtoken by following https://developers.google.com/calendar/quickstart/nodejs
 */

let gc = new GoogleCalConnector({
    clientId: "CLIENT_ID",
    clientSecret: "CLIENT_SECRET"
});
let options = {id: "customID", address: "...", token: "ABCDED"}
let params = {calendarId: "primary", maxResults: 10, singleEvents: true, timeMin: (new Date()).toISOString(), orderBy: 'startTime', eventId: 'EVENT_ID'};
let auth = {refresh_token: "REFRESH_TOKEN"};

gc.refreshAuthCredentials(auth, (err, auth) => {
    gc.listEvents(auth, params, (err, res)=>{
        console.log(res);
    })
    gc.listCalendars(auth, params, (err, res)=>{
        console.log(res);
    })
    gc.getEvent(auth, params, (err, res) => {
        console.log(res)
    })
    gc.getCalendar(auth, params, (err, res) => {
        console.log(res)
    })
    gc.getNextEvent(auth, params, (err, res) => {
        console.log(res)
    })
    gc.watchEvents(auth, params, options, (err, res) => {
        console.log(res)
    })
});
