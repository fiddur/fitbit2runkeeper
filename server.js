const fs                = require('fs')
const aawait            = require('asyncawait/await')
const aasync            = require('asyncawait/async')
const express           = require('express')
const exphbs            = require('express-handlebars')
const cookieSession     = require('cookie-session')
const cookieParser      = require('cookie-parser')
const passport          = require('passport')
const FitbitStrategy    = require('passport-fitbit-oauth2').FitbitOAuth2Strategy
const RunKeeperStrategy = require('passport-runkeeper').Strategy
const uuid              = require('node-uuid')
const rp                = require('request-promise')
const moment            = require('moment')

const config = require('./config.json')

const cache = {}

const oldUsers   = fs.readFileSync('data/users.json')
const users      = (oldUsers.length > 0) ? JSON.parse(oldUsers) : {}
const writeUsers = () => fs.writeFileSync('data/users.json', JSON.stringify(users))
const newUser    = () => {
  const id = uuid.v4()
  users[id] = {}
  users[id].id = id
  users[id].accounts = {}
  writeUsers()
  return id
}
const setAccount = (id, profile) => {
  users[id].accounts[profile.provider] = profile.id
  writeUsers()
}

// accounts[provider][id]
//   user
//   displayName
const oldAccounts = fs.readFileSync('data/accounts.json')
const accounts    = (oldAccounts.length > 0) ? JSON.parse(oldAccounts) : {}
const addAccount  = (profile, userId, accessToken, refreshToken) => {
  if (accounts[profile.provider] === undefined) accounts[profile.provider] = {}

  accounts[profile.provider][profile.id]              = profile
  accounts[profile.provider][profile.id].user         = userId
  accounts[profile.provider][profile.id].accessToken  = accessToken
  accounts[profile.provider][profile.id].refreshToken = refreshToken

  fs.writeFileSync('data/accounts.json', JSON.stringify(accounts))
}
const updateAccount = (profile, accessToken, refreshToken) => {
  accounts[profile.provider][profile.id].accessToken = accessToken
  accounts[profile.provider][profile.id].refreshToken = refreshToken
  fs.writeFileSync('data/accounts.json', JSON.stringify(accounts))
}

const app = express()
app.engine('.hbs', exphbs({ defaultLayout: 'main', extname: '.hbs' }))
app.set('view engine', '.hbs')
app.use(cookieParser())
app.use(cookieSession({ name: 'session', secret: 'af092mnvaz9' }))
app.use(passport.initialize())
app.use(passport.session())

const onAuthenticated = (req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    // Connect the new account to logged in user.
    setAccount(req.user.id, profile)
    updateAccount(profile, accessToken, refreshToken)
    done(null, req.user)
  } else {
    const userId = (accounts[profile.provider] === undefined ||
                    accounts[profile.provider][profile.id] === undefined) ?
          newUser() : accounts[profile.provider][profile.id].user

    addAccount(profile, userId, accessToken, refreshToken)
    setAccount(userId, profile)
    done(null, users[userId])
  }
}

passport.use(new FitbitStrategy(
  {
    clientID:          config.fitbit.clientID,
    clientSecret:      config.fitbit.clientSecret,
    callbackURL:       'http://localhost:3000/auth/fitbit/callback',
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
    callbackURL:       'http://localhost:3000/auth/runkeeper/callback',
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
passport.deserializeUser((id, done) => done(null, users[id]))

app.get('/', (req, res) => {
  const connectHtml =
    `<a href="/auth/fitbit">Connect FitBit</a><br/>
     <a href="/auth/runkeeper">Connect RunKeeper</a><br/>
     <a href="/home">Go home</a><br/>
    `

  if (req.user) {
    res.send(
      `
      Hello ${req.user.id}<br/>
      You are connected with: ${JSON.stringify(req.user.accounts)}<br/>
      ${connectHtml}
      `
    )
  } else {
    res.send(`Please login<br/>${connectHtml}`)
  }
})

const getFromFitbit = require('./lib/getFromFitbit')(rp)
const getFitbitTcx  = require('./lib/getFbTcx')(rp, config.fitbit)
const convertFb2Hg  = require('./lib/convertFb2Hg')(cache)

app.get(
  '/home', aasync((req, res) => {
    console.log('Logged in', req.user)

    const activitiesUrl =
          `https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=${moment().format('YYYY-MM-DD')}&sort=desc&limit=10&offset=0`

    const data = aawait(getFromFitbit(activitiesUrl, accounts.fitbit[req.user.accounts.fitbit]))

    data.activities.forEach(activity => (cache[activity.logId] = activity))

    // res.json(data)
    res.render('listfb', data)
  })
)

app.get('/fitbit/tcx/:logId', aasync((req, res) => {
  res.send(getFitbitTcx(accounts.fitbit[req.user.accounts.fitbit])(req.params.logId))
}))

app.get('/fitbit/cp/:logId', aasync((req, res) => {
  const newHgActivity = aawait(
    convertFb2Hg(
      getFitbitTcx(accounts.fitbit[req.user.accounts.fitbit])
    )(req.params.logId)
  )

  const runkeeperUri = 'https://api.runkeeper.com/fitnessActivities'
  const runkeeperAccess =
        accounts.runkeeper[req.user.accounts.runkeeper].accessToken

  aawait(rp({
    uri:     runkeeperUri,
    method:  'POST',
    json:    true,
    body:    newHgActivity,
    headers: {
      Authorization:  `Bearer ${runkeeperAccess}`,
      'Content-Type': 'application/vnd.com.runkeeper.NewFitnessActivity+json',
    },
  }))

  res.render('exported', { activityJson: JSON.stringify(newHgActivity, null, 2) })
}))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send(err.message)
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})
