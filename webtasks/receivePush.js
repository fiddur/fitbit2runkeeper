'use latest'
'use strict'

const express     = require('express')
const webtask     = require('webtask-tools')
const bodyParser  = require('body-parser')
const rp          = require('request-promise')
const MongoClient = require('mongodb').MongoClient
const Promise     = require('bluebird')

const server = express()
server.use(bodyParser.json())

const fetchUserFromMongo = (db, id) => db.collection('users').findOne({fitbitId: id})

const getStepsFromFitbit = (db, user, date, clientID, clientSecret) => {
  const stepsUrl = 'https://api.fitbit.com/1/user/' + user.fitbitId +
        '/activities/steps/date/' + date + '/1d/1min.json'
  return rp({
    headers: {'Authorization': 'Bearer ' + user.accessToken},
    uri:     stepsUrl,
    json:    true,
  }).catch(err => {
    // Try to use refreshToken to get new accessToken.
    if (err.statusCode === 401 && err.error.errors[0].errorType === 'expired_token') {
      return getNewFitbitAccessToken(db, user, clientID, clientSecret)
        .then(accessToken => {
          user.accessToken = accessToken // @todo Update in Mongo
          return getStepsFromFitbit(db, user, date, clientID, clientSecret)
        })
    }
    else throw err
  })
}

// Store all steps in separate collection for later charting.
const updateStepsInMongo = (db, id, date, steps) => {
  return db.collection('steps').findOneAndUpdate(
    {user: id, date: date},
    {user: id, date: date, steps: steps},
    {upsert: true}
  )
}

const getNewFitbitAccessToken = (user, clientID, clientSecret) => {
  const basic = new Buffer(clientID + ':' + clientSecret).toString('base64')
  console.log('Refreshing with refreshToken:', user.refreshToken)
  return rp({
    method: 'POST',
    uri: 'https://api.fitbit.com/oauth2/token',
    headers: {
      'Authorization': 'Basic ' + basic,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
    },
  }).then(response => {
    // Update accessToken in db.
    db.collection('users').findOneAndUpdate(
      {fitbitId: user.fitbitId},
      {$set: {
        accessToken:  response.access_token,
        refreshToken: response.refresh_token,
      }}
    ).catch(err => console.log(err)) // This error is not fatal for the token.

    return response.access_token
  }).catch(err => {
    console.log('Couldnt refresh token.  Clearing tokens from user', user.fitbitId)

    // If we can't refresh the accessToken, remove all tokens from user.
    return db.collection('users').findOneAndUpdate(
      {fitbitId: user.fitbitId},
      {$set: {accessToken:  null, refreshToken: null}}
    )
  })
}

/// Find runs; reduce steps to an array of runs with start, pauses, and end
const analyzeSteps = steps => {
  const runs = []
  let current = null

  steps.forEach((step, i, steps) => {
    const times = step.time.split(':')
    const minute = parseInt(times[0]) * 60 + parseInt(times[1]) // Minute of day.

    if (step.value > 120) {
      // Running this minute.
      if (!current) current = {start: minute, pauses: [], steps: [step.value]}
      else if ('end' in current) {
        if (minute - current.end < 15) {
          // Consider not running for < 15 minutes a pause.
          current.pauses.push({start: current.end, end: minute - 1})
          delete current.end
        }
        else {
          // New run!
          runs.push(current)
          current = {start: minute, pauses: [], steps: [step.value]}
        }
      }
      else current.steps.push(step.value)
    }
    else if (current && !('end' in current)) {
      current.end = minute - 1
      if (current.end - current.start < 3) current = null
    }
  })
  if (current) runs.push(current)

  // Add median cadence to all runs.
  runs.forEach(run => {
    const sortedSteps = run.steps.slice().sort()
    const lowMiddle = Math.floor(sortedSteps.length / 2)
    run.median = (sortedSteps.length % 2)
      ? sortedSteps[lowMiddle]
      : (sortedSteps[lowMiddle] + sortedSteps[lowMiddle + 1]) / 2
  })

  return runs
}

server.post('/', (req, res) => {
  res.sendStatus(204) // Just acknowledge receiving the push.

  MongoClient.connect(req.webtaskContext.data.MONGO_URL, {promiseLibrary: Promise})
    .then(db => Promise.all(req.body.map(
      updated => fetchUserFromMongo(db, updated.ownerId)
        .then(user => Promise.all([
          user,
          getStepsFromFitbit(
            db, user, updated.date, req.webtaskContext.data.FITBIT_CLIENT_ID,
            req.webtaskContext.data.FITBIT_CLIENT_SECRET
          )
        ]))
        .spread((user, steps) => Promise.all([
          updateStepsInMongo(
            db, updated.ownerId, updated.date,
            steps['activities-steps-intraday'].dataset
          ),
          analyzeSteps(steps['activities-steps-intraday'].dataset),
          user
        ]))
        .spread((result, analysis, user) => db.collection('users').findOneAndUpdate(
          {fitbitId: user.fitbitId},
          {$set: {['runsByDate.' + updated.date]: analysis}}
        ))
    )))
    .then(result => {console.log('All things done.', result)})
    .catch(err => {console.log(err)})
})

// For Fitbit verify-calls.
server.get('/', (req, res) => {
  if (req.query.verify === req.webtaskContext.data.FITBIT_VERIFY) return res.sendStatus(204)
  res.sendStatus(404)
})

module.exports = webtask.fromExpress(server)

/*

wt create receivePush.js \
  -s FITBIT_VERIFY=1c127da05dff81b5ddf2c92786f5b31932707be23ce775c5b3489dfbba6fc2f0 \
  -s MONGO_URL=mongodb://frc:fee1Die0@ds015740.mlab.com:15740/fitbit-running-cadence \
  -s FITBIT_CLIENT_ID=227GBF \
  -s FITBIT_CLIENT_SECRET=6731a619e93e042ad614ab8d896cd257 \
  --no-parse --no-merge

curl -X POST https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/receivePush?webtask_no_cache=1 \
  -H 'Content-Type: application/json' \
  -d '[{"collectionType":"activities","date":"2016-04-06","ownerId":"39L68J","ownerType":"user","subscriptionId":"39L68J"}]'


TODO

* Remove tokens when refreshing is not possible.

*/
