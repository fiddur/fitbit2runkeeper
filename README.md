Fitbit → Runkeeper syncer
==========================

This program will, when more ready, take activities in Runkeeper and add heartrate series from
Fitbit (e.g. HR or Surge).

This project requires both Fitbit and Runkeeper API keys, and is using a fitbit
api beta feature that might be broken in the future:
https://dev.fitbit.com/docs/activity/#get-activity-logs-list

This is Work In Progress, but can export a fitbit activity to runkeeper,
currently only tried (successfully) with runs that have GPS and heart rate.


Install
-------

To get this to work you need Fitbit personal API or partner API, otherwise you can't get intraday
heart rate series.

```bash
npm install
cp config.json.sample config.json ; and edit…
mkdir data
touch data/users.json data/accounts.json
npm start
```


Usage right now
---------------

* Visit localhost.
* Connect both fitbit and runkeeper.
* Go to `/home`
* Click the fitbit activity's logId to export it to runkeeper.


Todo
----

* Make sync automatic (requires publishing to public endpoint)
* Factor out authentication from `server.js`
* Fix user/account/login handling
