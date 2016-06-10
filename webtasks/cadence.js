'use latest'
'use strict'

const MongoClient = require('mongodb').MongoClient
const jwt         = require('jsonwebtoken')

module.exports = (ctx, done) => {
  console.log(ctx)
  //ctx.secrets.MONGO_URL

  const userData = jwt.verify(ctx.query.user, ctx.secrets.JWT_SERCRET)
  MongoClient.connect(ctx.secrets.MONGO_URL)
    .then(db => db.collection('users').findOne({fitbitId: userData.sub}))
    .then(user => {
      done(null, {runs: user.runsByDate})
    })
    .catch(err => done(err))
}

/*

wt create cadence.js \
  -s MONGO_URL=mongodb://frc:fee1Die0@ds015740.mlab.com:15740/fitbit-running-cadence \
  -s JWT_SERCRET=taH5waen

*/
