function e(id) {return document.getElementById(id)}

function rp(url) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest()
    req.open('GET', url, true)
    req.onload = function() {
      if (req.status >= 200 && req.status < 300) return resolve(JSON.parse(req.response))
      if (req.status == 401) {
        reject(
          new ForbiddenError(req, {method: method, url: url, headers: headers, body: body})
        )
      }
      reject(req.statusText)
    }
    req.onerror = function() {reject(new Error('Network failure'))}
    req.send('')
  })
}

function readCookie(name) {
  var nameEQ = name + "="
  var ca = document.cookie.split(';')
  for (var i=0;i < ca.length;i++) {
    var c = ca[i]
    while (c.charAt(0)==' ') c = c.substring(1,c.length)
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}

function showUser(userJwt) {
  console.log('Showing user', user)

  var user = jwt_decode(userJwt)

  e('login').className = 'hidden'
  e('user').className = ''
  e('username').innerHTML = user.sub

  // Fetch run periods.
  rp('https://webtask.it.auth0.com/api/run/wt-fredrik-liljegren_org-0/cadence?' +
     'user=' + userJwt)
    .then(function(data) {
      var header = document.createElement('h3')
      header.innerHTML = 'Analyzed runs'

      var ul = document.createElement('ul')
      Object.keys(data.runs).sort().forEach(function(date) {
        console.log(date, data.runs[date])
        data.runs[date].forEach(function(run) {
          var li = document.createElement('li')
          var time = Math.floor(run.start / 60) + ':' + (run.start % 60)
          li.innerHTML = date + ': ' + time + ' median ' + run.median
          ul.appendChild(li)
        })
      })
      e('user').appendChild(header)
      e('user').appendChild(ul)
    })
    .catch(function(err) {
      console.log('Error', err)
    })
}

function awaitLogin() {
  window.addEventListener("message", function(event) {
    if (event.origin !== 'https://webtask.it.auth0.com') return
    document.cookie = 'user=' + event.data + '; path=/'
    showUser(event.data)
  }, false)
}

function onLoad() {
  // Check if user is logged in.
  var userCookie = readCookie('user')

  if (userCookie) showUser(userCookie)
}
