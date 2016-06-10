'use latest'
'use strict'

const express     = require('express')
const webtask     = require('webtask-tools')
const MongoClient = require('mongodb').MongoClient
const rp          = require('request-promise')
const jwt         = require('jsonwebtoken')

const app = express()

// Fitbit callback url.
app.get('/', (req, res, next) => {
  if (!('state' in req.query)) return next()

  const clientID = req.webtaskContext.data.FITBIT_CLIENT_ID
  const clientSecret = req.webtaskContext.data.FITBIT_CLIENT_SECRET
  const basic = new Buffer(clientID + ':' + clientSecret).toString('base64')

  rp({
    method: 'POST',
    uri: 'https://api.fitbit.com/oauth2/token',
    headers: {
      'Authorization': 'Basic ' + basic,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    form: {
      code:         req.query.code,
      grant_type:   'authorization_code',
      client_id:    clientID,
      redirect_uri: 'https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/authenticateFitbit/',
      state:        'fitbitCallback',
    },
    json: true
  }).then(
    body => {
      console.log('Updating tokens from fitbit for user ' + body.user_id)
      return [body, MongoClient.connect(req.webtaskContext.data.MONGO_URL)]
    }
  ).spread(
    (body, db) => db.collection('users').findOneAndUpdate(
      {fitbitId: body.user_id},
      {$set: {
        accessToken:  body.access_token,
        refreshToken: body.refresh_token,
      }},
      {upsert: true}
    )
  ).then(
    result => {
      const userJwt = jwt.sign(
        {sub: result.value.fitbitId},
        req.webtaskContext.data.JWT_SECRET,
        {expiresIn: '2 days'}
      )

      res.send(
        '<html><head></head><body><script>\n' +
          'window.opener.postMessage("' + userJwt + '", "*")\n' +
          'window.close()\n' +
          '</script></body></html>'
      )
    }
  ).catch(
    err => {
      console.log(err)
      res.status(500).send('Didn\'t work :·(')
    }
  )
})

// Fitbit auth.
app.get('/', (req, res) => {
  res.redirect(
    'https://www.fitbit.com/oauth2/authorize?' +
      'scope=activity%20heartrate%20location%20profile%20weight&' +
      'state=fitbitCallback&' +
      'response_type=code&' +
      'redirect_uri=' + encodeURIComponent('https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/authenticateFitbit/') + '&' +
      'client_id=' + req.webtaskContext.data.FITBIT_CLIENT_ID
  )
})

module.exports = webtask.fromExpress(app)

/*

wt create authenticateFitbit.js \
  -s MONGO_URL=mongodb://frc:fee1Die0@ds015740.mlab.com:15740/fitbit-running-cadence \
  -s FITBIT_CLIENT_ID=227GBF \
  -s FITBIT_CLIENT_SECRET=6731a619e93e042ad614ab8d896cd257 \
  -s JWT_SERCRET=taH5waen \
  --no-parse --no-merge

*/
