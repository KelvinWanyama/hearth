'use strict'

const tap = require('tap')

const server = require('../lib/server')
const env = require('./test-env/init')()
const config = require('../lib/config')

let createWorkersTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      test(db, () => {
        env.clearDB((err) => {
          t.error(err)
          server.stop(() => {
            t.end()
          })
        })
      })
    })
  })
}

tap.test('should start a configurable amount of workers to read off the queue', (t) => {
  config.setConf('matchingQueue:numberOfWorkers', 5)
  createWorkersTest(t, (db, done) => {
    t.equal(Object.keys(server.workers).length, 5)
    done()
  })
})

tap.test('should be able to shutdown workers', (t) => {
  config.setConf('matchingQueue:numberOfWorkers', 5)
  createWorkersTest(t, (db, done) => {
    server.workers[Object.keys(server.workers)[0]].kill('SIGINT')
    t.equal(server.workers[Object.keys(server.workers)[0]].killed, true)
    t.equal(server.workers[Object.keys(server.workers)[1]].killed, false)
    t.equal(server.workers[Object.keys(server.workers)[2]].killed, false)
    t.equal(server.workers[Object.keys(server.workers)[3]].killed, false)
    t.equal(server.workers[Object.keys(server.workers)[4]].killed, false)
    t.equal(Object.keys(server.workers).length, 5)
    done()
  })
})
