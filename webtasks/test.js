'use strict'


const MongoClient = require('mongodb').MongoClient
const Promise     = require('bluebird')
const rp          = require('request-promise')

const mongo = 'mongodb://frc:fee1Die0@ds015740.mlab.com:15740/fitbit-running-cadence'

const fetchUserFromMongo = (db, id) => db.collection('users').findOne({fitbitId: id})

const ownerId = '39L68J'
const date = '2016-03-31'

const getStepsFromFitbit = (user, date, clientID, clientSecret) => {
  const stepsUrl = 'https://api.fitbit.com/1/user/' + user.fitbitId +
        '/activities/steps/date/' + date + '/1d/1min.json'
  return rp({
    headers: {'Authorization': 'Bearer ' + user.accessToken},
    //method:  'POST',
    uri:     stepsUrl,
    json:    true,
  }).catch(err => {
    console.log(err.name, err.statusCode, err.message, err.error)

    if (err.statusCode === 401 && err.error.errors[0].errorType === 'expired_token') {
      return getNewFitbitAccessToken(user, clientID, clientSecret)
        .then(accessToken => {
          user.accessToken = accessToken // @todo Update in Mongo
          return getStepsFromFitbit(user, date, clientID, clientSecret)
        })
    }
    else throw err
  })
}

const updateStepsInMongo = (db, id, date, steps) => {
  return db.collection('steps').findOneAndUpdate(
    {
      user: id,
      date: date,
    },
    {
      user: id,
      date: date,
      steps: steps,
    },
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
      // Running this minute
      if (!current) current = {start: minute, pauses: []}
      else if ('end' in current) {
        if (minute - current.end < 15) {
          // Consider this a pause
          current.pauses.push({start: current.end, end: minute - 1})
          delete current.end
        }
        else {
          // New run!
          runs.push(current)
          current = {start: minute, pauses: []}
        }
      }
    }
    else if (current && !('end' in current)) current.end = minute - 1
  })
  if (current) runs.push(current)

  return runs
}

MongoClient.connect(mongo, {promiseLibrary: Promise})
  .then(db => [db, fetchUserFromMongo(db, ownerId)])
  .spread((db, user) => [
    db,
    user,
    getStepsFromFitbit(
      user, date, '227GBF', '6731a619e93e042ad614ab8d896cd257'
    )
  ])
  .spread((db, user, steps) => [
    updateStepsInMongo(
      db, ownerId, date, steps['activities-steps-intraday'].dataset
    ),
    analyzeSteps(steps['activities-steps-intraday'].dataset),
    user,
    db
  ])
  .spread((result, analysis, user, db) => db.collection('users').findOneAndUpdate(
    {fitbitId: user.fitbitId},
    {$set: {['runsByDate.' + date]: analysis}},
    {upsert: true}
  ))
  .then(result => console.log(result))
