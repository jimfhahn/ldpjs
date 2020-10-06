'esversion: 8';

const express = require('express');
const bodyParser= require('body-parser');
var mongodb = require('mongodb');

var config = require("./config/index");

var Get = require("./api/get");
var Put = require("./api/Put");
var Post = require("./api/Post");
var Delete = require("./api/Delete");

var AdminIndexes = require("./admin/Indexes");

const ldp = express();

ldp.use(bodyParser.urlencoded({ extended: true }));

ldp.use(bodyParser.text({ type: 'application/ld+json' }));
ldp.use(bodyParser.text({ type: 'application/json' }));

ldp.use(bodyParser.text({ type: 'text/plain' }));
ldp.use(bodyParser.text({ type: 'application/n-triples' }));
ldp.use(bodyParser.text({ type: 'text/n3' }));
ldp.use(bodyParser.text({ type: 'application/n3' }));
ldp.use(bodyParser.text({ type: 'text/turtle' }));

ldp.use(bodyParser.text({ type: 'application/rdf+xml' }));
ldp.use(bodyParser.text({ type: 'application/xml' }));

const MongoClient = require('mongodb').MongoClient;
var db, collection;

ldp.setConfig = function(overlay_config) {
    if (overlay_config.indexes !== undefined && overlay_config.indexes.length > 0) {
        Object.assign(config.indexes, overlay_config.indexes);
    }
    config = Object.assign(config, overlay_config);
};

MongoClient.connect(config.mongodb.conn, function(err, client) {
    if(err) throw err;

    db = client.db(config.mongodb.db);
    collection = db.collection(config.mongodb.collection, function(err, collection) {});
    
    config._db = db;
    config._collection = collection;
  
    var uri = 'info:lc/';
    var docuri = '/root.json';
    collection.findOne( { docuri: { $exists: true, $eq: docuri } } )
        .then(doc => {
            if (!doc) {
                console.log("Root document not found.  Creating.");
                var dt = new Date().toISOString(),
                rootdoc = {
                    'uri': uri,
                    'docuri': docuri,
                    'created': dt,
                    'modified': dt,
                    'index': {},
                    'versions': [
                        {
                            v_created: dt,
                            mimeType: "application/ld+json",
                            ldpTypes: ["<http://www.w3.org/ns/ldp#BasicContainer>"],
                            content: {
                                "@context": config.context,
                                "@graph": [
                                    {
                                        "@id": "info:lc/",
                                        "dcterms:title": "LDP Server"
                                    }
                                ]
                            }
                        }
                    ]
                };  
                collection.insertOne(rootdoc, {})
                    .then(result => {
                        console.log("Root document created.");
                        
                        collection.dropIndexes()
                            .then(results => {
                                console.log(results);
                            })
                            .catch(err => {
                                throw err;
                            });
                        var indexes = config.indexes;
                        collection.createIndexes(indexes, {})
                            .then(results => {
                                if (results.ok) {
                                    console.log("Indexes created")
                                } else {
                                    console.log("WARNING: Indexes not created.");
                                }
                            console.log(results);
                            })
                            .catch(err => {
                                throw err;
                            });
                    })
                    .catch(err => {
                        throw err;
                    });
            }
        })
        .catch(function (err) {
            throw err;
        });

    var admin = new AdminIndexes(config);
    ldp.get('/admin/indexes', (req, res) => {
        admin.showIndexes(req, res);
    });
    ldp.post('/admin/indexes', (req, res) => {
        admin.createIndexes(req, res);
    });
    ldp.delete('/admin/indexes', (req, res) => {
        admin.deleteIndexes(req, res);
    });

    ldp.get('/*', (req, res) => {
        var api = new Get(config);
        api.process(req, res);
    });
     
    ldp.post('/*', (req, res) => {
        var api = new Post(config);
        api.process(req, res);
    });
     
    ldp.put('/*', (req, res) => {
        var api = new Put(config);
        api.process(req, res);
    });
         
    ldp.delete('/*', (req, res) => {
        var api = new Delete(config);
        api.process(req, res);
    });
    
});

module.exports = ldp;