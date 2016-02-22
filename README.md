Fitbit → Runkeeper syncer
==========================

This program will, when more ready, take activities in Runkeeper and add heartrate series from
Fitbit (e.g. HR or Surge).

I would like to add automatic sync from activities recorded with a Fitbit tracker into Runkeeper as
well, but that will have to wait until they
[deliver those activities in the API](https://community.fitbit.com/t5/Web-API/Potentially-breaking-change-to-Get-Activities-endpoint/m-p/736342#U736342).


This is Work In Progress and does not currently work at all yet!


Install
-------

To get this to work you need Fitbit personal API or partner API, otherwise you can't get intraday
heart rate series.

```bash
nvm use 5
npm install
cp config.json.sample config.json ; and edit…
npm start
```
