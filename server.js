'use strict'

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

  accounts[profile.provider][profile.id] = profile
  accounts[profile.provider][profile.id].user = userId
  accounts[profile.provider][profile.id].accessToken = accessToken
  accounts[profile.provider][profile.id].refreshToken = refreshToken

  fs.writeFileSync('data/accounts.json', JSON.stringify(accounts))
}
const updateAccount = (profile, accessToken, refreshToken) => {
  accounts[profile.provider][profile.id].accessToken = accessToken
  accounts[profile.provider][profile.id].refreshToken = refreshToken
  fs.writeFileSync('data/accounts.json', JSON.stringify(accounts))
}

const app = express()
app.engine('.hbs', exphbs({defaultLayout: 'main', extname: '.hbs'}))
app.set('view engine', '.hbs')
app.use(cookieParser())
app.use(cookieSession({name: 'session', secret: 'af092mnvaz9'}))
app.use(passport.initialize())
app.use(passport.session())

const onAuthenticated = (req, accessToken, refreshToken, profile, done) => {
  console.log(req, accessToken, refreshToken, profile)

  if (req.user) {
    // Connect the new account to logged in user.
    setAccount(req.user.id, profile)
    updateAccount(profile, accessToken, refreshToken)
    done(null, req.user)
  }
  else {
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
  passport.authenticate('fitbit', {scope: ['activity','heartrate','location','profile','weight']})
)
app.get(
  '/auth/fitbit/callback',
  passport.authenticate(
    'fitbit', {successRedirect: '/', failureRedirect: '/auth/fitbit/failure'}
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
    'runkeeper', {successRedirect: '/', failureRedirect: '/auth/runkeeper/failure'}
  )
)

passport.serializeUser((user, done) => {
  console.log('Serialize', user)
  done(null, user.id)
})
passport.deserializeUser((id, done) => {
  console.log('Deserialize', id)
  done(null, users[id])
})

app.get('/', (req, res) => {
  console.log(req.session)
  console.log(req.user)

  const connectHtml =
        '<a href="/auth/fitbit">Connect FitBit</a><br/>' +
        '<a href="/auth/runkeeper">Connect RunKeeper</a><br/>'

  if (req.user) {
    res.send(
      'Hello ' + req.user.id + '<br/>' +
        'You are connected with: ' + JSON.stringify(req.user.accounts) + '<br/>' +
        connectHtml
    )
  }
  else {
    res.send('Please login<br/>' + connectHtml)
  }
})

const getUrl = (url, token, accept) => {
  try {
    const headers = {'Authorization': 'Bearer ' + token}
    if (accept) headers.Accept = accept

    console.log('URL:', url)
    const activities = aawait(rp({
      uri: url,
      json: true,
      headers: headers,
    }))
    console.log('Activities:', activities)
    return activities
  }
  catch (err) {
    console.log(err.response.body ? err.response.body : err)
    return null
  }
}

const getFitbit = (url, account) => {
  console.log('Getting Fitbit data from', url)
  try {
    const activities = aawait(rp({
      uri: url,
      json: true,
      headers: {'Authorization': 'Bearer ' + account.accessToken},
    }))
    console.log('Activities:', activities)
    return activities
  }
  catch (err) {
    console.log(err.name, err.statusCode, err.message, err.error)

    if (err.statusCode === 401 && err.error.errors[0].errorType === 'expired_token') {
      try {
        const basic = new Buffer(config.fitbit.clientID + ':' + config.fitbit.clientSecret)
              .toString('base64')

        const newAccessToken = aawait(rp({
          method: 'POST',
          uri: 'https://api.fitbit.com/oauth2/token',
          headers: {
            'Authorization': 'Basic ' + basic,
            'Content-Type':  'application/x-www-form-urlencoded',
          },
          form: {
            grant_type: 'refresh_token',
            refresh_token: account.refreshToken,
          },
        }))
        console.log(newAccessToken)
      }
      catch (err2) {
        console.log(err2.name, err2.statusCode, err2.message, err2.error)
        // Still wrong?  Redirect client.
        throw err2
      }
    }
    return null
  }
}

app.get('/runkeeper/:type', aasync((req, res) => {

  //const listUrl = 'https://api.runkeeper.com/user' // user/' //+ type
  //const data = logUrl(listUrl, accounts.runkeeper[req.user.accounts.runkeeper].accessToken,
  //                    'application/vnd.com.runkeeper.User+json')

  //const listUrl = 'https://api.runkeeper.com/strengthTrainingActivities'
  const listUrl = 'https://api.runkeeper.com/fitnessActivities'
  const data = getUrl(listUrl, accounts.runkeeper[req.user.accounts.runkeeper].accessToken,
                      'application/vnd.com.runkeeper.FitnessActivityFeed+json')
  //'application/vnd.com.runkeeper.StrengthTrainingActivity+json')

  res.set({'content-type': 'text/html; charset=utf-8'})
  res.write('<html><body>')

  res.write('<table>')

  for (let i = 0; i < data.items.length; i++) {
    res.write(
      '<tr><td><a href="' + data.items[i].uri + '">' + data.items[i].start_time + '</a></td>' +
        '<td><a href="/runkeeper/activity/' + encodeURIComponent(data.items[i].uri) + '/♥">Add ♥</a>' +
      '</tr>'
    )
  }
  res.write('</table>')
    //res.write(JSON.stringify(data))
  res.write('</body></html>')

  res.end()
}))

app.get('/runkeeper/activity/:uri/%E2%99%A5', aasync((req, res) => {
  console.log('Got uri:', req.param('uri'))

  const data = getUrl(
    'https://api.runkeeper.com' + req.param('uri'),
    accounts.runkeeper[req.user.accounts.runkeeper].accessToken,
    'application/vnd.com.runkeeper.FitnessActivity+json'
  )

  res.render('activity', data)
}))

app.post('/runkeeper/activity/:uri/%E2%99%A5', aasync((req, res) => {
  console.log('Attempting to add heartrate data to', req.param('uri'))

  const runkeeperUri = 'https://api.runkeeper.com' + req.param('uri')
  const runkeeperAccess = accounts.runkeeper[req.user.accounts.runkeeper].accessToken

  const activityData = getUrl(
    runkeeperUri, runkeeperAccess, 'application/vnd.com.runkeeper.FitnessActivity+json'
  )
  const start = moment(activityData.start_time)
  //start.add('1', 'h') // Figure out activity's local timezone…
  console.log('Got date', start.format())

  // Hope this is not a timezone shift over the date limit.
  const date = start.format('YYYY-MM-DD')
  const startTime = start.format('HH:mm')

  const end = moment(start) // Clone starttime.
  end.add(activityData.duration + 59, 's') // We need it to round up to closes higher minute.
  const endTime = end.format('HH:mm')
  const userFitbitId = req.user.accounts.fitbit

  const heartrateUrl = 'https://api.fitbit.com/1/user/' + userFitbitId +
        '/activities/heart/date/' + date + '/1d/1sec/time/' +
        startTime + '/' + endTime + '.json'
  const data = getFitbit(heartrateUrl, accounts.fitbit[req.user.accounts.fitbit])

  const heartrateData = []

  data['activities-heart-intraday'].dataset.forEach(dataset => {
    const heartTime = moment(dataset.time, 'HH:mm:ss')
    heartTime.year(start.year())
    heartTime.month(start.month())
    heartTime.date(start.date())

    console.log(start.format(), heartTime.format())
    const position = heartTime.diff(start, 'seconds')
    console.log('Dataset at', position, dataset)

    // Make sure activity has started…
    if (position < 0 || position > activityData.duration - 1) return

    heartrateData.push({
      heart_rate: dataset.value,
      timestamp: position,
    })
  })

  //res.json(heartrateData)
  try {
    console.log('PUT ' + runkeeperUri, {heart_rate: heartrateData})
    //res.json({heart_rate: heartrateData})
    const response = aawait(rp({
      uri:    runkeeperUri,
      method: 'PUT',
      json:   true,
      body:   {heart_rate: heartrateData},
      headers: {
        Authorization: 'Bearer ' + runkeeperAccess,
        'Content-Type': 'application/vnd.com.runkeeper.FitnessActivity+json'
      },
    }))

    res.json(response)
  }
  catch (err) {
    res.json(err)

    //res.json(heartrateData)
  }

}))

app.get(
  '/home', aasync((req, res) => {
    console.log('Logged in', req.user)

    const today = new Date()
    //
    //const activityUrl = 'https://api.fitbit.com/1/user/' + req.user.accounts.fitbit +
    //      '/activities/date/2016-02-19.json'
    //logUrl(activityUrl, accounts.fitbit[req.user.accounts.fitbit].accessToken)
    //
    //const activityLogUrl = 'https://api.fitbit.com/1/user/' + req.user.accounts.fitbit +
    //      '/activities/list.json?afterDate=2016-02-19&offset=0&limit=10&sort=asc'
    //logUrl(activityLogUrl, accounts.fitbit[req.user.accounts.fitbit].accessToken)

    const date      = '2016-02-06'
    const startTime = '13:00'
    const endTime   = '13:19'

    const userFitbitId = req.user.accounts.fitbit
    //const userFitbitId = '-'

    const heartrateUrl = 'https://api.fitbit.com/1/user/' + userFitbitId +
          '/activities/heart/date/' + date + '/1d/1sec/time/' +
          startTime + '/' + endTime + '.json'
    const data = logUrl(heartrateUrl, accounts.fitbit[req.user.accounts.fitbit].accessToken)

    res.json(data)
  })
)

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
