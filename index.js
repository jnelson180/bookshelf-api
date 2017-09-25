var express = require('express');
var fetch = require('node-fetch');
var https = require('https');
var parseString = require('xml2js').parseString;
var app = express();
var keys = require('./keys');
var zlib = require('zlib');

// app.use(require('express-decompress').create());

app.get('/', function (req, res) {
        const id = req.query.id;
        const shelf = req.query.shelf;
        const sort = req.query.sort;
        const key = keys.key;
        const perPage = req.query.per_page;
        
        var reviews = null;
        // console.log(req.query);
        https.get("https://www.goodreads.com/review/list?v=2&id=" + id + "&shelf=" + shelf + 
            "&sort=" + sort + "&key=" + keys.key + "&per_page=" + perPage, 
            (response) => {
                response.setEncoding('utf8');
                let rawData = '';
                response.on('data', (chunk) => { rawData += chunk; });
                response.on('end', () => {
                    try {
                        parseString(rawData, function (err, r) {
                            let rev = r.GoodreadsResponse.reviews[0].review;
                            console.dir(rev);
                            reviews = rev;
                            res.send(rev);
                        });
                    } catch (e) {
                    console.error('e:', e.message);
                    }
                });
            }).on('error', (e) => {
                res.send(reviews);
            console.error(`Got error: ${e.message}`);
            });
    });
        

app.listen(3000);