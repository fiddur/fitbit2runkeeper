const FitbitStrategy    = require('passport-fitbit-oauth2').FitbitOAuth2Strategy
const RunKeeperStrategy = require('passport-runkeeper').Strategy
const aasync            = require('asyncawait/async')
const aawait            = require('asyncawait/await')
const cookieParser      = require('cookie-parser')
const cookieSession     = require('cookie-session')
const exphbs            = require('express-handlebars')
const express           = require('express')
const moment            = require('moment')
const passport          = require('passport')
const rp                = require('request-promise')

module.exports = (config, users) => {
  const cache = {}

  const app = express()
  app.use(express.static('static'))
  app.engine('.hbs', exphbs({ defaultLayout: 'main', extname: '.hbs' }))
  app.set('view engine', '.hbs')
  app.use(cookieParser())
  app.use(cookieSession(config.cookie))
  app.use(passport.initialize())
  app.use(passport.session())

  const onAuthenticated = aasync((req, accessToken, refreshToken, profile, done) => {
    const user = req.user
          || aawait(users.getByProvider(profile.provider, profile.id))
          || aawait(users.create())
    aawait(users.setAccount(user.id, profile, accessToken, refreshToken))
    done(null, user)
  })

  passport.use(new FitbitStrategy(
    {
      clientID:          config.fitbit.clientID,
      clientSecret:      config.fitbit.clientSecret,
      callbackURL:       `${config.server.full}/auth/fitbit/callback`,
      passReqToCallback: true,
    },
    onAuthenticated
  ))
  app.get(
    '/auth/fitbit',
    passport.authenticate('fitbit', {
      scope: ['activity', 'heartrate', 'location', 'profile', 'weight'],
    })
  )
  app.get(
    '/auth/fitbit/callback',
    passport.authenticate(
      'fitbit', { successRedirect: '/', failureRedirect: '/auth/fitbit/failure' }
    )
  )

  passport.use(new RunKeeperStrategy(
    {
      clientID:          config.runkeeper.clientID,
      clientSecret:      config.runkeeper.clientSecret,
      callbackURL:       `${config.server.full}/auth/runkeeper/callback`,
      passReqToCallback: true,
    },
    onAuthenticated
  ))
  app.get('/auth/runkeeper', passport.authenticate('runkeeper'))
  app.get(
    '/auth/runkeeper/callback',
    passport.authenticate(
      'runkeeper', { successRedirect: '/', failureRedirect: '/auth/runkeeper/failure' }
    )
  )

  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser(
    (id, done) => users
      .getById(id)
      .then(user => done(null, user))
  )

  app.get('/', (req, res) => {
    res.render('index', { user: req.user })
  })

  const getFromFitbit = require('./getFromFitbit')(rp, config.fitbit)
  const getFitbitTcx  = require('./getFbTcx')(rp)
  const convertFb2Hg  = require('./convertFb2Hg')(cache)

  app.get(
    '/home', aasync((req, res) => {
      const activitiesUrl =
            `https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=${moment().add(1, 'd').format('YYYY-MM-DD')}&sort=desc&limit=10&offset=0`

      const data = aawait(getFromFitbit(activitiesUrl, req.user.accounts.fitbit))

      data.activities.forEach(activity => (cache[activity.logId] = activity))

      // res.json(data)
      res.render('listfb', data)
    })
  )

  app.get('/fitbit/tcx/:logId', aasync((req, res) => {
    res.send(aawait(getFitbitTcx(req.user.accounts.fitbit)(req.params.logId)))
  }))

  app.get('/fitbit/cp/:logId', aasync((req, res) => {
    const newHgActivity = aawait(
      convertFb2Hg(
        getFitbitTcx(req.user.accounts.fitbit)
      )(req.params.logId)
    )

    const runkeeperUri    = 'https://api.runkeeper.com/fitnessActivities'
    const runkeeperAccess = req.user.accounts.runkeeper.accessToken

    const response = aawait(rp({
      uri:     runkeeperUri,
      method:  'POST',
      json:    true,
      body:    newHgActivity,
      headers: {
        Authorization:  `Bearer ${runkeeperAccess}`,
        'Content-Type': 'application/vnd.com.runkeeper.NewFitnessActivity+json',
      },
    }))
    console.log('Posted new activity:', newHgActivity, response)

    res.render('exported', { activityJson: JSON.stringify(newHgActivity, null, 2) })
  }))

  app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send(err.message)
  })

  return app
}
