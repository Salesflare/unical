const CronofyConnector = require('./unical-cronofy.js');

/**
 * This script can be used to test unical-cronofy.
 *
 * Usage: node ./lib/unical-cronofy-test.js <access-token> <refresh-token>
 */

if (!process.argv[3]) throw new Error('Missing arguments.');

let auth = {
	access_token: process.argv[2],
	refresh_token: process.argv[3]
};

let cronofyConnector = new CronofyConnector({
	clientId: null,
	clientSecret: null,
	accessToken: auth.access_token,
	refreshToken: auth.refresh_token,
});

let options = {};
let params = {};

cronofyConnector.refreshAuthCredentials(auth, (err, auth) => {
	cronofyConnector.listCalendars(auth, params, options, (err, result) => {
		console.log(result);
	});
});
