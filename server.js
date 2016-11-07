const MongoClient = require('mongodb').MongoClient

const App   = require('./lib/app')
const Users = require('./lib/users')

const config = {
  cookie: {
    name:   'session',
    secret: process.env.COOKIE_SECRET,
  },
  fitbit: {
    clientID:         process.env.FITBIT_CLIENTID,
    clientSecret:     process.env.FITBIT_SECRET,
    verificationCode: process.env.FITBIT_VERIFICATIONCODE,
  },
  mongo: {
    uri: process.env.MONGODB_URI,
  },
  runkeeper: {
    clientID:     process.env.RUNKEEPER_CLIENTID,
    clientSecret: process.env.RUNKEEPER_SECRET,
  },
  server: {
    host:     process.env.SERVER_HOST,
    port:     parseInt(process.env.SERVER_PORT, 10),
    protocol: process.env.SERVER_PROTOCOL,
  },
}
const portStr = config.server.port === 80 ? '' : `:${config.server.port}`
config.server.full = `${config.server.protocol}://${config.server.host}${portStr}`

MongoClient.connect(config.mongo.uri) // , {promiseLibrary: Promise})
  .then(db => Users(db.collection('users')))
  .then(users => {
    const app = App(config, users)

    app.listen(process.env.PORT || 3000, () => {
      console.log(`Fitbit2runkeeper listening on port ${process.env.PORT || 3000}!`)
    })
  })
  .catch(err => console.log(err))
