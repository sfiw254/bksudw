const fs = require('fs')
const axios = require('axios')
const express = require('express')
const app = express()
let db = JSON.parse(fs.readFileSync('public/db.json', 'utf8'))
let subs = fs.readFileSync('subs.json', 'utf8')
let subs2 = fs.readFileSync('subs2.json', 'utf8')
let history = {}

app.use('/termini', express.static('public'))
app.get('/termini/slots', (req, res) => routeSlots(req, res))
app.get('/termini/sub', (req, res) => routeSub(req, res))
app.get('/termini/unsub', (req, res) => routeUnsub(req, res))

app.listen(3000, () => {
  console.log(`Server is running on port 3000...`)
  updateDB()
  readSubs()
  check()
  check2()
})

async function routeSlots(req, res) {
  try {
    const data = await getSlots(req.query.id)
    data ? res.send(data) : res.status(400).send()
  } catch (err) {
    console.log('ERR routeSlots', err.message)
  }
}

function routeSub(req, res) {
  const { id, code, email } = req.query
  if (email && code && IDinfo(id) && !alreadySub()) {
    subs[id] ? subs[id].push({ email, code }) : subs[id] = [{ email, code }]
    updateSubs()
    console.log('+1 sub ', IDinfo(id).name, email)
  }
  res.send('ok')

  function alreadySub() {
    let isIt = false
    if (subs[id]) {
      subs[id].forEach(el => {
        email == el.email ? isIt = true : 0
      })
    }
    if (subs2[id]) {
      subs2[id].forEach(el => {
        email == el.email ? isIt = true : 0
      })
    }
    return isIt
  }
}

function routeUnsub(req, res) {
  const { id, code, email } = req.query
  if (subs[id]) {
    subs[id].forEach((el, index) => {
      if (el.email == email && el.code == code) {
        subs[id].splice(index, 1)
        subs[id].length == 0 ? delete subs[id] : 0
        updateSubs()
        console.log('-1 sub ', IDinfo(id).name, email)
      }
    })
  }
  if (subs2[id]) {
    subs2[id].forEach((el, index) => {
      if (el.email == email && el.code == code) {
        subs2[id].splice(index, 1)
        subs2[id].length == 0 ? delete subs2[id] : 0
        updateSubs()
        console.log('-1 sub', IDinfo(id).name, email)
      }
    })
  }
  res.send('<h1>ok</h1><title>Исклучено</title><script>alert("Исклучено")</script>')
}

function check() {
  let index = 0
  const IDs = Object.keys(subs)
  IDs.length && shouldCheck() ? doCheck() : setTimeout(check, 1000)

  async function doCheck() {
    if (index == IDs.length) {
      console.log('done')
      check()
      return
    }
    const id = IDs[index]
    if (!subs[id]) {
      index++
      doCheck()
      return
    }
    index++
    setTimeout(doCheck, 2000)
    try {
      const data = await getSlots(id)
      const name = data.name.slice(0, 60)
      let counter = 0
      for (property in data.timeslots) {
        data.timeslots[property].forEach(el => {
          el.isAvailable ? counter++ : 0
        })
      }
      console.log(counter, name)
      if (counter > 1) {
        notify(id, name)
        subs2[id] = subs[id]
        delete subs[id]
        updateSubs()
      }
    } catch (err) {
      console.log('ERR doCheck', err.message)
    }
  }
}

function check2() {
  const IDs = Object.keys(subs2)
  let index = 0
  IDs.length && shouldCheck() ? doCheck2() : setTimeout(check2, 1000)

  async function doCheck2() {
    if (index == IDs.length) {
      check2()
      return
    }
    const id = IDs[index]
    if (!subs2[id]) {
      index++
      doCheck2()
      return
    }
    index++
    setTimeout(doCheck2, 1000 * 60 * 10)
    try {
      const data = await getSlots(id)
      const name = data.name.slice(0, 60)
      let counter = 0
      for (property in data.timeslots) {
        data.timeslots[property].forEach(el => {
          el.isAvailable ? counter++ : 0
        })
      }
      console.log(counter, name, '2')
      if (counter == 0) {
        subs[id] = subs2[id]
        delete subs2[id]
        updateSubs()
      }
    } catch (err) {
      console.log('ERR doCheck2', err.message)
    }
  }
}

async function getSlots(id) {
  if (!history[id] || Date.now() - history[id].time > 500) {
    const res = await axios(`https://mojtermin.mk/api/pp/resources/${id}/slots_availability`, {
      signal: AbortSignal.timeout(4000)
    })
    history[id] = {
      data: res.data,
      time: Date.now()
    }
    // updateAvailability(data)
    return res.data
  } else {
    return history[id].data
  }
}

function notify(id, name) {
  subs[id].forEach(el => {
    const subject = `${name} има нови термини`
    const plain = `${name} има нови термини:
https://sfiw.onrender.com/termini/slots.html?id=${id}


За да го исклучите известувањето:
https://sfiw.onrender.com/termini/unsub?id=${id}&email=${el.email}&code=${el.code}`
    sendMaileroo(el.email, subject, plain)
    // console.log('mock send email ', subject,el.email)
  })
}

function sendMaileroo(to, subject, plain) {
  const config = {
    "from": {
      "address": "sfiw@546efd10e8c3419e.maileroo.org",
      "display_name": "sfiw.onrender.com"
    },
    "to": [{
      "address": to
    }],
    "subject": subject,
    "plain": plain
  }
  axios.post('https://smtp.maileroo.com/api/v2/emails', config, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": '096308984c35ee8ed28cb5c34ecd5d34f71ce1fb522d1cf282d064e9ec9cab6f'
      }
    })
    .then(res => console.log('maileroo', res.status))
    .catch(err => console.log('ERR maileroo ', err.message))
}

function filterSubs(req, res) {
  let list = []
  if (!req.query.email) {
    return
  }
  for (property in subs) {
    subs[property].forEach(el => {
      if (el.email == req.query.email) {
        let url = `https://sfiw.onrender.com/unsub?id=${property}&email=${req.query.email}&code=${el.code}`
        list.unshift({ name: IDinfo(property).name, url: url })
      }
    })
  }
  res.send(list)
}

async function updateDB() {
  setTimeout(updateDB, 1000 * 60 * 15)
  if (!shouldCheck()) {
    return
  }
  try {
    const res = await axios('https://mojtermin.mk/api/pp/side_navigation')
    const data = res.data
    const newDb = []
    data[0].subsections.forEach(specijalnost => {
      specijalnost.subsections.forEach(lokacija => {
        lokacija.subsections.forEach(ustanova => {
          ustanova.subsections.forEach(doktor => {
            newDb.push({
              id: doktor.id,
              name: doktor.name,
              specialty: specijalnost.name,
              hospital: ustanova.name,
              location: lokacija.name,
              availability: doktor.value,
              lastChecked: Date.now()
            })
          })
        })
      })
    });
    data[1].subsections.forEach(tip => {
      tip.subsections.forEach(lokacija => {
        lokacija.subsections.forEach(ustanova => {
          ustanova.subsections.forEach(aparat => {
            newDb.push({
              id: aparat.id,
              name: aparat.name,
              specialty: tip.name,
              hospital: ustanova.name,
              location: lokacija.name,
              availability: aparat.value,
              lastChecked: Date.now()
            })
          })
        })
      })
    });
    db = [...newDb]
    fs.writeFileSync('public/db.json', JSON.stringify(db))
  } catch (err) {
    console.log('ERR updateDB', err.message)
  }
}

function updateSubs() {
  fs.writeFileSync('subs.json', JSON.stringify(subs))
  fs.writeFileSync('subs2.json', JSON.stringify(subs2))
  axios.put('https://api.jsonbin.io/v3/b/6a96b3a9da38895dfe2a8a82', {
      subs: subs,
      subs2: subs2
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': '$2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK'
      }
    })
    .then(res => console.log('updateSubs', res.status))
    .catch(err => console.log('ERR updateSubs', err.message))
}


function readSubs() {
  axios('https://api.jsonbin.io/v3/b/6a96b3a9da38895dfe2a8a82', {
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': '$2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK'
      }
    })
    .then(res => {
      subs = res.data.record.subs
      subs2 = res.data.record.subs2
      fs.writeFileSync('subs.json', JSON.stringify(subs))
      fs.writeFileSync('subs2.json', JSON.stringify(subs2))
      console.log('readSubs', res.status)
    })
    .catch(err => console.log('ERR readSubs', err.message))
}

function IDinfo(id) {
  let info
  db.forEach(el => {
    if (el.id == id) {
      info = {
        name: el.name,
        specialty: el.specialty,
        location: el.location,
        hospital: el.hospital,
        availability: el.availability,
        lastChecked: el.lastChecked
      }
    }
  })
  return info
}

function updateAvailability(data) {
  db.forEach(el => {
    if (el.id == data.id) {
      el.availability = availability
      console.log(el.name, ' new avail ', availability)
    }
  })
}

function firstAvailable(data) {
  let first
  for (property in data.timeslots) {
    data.timeslots[property].forEach(el => {
      if (el.isAvailable) {

      }
    })
  }
}

function daysToDate(days) {
  const today = new Date()
  today.setDate(today.getDate() + days)
  return today
}

function dateToDays(date) {
  const today = new Date()
  const target = new Date(date)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return (target - today) / 86400000
}

function shouldCheck() {
  const day = new Date().getDay()
  const hour = new Date().getHours()
  const minute = new Date().getMinutes()
  if (!day || hour < 6 || hour > 19) {
    return false
  } else {
    return true
  }
}

setInterval(function() {
  axios('https://sfiw.onrender.com')
    .then(res => res)
    .catch(err => err)
}, 454938)

setInterval(function() {
  axios('https://sfiw.onrender.com')
    .then(res => res)
    .catch(err => err)
}, 834782)

// $2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK key
// 6a96b3a9da38895dfe2a8a82 bin1
// 6a96b3bbda38895dfe2a8ae2 bin2
// 6a96b3c6f5f4af5e295c148c bin3
// 6a96b3d2f5f4af5e295c14db bin4
// 6a96b3e9da38895dfe2a8bc9 bin5


///////////////////////////////////////////////////////chatu
app.use(express.static('other'))

let users, followed
app.get('/chatu', (req, res) => routeChatu(req, res))

readFollowed()

function routeChatu(req, res) {
  try {
    if (req.query.data) {
      users = JSON.parse(req.query.data).users
      followed = JSON.parse(req.query.data).followed
      res.send(followed)
    } else {
      res.send('u lost?')
    }
  } catch (err) {
    console.log('ERR routeChatu', err.message)
  }
}

function checkFollowed() {
  followed.forEach(el => {
    axios(`https://jpeg.live.mmcdn.com/stream?room=${el}&f=${Math.random()}`, {
        signal: AbortSignal.timeout(4000)
      })
      .then(res => {
        console.log(el, res.status)
        if (res.status == 200) {
          sendMaileroo('sfiw@proton.me', `${el} is online`, `${el} is online:
https://chaturbate.com/${el}`)
          // console.log('mock notify', el)
          followed = followed.filter(elt => elt !== el)
          updateFollowed()
        }
      })
      .catch(err => console.log('ERR checkFollowed', err.message))
  })
}

function readFollowed() {
  axios('https://api.jsonbin.io/v3/b/6a96b3e9da38895dfe2a8bc9', {
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': '$2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK'
      }
    })
    .then(res => {
      followed = res.data.record.followed
      users = res.data.record.users
      checkFollowed()
      setInterval(checkFollowed, 1000 * 60)
    })
    .catch(err => console.log('ERR readFollowed', err.message))
}

function updateFollowed() {
  axios.put('https://api.jsonbin.io/v3/b/6a96b3e9da38895dfe2a8bc9', {
      users,
      followed
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': '$2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK'
      }
    })
    .then(res => res)
    .catch(err => console.log('ERR readFollowed', err.message))
}