'use latest'
'use strict'

const MongoClient = require('mongodb').MongoClient

/**
 * Make a CSV of number of steps per minute while running.
 *
 * Expects user and date as query parameters.
 * E.g. https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/getCsv?webtask_no_cache=1&user=39L68J&date=2016-03-31
 */
module.exports = function (ctx, req, res) {
  MongoClient.connect(ctx.data.MONGO_URL)
    .then(db => db.collection('steps').findOne({user: ctx.data.user, date: ctx.data.date}))
    .then(steps => {
      res.writeHead(200, {'Content-Type': 'text/csv'})
      res.end(
        steps.steps
          .filter(step => step.value > 110)
          .map(step => step.time + ',' + step.value)
          .join('\n')
      )
    })
}

/*

wt create getCsv.js \
  -s MONGO_URL=mongodb://frc:fee1Die0@ds015740.mlab.com:15740/fitbit-running-cadence

*/
