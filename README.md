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


License ([GNU AGPLv3](http://www.gnu.org/licenses/agpl-3.0.html))
-----------------------------------------------------------------

Copyright (C) 2015 Fredrik Liljegren <fredrik@liljegren.org>

Some Comments is free software: you can redistribute it and/or modify it under the terms of the GNU
Affero General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Affero General Public License for more details.

See COPYING.
