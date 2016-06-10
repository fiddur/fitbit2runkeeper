Fitbit → Runkeeper syncer
==========================

This program will, when more ready, take activities in Runkeeper and add heartrate series from
Fitbit (e.g. HR or Surge).

**This project is stalled**, to be able to add automatic sync from activities recorded with a Fitbit tracker into Runkeeper as
well, but that will have to wait until they
[deliver those activities in the API](https://community.fitbit.com/t5/Web-API/Breaking-change-to-Get-Activity-Logs-List/m-p/1278266).


This is Work In Progress and does not currently work at all yet!


Webtask
-------

To be able to run this locally, but still receive push notifications, I've uploaded the
subscription handler to webtask.io.


Install
-------

To get this to work you need Fitbit personal API or partner API, otherwise you can't get intraday
heart rate series.

1. Register accounts:
  * Fitbit, needs to be Personal API (or Partner API).
  * Runkeeper
  * MongoDB (E.g. get a free one at https://mlab.com/ )
2. Copy `config.json.sample` to `config.json` and edit.
3. Use node 4 or 5. E.g. `nvm use 5`
4. Add subscription endpoint
  1. Upload webtasks
  2. Register subscription on fitbit.

```bash
npm install
npm start
```
