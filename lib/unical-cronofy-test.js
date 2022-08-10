const CronofyConnector = require('./unical-cronofy.js');

const Oauth2 = require('simple-oauth2');

/**
 * This script can be used to test unical-cronofy.
 *
 * Usage: node ./lib/unical-cronofy-test.js <access-token> <refresh-token>
 */

if (!process.argv[3]) throw new Error('Missing arguments.');

let auth = {
	access_token: process.argv[2],
	refresh_token: process.argv[3],
	expiration_date: '2022-08-17T13:22:22.901Z',
};

let cronofyConnector = new CronofyConnector({
	clientId: auth.clientId,
	clientSecret: auth.clientSecret,
	accessToken: auth.access_token,
	refreshToken: auth.refresh_token,
});

let options = {};
let params = {};
let eventParams = {
	timeZone: 'Europe/Brussels',
	from: new Date('2022-07-01'),
	to: new Date('2022-12-01'),
}
cronofyConnector.refreshAuthCredentials(auth, (err, auth) => {
	cronofyConnector.listCalendars(auth, params, options, (err, result) => {
		//console.log(result);

		result.calendars.forEach((calendar) => {
			cronofyConnector.listEvents(auth, { calendarId: calendar.id, ...eventParams }, {}, (err, results) => {
				//console.log(results);
			});
		});
	});

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

	const oauth2 = Oauth2.create(oauthCredentials);

	const token = oauth2.accessToken
		.create({
			refresh_token: auth.refresh_token,
			access_token: auth.access_token,
			expires_at: auth.expiration_date
		});


	console.log(token.expired());
});
