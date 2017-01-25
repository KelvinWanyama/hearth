'use strict'

const tap = require('tap')
const env = require('./test-env/init')()
const server = require('../lib/server')
const request = require('request')
const ObjectID = require('mongodb').ObjectID

const Transaction = require('../lib/fhir/transaction')
const testBundle = require('./resources/Transaction-1.json')

tap.test('Transaction resource .sortTransactionBundle() should sort interactions correctly', (t) => {
  // given
  const transaction = Transaction()
  // when
  let sortedBundle = transaction.sortTransactionBundle(testBundle)
  // then
  t.ok(sortedBundle)
  t.equals(sortedBundle.entry.length, testBundle.entry.length, 'should have the same number of entries as the original bundle')
  t.equals(sortedBundle.entry[0].request.method, 'DELETE')
  t.equals(sortedBundle.entry[1].request.method, 'DELETE')
  t.equals(sortedBundle.entry[2].request.method, 'POST')
  t.equals(sortedBundle.entry[3].request.method, 'POST')
  t.equals(sortedBundle.entry[4].request.method, 'POST')
  t.equals(sortedBundle.entry[5].request.method, 'PUT')
  t.equals(sortedBundle.entry[6].request.method, 'PUT')
  t.equals(sortedBundle.entry[7].request.method, 'PUT')
  t.equals(sortedBundle.entry[8].request.method, 'GET')
  t.equals(sortedBundle.entry[9].request.method, 'GET')
  t.end()
})

tap.test('Transaction resource .sortTransactionBundle() should do nothing on an empty bundle', (t) => {
  // given
  const transaction = Transaction()
  // when
  let sortedBundle = transaction.sortTransactionBundle({
    type: 'transaction',
    entry: []
  })
  // then
  t.ok(sortedBundle)
  t.equals(sortedBundle.entry.length, 0)
  t.end()
})

tap.test('Transaction resource .sortTransactionBundle() should throw an error if request.method isn\'t specified', (t) => {
  t.plan(1)
  // given
  const transaction = Transaction()
  // when and then
  t.throws(() => {
    transaction.sortTransactionBundle({
      type: 'transaction',
      entry: [
        {
          request: {
            method: 'PUT'
          }
        },
        { /* fail */ },
        {
          request: {
            method: 'POST'
          }
        }
      ]
    })
  }, {}, 'should throw an error object')
})

tap.test('Transaction resource .sortTransactionBundle() should throw and error if the Bundle.type isn\'t \'transaction\'', (t) => {
  t.plan(1)
  // given
  const transaction = Transaction()
  // when and then
  t.throws(() => {
    transaction.sortTransactionBundle({
      type: 'Meh',
      entry: []
    })
  }, /Bundle is not of type transaction/, 'should throw the correct error')
})

tap.test('Transaction resource .revertUpdate() should remove a newly updated resource', (t) => {
   env.initDB((err, db) => {
     t.error(err)
     
     server.start((err) => {
       t.error(err)
       
       // create a new patient
       const resourceType = 'Patient'
       const patients = env.testPatients()
       env.createPatient(t, patients.charlton, () => {
         const idToUpdate = patients.charlton.patient.id
         const transaction = Transaction(env.mongo())
         
         let c = db.collection(resourceType)
         c.findOne({ _id: ObjectID(idToUpdate) }, {}, (err, doc) => {
           t.error(err)
           t.equals('' + doc._id, idToUpdate, 'Patient has been created')
           
           // update the created patient
           patients.charlton.patient.telecom[0].value = 'charliebrown@fanmail.com'
           request.put({
             url: `http://localhost:3447/fhir/${resourceType}/${idToUpdate}`,
             body: patients.charlton.patient,
             headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
             json: true
           }, (err, res) => {
             t.error(err)
             t.equal(res.statusCode, 200)
             t.equal(res.body, 'OK')
             
             c.findOne({ _id: ObjectID(idToUpdate) }, {}, (err, doc) => {
               t.error(err)
               t.equals(doc.latest.telecom[0].value, 'charliebrown@fanmail.com', 'Patient has been updated')
             
               // revert the update
               const idToRevert = idToUpdate
               transaction.revertUpdate(resourceType, idToRevert, (err, success) => {
                 t.error(err)
                 t.true(success, 'should respond with success status as true')
                 
                 c.findOne({ _id: ObjectID(idToRevert) }, {}, (err, doc) => {
                   t.error(err)
                   t.equals(doc.latest.telecom[0].value, 'charlton@email.com', 'Patient update has been reverted')
                   t.equals(doc.history, undefined, 'Resource history has been reverted')
       
                   request({
                     url: `http://localhost:3447/fhir/Patient/${idToRevert}`,
                     headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
                     json: true
                   }, (err, res) => {
                     t.error(err)
                     t.equal(res.statusCode, 200, 'resource should be available')
         
                     env.clearDB((err) => {
                       t.error(err)
                       server.stop(() => {
                         t.end()
                       })
                     })
                   })
                 })
               })
             })
           })
         })
       })
     })
   })
 })
 
 tap.test('Transaction resource .revertUpdate() should respond with success=false if unknown resource', (t) => {
    env.initDB((err, db) => {
      t.error(err)
      const transaction = Transaction(env.mongo())
      transaction.revertUpdate('Patient', '5aaaaaaaaaaaaaaaaaaaaaaa', (err, success) => {
        t.error(err)
        t.false(success, 'should respond with success status as false')
  
        env.clearDB((err) => {
          t.error(err)
          t.end()
        })
      })
    })
  })
