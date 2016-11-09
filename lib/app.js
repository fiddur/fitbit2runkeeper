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
  const fitbit = Fitbit({ config: config.fitbit, onNewTokens: users.setFitbitTokens, rp })
  const convertFb2Hg = require('./convertFb2Hg')(cache)

  const copyFitbit2Runkeeper = aasync((user, logId) => {
    const newHgActivity = aawait(convertFb2Hg(fitbit.getTcx(user))(logId))

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

    // Store on user that is was exported and when.
    users.setActivityAsExported(user.id, logId, moment())

    return newHgActivity
  })

  const syncUserAtDate = aasync(({ date, user }) => {
    // Need to check if an activity is already synced.
    console.log('Should sync user at date', user, date.toString())

    const activities = aawait(fitbit.getActivities(user, date))
    activities.forEach(activity => (cache[activity.logId] = activity))

    return aawait(
      activities.map(
        activity => (
          user.exported && user.exported[activity.logId]
            ? Promise.resolve()
            : copyFitbit2Runkeeper(user, activity.logId)
        )
      )
    )
  })

  const onAuthenticated = aasync((req, accessToken, refreshToken, profile, done) => {
    const user = req.user
          || aawait(users.getByProvider(profile.provider, profile.id))
          || aawait(users.create())
    aawait(users.setAccount(user.id, profile, accessToken, refreshToken))
    fitbit.subscribe(user) // TODO: Is this reasonable to do on every authentication?
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

  app.get('/', (req, res) => res.render('index', { user: req.user }))
  app.get('/about', (req, res) => res.render('about'))

  app.get(
    '/home', aasync((req, res) => {
      const activities = aawait(fitbit.getActivities(req.user, moment().add(1, 'd')))
      activities.forEach(activity => (cache[activity.logId] = activity))

      // match up these with which are already exported on user.
      if (req.user.exported) {
        activities.forEach(activity => activity.exported = req.user.exported[activity.logId])
      }

      // res.json(data)
      res.render('listfb', { activities, user: req.user })
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
    // TODO: Verify signature.  Not that important actually, since we fetch the
    // activities from their API anyway…

    console.log('POST to webhook', req.body)

    Promise.all(
      req.body
        .filter(updated => updated.collectionType === 'activities')
        .map(
          updated => users
            .getById(updated.subscriptionId)
            .then(user => {
              // Notification is basically just user, collectionType, and date.
              return syncUserAtDate({ user, date: moment(updated.date) })
            })
        )
    ).then(all => {
      console.log('All', all)
      res.sendStatus(204)
    }).catch(err => {
      console.log(err)
      res.sendStatus(500)
    })
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
