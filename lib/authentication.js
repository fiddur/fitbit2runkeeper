'use strict'

const aawait            = require('asyncawait/await')
const aasync            = require('asyncawait/async')
const passport          = require('passport')
const FitbitStrategy    = require('passport-fitbit-oauth2').FitbitOAuth2Strategy
const RunKeeperStrategy = require('passport-runkeeper').Strategy

module.exports = (app, userFactory, config) => {

  app.use(passport.initialize())
  app.use(passport.session())

  const onAuthenticated = aasync((req, accessToken, refreshToken, profile, done) => {
    console.log(req, accessToken, refreshToken, profile)

    const user = req.user
          || aawait(userFactory.getByProfile(profile))
          || aawait(userFactory.create(profile))

    aawait(userFactory.setAccount(user.id, profile))
    aawait(userFactory.setTokens(
      user.id, profile.provider, {
        accessToken:  accessToken,
        refreshToken: refreshToken
      }
    ))
    done(null, user)
  })

  passport.use(new FitbitStrategy(
    {
      clientID:          config.fitbit.clientID,
      clientSecret:      config.fitbit.clientSecret,
      callbackURL:       'http://localhost:3000/',
      passReqToCallback: true,
    },
    onAuthenticated
  ))

  app.get(
    '/', (req, res, next) => {
      if (req.query.state === 'fitbitCallback') {
        passport.authenticate(
          'fitbit',  {successRedirect: '/', failureRedirect: '/auth/fitbit/failure'}
        )(req, res, next)
      }
      else if (req.query.auth === 'fitbit') {
        passport.authenticate('fitbit', {
          scope: ['activity','heartrate','location','profile','weight'],
          state: 'fitbitCallback',
        })(req, res, next)
      }
      else next()
    }
  )

  passport.use(new RunKeeperStrategy(
    {
      clientID:          config.runkeeper.clientID,
      clientSecret:      config.runkeeper.clientSecret,
      callbackURL:       'http://localhost:3000/auth/runkeeper/callback',
      passReqToCallback: true,
    },
    onAuthenticated
  ))
  app.get('/auth/runkeeper', passport.authenticate('runkeeper'))
  app.get(
    '/auth/runkeeper/callback',
    passport.authenticate(
      'runkeeper', {successRedirect: '/', failureRedirect: '/auth/runkeeper/failure'}
    )
  )

  passport.serializeUser((user, done) => {
    console.log('Serialize', user)
    done(null, user.id)
  })
  passport.deserializeUser(aasync((id, done) => {
    console.log('Deserialize', id)
    const user = aawait(userFactory.getById(id))

    if (user) done(null, user)
    else      done(new Error('No user with id ' + id))
  }))
}
