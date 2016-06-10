'use strict'

const aawait        = require('asyncawait/await')
const aasync        = require('asyncawait/async')
const express       = require('express')
const exphbs        = require('express-handlebars')
const cookieSession = require('cookie-session')
const cookieParser  = require('cookie-parser')
const rp            = require('request-promise')
const moment        = require('moment')
const MongoClient   = require('mongodb').MongoClient

const UserFactory    = require('./lib/user_factory')
const authentication = require('./lib/authentication')
const routes         = require('./lib/routes')

const config = require('./config.json')

const app = express()
const hbs = exphbs.create({
  helpers: {
    json: context => JSON.stringify(context),
  },
  defaultLayout: 'main', extname: '.hbs'
})
app.engine('.hbs', hbs.engine)
app.set('view engine', '.hbs')
app.use(cookieParser())
app.use(cookieSession({name: 'session', secret: config.cookieSecret}))
//app.use(express.static('public'))

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

aasync(() => {
  const db          = aawait(MongoClient.connect(config.mongodb))
  const userFactory = UserFactory(db.collection('users'))

  authentication(app, userFactory, config)
  app.use((req, res, next) => {req.db = db; next()})
  app.use(routes)

  app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
  })
})().done()
