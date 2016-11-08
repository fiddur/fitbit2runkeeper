Fitbit → Runkeeper syncer
==========================

This program will, when more ready, take activities in Runkeeper and add
heartrate series from Fitbit (e.g. HR or Surge).

This project requires both Fitbit and Runkeeper API keys, and is using a fitbit
api beta feature that might be broken in the future:
https://dev.fitbit.com/docs/activity/#get-activity-logs-list

This is Work In Progress, but can export a fitbit activity to runkeeper,
currently tried (successfully) with runs that have GPS and heart rate as well
as auto-tracked "Sports" activity.


Install and run
---------------

To get this to work you need Fitbit personal API or partner API, otherwise you can't get intraday
heart rate series.

```bash
npm install

FITBIT_CLIENTID=... \
FITBIT_SECRET=... \
FITBIT_VERIFICATIONCODE=... \
RUNKEEPER_CLIENTID=... \
RUNKEEPER_SECRET=... \
SERVER_HOST=example.net \
SERVER_PORT=3000 \
SERVER_PROTOCOL=http \
PORT=3000 \
MONGODB_URI=mongodb://user:pass@example.net/fitbit2runkeeper \
COOKIE_SECRET=secret \
npm start
```


Usage right now
---------------

* Visit localhost.
* Connect both fitbit and runkeeper.
* List subscriptions to activate automatic sync.
* Click the fitbit activity's logId to export it to runkeeper.


Todo
----

* Don't mark every km as pause/resume just because fitbit makes laps of them.
* Make subscription automatic on first fitbit auth.
* Factor out authentication from `app.js`


License ([GNU AGPLv3](http://www.gnu.org/licenses/agpl-3.0.html))
-----------------------------------------------------------------

Copyright (C) 2015 Fredrik Liljegren <fredrik@liljegren.org>

Fitbit2Runkeeper is free software: you can redistribute it and/or modify it
under the terms of the GNU Affero General Public License as published by the
Free Software Foundation, either version 3 of the License, or (at your option)
any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

See COPYING.
