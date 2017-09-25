var express = require('express');
var fetch = require('node-fetch');
var https = require('https');
require('dotenv').config();
var parseString = require('xml2js').parseString;
var app = express();
console.log(process.env["GOODREADS_KEY"]);
const key = process.env["GOODREADS_KEY"] || ENV["GOODREADS_KEY"];



var zlib = require('zlib');

// app.use(require('express-decompress').create());

app.get('/', function (req, res) {
        const id = req.query.id;
        const shelf = req.query.shelf;
        const sort = req.query.sort;
        const perPage = req.query.per_page;

        var reviews = null;
        // console.log(req.query);
        https.get("https://www.goodreads.com/review/list?v=2&id=" + id + "&shelf=" + shelf + 
            "&sort=" + sort + "&key=" + key + "&per_page=" + perPage, 
            (response) => {
                console.log(response);
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