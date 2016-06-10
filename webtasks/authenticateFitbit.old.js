'use latest'
'use strict'

const express        = require('express')
const webtask        = require('webtask-tools')
const MongoClient    = require('mongodb').MongoClient
const bodyParser     = require('body-parser')
const passport       = require('passport')
const FitbitStrategy = require('passport-fitbit-oauth2').FitbitOAuth2Strategy

const app = express()
app.use(bodyParser.json())

const fetchUserFromMongo = (db, id) => db.collection('users').findOne({fitbitId: id})

app.use(passport.initialize())
app.use(passport.session())

const onAuthenticated = (req, accessToken, refreshToken, profile, done) => {
  console.log('Authed:', req, accessToken, refreshToken, profile)
  done()
}

app.use((req, res, next) => {
  console.log(req.webtaskContext)

  MongoClient.connect(req.webtaskContext.data.MONGO_URL)
    .then(db => {
      req.db = db

      passport.use(new FitbitStrategy(
        {
          clientID:          req.webtaskContext.data.FITBIT_CLIENT_ID,
          clientSecret:      req.webtaskContext.data.FITBIT_CLIENT_SECRET,
          callbackURL:       'https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/authenticateFitbit',
          passReqToCallback: true,
        },
        onAuthenticated
      ))

      next()
    })
})


// Fitbit callback url.
app.get('/', (req, res, next) => {
  if (!('state' in req.query)) return next()

  passport.authenticate(
    'fitbit',  {successRedirect: '/', failureRedirect: '/auth/fitbit/failure'}
  )(req, res, next)
})

// Fitbit auth.
app.get('/', (req, res, next) => {
  passport.authenticate('fitbit', {
    scope: ['activity','heartrate','location','profile','weight'],
    state: 'fitbitCallback',
  })(req, res, next)
})

app.get('/', (req, res) => {
})

module.exports = webtask.fromExpress(server)

/*

wt create authenticateFitbit.js \
  -s MONGO_URL=mongodb://frc:fee1Die0@ds015740.mlab.com:15740/fitbit-running-cadence \
  -s FITBIT_CLIENT_ID=227GBF \
  -s FITBIT_CLIENT_SECRET=6731a619e93e042ad614ab8d896cd257 \
  --no-parse --no-merge

*/
