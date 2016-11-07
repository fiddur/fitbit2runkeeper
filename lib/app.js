const FitbitStrategy    = require('passport-fitbit-oauth2').FitbitOAuth2Strategy
const RunKeeperStrategy = require('passport-runkeeper').Strategy
const aasync            = require('asyncawait/async')
const aawait            = require('asyncawait/await')
const bodyParser        = require('body-parser')
const cookieParser      = require('cookie-parser')
const cookieSession     = require('cookie-session')
const exphbs            = require('express-handlebars')
const express           = require('express')
const moment            = require('moment')
const passport          = require('passport')
const rp                = require('request-promise')

const Fitbit = require('./fitbit')

module.exports = (config, users) => {
  const cache = {}
  const fitbit = Fitbit({ config: config.fitbit, rp })
  const convertFb2Hg = require('./convertFb2Hg')(cache)

  const copyFitbit2Runkeeper = aasync((user, logId) => {
    const newHgActivity = aawait(
      convertFb2Hg(fitbit.getTcx(user.accounts.fitbit))(logId)
    )

    const response = aawait(rp({
      uri:     'https://api.runkeeper.com/fitnessActivities',
      method:  'POST',
      json:    true,
      body:    newHgActivity,
      headers: {
        Authorization:  `Bearer ${user.accounts.runkeeper.accessToken}`,
        'Content-Type': 'application/vnd.com.runkeeper.NewFitnessActivity+json',
      },
    }))
    console.log('Posted new activity:', newHgActivity, response)

    return newHgActivity
  })

  const syncUserAtDate = (user, date) => {
    // Need to check if an activity is already synced.
    console.log('Should sync user at date', user, date)
  }

  const onAuthenticated = aasync((req, accessToken, refreshToken, profile, done) => {
    const user = req.user
          || aawait(users.getByProvider(profile.provider, profile.id))
          || aawait(users.create())
    aawait(users.setAccount(user.id, profile, accessToken, refreshToken))
    done(null, user)
  })

  const app = express()
  app.use(express.static('static'))
  app.use(bodyParser.json())
  app.engine('.hbs', exphbs({ defaultLayout: 'main', extname: '.hbs' }))
  app.set('view engine', '.hbs')
  app.use(cookieParser())
  app.use(cookieSession(config.cookie))
  app.use(passport.initialize())
  app.use(passport.session())

  passport.use(new FitbitStrategy({
    clientID:          config.fitbit.clientID,
    clientSecret:      config.fitbit.clientSecret,
    callbackURL:       `${config.server.full}/auth/fitbit/callback`,
    passReqToCallback: true,
  }, onAuthenticated))
  app.get('/auth/fitbit', passport.authenticate('fitbit', {
    scope: ['activity', 'heartrate', 'location', 'profile'],
  }))
  app.get('/auth/fitbit/callback', passport.authenticate(
    'fitbit', { successRedirect: '/', failureRedirect: '/auth/fitbit/failure' }
  ))

  passport.use(new RunKeeperStrategy({
    clientID:          config.runkeeper.clientID,
    clientSecret:      config.runkeeper.clientSecret,
    callbackURL:       `${config.server.full}/auth/runkeeper/callback`,
    passReqToCallback: true,
  }, onAuthenticated))
  app.get('/auth/runkeeper', passport.authenticate('runkeeper'))
  app.get('/auth/runkeeper/callback', passport.authenticate(
    'runkeeper', { successRedirect: '/', failureRedirect: '/auth/runkeeper/failure' }
  ))

  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser(
    (id, done) => users
      .getById(id)
      .then(user => done(null, user))
  )

  app.get('/', (req, res) => {
    res.render('index', { user: req.user })
  })

  app.get(
    '/home', aasync((req, res) => {
      const activities = aawait(fitbit.getActivities(req.user))

      activities.forEach(activity => (cache[activity.logId] = activity))

      // res.json(data)
      res.render('listfb', { activities })
    })
  )

  // Fitbit subscription verification:
  // https://dev.fitbit.com/docs/subscriptions/#verify-a-subscriber
  app.get('/fitbit/webhook', (req, res) => {
    if (req.query.verify === config.fitbit.verificationCode) res.sendStatus(204)
    else res.sendStatus(404)
  })

  // Fitbit subscription hook
  app.post('/fitbit/webhook', (req, res) => {
    // TODO: Verify signature

    console.log('POST to webhook', req.body)

    Promise.all(
      req.body
        .filter(updated => updated.collectionType === 'activities')
        .map(
          updated => users
            .get(updated.subscriptionId)
            .then(user => {
              // Notification is basically just user, collectionType, and date.
              syncUserAtDate({ user, date: moment(updated.date) })
            })
        )
    )

    res.sendStatus(500)
  })

  app.get(
    '/fitbit/listSubscriptions', (req, res) => fitbit
      .listSubscriptions(req.user)
      .then(subscriptions => res.render('listSubscriptions', { subscriptions }))
  )

  app.get(
    '/fitbit/subscribe', (req, res) => fitbit
      .subscribe(req.user)
      .then(res.redirect('/fitbit/listSubscriptions'))
  )

  app.get(
    '/fitbit/tcx/:logId', (req, res) => fitbit
      .getTcx(req.user)(req.params.logId)
      .then(tcxData => res.send(tcxData))
  )

  app.get('/fitbit/cp/:logId', (req, res) => {
    copyFitbit2Runkeeper(req.user, req.params.logId)
      .then(
        newHgActivity => res
          .render('exported', { activityJson: JSON.stringify(newHgActivity, null, 2) })
      )
  })

  app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send(err.message)
  })

  return app
}
