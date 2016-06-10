'use strict'

const aawait  = require('asyncawait/await')
const aasync  = require('asyncawait/async')
const express = require('express')
const rp      = require('request-promise')

const router = express.Router()

router.get('/', (req, res) => {
  console.log('Query', req.query)
  console.log(req.session)
  console.log(req.user)

  res.render('index', {user: req.user})

  //if (req.user) {
  //  res.send(
  //    'Hello ' + req.user.id + '<br/>' +
  //      'You are connected with: ' + JSON.stringify(Object.keys(req.user.accounts)) +
  //      '<br/>' + connectHtml
  //  )
  //}
  //else {
  //  res.send('Please login<br/>' + connectHtml)
  //}
})

router.get(
  '/home', aasync((req, res) => {
    console.log('Logged in', req.user)

    const date      = '2016-02-06'
    const startTime = '13:00'
    const endTime   = '13:19'

    const userFitbitId = req.user.accounts.fitbit.id

    const heartrateUrl = 'https://api.fitbit.com/1/user/' + userFitbitId +
          '/activities/heart/date/' + date + '/1d/1sec/time/' +
          startTime + '/' + endTime + '.json'
    const data = logUrl(heartrateUrl, accounts.fitbit[req.user.accounts.fitbit].accessToken)

    res.json(data)
  })
)

router.get('/subscribe', aasync((req, res) => {
  const uri =
        'https://api.fitbit.com/1/user/-/activities/apiSubscriptions/' +
        req.user.id + '.json'

  const result = aawait(rp({
    headers: {'Authorization': 'Bearer ' + req.user.accounts.fitbit.tokens.accessToken},
    method:  'POST',
    uri:     uri,
    json:    true,
  }))

  console.log(result)
  res.json(result)
}))

router.get('/cadence', aasync((req, res) => {
  const date   = '2016-03-31'
  const userId = '39L68J'

  const steps = aawait(req.db.collection('steps').findOne({user: userId, date: date}))
  const stepData = steps.steps.filter(step => step.value > 110)
  res.render('cadence', {
    times: stepData.map(step => step.time.substr(0,5)),
    steps: stepData.map(step => step.value)
  })
}))


// The ♥-url to add heartrate to existing activities.  Does not work yet…
router.post('/runkeeper/activity/:uri/%E2%99%A5', aasync((req, res) => {
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

module.exports = router
