const fs = require("fs")
const axios = require("axios")
const express = require("express")
const app = express()
let db = JSON.parse(fs.readFileSync("public/db.json", "utf8"))
let subs = JSON.parse(fs.readFileSync("subs.json", "utf8"))
let subs2 = JSON.parse(fs.readFileSync("subs2.json", "utf8"))
let history = {}

app.use("/termini", express.static("public"))
app.get("/termini/slots", (req, res) => routeSlots(req, res))
app.get("/termini/sub", (req, res) => routeSub(req, res))
app.get("/termini/unsub", (req, res) => routeUnsub(req, res))

// Log heap memory in MB every x seconds
setInterval(() => {
  const usedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
  console.log(`Memory: ${usedMB} MB`)
}, 60000).unref() // .unref() lets Node exit cleanly if the main loop stops

app.listen(3000, () => {
  console.log(`Server is running on port 3000...`)
  readSubs()
  updateDB()
  check()
  check2()
})

async function routeSlots(req, res) {
  try {
    const data = await getSlots(req.query.id)
    res.send(data)
  } catch (err) {
    console.log("ERR routeSlots", err.message)
    res.status(400).send()
  }
}

function routeSub(req, res) {
  const { id, code, email } = req.query
  if (email && code && IDinfo(id) && !alreadySub()) {
    subs[id] ? subs[id].push({ email, code }) : (subs[id] = [{ email, code }])
    updateSubs()
    console.log("+1 sub ", IDinfo(id)?.name, email)
  }
  res.send("ok")

  function alreadySub() {
    let isIt = false
    if (subs[id]) {
      subs[id].forEach((el) => {
        email == el.email ? (isIt = true) : 0
      })
    }
    if (subs2[id]) {
      subs2[id].forEach((el) => {
        email == el.email ? (isIt = true) : 0
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
        console.log("-1 sub ", IDinfo(id)?.name, email)
      }
    })
  }
  if (subs2[id]) {
    subs2[id].forEach((el, index) => {
      if (el.email == email && el.code == code) {
        subs2[id].splice(index, 1)
        subs2[id].length == 0 ? delete subs2[id] : 0
        updateSubs()
        console.log("-1 sub", IDinfo(id)?.name, email)
      }
    })
  }
  res.send('<h1>ok</h1><title>Исклучено</title><script>alert("Исклучено")</script>')
}

// async function iterate() {
//   const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
//   const IDs = Object.keys(subs)

//   if (IDs.length && shouldCheck()) {
//     await fetchAll()
//     iterate()
//   } else {
//     setTimeout(iterate, 1000)
//   }

//   async function fetchAll() {
//     for (const id of IDs) {
//       if (!subs[id]) continue;
//       getSlots(id)
//         .then(data => check(data))
//         .catch(err => console.log('ERR fetchAll', IDinfo(id).name, err.message))
//       await wait(2000);
//     }
//   }

//   function check(data) {
//     try {
//       const name = data.name.slice(0, 60)
//       const id = data.id
//       let counter = 0
//       for (property in data.timeslots) {
//         data.timeslots[property].forEach(el => {
//           el.isAvailable ? counter++ : 0
//         })
//       }
//       console.log(counter, name)
//       if (counter > 1) {
//         notify(id, name)
//         subs2[id] = subs[id]
//         delete subs[id]
//         updateSubs()
//       }
//     } catch (err) {
//       console.log('ERR check', err.message)
//     }
//   }
// }

// const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// async function iterate() {
//   while (true) {
//     const IDs = Object.keys(subs);

//     if (IDs.length && shouldCheck()) {
//       await fetchAll(IDs);
//     } else {
//       await wait(1000);
//     }
//   }
// }

// async function fetchAll(IDs) {
//   for (const id of IDs) {
//     if (!subs[id]) continue;
//     getSlots(id)
//       .then((data) => check(data))
//       .catch((err) => console.log('ERR fetchAll', IDinfo(id)?.name, err.message));
//     await wait(2000);
//   }
// }

// function check(data) {
//   try {
//     const name = data.name.slice(0, 60);
//     const id = data.id;
//     let counter = 0;
//     for (const property in data.timeslots) {
//       data.timeslots[property].forEach((el) => {
//         if (el.isAvailable) counter++;
//       });
//     }
//     console.log(counter, name);
//     if (counter > 1) {
//       notify(id, name);
//       subs2[id] = subs[id];
//       delete subs[id];
//       updateSubs();
//     }
//   } catch (err) {
//     console.log('ERR check', err.message);
//   }
// }

// // Start the loop
// iterate();

function check() {
  let index = 0
  const IDs = Object.keys(subs)
  IDs.length && shouldCheck() ? doCheck() : setTimeout(check, 1000)

  async function doCheck() {
    if (index == IDs.length) {
      console.log("done")
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
      for (const property in data.timeslots) {
        data.timeslots[property].forEach((el) => {
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
      console.log("ERR doCheck", err.message)
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
    setTimeout(doCheck2, 1000 * 60 * 14)
    try {
      const data = await getSlots(id)
      const name = data.name.slice(0, 60)
      let counter = 0
      for (const property in data.timeslots) {
        data.timeslots[property].forEach((el) => {
          el.isAvailable ? counter++ : 0
        })
      }
      console.log(counter, name, "2")
      if (counter == 0) {
        subs[id] = subs2[id]
        delete subs2[id]
        updateSubs()
      }
    } catch (err) {
      console.log("ERR doCheck2", err.message)
    }
  }
}

async function getSlots(id) {
  if (!history[id] || Date.now() - history[id].time > 1000) {
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
  subs[id].forEach((el) => {
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
    from: {
      address: "sfiw@546efd10e8c3419e.maileroo.org",
      display_name: "sfiw.onrender.com"
    },
    to: [
      {
        address: to
      }
    ],
    subject: subject,
    plain: plain
  }
  axios
    .post("https://smtp.maileroo.com/api/v2/emails", config, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": "096308984c35ee8ed28cb5c34ecd5d34f71ce1fb522d1cf282d064e9ec9cab6f"
      }
    })
    .then((res) => console.log("maileroo", res.status))
    .catch((err) => console.log("ERR maileroo ", err.message))
}

// function filterSubs(req, res) {
//   let list = []
//   if (!req.query.email) {
//     return
//   }
//   for (const property in subs) {
//     subs[property].forEach((el) => {
//       if (el.email == req.query.email) {
//         let url = `https://sfiw.onrender.com/termini/unsub?id=${property}&email=${req.query.email}&code=${el.code}`
//         list.unshift({ name: IDinfo(property).name, url: url })
//       }
//     })
//   }
//   res.send(list)
// }

async function updateDB() {
  setTimeout(updateDB, 1000 * 60 * 15)
  if (!shouldCheck()) {
    return
  }
  console.log("updating DB...")
  try {
    const res = await axios("https://mojtermin.mk/api/pp/side_navigation")
    const data = res.data
    const newDb = []
    data[0].subsections.forEach((specijalnost) => {
      specijalnost.subsections.forEach((lokacija) => {
        lokacija.subsections.forEach((ustanova) => {
          ustanova.subsections.forEach((doktor) => {
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
    })
    data[1].subsections.forEach((tip) => {
      tip.subsections.forEach((lokacija) => {
        lokacija.subsections.forEach((ustanova) => {
          ustanova.subsections.forEach((aparat) => {
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
    })
    db = [...newDb]
    fs.writeFileSync("public/db.json", JSON.stringify(db))
    console.log("updateDB", res.status)
  } catch (err) {
    console.log("ERR updateDB", err.message)
  }
}

function updateSubs() {
  fs.writeFileSync("subs.json", JSON.stringify(subs))
  fs.writeFileSync("subs2.json", JSON.stringify(subs2))
  axios
    .put(
      "https://api.jsonbin.io/v3/b/6a96b3a9da38895dfe2a8a82",
      {
        subs: subs,
        subs2: subs2
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": "$2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK"
        }
      }
    )
    .then((res) => console.log("updateSubs", res.status))
    .catch((err) => console.log("ERR updateSubs", err.message))
}

function readSubs() {
  console.log("reading subs...")
  axios("https://api.jsonbin.io/v3/b/6a96b3a9da38895dfe2a8a82", {
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": "$2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK"
    }
  })
    .then((res) => {
      subs = res.data.record.subs
      subs2 = res.data.record.subs2
      fs.writeFileSync("subs.json", JSON.stringify(subs))
      fs.writeFileSync("subs2.json", JSON.stringify(subs2))
      console.log("readSubs", res.status)
    })
    .catch((err) => console.log("ERR readSubs", err.message))
}

function IDinfo(id) {
  let info
  db.forEach((el) => {
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

// function updateAvailability(data) {
//   db.forEach((el) => {
//     if (el.id == data.id) {
//       el.availability = availability
//       console.log(el.name, " new avail ", availability)
//     }
//   })
// }

// function firstAvailable(data) {
//   let first
//   for (const property in data.timeslots) {
//     data.timeslots[property].forEach((el) => {
//       if (el.isAvailable) {
//       }
//     })
//   }
// }

// function daysToDate(days) {
//   const today = new Date()
//   today.setDate(today.getDate() + days)
//   return today
// }

// function dateToDays(date) {
//   const today = new Date()
//   const target = new Date(date)
//   today.setHours(0, 0, 0, 0)
//   target.setHours(0, 0, 0, 0)
//   return (target - today) / 86400000
// }

function shouldCheck() {
  const day = new Date().getDay()
  const hour = new Date().getHours()
  if (!day || hour < 6 || hour > 19) {
    return false
  } else {
    return true
  }
}

setInterval(function () {
  axios("https://sfiw.onrender.com")
    .then((res) => res)
    .catch((err) => err)
}, 454938)

setInterval(function () {
  axios("https://sfiw.onrender.com")
    .then((res) => res)
    .catch((err) => err)
}, 834782)

// $2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK key
// 6a96b3a9da38895dfe2a8a82 bin1
// 6a96b3bbda38895dfe2a8ae2 bin2
// 6a96b3c6f5f4af5e295c148c bin3
// 6a96b3d2f5f4af5e295c14db bin4
// 6a96b3e9da38895dfe2a8bc9 bin5

///////////////////////////////////////////////////////chatu
app.use(express.static("other"))

let followed = []

app.get("/chatu", (req, res) => routeChatu(req, res))

readFollowed()
checkFollowed()
setInterval(checkFollowed, 1000 * 5)

function routeChatu(req, res) {
  try {
    if (req.query.f) {
      followed.unshift(req.query.f)
      followed = [...new Set(followed)]
      updateFollowed()
    } else if (req.query.u) {
      followed = followed.filter((el) => el !== req.query.u)
      updateFollowed()
    } else if (req.query.l) {
      res.send(followed)
      return
    }
    res.send("ok")
  } catch (err) {
    console.log("ERR routeChatu", err.message)
    res.status(400).send("invalid data")
  }
}

async function readFollowed() {
  return axios("https://api.jsonbin.io/v3/b/6a96b3d2f5f4af5e295c14db", {
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": "$2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK"
    }
  })
    .then((res) => {
      followed = res.data.record
    })
    .catch((err) => console.log("ERR readFollowed", err.message))
}

function checkFollowed() {
  followed = followed.filter((el) => el !== "dummy")
  followed.forEach((el) => {
    axios(`https://jpeg.live.mmcdn.com/stream?room=${el}&f=${Math.random()}`, {
      signal: AbortSignal.timeout(4000)
    })
      .then((res) => {
        console.log(el, res.status)
        if (res.status == 200 && followed.includes(el)) {
          // console.log("mock notify", el)
          sendMaileroo(
            "sfiw@proton.me",
            `${el} is online`,
            `${el} is online:
          https://chaturbate.com/${el}`
          )
          followed = followed.filter((elt) => elt !== el)
          updateFollowed()
        }
      })
      .catch((err) => console.log("ERR checkFollowed", err.message))
  })
}

function updateFollowed() {
  if (!followed.length) {
    followed.push("dummy")
  }
  axios
    .put("https://api.jsonbin.io/v3/b/6a96b3d2f5f4af5e295c14db", followed, {
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": "$2a$10$HKvQ2eV1Hypp05KcTnfD4Ot/VvlNBykosM8cShL/K8Evz0nFL/PnK"
      }
    })
    .then((res) => res)
    .catch((err) => console.log("ERR updateFollowed", err.message))
}
